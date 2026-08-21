import { describe, it, expect, beforeEach } from 'vitest';
import { installFakeChrome } from './fakeChrome.js';

installFakeChrome();

const { DEFAULT_SETTINGS, loadCycles, loadSettings, recordCycle, saveSettings, KEYS } = await import(
  '../src/lib/storage.js'
);

function cycle(at: number) {
  return {
    at,
    ran: true,
    platformsDiscovered: 8,
    platformsScanned: 8,
    dueFound: 1,
    succeeded: 1,
    skipped: 0,
    failed: 0,
    digests: [`0x${at}`],
  };
}

describe('settings', () => {
  beforeEach(async () => {
    await chrome.storage.local.clear();
  });

  it('returns defaults when nothing has been stored', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('persists a partial patch without clobbering the other fields', async () => {
    await saveSettings({ enabled: false });
    await saveSettings({ network: 'devnet' });

    const settings = await loadSettings();
    expect(settings.enabled).toBe(false);
    expect(settings.network).toBe('devnet');
    expect(settings.platformAllowlist).toEqual([]);
  });

  it('round-trips a platform allowlist', async () => {
    await saveSettings({ platformAllowlist: ['0xa', '0xb'] });
    expect((await loadSettings()).platformAllowlist).toEqual(['0xa', '0xb']);
  });

  it('treats a stored false as a real value, not as missing', async () => {
    // A naive `stored[key] || fallback` would silently flip this back to true.
    await chrome.storage.local.set({ [KEYS.enabled]: false });
    expect((await loadSettings()).enabled).toBe(false);
  });
});

describe('cycle history', () => {
  beforeEach(async () => {
    await chrome.storage.local.clear();
  });

  it('starts empty', async () => {
    expect(await loadCycles()).toEqual([]);
  });

  it('records newest first', async () => {
    await recordCycle(cycle(1));
    await recordCycle(cycle(2));
    expect((await loadCycles()).map((c) => c.at)).toEqual([2, 1]);
  });

  it('caps history so storage cannot grow without limit', async () => {
    for (let i = 0; i < 30; i++) await recordCycle(cycle(i));
    const cycles = await loadCycles();
    expect(cycles).toHaveLength(20);
    expect(cycles[0].at).toBe(29);
    expect(cycles.at(-1)!.at).toBe(10);
  });
});
