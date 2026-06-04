import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { DEVNET_SUBSCRIPTIONS_PACKAGE_ID } from '../src/constants.ts';

import { config } from 'dotenv';
config();

// This is the keypair for the demo scheduler.
// It will be loaded from the secure .env file.
const SCHEDULER_SECRET = process.env.SCHEDULER_SECRET; 

// Define the network
const client = new SuiGrpcClient({ network: "devnet", baseUrl: "https://fullnode.devnet.sui.io:443" });

async function runScheduler() {
    console.log("Starting Subscriptions Scheduler...");

    // Setup keypair
    if (!SCHEDULER_SECRET) {
        console.error("SCHEDULER_SECRET is not set in the .env file. Please configure it.");
        return;
    }
    
    let keypair: Ed25519Keypair;
    try {
        keypair = Ed25519Keypair.fromSecretKey(SCHEDULER_SECRET);
    } catch (e) {
        console.warn("Invalid secret key. Please set a valid scheduler secret in .env for the demo.");
        return;
    }
    
    try {
        const schedulerAddress = keypair.toSuiAddress();
        console.log(`Scheduler Address: ${schedulerAddress}`);

        // 1. Find SchedulerCap objects owned by the scheduler
        console.log("Finding SchedulerCaps...");
        const { objects: caps } = await client.core.listOwnedObjects({
            owner: schedulerAddress,
            type: `${DEVNET_SUBSCRIPTIONS_PACKAGE_ID}::platform_registry::SchedulerCap`,
            include: { json: true }
        });

        if (caps.length === 0) {
            console.log("No SchedulerCaps found for this address. Waiting for platform authorization.");
            return;
        }

        // For each authorized platform, run the batch withdrawal
        for (const capObj of caps) {
            const content = capObj.json as any;
            if (!content) continue;

            const platformId = content.platform_id;
            const schedulerCapId = capObj.objectId;

            if (!platformId || !schedulerCapId) continue;

            console.log(`Processing withdrawals for Platform: ${platformId}`);

            // 2. Query all SubscriptionAccount objects
            // In a real app, you'd index these accounts off-chain in a database.
            // For the demo, we'll query events or search by type, but querying all accounts can be heavy.
            // As a simplification, we assume we have a list of account IDs, or we find them via an indexer.
            // Since we can't fetch all shared objects easily without an indexer, we query AccountCreated events.
            
            let hasNextPage = true;
            let cursor: any = null;
            const accountIds: string[] = [];

            while (hasNextPage) {
                const events = await (client.core as any).queryEvents({
                    query: { MoveEventType: `${DEVNET_SUBSCRIPTIONS_PACKAGE_ID}::subscription_account::AccountCreated` },
                    cursor,
                    limit: 50,
                });

                events.data.forEach((e: any) => {
                    const json = e.parsedJson || e.json;
                    if (json?.account_id) accountIds.push(json.account_id);
                });
                hasNextPage = events.hasNextPage;
                cursor = events.nextCursor;
            }

            if (accountIds.length === 0) {
                console.log("No subscription accounts found on the network.");
                continue;
            }

            // 3. Fetch the account objects to check their status
            const { objects: accountsResult } = await client.core.getObjects({
                objectIds: accountIds,
                include: { json: true }
            });

            const accountsToWithdraw: string[] = [];
            const withdrawalAmounts: number[] = [];
            const now = Date.now();

            for (const acc of accountsResult) {
                if (acc instanceof Error) continue;
                const accContent = acc.json as any;
                if (!accContent) continue;

                // Check if account has an active subscription for this platform
                // Note: In Sui v2 GraphQL/JSON, VecMap is an array of { key, value }
                const subscriptions = accContent.subscriptions?.fields?.contents || accContent.subscriptions || [];
                
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
                    const balance = Number(accContent.balance || 0);
                    if (balance >= amount) {
                        accountsToWithdraw.push(acc.objectId);
                        withdrawalAmounts.push(amount);
                    } else {
                        console.log(`Account ${acc.objectId} has insufficient balance for subscription.`);
                    }
                }
            }

            if (accountsToWithdraw.length > 0) {
                console.log(`Found ${accountsToWithdraw.length} due subscriptions. Executing batch withdrawal...`);
                
                const tx = new Transaction();
                
                // Convert arrays to Move vectors
                const accountsVec = tx.makeMoveVec({ 
                    elements: accountsToWithdraw.map(id => tx.object(id)) 
                });
                const amountsVec = tx.makeMoveVec({ 
                    type: 'u64', 
                    elements: withdrawalAmounts.map(amt => tx.pure.u64(amt)) 
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
                    // We just use transaction.build and sign with core if signAndExecute is not on core
                    const result = await (client as any).signAndExecuteTransaction({
                        transaction: tx,
                        signer: keypair,
                    });
                    console.log(`Batch withdrawal successful! Digest: ${result.digest}`);
                } catch (err) {
                    console.error(`Failed to execute batch withdrawal:`, err);
                }
            } else {
                console.log(`No subscriptions due for Platform: ${platformId}`);
            }
        }
    } catch (error) {
        console.error("Scheduler encountered an error during this iteration:");
        console.error(error);
        console.log("Will retry on next interval.");
    }
}

// Run every minute for the demo
setInterval(runScheduler, 60000);
runScheduler(); // run immediately once
