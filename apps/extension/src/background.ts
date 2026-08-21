import {
  classifyPayment,
  discoverPlatforms,
  discoverSubscriptions,
  filterDueSubscriptions,
  getCurrentTime,
} from '@paystreamer/scheduler-core';
import { STORAGE_KEYS } from './config.js';
import { getScheduler } from './scheduler.js';

/**
 * Milestone 2 spike: prove a PayStreamer billing cycle can actually run
 * inside a Chrome MV3 service worker. Three things are being tested that
 * could not be assumed from `apps/portal` running the same clients in a
 * page context:
 *
 *   1. `SuiGrpcClient` / `SuiGraphQLClient` work in a service worker.
 *   2. `Ed25519Keypair` signing works under the extension CSP (no eval,
 *      no remote code, WebCrypto only).
 *   3. `chrome.alarms` drives the loop where `setInterval` cannot — a
 *      suspended MV3 worker loses its timers.
 *
 * The UI surfaces (popup, options) are Milestones 3-6; this file stays
 * deliberately thin so the spike proves the runtime, not the app.
 */

const ALARM_NAME = 'paystreamer-cycle';
/** chrome.alarms enforces a 1-minute floor, well above the standalone service's 10s. */
const PERIOD_MINUTES = 1;

type CycleRecord = {
  at: number;
  ran: boolean;
  dueFound: number;
  succeeded: number;
  skipped: number;
  failed: number;
  digests: string[];
  error?: string;
};

async function recordCycle(record: CycleRecord) {
  await chrome.storage.local.set({ [STORAGE_KEYS.lastCycle]: record });
}

/**
 * Runs one billing cycle and persists a summary. State goes to
 * `chrome.storage.local` rather than memory because the worker is
 * suspended between alarms — a popup opened later has no live worker to
 * ask, only what was written down.
 */
export async function runOneCycle(): Promise<CycleRecord> {
  const { scheduler } = await getScheduler();
  const result = await scheduler.runCycle();

  const record: CycleRecord = {
    at: Date.now(),
    ran: result.ran,
    dueFound: result.dueFound,
    succeeded: result.succeeded.length,
    skipped: result.skipped.length,
    failed: result.failed.length,
    digests: result.succeeded.map((s) => s.digest),
    error: result.error,
  };

  await recordCycle(record);
  console.log('[PayStreamer] cycle complete', record);
  return record;
}

/**
 * Discovery and classification only — no signing, no transactions. Lets the
 * spike prove the read path from a service worker without billing anyone.
 */
export async function discoverOnly() {
  const { context } = await getScheduler();
  const now = await getCurrentTime(context);
  const platforms = await discoverPlatforms(context);

  let active = 0;
  let due = 0;
  const classifications: Record<string, number> = {};

  for (const p of platforms) {
    const subs = await discoverSubscriptions(context, p.platformId);
    active += subs.length;
    for (const sub of filterDueSubscriptions(subs, now)) {
      due++;
      const kind = classifyPayment(sub, context.routingAllowlist).kind;
      classifications[kind] = (classifications[kind] ?? 0) + 1;
    }
  }

  return { clock: String(now), platforms: platforms.length, active, due, classifications };
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('[PayStreamer] installed; registering alarm');
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: PERIOD_MINUTES });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  console.log('[PayStreamer] alarm fired');
  void runOneCycle();
});

// Spike harness hook. Playwright drives the real service worker through
// this rather than waiting on a 1-minute alarm; the alarm path above is
// exercised separately by firing it directly.
Object.assign(self, {
  __paystreamerSpike: {
    runOneCycle,
    discoverOnly,
    async address() {
      const { context } = await getScheduler();
      return context.senderAddress;
    },
    async info() {
      const { context } = await getScheduler();
      return {
        address: context.senderAddress,
        network: context.network,
        packageId: context.packageId,
        routedExecutorWired: Boolean(context.routedPaymentExecutor),
      };
    },
  },
});

console.log('[PayStreamer] service worker booted');
