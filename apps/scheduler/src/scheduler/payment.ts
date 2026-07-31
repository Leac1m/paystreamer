import { Transaction } from '@mysten/sui/transactions';
import { grpcClient, getSchedulerKeypair, getSchedulerAddress } from '../lib/sui.js';
import { PACKAGE_ID, PAYMENT_SCHEDULER_ID } from '../lib/config.js';
import { DiscoveredSubscription } from './discovery.js';

export async function processDuePayments(subscriptions: DiscoveredSubscription[]): Promise<string[]> {
  const digests: string[] = [];
  const schedulerAddress = getSchedulerAddress();
  const schedulerKeypair = getSchedulerKeypair();

  for (const sub of subscriptions) {
    try {
      console.log(`[Payment] Processing for Account: ${sub.accountId}`);
      const tx = new Transaction();

      tx.moveCall({
        target: `${PACKAGE_ID}::scheduler::process_due_payment`,
        typeArguments: [sub.denomination],
        arguments: [
          tx.object(PAYMENT_SCHEDULER_ID),
          tx.object(sub.platformId),
          tx.object(sub.accountId),
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
