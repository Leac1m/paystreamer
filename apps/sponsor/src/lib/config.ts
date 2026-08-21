import dotenv from 'dotenv';
import { getConfig, SupportedNetwork } from '@paystreamer/sdk';

dotenv.config();

const isTestMode = process.env.NODE_ENV === 'test' || process.env.VITEST;
export const NETWORK = (process.env.NETWORK || (isTestMode ? 'local' : 'testnet')) as SupportedNetwork;
const networkConfig = getConfig(NETWORK);

export const SUI_RPC_URL = process.env.SUI_RPC_URL || networkConfig.GRPC_URL;
export const PORT = parseInt(process.env.PORT || '3000', 10);

// Contracts — sourced from the SDK's centralized constants.ts rather than
// duplicated here. The previous hardcoded fallbacks drifted from what was
// actually deployed (they were the source of a real bug: the sponsor's
// Move-call allowlist silently rejected every real transaction because it
// was built from a stale package ID no app was actually using anymore).
export const PACKAGE_ID = networkConfig.PACKAGE_ID;
export const PUSD_PACKAGE_ID = networkConfig.PUSD_PACKAGE_ID;
export const COIN_TYPE_REGISTRY_ID = networkConfig.COIN_TYPE_REGISTRY_ID;
export const PAYMENT_SCHEDULER_ID = networkConfig.PAYMENT_SCHEDULER_ID;
export const CLOCK_OBJECT_ID = '0x0000000000000000000000000000000000000000000000000000000000000006';

// Sponsor
export const SPONSOR_PRIVATE_KEY = process.env.SPONSOR_PRIVATE_KEY || '';
export const SPONSOR_ADDRESS = process.env.SPONSOR_ADDRESS || '';

// Scheduler interval (10 seconds)
export const SCHEDULER_INTERVAL_MS = 10_000;
