import { Transaction } from '@mysten/sui/transactions';
import { client, getSponsorAddress } from '../lib/sui.js';
import { PACKAGE_ID, CLOCK_OBJECT_ID, PAYMENT_SCHEDULER_ID } from '../lib/config.js';
import { DiscoveredSubscription } from './discovery.js';

/**
 * Builds a Payment Transaction Block (PTB) for processing due payments
 * 
 * The PTB structure:
 * 1. empty_limiters - Creates empty limiters for the payment
 * 2. ensure_initialized - Ensures the account is initialized for the denomination
 * 3. process_due_payment - Processes the actual payment
 * 
 * @param subscription The subscription to process payment for
 * @returns The built transaction
 */
export function buildPaymentTransaction(subscription: DiscoveredSubscription): Transaction {
  const { accountId, platformId, denomination } = subscription;

  const tx = new Transaction();

  // Step 1: Create empty limiters
  const limiters = tx.moveCall({
    target: `${PACKAGE_ID}::policies::empty_limiters`,
    arguments: [tx.object(CLOCK_OBJECT_ID)],
  });

  // Step 2: Ensure the account is initialized for the denomination
  tx.moveCall({
    target: `${PACKAGE_ID}::policies::ensure_initialized`,
    typeArguments: [denomination],
    arguments: [tx.object(accountId), limiters, tx.object(CLOCK_OBJECT_ID)],
  });

  // Step 3: Process the due payment
  tx.moveCall({
    target: `${PACKAGE_ID}::scheduler::process_due_payment`,
    typeArguments: [denomination],
    arguments: [
      tx.object(PAYMENT_SCHEDULER_ID),
      tx.object(platformId),
      tx.object(accountId),
      limiters,
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  // Set gas owner to sponsor (address balance gas model)
  const sponsorAddress = getSponsorAddress();
  tx.setGasOwner(sponsorAddress);

  // Set gas payment to empty (address balance gas model)
  tx.setGasPayment([]);

  return tx;
}

/**
 * Processes a batch of due payments
 * @param subscriptions Array of subscriptions due for payment
 * @returns Array of transaction digests
 */
export async function processDuePayments(subscriptions: DiscoveredSubscription[]): Promise<string[]> {
  const digests: string[] = [];

  for (const subscription of subscriptions) {
    try {
      console.log(`[Payment] Processing payment for subscription: ${subscription.subscriptionId}`);
      console.log(`[Payment]   Account: ${subscription.accountId}`);
      console.log(`[Payment]   Platform: ${subscription.platformId}`);
      console.log(`[Payment]   Denomination: ${subscription.denomination}`);

      // Build the payment transaction
      const tx = buildPaymentTransaction(subscription);

      // Get sponsor keypair and sign
      const { getSponsorKeypair } = await import('../lib/sui.js');
      const sponsorKeypair = getSponsorKeypair();
      const sponsorAddress = getSponsorAddress();

      // Build transaction bytes
      const builtTx = await tx.build({ client });

      // Sponsor signs
      const sponsorSignature = await sponsorKeypair.signTransaction(builtTx);

      // Execute transaction (no user signature needed for scheduler-initiated payments)
      const result = await client.executeTransaction({
        transaction: builtTx,
        signatures: [sponsorSignature],
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      console.log(`[Payment] Payment processed successfully: ${result.digest}`);
      digests.push(result.digest);
    } catch (error) {
      console.error(`[Payment] Failed to process payment for subscription ${subscription.subscriptionId}:`, error);
      // Continue processing other subscriptions
    }
  }

  return digests;
}

/**
 * Processes payments for a single platform
 * @param platformId The platform ID
 * @param subscriptions Array of subscriptions due for payment
 * @returns Array of transaction digests
 */
export async function processPlatformPayments(
  platformId: string,
  subscriptions: DiscoveredSubscription[]
): Promise<string[]> {
  console.log(`[Payment] Processing ${subscriptions.length} payments for platform ${platformId}`);
  
  const dueSubscriptions = subscriptions.filter(
    sub => sub.platformId === platformId && sub.nextBillingTime <= BigInt(Date.now())
  );

  if (dueSubscriptions.length === 0) {
    console.log(`[Payment] No due payments for platform ${platformId}`);
    return [];
  }

  return processDuePayments(dueSubscriptions);
}
