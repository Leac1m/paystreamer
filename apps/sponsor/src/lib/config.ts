import dotenv from 'dotenv';

dotenv.config();

const isTestMode = process.env.NODE_ENV === 'test' || process.env.VITEST;
export const NETWORK = process.env.NETWORK || (isTestMode ? 'localnet' : 'testnet');
export const SUI_RPC_URL = process.env.SUI_RPC_URL || (NETWORK === 'localnet' || NETWORK === 'local' ? 'http://127.0.0.1:9000' : `https://fullnode.${NETWORK}.sui.io:443`);
export const PORT = parseInt(process.env.PORT || '3000', 10);

// Contracts
export const PACKAGE_ID = process.env.PACKAGE_ID || '0xf310efaea5adf4bba799c3628563f8c6e0c9677785dca6d7865744e4a3b80afb';
export const PUSD_PACKAGE_ID = process.env.PUSD_PACKAGE_ID || '0xee983e3c2a2e899589e34325a031f942eff015399215abb9ef597487dbc638c4';
export const COIN_TYPE_REGISTRY_ID = process.env.COIN_TYPE_REGISTRY_ID || '0x076e62b38cbe903413cb7ee9a177eef0c593a9bac40d0dcdbc7d46315af65639';
export const PAYMENT_SCHEDULER_ID = process.env.PAYMENT_SCHEDULER_ID || '0x09d3b621355da923e9076fa95a8ff253331b44b8a0f4fa61b0ca51878b1d1c4e';
export const CLOCK_OBJECT_ID = process.env.CLOCK_OBJECT_ID || '0x0000000000000000000000000000000000000000000000000000000000000006';

// Sponsor
export const SPONSOR_PRIVATE_KEY = process.env.SPONSOR_PRIVATE_KEY || '';
export const SPONSOR_ADDRESS = process.env.SPONSOR_ADDRESS || '';

// Scheduler interval (10 seconds)
export const SCHEDULER_INTERVAL_MS = 10_000;
