#!/usr/bin/env node

/**
 * Find all AccountCap objects owned by an address
 * Usage: pnpm exec ts-node --esm scripts/find-account-caps.ts [address]
 */

import { config } from 'dotenv';
config();

import { SuiGraphQLClient } from '@mysten/sui/graphql';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

const GRAPHQL_URL = 'https://fullnode.devnet.sui.io:443/graphql';

async function getSender() {
    const secret = process.env.SCHEDULER_SECRET;
    if (!secret) throw new Error('SCHEDULER_SECRET not set');
    return Ed25519Keypair.fromSecretKey(secret).toSuiAddress();
}

async function findAccountCaps(address: string) {
    const client = new SuiGraphQLClient({ url: GRAPHQL_URL });

    const result = await client.query({
        query: `
            query GetAccountCaps($address: SuiAddress!) {
                address(owner: $address) {
                    objects(first: 50, filter: { type: "0xd2ddd9bd521bde4137d6b27312c73216924b8661420b25c1c37737c4bc43b76e::subscription_account::AccountCap" }) {
                        nodes {
                            address
                            version
                            previousTransaction {
                                digest
                            }
                        }
                    }
                }
            }
        `,
        variables: { address },
    });

    console.log('AccountCaps found:', result.data?.address?.objects?.nodes?.length || 0);
    console.log(JSON.stringify(result.data?.address?.objects?.nodes || [], null, 2));

    return result.data?.address?.objects?.nodes || [];
}

async function main() {
    const address = process.argv[2] || await getSender();
    console.log(`Finding AccountCaps for: ${address}`);
    await findAccountCaps(address);
}

main().catch(console.error);