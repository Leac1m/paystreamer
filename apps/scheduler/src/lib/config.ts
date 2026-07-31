import { config } from 'dotenv';
import { getConfig, SupportedNetwork } from '@paystreamer/sdk';
config({ path: '../../.env' }); // Load from root

export const NETWORK = (process.env.VITE_NETWORK || process.env.NETWORK || 'devnet') as SupportedNetwork;
const networkConfig = getConfig(NETWORK);

export const SUI_RPC_URL = process.env.VITE_SUI_RPC_URL;
export const GRAPHQL_URL = process.env.VITE_GRAPHQL_URL || networkConfig.GRAPHQL_URL;
export const PACKAGE_ID = networkConfig.PACKAGE_ID;
export const REGISTRY_ID = networkConfig.COIN_TYPE_REGISTRY_ID;
export const PAYMENT_SCHEDULER_ID = networkConfig.PAYMENT_SCHEDULER_ID;
export const SCHEDULER_PRIVATE_KEY = process.env.SCHEDULER_PRIVATE_KEY as string;
export const PUSD_TYPE_ARG = networkConfig.PUSD_TYPE_ARG;
export const CLOCK_OBJECT_ID = "0x0000000000000000000000000000000000000000000000000000000000000006";

if (!SCHEDULER_PRIVATE_KEY) throw new Error("SCHEDULER_PRIVATE_KEY is not set in environment variables");
