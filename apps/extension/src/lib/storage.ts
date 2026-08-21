import type { SupportedNetwork } from '@paystreamer/sdk/constants';

/**
 * Typed wrapper over `chrome.storage.local`.
 *
 * Everything the extension knows lives here rather than in worker memory,
 * because an MV3 service worker is suspended whenever it's idle. The popup
 * routinely opens with no worker alive, so persisted state is the only
 * thing it can read.
 */

export const KEYS = {
  privateKey: 'paystreamer.schedulerPrivateKey',
  network: 'paystreamer.network',
  enabled: 'paystreamer.enabled',
  platformAllowlist: 'paystreamer.platformAllowlist',
  routingAllowlist: 'paystreamer.routingAllowlist',
  cycles: 'paystreamer.cycles',
} as const;

/** A summary of one billing cycle, as shown in the popup. */
export interface CycleRecord {
  at: number;
  ran: boolean;
  platformsDiscovered: number;
  platformsScanned: number;
  dueFound: number;
  succeeded: number;
  skipped: number;
  failed: number;
  digests: string[];
  error?: string;
  /** First failure message, if any — enough to show without a log console. */
  firstFailure?: string;
}

export interface Settings {
  network: SupportedNetwork;
  enabled: boolean;
  /** Empty array means "serve every platform"; the UI never writes a deliberate no-op. */
  platformAllowlist: string[];
  routingAllowlistJson: string;
}

export const DEFAULT_SETTINGS: Settings = {
  network: 'testnet',
  enabled: true,
  platformAllowlist: [],
  routingAllowlistJson: '',
};

/** Retained cycles: enough for the popup's activity list, bounded so storage can't grow without limit. */
const MAX_CYCLES = 20;

async function get<T>(key: string, fallback: T): Promise<T> {
  const stored = await chrome.storage.local.get(key);
  const value = stored[key];
  return value === undefined || value === null ? fallback : (value as T);
}

export async function loadSettings(): Promise<Settings> {
  const [network, enabled, platformAllowlist, routingAllowlistJson] = await Promise.all([
    get(KEYS.network, DEFAULT_SETTINGS.network),
    get(KEYS.enabled, DEFAULT_SETTINGS.enabled),
    get(KEYS.platformAllowlist, DEFAULT_SETTINGS.platformAllowlist),
    get(KEYS.routingAllowlist, DEFAULT_SETTINGS.routingAllowlistJson),
  ]);
  return { network, enabled, platformAllowlist, routingAllowlistJson };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.network !== undefined) update[KEYS.network] = patch.network;
  if (patch.enabled !== undefined) update[KEYS.enabled] = patch.enabled;
  if (patch.platformAllowlist !== undefined) update[KEYS.platformAllowlist] = patch.platformAllowlist;
  if (patch.routingAllowlistJson !== undefined) update[KEYS.routingAllowlist] = patch.routingAllowlistJson;
  await chrome.storage.local.set(update);
}

export async function loadCycles(): Promise<CycleRecord[]> {
  return get<CycleRecord[]>(KEYS.cycles, []);
}

/** Prepends a cycle and trims to MAX_CYCLES, newest first. */
export async function recordCycle(record: CycleRecord): Promise<CycleRecord[]> {
  const existing = await loadCycles();
  const next = [record, ...existing].slice(0, MAX_CYCLES);
  await chrome.storage.local.set({ [KEYS.cycles]: next });
  return next;
}

export async function loadPrivateKey(): Promise<string | null> {
  return get<string | null>(KEYS.privateKey, null);
}

export async function savePrivateKey(secret: string): Promise<void> {
  await chrome.storage.local.set({ [KEYS.privateKey]: secret });
}
