#!/usr/bin/env node

/**
 * Execute a transaction using the keypair from SCHEDULER_SECRET
 * Usage: pnpm exec ts-node --esm scripts/execute-tx.ts
 *
 * This script builds and executes a create_account_entry transaction.
 * To execute different transactions, modify the tx construction below.
 */

import { config } from 'dotenv';
config();

import { Transaction } from '@mysten/sui/transactions';
import { getKeypair, createGraphQLClient, PACKAGE_ID } from './test-utils.ts';

const SUI_TYPE = '0x2::sui::SUI';

async function main() {
    const keypair = await getKeypair();
    const client = await createGraphQLClient();

    console.log(`Executing transaction as ${keypair.toSuiAddress()}`);

    const tx = new Transaction();
    tx.setGasBudget(10000000);

    // Build the transaction - create account entry
    tx.moveCall({
        package: PACKAGE_ID,
        module: 'subscription_account',
        function: 'create_account_entry',
        typeArguments: [SUI_TYPE],
        arguments: [],
    });

    console.log('Built transaction, executing...');

    const result = await client.signAndExecuteTransaction({
        transaction: tx,
        signer: keypair,
    });

    console.log('Transaction executed!');
    console.log('Digest:', result.digest);

    if (result.Transaction) {
        console.log('Transaction data:', JSON.stringify(result.Transaction, null, 2).substring(0, 500));
    }

    return result;
}

main().catch(console.error);