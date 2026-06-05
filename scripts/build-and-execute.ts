#!/usr/bin/env node

/**
 * Build and execute a transaction
 * Usage: npx ts-node --esm scripts/build-and-execute.ts <module> <function> [args...]
 * Or import buildAndExecute(transaction) for programmatic use
 */

import { config } from 'dotenv';
config();

import { Transaction } from '@mysten/sui/transactions';
import { getKeypair, createGraphQLClient, PACKAGE_ID } from './test-utils.ts';

export async function buildAndExecute(
    module: string,
    functionName: string,
    arguments: (string | TransactionArgument)[],
    typeArguments: string[] = [],
    extraArgs: Record<string, string> = {}
) {
    const keypair = await getKeypair();
    const client = await createGraphQLClient();

    const tx = new Transaction();
    tx.setGasBudget(10000000);

    // Build moveCall arguments based on type
    const builtArgs = arguments.map(arg => {
        if (typeof arg === 'string') {
            // Check if it's an object ID (0x...)
            if (arg.startsWith('0x')) {
                return tx.object(arg);
            }
            // Check if it's a number
            if (!isNaN(Number(arg))) {
                return tx.pure.u64(BigInt(arg));
            }
            // Otherwise treat as string
            return tx.pure.string(arg);
        }
        return arg;
    });

    tx.moveCall({
        package: PACKAGE_ID,
        module,
        function: functionName,
        arguments: builtArgs,
        typeArguments,
    });

    const txBytes = tx.serialize();
    console.log(`Built ${module}::${functionName} transaction`);

    const result = await client.signAndExecuteTransaction({
        transaction: txBytes,
        signer: keypair,
    });

    console.log(`Transaction executed! Digest: ${result.digest}`);
    return result;
}

// Simple CLI wrapper
const MODULE = process.argv[2];
const FUNCTION = process.argv[3];
const ARGS = process.argv.slice(4);

if (!MODULE || !FUNCTION) {
    console.log('Usage: npx ts-node --esm scripts/build-and-execute.ts <module> <function> [args...]');
    console.log('Example: npx ts-node --esm scripts/build-and-execute.ts subscription_account create_account_entry');
    process.exit(1);
}

// For simple calls without arguments
buildAndExecute(MODULE, FUNCTION, ARGS).catch(console.error);