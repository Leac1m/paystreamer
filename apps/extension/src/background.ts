import { fetchSchedulerEarnings } from '@paystreamer/scheduler-core';
import { getConfig } from '@paystreamer/sdk/constants';
import type { EarningsResponse, Request, Response, StatusResponse } from './lib/messages.js';
import { exportPrivateKey, importPrivateKey } from './lib/keys.js';
import { getBalance, getScheduler, resetScheduler } from './lib/scheduler.js';
import { loadCycles, loadSettings, recordCycle, saveSettings, type CycleRecord } from './lib/storage.js';

/**
 * The MV3 background service worker.
 *
 * `chrome.alarms` drives the loop, not `setInterval`: a suspended worker
 * loses its timers, and MV3 suspends aggressively. The alarm floor is one
 * minute, versus the standalone service's ten seconds. That is a real,
 * disclosed trade rather than a defect — billing is due-time-based, not
 * latency-sensitive, so a late cycle simply bills on the next pass.
 *
 * Nothing durable is kept in module scope. Every cycle writes its summary
 * to `chrome.storage.local` so the popup, which usually opens with no
 * worker alive, has something to read.
 */

const ALARM_NAME = 'paystreamer-cycle';
const PERIOD_MINUTES = 1;

/** ~0.05 SUI. Below this, gas is nearly out and cycles will start failing. */
const LOW_GAS_THRESHOLD = 50_000_000n;

async function syncAlarm(enabled: boolean) {
  if (enabled) {
    await chrome.alarms.create(ALARM_NAME, { periodInMinutes: PERIOD_MINUTES });
  } else {
    await chrome.alarms.clear(ALARM_NAME);
  }
}

export async function runOneCycle(): Promise<CycleRecord> {
  const { scheduler } = await getScheduler();
  const result = await scheduler.runCycle();

  const record: CycleRecord = {
    at: Date.now(),
    ran: result.ran,
    platformsDiscovered: result.platformsDiscovered,
    platformsScanned: result.platformsScanned,
    dueFound: result.dueFound,
    succeeded: result.succeeded.length,
    skipped: result.skipped.length,
    failed: result.failed.length,
    digests: result.succeeded.map((s) => s.digest),
    error: result.error,
    firstFailure: result.failed[0]?.error,
  };

  // A declined overlapping cycle isn't activity; recording it would just
  // push real history out of a bounded list.
  if (record.ran) await recordCycle(record);
  console.log('[PayStreamer] cycle complete', record);
  return record;
}

async function buildStatus(): Promise<StatusResponse> {
  const { context } = await getScheduler();
  const settings = await loadSettings();
  const [cycles, alarm] = await Promise.all([loadCycles(), chrome.alarms.get(ALARM_NAME)]);

  let suiBalance = 0n;
  try {
    suiBalance = await getBalance(context, '0x2::sui::SUI');
  } catch (err) {
    console.error('[PayStreamer] failed to read gas balance', err);
  }

  return {
    address: context.senderAddress,
    network: context.network,
    enabled: settings.enabled,
    suiBalance: suiBalance.toString(),
    lowGas: suiBalance < LOW_GAS_THRESHOLD,
    nextCycleAt: alarm?.scheduledTime ?? null,
    cycles,
    settings,
  };
}

async function buildEarnings(): Promise<EarningsResponse> {
  const { context } = await getScheduler();
  const summary = await fetchSchedulerEarnings(context, { recentLimit: 10 });
  return {
    totalFee: summary.totalFee.toString(),
    paymentCount: summary.paymentCount,
    truncated: summary.truncated,
    recent: summary.recent.map((r) => ({
      digest: r.digest,
      timestampMs: r.timestampMs,
      platformId: r.platformId,
      schedulerFee: r.schedulerFee.toString(),
    })),
  };
}

/**
 * Requests testnet gas for the scheduler address. Only meaningful on
 * testnet/devnet — mainnet has no faucet, and saying so is better than a
 * button that silently does nothing.
 */
async function requestFaucet(): Promise<{ message: string }> {
  const { context } = await getScheduler();
  if (context.network !== 'testnet' && context.network !== 'devnet') {
    throw new Error(`No faucet exists for ${context.network}. Fund the address directly.`);
  }

  const response = await fetch(`https://faucet.${context.network}.sui.io/v2/gas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ FixedAmountRequest: { recipient: context.senderAddress } }),
  });

  if (!response.ok) {
    // The faucet's own body carries the useful part — a 429 says how many
    // seconds to wait. Surface that rather than guessing at the cause; the
    // limit is per source IP, not per address, so a brand-new address can be
    // refused too.
    const body = (await response.text().catch(() => '')).trim();
    throw new Error(
      body
        ? `Faucet refused the request (${response.status}): ${body}`
        : `Faucet returned ${response.status}. Try again shortly, or fund the address directly.`,
    );
  }
  return { message: 'Faucet request accepted. Gas usually arrives within a few seconds.' };
}

async function handle(request: Request): Promise<unknown> {
  switch (request.type) {
    case 'status':
      return buildStatus();
    case 'runNow':
      return runOneCycle();
    case 'earnings':
      return buildEarnings();
    case 'requestFaucet':
      return requestFaucet();
    case 'setEnabled':
      await saveSettings({ enabled: request.enabled });
      await syncAlarm(request.enabled);
      return buildStatus();
    case 'saveSettings':
      await saveSettings(request.patch);
      // Settings feed the context; drop the memo so the next cycle rebuilds.
      resetScheduler();
      if (request.patch.enabled !== undefined) await syncAlarm(request.patch.enabled);
      return buildStatus();
    case 'importKey': {
      const address = await importPrivateKey(request.secret);
      resetScheduler();
      return { address };
    }
    case 'exportKey':
      return { secret: await exportPrivateKey() };
    default:
      throw new Error(`Unknown request: ${JSON.stringify(request)}`);
  }
}

chrome.runtime.onMessage.addListener((request: Request, _sender, sendResponse) => {
  handle(request)
    .then((data) => sendResponse({ ok: true, data } satisfies Response<unknown>))
    .catch((err) => {
      console.error('[PayStreamer] request failed', request.type, err);
      sendResponse({ ok: false, error: err?.message || String(err) } satisfies Response<never>);
    });
  // Keeps the message channel open for the async work above.
  return true;
});

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await loadSettings();
  // Generating the key at install rather than on first cycle means the
  // popup can show a fundable address immediately.
  const { context } = await getScheduler();
  console.log('[PayStreamer] installed; scheduler address', context.senderAddress);
  console.log('[PayStreamer] network', getConfig(settings.network).PACKAGE_ID);
  await syncAlarm(settings.enabled);
});

chrome.runtime.onStartup.addListener(async () => {
  const settings = await loadSettings();
  await syncAlarm(settings.enabled);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  void (async () => {
    const settings = await loadSettings();
    if (!settings.enabled) {
      await chrome.alarms.clear(ALARM_NAME);
      return;
    }
    await runOneCycle();
  })();
});

// Harness hook — see scripts/spike.ts. Exposes the same `handle` the popup
// reaches through `chrome.runtime.sendMessage`, so the spike drives exactly
// the code path the UI uses rather than a parallel one.
Object.assign(self, {
  __paystreamerTest: {
    handle: async (request: Request) => {
      try {
        return { ok: true, data: await handle(request) };
      } catch (err: any) {
        return { ok: false, error: err?.message || String(err) };
      }
    },
  },
});

console.log('[PayStreamer] service worker booted');
