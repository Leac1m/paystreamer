import { Transaction } from '@mysten/sui/transactions';
import { grpcClient, getSchedulerKeypair, getSchedulerAddress } from '../lib/sui.js';
import { PACKAGE_ID, PAYMENT_SCHEDULER_ID, REGISTRY_ID, CLOCK_OBJECT_ID } from '../lib/config.js';
import { DiscoveredSubscription } from './discovery.js';
import { classifyPayment } from './routing.js';
import { processRoutedPayment } from './routedPayment.js';

export async function processDuePayments(subscriptions: DiscoveredSubscription[]): Promise<string[]> {
  const digests: string[] = [];
  const schedulerAddress = getSchedulerAddress();
  const schedulerKeypair = getSchedulerKeypair();

  for (const sub of subscriptions) {
    const classification = classifyPayment(sub);

    if (classification.kind === 'unroutable') {
      // Currency mismatch, and the platform hasn't opted this funding
      // currency into ROUTING_ALLOWLIST_JSON. Skip rather than fall
      // through to the plain path below, which would otherwise silently
      // credit the platform in the wrong coin (process_due_payment never
      // checks the account's coin type against the tier's declared
      // denomination on-chain).
      console.log(`[Payment] Skipping ${sub.accountId}: holds ${sub.denomination}, platform ${sub.platformId} settles in ${sub.settlementDenomination} and has not opted in for this funding currency`);
      continue;
    }

    if (classification.kind === 'routed') {
      try {
        console.log(`[Payment] Routing ${sub.accountId} via DeepBook: ${sub.denomination} -> ${sub.settlementDenomination}`);
        const digest = await processRoutedPayment(sub, classification.pool);
        console.log(`[Payment] Routed success: ${digest}`);
        digests.push(digest);
      } catch (err: any) {
        console.error(`[Payment] Routed payment failed for ${sub.accountId}:`, err);
      }
      continue;
    }

    try {
      console.log(`[Payment] Processing for Account: ${sub.accountId}`);
      const tx = new Transaction();

      const limiters = tx.moveCall({
        target: `${PACKAGE_ID}::policies::empty_limiters`,
        arguments: [tx.object(CLOCK_OBJECT_ID)],
      });

      tx.moveCall({
        target: `${PACKAGE_ID}::policies::ensure_initialized`,
        typeArguments: [sub.denomination],
        arguments: [tx.object(sub.accountId), limiters, tx.object(CLOCK_OBJECT_ID)],
      });

      tx.moveCall({
        target: `${PACKAGE_ID}::scheduler::process_due_payment`,
        typeArguments: [sub.denomination],
        arguments: [
          tx.object(REGISTRY_ID),
          tx.object(PAYMENT_SCHEDULER_ID),
          tx.object(sub.platformId),
          tx.object(sub.accountId),
          limiters,
          tx.object(CLOCK_OBJECT_ID),
        ],
      });

      tx.setSender(schedulerAddress);

      const coins = await grpcClient.core.listCoins({ owner: schedulerAddress, coinType: '0x2::sui::SUI' });
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

      const bytes = await tx.build({ client: grpcClient });
      const { signature } = await schedulerKeypair.signTransaction(bytes);

      const result = await grpcClient.core.executeTransaction({
        transaction: bytes,
        signatures: [signature],
        include: { effects: true },
      });

      if (result.$kind === 'FailedTransaction') {
         throw new Error(`Failed execution: ${result.FailedTransaction.status.error?.message}`);
      }

      const digest = result.Transaction.digest;
      await grpcClient.waitForTransaction({ digest });
      
      console.log(`[Payment] Success: ${digest}`);
      digests.push(digest);
    } catch (err: any) {
      console.error(`[Payment] Failed for ${sub.accountId}:`, err);
    }
  }

  return digests;
}
