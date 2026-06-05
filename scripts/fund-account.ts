#!/usr/bin/env node

/**
 * Fund a subscription account with SUI
 *
 * Usage:
 *   pnpm exec ts-node --esm scripts/fund-account.ts <accountCapId> <accountId> <amountInSui>
 *
 * Example:
 *   pnpm exec ts-node --esm scripts/fund-account.ts \
 *     0x13ad7af394d0357fc1c036c4356b20c13e056872f4277d43e8dd0c84fea7ec5d \
 *     0x9842f9623a3e3c71303c24fdd9e40cd1c4459e5e95835535fb6f581f815cad3c \
 *     5
 */

import { config } from 'dotenv';
config();

import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiGraphQLClient } from '@mysten/sui/graphql';

const GRAPHQL_URL = 'https://fullnode.devnet.sui.io:443/graphql';
const PACKAGE_ID = '0xd2ddd9bd521bde4137d6b27312c73216924b8661420b25c1c37737c4bc43b76e';
const SUI_TYPE = '0x2::sui::SUI';

interface Args {
    accountCapId: string;
    accountId: string;
    amountSui: number;
}

function parseArgs(): Args {
    const args = process.argv.slice(2);

    if (args.length < 3) {
        console.log('Usage: pnpm exec ts-node --esm scripts/fund-account.ts <accountCapId> <accountId> <amountInSui>');
        console.log('');
        console.log('Arguments:');
        console.log('  accountCapId   - AccountCap object ID (required)');
        console.log('  accountId      - SubscriptionAccount object ID (required)');
        console.log('  amountInSui   - Amount to deposit in SUI (required)');
        console.log('');
        console.log('Example:');
        console.log('  pnpm exec ts-node --esm scripts/fund-account.ts \\');
        console.log('    0x13ad7af394d0357fc1c036c4356b20c13e056872f4277d43e8dd0c84fea7ec5d \\');
        console.log('    0x9842f9623a3e3c71303c24fdd9e40cd1c4459e5e95835535fb6f581f815cad3c \\');
        console.log('    5');
        process.exit(1);
    }

    return {
        accountCapId: args[0],
        accountId: args[1],
        amountSui: parseFloat(args[2]),
    };
}

async function getKeypair() {
    const secret = process.env.SCHEDULER_SECRET;
    if (!secret) throw new Error('SCHEDULER_SECRET not set');
    return Ed25519Keypair.fromSecretKey(secret);
}

async function fundAccount(args: Args) {
    const keypair = await getKeypair();
    const sender = keypair.toSuiAddress();
    const amountMist = BigInt(Math.floor(args.amountSui * 1_000_000_000));

    console.log(`Funding subscription account...`);
    console.log(`  AccountCap: ${args.accountCapId}`);
    console.log(`  Account:    ${args.accountId}`);
    console.log(`  Amount:     ${args.amountSui} SUI (${amountMist} mist)`);
    console.log(`  Sender:     ${sender}`);

    const client = new SuiGraphQLClient({ url: GRAPHQL_URL });

    const tx = new Transaction();
    tx.setGasBudget(10000000);

    // Split coin from gas
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);

    // Build the deposit moveCall
    tx.moveCall({
        package: PACKAGE_ID,
        module: 'subscription_account',
        function: 'deposit',
        arguments: [
            tx.object(args.accountCapId),
            tx.object(args.accountId),
            coin,
        ],
        typeArguments: [SUI_TYPE],
    });

    console.log('\nExecuting transaction...');

    const result = await client.signAndExecuteTransaction({
        transaction: tx,
        signer: keypair,
    });

    const digest = result.Transaction?.digest || result.digest;
    console.log(`Transaction executed!`);
    console.log(`  Digest: ${digest}`);

    if (result.Transaction?.effects?.status?.success) {
        console.log(`  Status: SUCCESS`);
    } else {
        console.log(`  Status: FAILED`);
        console.log(`  Error: ${result.Transaction?.effects?.status?.error || 'Unknown'}`);
    }

    return result;
}

async function main() {
    const args = parseArgs();

    try {
        await fundAccount(args);
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}

main();