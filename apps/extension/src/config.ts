import { getConfig, type SupportedNetwork } from '@paystreamer/sdk/constants';

/**
 * Imported from `@paystreamer/sdk/constants`, a subpath entry point added
 * for this app. The SDK's root barrel re-exports `./react` and `./ui`, so
 * importing `getConfig` from it would drag React into a service worker
 * bundle that has no DOM to render into.
 */
export const NETWORK: SupportedNetwork = 'testnet';

export const STORAGE_KEYS = {
  privateKey: 'paystreamer.schedulerPrivateKey',
  routingAllowlist: 'paystreamer.routingAllowlist',
  lastCycle: 'paystreamer.lastCycle',
} as const;

/**
 * The demo scheduler key this repo already ships hardcoded as a non-mainnet
 * fallback in `apps/scheduler/src/lib/config.ts`. Used only to seed the
 * spike so it has a funded testnet address; Milestone 4 replaces this with
 * real first-run key generation and an import/export flow.
 */
const SPIKE_SEED_KEY = 'suiprivkey1qr4shgju6rsqyz3dyyg5nhtfla3hld4x6k98ayuc382q8ck0mp68cduyj45';

/**
 * Reads the signing key from `chrome.storage.local`, seeding it on first
 * run. This is the asynchronous, post-module-load config path that the
 * whole `SchedulerContext` refactor exists to support — the old
 * `process.env` singletons evaluated at import time and could not be
 * satisfied here at all.
 */
export async function loadPrivateKey(): Promise<string> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.privateKey);
  const existing = stored[STORAGE_KEYS.privateKey];
  if (typeof existing === 'string' && existing.length > 0) return existing;

  await chrome.storage.local.set({ [STORAGE_KEYS.privateKey]: SPIKE_SEED_KEY });
  return SPIKE_SEED_KEY;
}

export async function loadRoutingAllowlistJson(): Promise<string | undefined> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.routingAllowlist);
  const raw = stored[STORAGE_KEYS.routingAllowlist];
  return typeof raw === 'string' ? raw : undefined;
}

export function networkConfig() {
  return getConfig(NETWORK);
}
