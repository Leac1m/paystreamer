#!/usr/bin/env node

/**
 * Create a tier with custom frequency on a platform
 * Usage: npx ts-node --esm scripts/create-test-tier.ts <ownerCapId> <platformId> <tierName> <amountInSui> <frequencyMs>
 * Example: npx ts-node --esm scripts/create-test-tier.ts 0x... 0x... "MinuteTier" 0.1 60000
 */

import { config } from 'dotenv';
config();

import { Transaction } from '@mysten/sui/transactions';
import { getKeypair, createGraphQLClient, PACKAGE_ID } from './test-utils.ts';

const CLOCK_ID = '0x0000000000000000000000000000000000000000000000000000000000000006';

async function createTier(ownerCapId: string, platformId: string, tierName: string, amountSui: string, frequencyMs: string) {
    const keypair = await getKeypair();
    const sender = keypair.toSuiAddress();
    console.log(`Creating tier on platform ${platformId} by ${sender}`);

    const client = await createGraphQLClient();
    const tx = new Transaction();
    tx.setGasBudget(10000000);

    const amountMist = BigInt(Math.floor(parseFloat(amountSui) * 1_000_000_000));
    const freqMs = BigInt(parseInt(frequencyMs));

    // First, create the BillingFrequency via a nested moveCall
    const freqArg = tx.moveCall({
        package: PACKAGE_ID,
        module: 'platform_registry',
        function: 'billing_frequency_custom',
        arguments: [tx.pure.u64(freqMs)],
        typeArguments: [],
    });

    // Then call create_tier with the frequency argument
    tx.moveCall({
        package: PACKAGE_ID,
        module: 'platform_registry',
        function: 'create_tier',
        arguments: [
            tx.object(ownerCapId),
            tx.object(platformId),
            tx.pure.string(tierName),
            tx.pure.u64(amountMist),
            freqArg, // Pass the result of billing_frequency_custom
        ],
        typeArguments: [],
    });

    const serialized = tx.serialize();
    console.log('Transaction built (use with sui client execute-signed-tx or signAndExecute)');
    console.log('Serialized:', serialized);

    // For CLI execution, we can use sui client execute-signed-tx with the built transaction
    return serialized;
}

const args = process.argv.slice(2);
if (args.length < 5) {
    console.log('Usage: npx ts-node --esm scripts/create-test-tier.ts <ownerCapId> <platformId> <tierName> <amountInSui> <frequencyMs>');
    console.log('Example: npx ts-node --esm scripts/create-test-tier.ts 0x93a19496ee48ed2e570786654263161711d02cb24eba114f6ffec4603887e079 0x166bef556043506713e96c9afe05aea249a1eb7bc04a56efe4cc83279fcf3b33 "MinuteTier" 0.1 60000');
    process.exit(1);
}

createTier(args[0], args[1], args[2], args[3], args[4]).catch(console.error);