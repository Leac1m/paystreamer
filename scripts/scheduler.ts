import { SuiGraphQLClient } from '@mysten/sui/graphql';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { 
    V2_PACKAGE_ID, 
    V2_PAYMENT_SCHEDULER_ID, 
    CLOCK_OBJECT_ID,
    SUI_TYPE_ARG
} from '../src/constants.ts';

import { config } from 'dotenv';
config();

// This is the keypair for the demo scheduler.
// It will be loaded from the secure .env file.
const SCHEDULER_SECRET = process.env.SCHEDULER_SECRET; 

// Define the network
const client = new SuiGraphQLClient({ url: "https://fullnode.devnet.sui.io:443/graphql", network: "devnet" });

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

        // In v2, process_due_payment is permissionless, so we don't need a SchedulerCap.
        // We will fetch all AccountCreated events to find subscription accounts.
        console.log("Finding Subscription Accounts...");
        
        let hasNextPage = true;
        let cursor: any = null;
        const accountIds: string[] = [];

        while (hasNextPage) {
            const result = await client.query({
                query: `
                    query GetEvents($cursor: String, $type: String!) {
                        events(first: 50, after: $cursor, filter: { type: $type }) {
                            nodes { contents { json } }
                            pageInfo { hasNextPage endCursor }
                        }
                    }
                `,
                variables: {
                    type: `${V2_PACKAGE_ID}::account::AccountCreated`,
                },
            });

            if (!result.data?.events) {
                console.error("Failed to query events:", result.errors);
                break;
            }

            const events = {
                data: result.data.events.nodes.map((n: any) => ({
                    parsedJson: n.contents.json,
                })),
                hasNextPage: result.data.events.pageInfo.hasNextPage,
                nextCursor: result.data.events.pageInfo.endCursor,
            };

            events.data.forEach((e: any) => {
                const json = e.parsedJson || e.json;
                if (json?.account_id) accountIds.push(json.account_id);
            });
            hasNextPage = events.hasNextPage;
            cursor = events.nextCursor;
        }

        if (accountIds.length === 0) {
            console.log("No subscription accounts found on the network.");
            return;
        }

        console.log(`Found ${accountIds.length} accounts. Checking subscriptions...`);

        // Fetch the account objects to check their status
        const { objects: accountsResult } = await client.core.getObjects({
            objectIds: accountIds,
            include: { json: true }
        });

        const duePayments: { accountId: string, platformId: string, amount: number }[] = [];
        const now = Date.now();

        for (const acc of accountsResult) {
            if (acc instanceof Error) continue;
            const accContent = acc.json as any;
            if (!accContent) continue;

            // GraphQL returns VecMap as an array of entries inside `contents`
            const subscriptions = accContent.subscriptions?.contents || [];

            for (const subEntry of subscriptions) {
                const platformId = subEntry.key;
                const sub = subEntry.value?.fields || subEntry.value;
                if (!sub) continue;

                const nextBilling = Number(sub.next_billing_ts || sub.next_billing_time || 0);
                const amount = Number(sub.tier_amount || sub.amount || 0);
                const status = sub.status?.variant ?? sub.status; // Support object or primitive

                if (status === 0 && now >= nextBilling && amount > 0) {
                    // Subscription is active and due for billing
                    const balance = Number(accContent.balance || 0);
                    if (balance >= amount) {
                        duePayments.push({
                            accountId: acc.objectId,
                            platformId,
                            amount
                        });
                    } else {
                        console.log(`Account ${acc.objectId} has insufficient balance for subscription to platform ${platformId}.`);
                    }
                }
            }
        }

        if (duePayments.length > 0) {
            console.log(`Found ${duePayments.length} due subscriptions. Processing individually...`);

            for (const payment of duePayments) {
                const tx = new Transaction();

                // 1. empty_limiters (used by process_due_payment)
                const limiters = tx.moveCall({
                    target: `${V2_PACKAGE_ID}::policies::empty_limiters`,
                    arguments: [tx.object(CLOCK_OBJECT_ID)],
                });

                // 2. ensure_initialized (idempotent, harmless)
                tx.moveCall({
                    target: `${V2_PACKAGE_ID}::policies::ensure_initialized`,
                    typeArguments: [SUI_TYPE_ARG],
                    arguments: [tx.object(CLOCK_OBJECT_ID)],
                });

                // 3. process_due_payment
                tx.moveCall({
                    target: `${V2_PACKAGE_ID}::scheduler::process_due_payment`,
                    typeArguments: [SUI_TYPE_ARG],
                    arguments: [
                        tx.object(V2_PAYMENT_SCHEDULER_ID),
                        tx.object(payment.platformId),
                        tx.object(payment.accountId),
                        limiters,
                        tx.object(CLOCK_OBJECT_ID)
                    ]
                });

                try {
                    console.log(`Submitting withdrawal for account ${payment.accountId} / platform ${payment.platformId}...`);
                    const result = await (client as any).signAndExecuteTransaction({
                        transaction: tx,
                        signer: keypair,
                    });
                    const digest = result.Transaction?.digest || result.digest || (result as any).effects?.transactionDigest;
                    console.log(`Withdrawal successful! Digest: ${digest}`);
                } catch (err) {
                    console.error(`Failed to withdraw from account ${payment.accountId}:`, err);
                }
            }
        } else {
            console.log(`No subscriptions due on the network right now.`);
        }
    } catch (error) {
        console.error("Scheduler encountered an error during this iteration:");
        console.error(error);
        console.log("Will retry on next interval.");
    }
}

// Run every minute for the demo
setInterval(runScheduler, 15000);
runScheduler(); // run immediately once
