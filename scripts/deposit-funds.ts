#!/usr/bin/env node

/**
 * Deposit funds into a subscription account
 * Usage: npx ts-node --esm scripts/deposit-funds.ts <accountCapId> <accountId> <amountInSui>
 * Example: npx ts-node --esm scripts/deposit-funds.ts 0x... 0x... 1
 */

import { config } from 'dotenv';
config();

import { Transaction } from '@mysten/sui/transactions';
import { getKeypair, createGraphQLClient, PACKAGE_ID } from './test-utils.ts';

const SUI_TYPE = '0x2::sui::SUI';

async function depositFunds(accountCapId: string, accountId: string, amountSui: string) {
    const keypair = await getKeypair();
    const sender = keypair.toSuiAddress();
    console.log(`Depositing ${amountSui} SUI into account ${accountId} from ${sender}`);

    const client = await createGraphQLClient();
    const tx = new Transaction();
    tx.setGasBudget(10000000);

    const amountMist = BigInt(Math.floor(parseFloat(amountSui) * 1_000_000_000));

    // Split the gas coin into a payment coin
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);

    // Call deposit
    tx.moveCall({
        package: PACKAGE_ID,
        module: 'subscription_account',
        function: 'deposit',
        arguments: [
            tx.object(accountCapId),
            tx.object(accountId),
            coin,
        ],
        typeArguments: [SUI_TYPE],
    });

    console.log('Transaction built:', tx.serialize());
    return tx.serialize();
}

const args = process.argv.slice(2);
if (args.length < 3) {
    console.log('Usage: npx ts-node --esm scripts/deposit-funds.ts <accountCapId> <accountId> <amountInSui>');
    console.log('Example: npx ts-node --esm scripts/deposit-funds.ts 0xe5b0504c699e37f1344b7180d1f61581195eb85dde968289a5cdd4828f89ae7a 0x11d75fb6b4d9785e4d1cd5388424b0debd5ee506ece609d579657a91aaca83d6 1');
    process.exit(1);
}

depositFunds(args[0], args[1], args[2]).catch(console.error);