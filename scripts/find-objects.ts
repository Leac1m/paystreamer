#!/usr/bin/env node

/**
 * Find all AccountCap objects owned by an address
 * Usage: pnpm exec ts-node --esm scripts/find-objects.ts [address]
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

async function findObjects(address: string, typeFilter?: string) {
    const client = new SuiGraphQLClient({ url: GRAPHQL_URL });

    // Use the correct schema: objects(first: N, filter: { owner: address })
    const result = await client.query({
        query: `
            query GetObjects($filter: ObjectFilter!) {
                objects(first: 50, filter: $filter) {
                    nodes {
                        address
                        asMoveObject {
                            hasPublicTransfer
                            contents {
                                type { repr }
                                json
                            }
                        }
                    }
                }
            }
        `,
        variables: { filter: { owner: address } },
    });

    return result;
}

async function main() {
    const address = process.argv[2] || await getSender();
    console.log(`Querying objects for: ${address}`);

    const result = await findObjects(address);

    if (result.errors) {
        console.log('GraphQL errors:', JSON.stringify(result.errors, null, 2));
        return;
    }

    const objects = result.data?.objects?.nodes || [];
    console.log('Total objects found:', objects.length);

    // Find AccountCaps from our package
    const accountCaps = objects.filter(n =>
        n.asMoveObject?.contents?.type?.repr?.includes(`${PACKAGE_ID}::subscription_account::AccountCap`)
    );
    console.log('\nAccountCaps found:', accountCaps.length);
    console.log(JSON.stringify(accountCaps.map(a => ({ address: a.address, json: a.asMoveObject?.contents?.json })), null, 2));

    // Find SubscriptionAccount objects
    const subAccounts = objects.filter(n =>
        n.asMoveObject?.contents?.type?.repr?.includes(`${PACKAGE_ID}::subscription_account::SubscriptionAccount`)
    );
    console.log('\nSubscriptionAccounts found:', subAccounts.length);
    console.log(JSON.stringify(subAccounts.map(a => ({ address: a.address, json: a.asMoveObject?.contents?.json })), null, 2));

    // Find PlatformOwnerCaps
    const platformOwnerCaps = objects.filter(n =>
        n.asMoveObject?.contents?.type?.repr?.includes('::platform_registry::PlatformOwnerCap')
    );
    console.log('\nPlatformOwnerCaps found:', platformOwnerCaps.length);
    console.log(JSON.stringify(platformOwnerCaps.map(a => ({ address: a.address, json: a.asMoveObject?.contents?.json })), null, 2));

    // Find SchedulerCaps
    const schedulerCaps = objects.filter(n =>
        n.asMoveObject?.contents?.type?.repr?.includes('::platform_registry::SchedulerCap')
    );
    console.log('\nSchedulerCaps found:', schedulerCaps.length);
    console.log(JSON.stringify(schedulerCaps.map(a => ({ address: a.address, json: a.asMoveObject?.contents?.json })), null, 2));
}

main().catch(console.error);