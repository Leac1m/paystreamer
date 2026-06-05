#!/usr/bin/env node

/**
 * End-to-end test of the subscription scheduler flow
 *
 * This script builds transactions and uses sui client for complex calls
 *
 * Usage: pnpm exec ts-node --esm scripts/test-scheduler-flow.ts [command]
 * Commands:
 *   check          - Check account and subscription status
 *   list-events    - List recent subscription events
 */

import { config } from 'dotenv';
config();

import { SuiGraphQLClient } from '@mysten/sui/graphql';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

const GRAPHQL_URL = 'https://fullnode.devnet.sui.io:443/graphql';
const PACKAGE_ID = '0xd2ddd9bd521bde4137d6b27312c73216924b8661420b25c1c37737c4bc43b76e';

async function getSender() {
    const secret = process.env.SCHEDULER_SECRET;
    if (!secret) throw new Error('SCHEDULER_SECRET not set');
    return Ed25519Keypair.fromSecretKey(secret).toSuiAddress();
}

async function getClient() {
    return new SuiGraphQLClient({ url: GRAPHQL_URL });
}

async function checkAccount(accountId: string) {
    console.log(`\n=== Checking account: ${accountId} ===`);

    const client = await getClient();
    const result = await client.query({
        query: `
            query GetAccount($address: SuiAddress!) {
                object(address: $address) {
                    address
                    asMoveObject {
                        contents {
                            type { repr }
                            json
                        }
                    }
                }
            }
        `,
        variables: { address: accountId },
    });

    if (result.errors) {
        console.log('Error:', JSON.stringify(result.errors, null, 2));
        return;
    }

    const json = result.data?.object?.asMoveObject?.contents?.json;
    console.log('Type:', result.data?.object?.asMoveObject?.contents?.type?.repr);
    console.log('Balance:', json?.balance);
    console.log('Subscriptions:', JSON.stringify(json?.subscriptions, null, 2));

    return json;
}

async function listEvents() {
    console.log('\n=== Recent AccountCreated events ===');

    const client = await getClient();
    const result = await client.query({
        query: `
            query GetEvents($type: String!) {
                events(first: 10, filter: { type: $type }) {
                    nodes {
                        contents { json }
                        sender { address }
                        transaction { digest }
                    }
                }
            }
        `,
        variables: { type: `${PACKAGE_ID}::subscription_account::AccountCreated` },
    });

    if (result.errors) {
        console.log('Error:', JSON.stringify(result.errors, null, 2));
        return;
    }

    const events = result.data?.events?.nodes || [];
    console.log(`Found ${events.length} events:\n`);
    events.forEach((e: any, i: number) => {
        console.log(`${i + 1}. Account: ${e.contents?.json?.account_id}`);
        console.log(`   Owner: ${e.sender?.address}`);
        console.log(`   Tx: ${e.transaction?.digest}`);
        console.log('');
    });
}

async function listTierCreatedEvents() {
    console.log('\n=== Recent TierCreated events ===');

    const client = await getClient();
    const result = await client.query({
        query: `
            query GetEvents($type: String!) {
                events(first: 10, filter: { type: $type }) {
                    nodes {
                        contents { json }
                        sender { address }
                        transaction { digest }
                    }
                }
            }
        `,
        variables: { type: `${PACKAGE_ID}::platform_registry::TierCreated` },
    });

    if (result.errors) {
        console.log('Error:', JSON.stringify(result.errors, null, 2));
        return;
    }

    const events = result.data?.events?.nodes || [];
    console.log(`Found ${events.length} events:\n`);
    events.forEach((e: any, i: number) => {
        console.log(`${i + 1}. Platform: ${e.contents?.json?.platform_id}`);
        console.log(`   Tier: ${e.contents?.json?.tier_name} (index: ${e.contents?.json?.tier_index})`);
        console.log(`   Amount: ${e.contents?.json?.amount}, Freq variant: ${e.contents?.json?.frequency}`);
        console.log(`   Tx: ${e.transaction?.digest}`);
        console.log('');
    });
}

async function listAllAccounts() {
    console.log('\n=== All AccountCreated events for sender ===');

    const sender = await getSender();
    console.log(`Sender: ${sender}`);

    const client = await getClient();
    const result = await client.query({
        query: `
            query GetEvents($sender: SuiAddress!, $type: String!) {
                events(first: 20, filter: { type: $type, sender: $sender }) {
                    nodes {
                        contents { json }
                        transaction { digest }
                    }
                }
            }
        `,
        variables: {
            sender,
            type: `${PACKAGE_ID}::subscription_account::AccountCreated`,
        },
    });

    if (result.errors) {
        console.log('Error:', JSON.stringify(result.errors, null, 2));
        return;
    }

    const events = result.data?.events?.nodes || [];
    console.log(`Found ${events.length} accounts:\n`);
    events.forEach((e: any, i: number) => {
        console.log(`${i + 1}. Account: ${e.contents?.json?.account_id}`);
        console.log(`   Cap ID: ${e.contents?.json?.cap_id}`);
        console.log(`   Tx: ${e.transaction?.digest}`);
        console.log('');
    });
}

async function main() {
    const command = process.argv[2] || 'check';
    const accountId = process.argv[3];

    console.log('Subscription Flow Test - Read Only');
    console.log('===================================');
    console.log('Package:', PACKAGE_ID);
    console.log('');

    switch (command) {
        case 'check':
            if (!accountId) {
                console.log('Usage: test-scheduler-flow.ts check [accountId]');
                console.log('No accountId provided, listing all accounts instead...\n');
                await listAllAccounts();
            } else {
                await checkAccount(accountId);
            }
            break;
        case 'list-events':
            await listEvents();
            break;
        case 'list-tiers':
            await listTierCreatedEvents();
            break;
        case 'list-accounts':
            await listAllAccounts();
            break;
        default:
            console.log('Usage: pnpm exec ts-node --esm scripts/test-scheduler-flow.ts [check|list-events|list-tiers|list-accounts] [accountId]');
            console.log('\nCommands:');
            console.log('  check          - Check account status');
            console.log('  list-events    - List AccountCreated events');
            console.log('  list-tiers     - List TierCreated events');
            console.log('  list-accounts  - List all accounts for sender');
    }
}

main().catch(console.error);