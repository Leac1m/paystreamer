#!/usr/bin/env node

import { config } from 'dotenv';
config();

import { SuiGraphQLClient } from '@mysten/sui/graphql';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { DEVNET_SUBSCRIPTIONS_PACKAGE_ID } from '../src/constants.ts';

const PACKAGE_ID = DEVNET_SUBSCRIPTIONS_PACKAGE_ID!;
const NETWORK = 'devnet';
const GRAPHQL_URL = 'https://fullnode.devnet.sui.io:443/graphql';

// Default sender address (from SCHEDULER_SECRET)
const SCHEDULER_SECRET = process.env.SCHEDULER_SECRET!;

async function getKeypair() {
    if (!SCHEDULER_SECRET) {
        throw new Error('SCHEDULER_SECRET not set in .env');
    }
    return Ed25519Keypair.fromSecretKey(SCHEDULER_SECRET);
}

export async function createGraphQLClient() {
    return new SuiGraphQLClient({ url: GRAPHQL_URL });
}

export { PACKAGE_ID, NETWORK, getKeypair };