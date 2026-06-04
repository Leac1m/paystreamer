import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { DEVNET_SUBSCRIPTIONS_PACKAGE_ID } from '../src/constants';

// This is a dummy keypair for the demo scheduler.
// In a real environment, this would be loaded from a secure environment variable.
const SCHEDULER_SECRET = "suiprivkey1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq"; // dummy

// Define the network
const client = new SuiClient({ url: getFullnodeUrl('devnet') });

async function runScheduler() {
    console.log("Starting Subscriptions Scheduler...");

    // Setup keypair
    let keypair: Ed25519Keypair;
    try {
        keypair = Ed25519Keypair.fromSecretKey(SCHEDULER_SECRET);
    } catch (e) {
        console.warn("Invalid secret key. Please set a valid scheduler secret for the demo.");
        return;
    }
    
    const schedulerAddress = keypair.toSuiAddress();
    console.log(`Scheduler Address: ${schedulerAddress}`);

    // 1. Find SchedulerCap objects owned by the scheduler
    console.log("Finding SchedulerCaps...");
    const { objects: caps } = await client.getOwnedObjects({
        owner: schedulerAddress,
        filter: {
            StructType: `${DEVNET_SUBSCRIPTIONS_PACKAGE_ID}::platform_registry::SchedulerCap`
        },
        options: { showContent: true }
    });

    if (caps.length === 0) {
        console.log("No SchedulerCaps found for this address. Waiting for platform authorization.");
        return;
    }

    // For each authorized platform, run the batch withdrawal
    for (const capObj of caps) {
        const content = capObj.data?.content as any;
        if (!content) continue;

        const platformId = content.fields.platform_id;
        const schedulerCapId = capObj.data?.objectId;

        if (!platformId || !schedulerCapId) continue;

        console.log(`Processing withdrawals for Platform: ${platformId}`);

        // 2. Query all SubscriptionAccount objects
        // In a real app, you'd index these accounts off-chain in a database.
        // For the demo, we'll query events or search by type, but querying all accounts can be heavy.
        // As a simplification, we assume we have a list of account IDs, or we find them via an indexer.
        // Since we can't fetch all shared objects easily without an indexer, we query AccountCreated events.
        
        let hasNextPage = true;
        let cursor = null;
        const accountIds: string[] = [];

        while (hasNextPage) {
            const events = await client.queryEvents({
                query: { MoveEventType: `${DEVNET_SUBSCRIPTIONS_PACKAGE_ID}::subscription_account::AccountCreated` },
                cursor,
                limit: 50,
            });

            events.data.forEach(e => accountIds.push((e.parsedJson as any).account_id));
            hasNextPage = events.hasNextPage;
            cursor = events.nextCursor as any;
        }

        if (accountIds.length === 0) {
            console.log("No subscription accounts found on the network.");
            continue;
        }

        // 3. Fetch the account objects to check their status
        const { data: accounts } = await client.multiGetObjects({
            ids: accountIds,
            options: { showContent: true }
        });

        const accountsToWithdraw: string[] = [];
        const withdrawalAmounts: number[] = [];
        const now = Date.now();

        for (const acc of accounts) {
            const accContent = acc.data?.content as any;
            if (!accContent) continue;

            // Check if account has an active subscription for this platform
            // Note: In Sui v2 GraphQL/JSON, VecMap is an array of { key, value }
            const subscriptions = accContent.fields.subscriptions?.fields?.contents || accContent.fields.subscriptions || [];
            
            const subEntry = (Array.isArray(subscriptions) ? subscriptions : []).find(
                (s: any) => s.key === platformId || s.fields?.key === platformId
            );

            if (!subEntry) continue; // Not subscribed to this platform

            const sub = subEntry.value || subEntry.fields?.value;
            if (!sub) continue;

            const nextBilling = Number(sub.fields?.schedule?.fields?.next_billing_time || sub.schedule?.next_billing_time || 0);
            const amount = Number(sub.fields?.tier_amount || sub.tier_amount || 0);
            const status = sub.fields?.status?.fields?.variant ?? sub.status?.variant;

            if (status === 0 && now >= nextBilling && amount > 0) {
                // Subscription is active and due for billing
                // Check if account has enough balance
                const balance = Number(accContent.fields.balance || 0);
                if (balance >= amount) {
                    accountsToWithdraw.push(acc.data!.objectId);
                    withdrawalAmounts.push(amount);
                } else {
                    console.log(`Account ${acc.data?.objectId} has insufficient balance for subscription.`);
                }
            }
        }

        if (accountsToWithdraw.length > 0) {
            console.log(`Found ${accountsToWithdraw.length} due subscriptions. Executing batch withdrawal...`);
            
            const tx = new Transaction();
            
            // Convert arrays to Move vectors
            const accountsVec = tx.makeMoveVec({ 
                objects: accountsToWithdraw.map(id => tx.object(id)) 
            });
            const amountsVec = tx.makeMoveVec({ 
                type: 'u64', 
                objects: withdrawalAmounts.map(amt => tx.pure.u64(amt)) 
            });

            tx.moveCall({
                target: `${DEVNET_SUBSCRIPTIONS_PACKAGE_ID}::platform_registry::batch_withdraw_scheduler`,
                typeArguments: ['0x2::sui::SUI'],
                arguments: [
                    tx.object(schedulerCapId),
                    tx.object(platformId),
                    accountsVec,
                    amountsVec,
                    tx.object('0x6') // Clock object
                ]
            });

            try {
                const result = await client.signAndExecuteTransaction({
                    transaction: tx,
                    signer: keypair,
                    options: { showEffects: true }
                });
                console.log(`Batch withdrawal successful! Digest: ${result.digest}`);
            } catch (err) {
                console.error(`Failed to execute batch withdrawal:`, err);
            }
        } else {
            console.log(`No subscriptions due for Platform: ${platformId}`);
        }
    }
}

// Run every minute for the demo
setInterval(runScheduler, 60000);
runScheduler(); // run immediately once
