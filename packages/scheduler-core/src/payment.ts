import { Transaction } from '@mysten/sui/transactions';
import { getClockId, type SchedulerContext } from './context.js';
import type { DiscoveredSubscription } from './discovery.js';
import { classifyPayment } from './routing.js';

/** One settled payment, in the order it was executed. */
export interface PaymentSuccess {
  accountId: string;
  platformId: string;
  digest: string;
  /** Amount billed this cycle, in the settlement currency's smallest unit. */
  amount: bigint;
  /** true if the payment went through the DeepBook-routed path. */
  routed: boolean;
}

export interface PaymentSkip {
  accountId: string;
  reason: 'unroutable' | 'no-routed-executor';
}

export interface PaymentFailure {
  accountId: string;
  error: string;
}

/**
 * Outcome of one batch of due payments. `processDuePayments` never throws
 * on an individual failure — one bad account must not abort the rest of
 * the cycle — so the caller gets the breakdown back instead of only the
 * digests, which is also what lets a host surface earnings and recent
 * activity without re-reading the chain.
 */
export interface PaymentRunResult {
  succeeded: PaymentSuccess[];
  skipped: PaymentSkip[];
  failed: PaymentFailure[];
}

export async function processDuePayments(
  ctx: SchedulerContext,
  subscriptions: DiscoveredSubscription[],
): Promise<PaymentRunResult> {
  const result: PaymentRunResult = { succeeded: [], skipped: [], failed: [] };
  const schedulerAddress = ctx.senderAddress;
  const clockId = getClockId(ctx);

  for (const sub of subscriptions) {
    const classification = classifyPayment(sub, ctx.routingAllowlist);

    if (classification.kind === 'unroutable') {
      // Currency mismatch, and the platform hasn't opted this funding
      // currency into the routing allowlist. Skip rather than fall
      // through to the plain path below, which would otherwise silently
      // credit the platform in the wrong coin (process_due_payment never
      // checks the account's coin type against the tier's declared
      // denomination on-chain).
      console.log(`[Payment] Skipping ${sub.accountId}: holds ${sub.denomination}, platform ${sub.platformId} settles in ${sub.settlementDenomination} and has not opted in for this funding currency`);
      result.skipped.push({ accountId: sub.accountId, reason: 'unroutable' });
      continue;
    }

    if (classification.kind === 'routed') {
      if (!ctx.routedPaymentExecutor) {
        // The host opted this pair into routing but didn't wire a routed
        // executor (e.g. a build that deliberately excludes DeepBook).
        // Same fail-safe as 'unroutable': leave it unpaid, never mispaid.
        console.log(`[Payment] Skipping ${sub.accountId}: routed payment required but no routed executor is configured`);
        result.skipped.push({ accountId: sub.accountId, reason: 'no-routed-executor' });
        continue;
      }
      try {
        console.log(`[Payment] Routing ${sub.accountId} via DeepBook: ${sub.denomination} -> ${sub.settlementDenomination}`);
        const digest = await ctx.routedPaymentExecutor(sub, classification.pool);
        console.log(`[Payment] Routed success: ${digest}`);
        result.succeeded.push({
          accountId: sub.accountId,
          platformId: sub.platformId,
          digest,
          amount: sub.tierAmount,
          routed: true,
        });
      } catch (err: any) {
        console.error(`[Payment] Routed payment failed for ${sub.accountId}:`, err);
        result.failed.push({ accountId: sub.accountId, error: err?.message || String(err) });
      }
      continue;
    }

    try {
      console.log(`[Payment] Processing for Account: ${sub.accountId}`);
      const tx = new Transaction();

      const limiters = tx.moveCall({
        target: `${ctx.packageId}::policies::empty_limiters`,
        arguments: [tx.object(clockId)],
      });

      tx.moveCall({
        target: `${ctx.packageId}::policies::ensure_initialized`,
        typeArguments: [sub.denomination],
        arguments: [tx.object(sub.accountId), limiters, tx.object(clockId)],
      });

      tx.moveCall({
        target: `${ctx.packageId}::scheduler::process_due_payment`,
        typeArguments: [sub.denomination],
        arguments: [
          tx.object(ctx.registryId),
          tx.object(ctx.paymentSchedulerId),
          tx.object(sub.platformId),
          tx.object(sub.accountId),
          limiters,
          tx.object(clockId),
        ],
      });

      tx.setSender(schedulerAddress);

      const coins = await ctx.grpcClient.core.listCoins({ owner: schedulerAddress, coinType: '0x2::sui::SUI' });
      const largestCoin = coins.objects.sort((a: any, b: any) => Number(BigInt(b.balance) - BigInt(a.balance)))[0];
      if (!largestCoin) {
        throw new Error(`Unable to perform gas selection due to insufficient SUI balance for scheduler address ${schedulerAddress}`);
      }
      tx.setGasPayment([{
        objectId: largestCoin.objectId,
        version: largestCoin.version,
        digest: largestCoin.digest,
      }]);
      tx.setGasBudget(50000000);

      const bytes = await tx.build({ client: ctx.grpcClient });
      const { signature } = await ctx.signer.signTransaction(bytes);

      const execution = await ctx.grpcClient.core.executeTransaction({
        transaction: bytes,
        signatures: [signature],
        include: { effects: true },
      });

      if (execution.$kind === 'FailedTransaction') {
        throw new Error(`Failed execution: ${execution.FailedTransaction.status.error?.message}`);
      }

      const digest = execution.Transaction.digest;
      await ctx.grpcClient.waitForTransaction({ digest });

      console.log(`[Payment] Success: ${digest}`);
      result.succeeded.push({
        accountId: sub.accountId,
        platformId: sub.platformId,
        digest,
        amount: sub.tierAmount,
        routed: false,
      });
    } catch (err: any) {
      console.error(`[Payment] Failed for ${sub.accountId}:`, err);
      result.failed.push({ accountId: sub.accountId, error: err?.message || String(err) });
    }
  }

  return result;
}
