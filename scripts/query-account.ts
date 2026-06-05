#!/usr/bin/env node

/**
 * Query subscription account details
 * Usage: pnpm exec ts-node --esm scripts/query-account.ts [accountId]
 */

import { config } from 'dotenv';
config();

import { SuiGraphQLClient } from '@mysten/sui/graphql';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

const GRAPHQL_URL = 'https://fullnode.devnet.sui.io:443/graphql';
const PACKAGE_ID = '0xd2ddd9bd521bde4137d6b27312c73216924b8661420b25c1c37737c4bc43b76e';

async function queryAccount(accountId: string) {
    const client = new SuiGraphQLClient({ url: GRAPHQL_URL });

    // Query the object by its address
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

    return result;
}

async function main() {
    const accountId = process.argv[2] || '0x9842f9623a3e3c71303c24fdd9e40cd1c4459e5e95835535fb6f581f815cad3c';
    console.log(`Querying account: ${accountId}`);

    const result = await queryAccount(accountId);

    if (result.errors) {
        console.log('GraphQL errors:', JSON.stringify(result.errors, null, 2));
        return;
    }

    console.log(JSON.stringify(result.data, null, 2));
}

main().catch(console.error);