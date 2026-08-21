/**
 * End-to-end verification: load the built extension into a real Chromium and
 * drive it the way a user would.
 *
 * Real Chrome behavior is only knowable in a real Chrome — the unit tests in
 * `test/` fake `chrome.*`, so this script is what proves the service worker,
 * alarms, storage, popup, and options page actually work together.
 *
 * Pass `--execute` to let it bill real due payments on testnet, and
 * `--wait-alarm` to also wait ~60s and prove the alarm fires on its own.
 *
 *   pnpm build
 *   pnpm spike
 *   pnpm spike -- --execute --wait-alarm
 */
import { chromium, type Worker } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '..', 'dist');
const EXECUTE = process.argv.includes('--execute');
const WAIT_ALARM = process.argv.includes('--wait-alarm');

/**
 * A funded testnet key, supplied by the operator — never committed.
 *
 * Export one from the Sui CLI and pass it in:
 *   SCHEDULER_PRIVATE_KEY=$(sui keytool export --key-identity <address> --json | jq -r .exportedPrivateKey) \
 *     pnpm spike -- --execute
 *
 * Only `--execute` needs it; the read-only run exercises key generation and
 * every UI surface without one.
 */
const FUNDED_TESTNET_KEY = process.env.SCHEDULER_PRIVATE_KEY;

let stepNumber = 0;
function step(label: string) {
  stepNumber++;
  console.log(`\n--- ${stepNumber}. ${label} ---`);
}
function ok(message: string) {
  console.log(`   ✓ ${message}`);
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function callWorker<T>(worker: Worker, request: unknown): Promise<T> {
  const response: any = await worker.evaluate(
    async (req) => (self as any).__paystreamerTest.handle(req),
    request,
  );
  if (!response.ok) throw new Error(response.error);
  return response.data as T;
}

async function readCycles(worker: Worker): Promise<any[]> {
  return worker.evaluate(async () => {
    const all = await chrome.storage.local.get('paystreamer.cycles');
    return all['paystreamer.cycles'] ?? [];
  });
}

async function main() {
  assert(
    fs.existsSync(path.join(EXTENSION_PATH, 'manifest.json')),
    `No build at ${EXTENSION_PATH}. Run \`pnpm build\` first.`,
  );

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paystreamer-spike-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  });

  try {
    step('MV3 service worker registers and boots');
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 30_000 });
    worker.on('console', (msg) => console.log(`   [sw] ${msg.text()}`));
    const extensionId = new URL(worker.url()).host;
    ok(`registered (extension id ${extensionId})`);

    step('A signing key is generated on first install, under the extension CSP');
    const generated = await callWorker<any>(worker, { type: 'status' });
    assert(/^0x[0-9a-f]{64}$/.test(generated.address), `Not a Sui address: ${generated.address}`);
    ok(`generated fresh address ${generated.address.slice(0, 10)}… with no key in the source`);
    ok(`gas balance reads ${generated.suiBalance} MIST — correctly zero and flagged lowGas=${generated.lowGas}`);
    assert(generated.lowGas, 'A brand-new address should be flagged as low on gas.');

    if (FUNDED_TESTNET_KEY) {
      step('Importing a funded key replaces the generated one');
      await callWorker(worker, { type: 'importKey', secret: FUNDED_TESTNET_KEY });
      const imported = await callWorker<any>(worker, { type: 'status' });
      assert(imported.address !== generated.address, 'Import did not replace the generated key.');
      ok(`address is now ${imported.address.slice(0, 10)}…, gas ${imported.suiBalance} MIST`);
      assert(!imported.lowGas, 'Imported address has no gas — fund it before running with --execute.');
    } else {
      step('Importing a funded key — SKIPPED (no SCHEDULER_PRIVATE_KEY in env)');
    }

    step('Sui clients reach testnet from the service worker');
    const earningsBefore = await callWorker<any>(worker, { type: 'earnings' });
    ok(`earnings query returned ${earningsBefore.paymentCount} historical payments, ${earningsBefore.totalFee} MIST of fees`);

    step(EXECUTE ? 'Full billing cycle — REAL transactions' : 'Billing cycle skipped (pass --execute to bill)');
    if (EXECUTE && !FUNDED_TESTNET_KEY) {
      throw new Error('--execute needs SCHEDULER_PRIVATE_KEY in the environment to have gas.');
    }
    if (EXECUTE) {
      const cycle = await callWorker<any>(worker, { type: 'runNow' });
      console.log(`   ${JSON.stringify(cycle)}`);
      assert(cycle.ran, 'Cycle declined to run.');
      assert(cycle.failed === 0, `Cycle had ${cycle.failed} failures: ${cycle.firstFailure}`);
      ok(`${cycle.dueFound} due, ${cycle.succeeded} billed, ${cycle.skipped} skipped, ${cycle.failed} failed`);
      const history = await readCycles(worker);
      assert(history.length > 0, 'Cycle was not persisted for the popup to read.');
      ok(`persisted ${history.length} cycle record(s) for a popup that was not alive for them`);
    }

    step('The alarm drives the loop, and pausing clears it');
    let alarms = await worker.evaluate(() => chrome.alarms.getAll());
    assert(alarms.length === 1, `Expected one alarm, got ${alarms.length}`);
    ok(`alarm registered at ${alarms[0].periodInMinutes}-minute period (chrome.alarms' floor)`);

    await callWorker(worker, { type: 'setEnabled', enabled: false });
    alarms = await worker.evaluate(() => chrome.alarms.getAll());
    assert(alarms.length === 0, 'Pausing did not clear the alarm.');
    ok('pausing cleared the alarm, so a paused extension does no work');

    await callWorker(worker, { type: 'setEnabled', enabled: true });
    alarms = await worker.evaluate(() => chrome.alarms.getAll());
    assert(alarms.length === 1, 'Resuming did not re-register the alarm.');
    ok('resuming re-registered it');

    if (WAIT_ALARM) {
      // chrome.alarms has a 1-minute floor and no API to force-fire, so this
      // genuinely waits. Polls persisted state rather than holding a promise
      // open in the worker, which suspension would kill — and which is how
      // the popup observes cycles it was not alive for.
      const before = (await readCycles(worker))[0]?.at ?? 0;
      console.log('   waiting up to 150s for the alarm to fire on its own...');
      const deadline = Date.now() + 150_000;
      let latest = before;
      while (Date.now() < deadline && latest <= before) {
        await new Promise((r) => setTimeout(r, 5_000));
        latest = (await readCycles(worker))[0]?.at ?? before;
      }
      assert(latest > before, 'Alarm never drove a cycle within 150s.');
      ok(`alarm fired ~${Math.round((latest - before) / 1000)}s later and drove a cycle with no page open`);
    }

    step('Popup renders real state');
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await popup.waitForSelector('text=PayStreamer Scheduler', { timeout: 15_000 });
    await popup.waitForSelector('text=Fees earned', { timeout: 15_000 });
    try {
      await popup.waitForFunction(() => /PUSD/.test(document.body.innerText), undefined, {
        timeout: 30_000,
      });
    } catch {
      throw new Error(`Popup never rendered a PUSD figure. Rendered:\n${await popup.locator('body').innerText()}`);
    }
    const popupText = await popup.locator('body').innerText();
    assert(popupText.includes('Running'), 'Popup does not show a running state.');
    assert(!/NaN|undefined|Infinity/.test(popupText), `Popup rendered a broken value:\n${popupText}`);
    console.log(`   ${popupText.replace(/\n/g, '\n   ')}`);
    ok('popup rendered earnings, gas, last cycle, and recent payments');

    step('Options page renders and saves');
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    await options.waitForSelector('text=Scheduler identity', { timeout: 15_000 });
    const optionsText = await options.locator('body').innerText();
    assert(
      optionsText.includes('This key is stored unencrypted'),
      'Options page does not disclose the unencrypted key.',
    );
    const currentAddress = (await callWorker<any>(worker, { type: 'status' })).address;
    assert(optionsText.includes(currentAddress), 'Options page does not show the scheduler address.');

    await options.getByPlaceholder('0x…').fill('0xtest-platform-id');
    await options.getByRole('button', { name: 'Save platforms' }).click();
    await options.waitForSelector('text=Platform allowlist saved.', { timeout: 10_000 });
    const saved = await callWorker<any>(worker, { type: 'status' });
    assert(
      saved.settings.platformAllowlist.includes('0xtest-platform-id'),
      'Platform allowlist did not persist.',
    );
    ok('options page disclosed the key warning, showed the address, and persisted a settings change');

    // Leave the profile in a clean state rather than with a bogus allowlist.
    await callWorker(worker, { type: 'saveSettings', patch: { platformAllowlist: [] } });

    console.log('\n=== ALL CHECKS PASSED ===');
    if (!EXECUTE) console.log('No transactions were signed or submitted. Re-run with --execute to bill.');
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
