import type { CycleRecord, Settings } from './storage.js';

/**
 * The popup and options page talk to the service worker through
 * `chrome.runtime.sendMessage`. They cannot import its module state: the
 * worker is suspended between alarms, and a message is what wakes it.
 */

export type Request =
  | { type: 'status' }
  | { type: 'runNow' }
  | { type: 'setEnabled'; enabled: boolean }
  | { type: 'earnings' }
  | { type: 'requestFaucet' }
  | { type: 'importKey'; secret: string }
  | { type: 'exportKey' }
  | { type: 'saveSettings'; patch: Partial<Settings> };

export interface StatusResponse {
  address: string;
  network: string;
  enabled: boolean;
  suiBalance: string;
  /** Below this, gas is about to run out and cycles will start failing. */
  lowGas: boolean;
  nextCycleAt: number | null;
  cycles: CycleRecord[];
  settings: Settings;
}

export interface EarningsResponse {
  totalFee: string;
  paymentCount: number;
  truncated: boolean;
  recent: {
    digest: string;
    timestampMs: number;
    platformId: string;
    schedulerFee: string;
  }[];
}

export type Response<T> = { ok: true; data: T } | { ok: false; error: string };

export async function send<T>(request: Request): Promise<T> {
  const response = (await chrome.runtime.sendMessage(request)) as Response<T>;
  if (!response) throw new Error('No response from the service worker.');
  if (!response.ok) throw new Error(response.error);
  return response.data;
}
