#!/usr/bin/env node

/**
 * Subscribe to a platform tier
 * Usage: npx ts-node --esm scripts/subscribe-to-platform.ts <accountCapId> <accountId> <platformId> <tierIndex>
 * Example: npx ts-node --esm scripts/subscribe-to-platform.ts 0x... 0x... 0x... 1
 */

import { config } from 'dotenv';
config();

import { Transaction } from '@mysten/sui/transactions';
import { getKeypair, createGraphQLClient, PACKAGE_ID } from './test-utils.ts';

const SUI_TYPE = '0x2::sui::SUI';
const CLOCK_ID = '0x0000000000000000000000000000000000000000000000000000000000000006';

async function subscribeToPlatform(accountCapId: string, accountId: string, platformId: string, tierIndex: string) {
    const keypair = await getKeypair();
    const sender = keypair.toSuiAddress();
    console.log(`Subscribing to platform ${platformId} tier ${tierIndex} from account ${accountId}`);

    const client = await createGraphQLClient();
    const tx = new Transaction();
    tx.setGasBudget(10000000);

    tx.moveCall({
        package: PACKAGE_ID,
        module: 'subscription_manager',
        function: 'create_subscription',
        arguments: [
            tx.object(accountCapId),
            tx.object(accountId),
            tx.object(platformId),
            tx.pure.u64(BigInt(parseInt(tierIndex))),
            tx.object(CLOCK_ID),
        ],
        typeArguments: [SUI_TYPE],
    });

    console.log('Transaction built:', tx.serialize());
    return tx.serialize();
}

const args = process.argv.slice(2);
if (args.length < 4) {
    console.log('Usage: npx ts-node --esm scripts/subscribe-to-platform.ts <accountCapId> <accountId> <platformId> <tierIndex>');
    console.log('Example: npx ts-node --esm scripts/subscribe-to-platform.ts 0xe5b0504c699e37f1344b7180d1f61581195eb85dde968289a5cdd4828f89ae7a 0x11d75fb6b4d9785e4d1cd5388424b0debd5ee506ece609d579657a91aaca83d6 0x166bef556043506713e96c9afe05aea249a1eb7bc04a56efe4cc83279fcf3b33 1');
    process.exit(1);
}

subscribeToPlatform(args[0], args[1], args[2], args[3]).catch(console.error);