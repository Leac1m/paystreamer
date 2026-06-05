#!/usr/bin/env node

/**
 * Create a subscription account
 * Usage: npx ts-node --esm scripts/create-test-account.ts
 */

import { config } from 'dotenv';
config();

import { Transaction } from '@mysten/sui/transactions';
import { getKeypair, createGraphQLClient, PACKAGE_ID } from './test-utils.ts';

const SUI_TYPE = '0x2::sui::SUI';

async function createAccount() {
    const keypair = await getKeypair();
    const sender = keypair.toSuiAddress();
    console.log(`Creating subscription account for sender: ${sender}`);

    const client = await createGraphQLClient();

    const tx = new Transaction();
    tx.setGasBudget(10000000);

    // Call create_account_entry - no arguments needed, single type arg
    tx.moveCall({
        package: PACKAGE_ID,
        module: 'subscription_account',
        function: 'create_account_entry',
        typeArguments: [SUI_TYPE],
        arguments: [],
    });

    console.log('Transaction built:', tx.serialize());
    console.log('Note: You need to sign and execute this transaction using your wallet or fullnode');
}

createAccount().catch(console.error);