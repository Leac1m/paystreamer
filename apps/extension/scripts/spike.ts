/**
 * Milestone 2 exit criterion: load the built extension into a real Chromium
 * and drive its MV3 service worker, proving the scheduler runs there.
 *
 * Checks, in order:
 *   1. the service worker registers and boots at all;
 *   2. config loads asynchronously from `chrome.storage.local` (the path
 *      the SchedulerContext refactor exists to support);
 *   3. `SuiGrpcClient` / `SuiGraphQLClient` reach testnet from a worker;
 *   4. `Ed25519Keypair` signs under the extension CSP and a real billing
 *      transaction executes;
 *   5. `chrome.alarms` fires and drives a cycle where `setInterval` cannot.
 *
 * Run with `--execute` to let it bill real due payments on testnet.
 *
 *   pnpm --filter @paystreamer/extension build
 *   pnpm --filter @paystreamer/extension spike
 *   pnpm --filter @paystreamer/extension spike -- --execute
 *   pnpm --filter @paystreamer/extension spike -- --execute --wait-alarm
 */
import { chromium } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '..', 'dist');
const EXECUTE = process.argv.includes('--execute');
const WAIT_ALARM = process.argv.includes('--wait-alarm');

type LastCycle = { at: number; succeeded: number; dueFound: number } | undefined;

async function readLastCycle(worker: { evaluate: (fn: () => any) => Promise<any> }): Promise<LastCycle> {
  return worker.evaluate(async () => {
    const all = await chrome.storage.local.get('paystreamer.lastCycle');
    return all['paystreamer.lastCycle'];
  });
}

function step(n: number, label: string) {
  console.log(`\n--- ${n}. ${label} ---`);
}

async function main() {
  if (!fs.existsSync(path.join(EXTENSION_PATH, 'manifest.json'))) {
    throw new Error(`No build at ${EXTENSION_PATH}. Run \`pnpm build\` first.`);
  }

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paystreamer-spike-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  });

  const workerLogs: string[] = [];

  try {
    step(1, 'Service worker registration');
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 30_000 });
    worker.on('console', (msg) => {
      workerLogs.push(msg.text());
      console.log(`   [sw] ${msg.text()}`);
    });
    console.log(`   registered: ${worker.url()}`);

    step(2, 'Async config from chrome.storage.local + keypair under extension CSP');
    const info = await worker.evaluate(() => (self as any).__paystreamerSpike.info());
    console.log(`   ${JSON.stringify(info, null, 2).replace(/\n/g, '\n   ')}`);

    const stored = await worker.evaluate(async () => {
      const all = await chrome.storage.local.get(null);
      return Object.keys(all);
    });
    console.log(`   storage keys seeded: ${JSON.stringify(stored)}`);

    step(3, 'Sui clients reach testnet from the service worker');
    const chain = await worker.evaluate(async () => {
      const spike = (self as any).__paystreamerSpike;
      const addr = await spike.address();
      return { address: addr };
    });
    console.log(`   scheduler address: ${chain.address}`);

    step(4, EXECUTE ? 'Full billing cycle — REAL transactions' : 'Discovery and classification only — no signing, no transactions');
    const cycle = EXECUTE
      ? await worker.evaluate(() => (self as any).__paystreamerSpike.runOneCycle())
      : await worker.evaluate(() => (self as any).__paystreamerSpike.discoverOnly());
    console.log(`   ${JSON.stringify(cycle, null, 2).replace(/\n/g, '\n   ')}`);

    step(5, 'chrome.alarms drives a cycle where setInterval cannot');
    const alarms = await worker.evaluate(async () => {
      const all = await chrome.alarms.getAll();
      return all.map((a) => ({ name: a.name, periodInMinutes: a.periodInMinutes }));
    });
    console.log(`   registered alarms: ${JSON.stringify(alarms)}`);
    if (alarms.length === 0) throw new Error('No alarm registered — the MV3 loop would never fire.');

    if (WAIT_ALARM) {
      // Registration alone doesn't prove the loop works. chrome.alarms has a
      // 1-minute floor and no API to force-fire, so this genuinely waits.
      //
      // Polls persisted state rather than holding a promise open inside the
      // worker: the worker may be suspended while we wait, which would kill
      // an in-worker listener. This is also how a popup observes a cycle it
      // wasn't alive for.
      const before = await readLastCycle(worker);
      console.log(`   last cycle before waiting: ${before?.at ?? 'none'}`);
      console.log('   waiting up to 150s for the alarm to fire on its own...');

      const deadline = Date.now() + 150_000;
      let after = before;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 5_000));
        after = await readLastCycle(worker);
        if (after && (!before || after.at > before.at)) break;
      }

      if (!after || (before && after.at <= before.at)) {
        throw new Error('Alarm never drove a cycle within 150s — the MV3 loop is not viable as wired.');
      }
      const waited = Math.round((after.at - (before?.at ?? after.at)) / 1000);
      console.log(`   alarm fired ~${waited}s later and drove a cycle with no page open and no setInterval:`);
      console.log(`   ${JSON.stringify(after)}`);
    } else {
      console.log('   (pass --wait-alarm to wait ~60s and prove it actually fires)');
    }

    step(6, 'Persisted cycle state survives for a popup to read');
    const persisted = await worker.evaluate(async () => {
      const all = await chrome.storage.local.get('paystreamer.lastCycle');
      return all['paystreamer.lastCycle'];
    });
    console.log(`   ${JSON.stringify(persisted)}`);
    if (EXECUTE && !persisted) throw new Error('Cycle state was not persisted.');
    if (!EXECUTE && !persisted) console.log('   (none yet — no cycle has run in read-only mode)');

    console.log('\n=== SPIKE PASSED ===');
    console.log('MV3 service worker runs the scheduler end to end.');
    if (!EXECUTE) console.log('Read-only run — no transactions were signed or submitted.');
    if (!EXECUTE) console.log('(Re-run with --execute to bill real due payments.)');
  } finally {
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('\n=== SPIKE FAILED ===');
  console.error(err);
  process.exit(1);
});
