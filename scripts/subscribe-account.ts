#!/usr/bin/env node

/**
 * Subscribe an account to a platform tier
 *
 * Usage:
 *   pnpm exec ts-node --esm scripts/subscribe-account.ts <accountCapId> <accountId> <platformId> [tierIndex]
 *
 * Example:
 *   pnpm exec ts-node --esm scripts/subscribe-account.ts \
 *     0x13ad7af394d0357fc1c036c4356b20c13e056872f4277d43e8dd0c84fea7ec5d \
 *     0x9842f9623a3e3c71303c24fdd9e40cd1c4459e5e95835535fb6f581f815cad3c \
 *     0x166bef556043506713e96c9afe05aea249a1eb7bc04a56efe4cc83279fcf3b33 \
 *     1
 */

import { config } from 'dotenv';
config();

import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiGraphQLClient } from '@mysten/sui/graphql';

const GRAPHQL_URL = 'https://fullnode.devnet.sui.io:443/graphql';
const PACKAGE_ID = '0xd2ddd9bd521bde4137d6b27312c73216924b8661420b25c1c37737c4bc43b76e';
const SUI_TYPE = '0x2::sui::SUI';
const CLOCK_ID = '0x0000000000000000000000000000000000000000000000000000000000000006';

interface Args {
    accountCapId: string;
    accountId: string;
    platformId: string;
    tierIndex: number;
}

function parseArgs(): Args {
    const args = process.argv.slice(2);

    if (args.length < 3) {
        console.log('Usage: pnpm exec ts-node --esm scripts/subscribe-account.ts <accountCapId> <accountId> <platformId> [tierIndex]');
        console.log('');
        console.log('Arguments:');
        console.log('  accountCapId   - AccountCap object ID (required)');
        console.log('  accountId      - SubscriptionAccount object ID (required)');
        console.log('  platformId     - Platform object ID (required)');
        console.log('  tierIndex      - Tier index to subscribe to (default: 0)');
        console.log('');
        console.log('Example:');
        console.log('  pnpm exec ts-node --esm scripts/subscribe-account.ts \\');
        console.log('    0x13ad7af394d0357fc1c036c4356b20c13e056872f4277d43e8dd0c84fea7ec5d \\');
        console.log('    0x9842f9623a3e3c71303c24fdd9e40cd1c4459e5e95835535fb6f581f815cad3c \\');
        console.log('    0x166bef556043506713e96c9afe05aea249a1eb7bc04a56efe4cc83279fcf3b33 \\');
        console.log('    1');
        process.exit(1);
    }

    return {
        accountCapId: args[0],
        accountId: args[1],
        platformId: args[2],
        tierIndex: args[3] ? parseInt(args[3]) : 0,
    };
}

async function getKeypair() {
    const secret = process.env.SCHEDULER_SECRET;
    if (!secret) throw new Error('SCHEDULER_SECRET not set');
    return Ed25519Keypair.fromSecretKey(secret);
}

async function subscribeToPlatform(args: Args) {
    const keypair = await getKeypair();
    const sender = keypair.toSuiAddress();
    console.log(`Subscribing account to platform...`);
    console.log(`  AccountCap: ${args.accountCapId}`);
    console.log(`  Account:    ${args.accountId}`);
    console.log(`  Platform:   ${args.platformId}`);
    console.log(`  TierIndex:  ${args.tierIndex}`);
    console.log(`  Sender:     ${sender}`);

    const client = new SuiGraphQLClient({ url: GRAPHQL_URL });

    const tx = new Transaction();
    tx.setGasBudget(10000000);

    // Build the create_subscription moveCall
    tx.moveCall({
        package: PACKAGE_ID,
        module: 'subscription_manager',
        function: 'create_subscription',
        arguments: [
            tx.object(args.accountCapId),
            tx.object(args.accountId),
            tx.object(args.platformId),
            tx.pure.u64(BigInt(args.tierIndex)),
            tx.object(CLOCK_ID),
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
        await subscribeToPlatform(args);
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}

main();