import { config } from 'dotenv';
import { getConfig, SupportedNetwork } from '@paystreamer/sdk';
config({ path: '../../.env' }); // Load from root

const isTestMode = process.env.NODE_ENV === 'test' || process.env.VITEST;
export const NETWORK = (process.env.VITE_NETWORK || process.env.NETWORK || (isTestMode ? 'local' : 'testnet')) as SupportedNetwork;
const networkConfig = getConfig(NETWORK);

export const SUI_RPC_URL = process.env.VITE_SUI_RPC_URL;
export const GRAPHQL_URL = process.env.VITE_GRAPHQL_URL || networkConfig.GRAPHQL_URL;
export const PACKAGE_ID = networkConfig.PACKAGE_ID;
export const REGISTRY_ID = networkConfig.COIN_TYPE_REGISTRY_ID;
export const PAYMENT_SCHEDULER_ID = networkConfig.PAYMENT_SCHEDULER_ID;
/**
 * Supplied by the operator; never hardcoded.
 *
 * This previously fell back to a key committed in this file for any
 * non-mainnet network. That was a real exposure — the key was readable by
 * anyone with the repo, and it controlled a funded testnet address that was
 * also a developer's CLI identity. A convenience default for a *signing key*
 * is never worth it: a missing key should stop the process, not silently
 * sign as somebody else.
 */
export const SCHEDULER_PRIVATE_KEY = (process.env.SCHEDULER_PRIVATE_KEY || process.env.SPONSOR_PRIVATE_KEY) as string;
export const PUSD_TYPE_ARG = networkConfig.PUSD_TYPE_ARG;

/** Opt-in DeepBook routing, keyed platformId -> fundingCoinType. See `@paystreamer/scheduler-core`'s `parseRoutingAllowlist`. */
export const ROUTING_ALLOWLIST_JSON = process.env.ROUTING_ALLOWLIST_JSON;
/** The DEEP token's coin type, needed to pay DeepBook trading fees. Routing is skipped if unset. */
export const DEEP_COIN_TYPE = process.env.DEEP_COIN_TYPE;

if (!SCHEDULER_PRIVATE_KEY) {
  throw new Error(
    'SCHEDULER_PRIVATE_KEY is not set. Export a funded key from the Sui CLI ' +
      '(`sui keytool export --key-identity <address>`) and put it in the root .env ' +
      'as SCHEDULER_PRIVATE_KEY=suiprivkey1... — see .env.example.',
  );
}
