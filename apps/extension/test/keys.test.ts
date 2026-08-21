import { describe, it, expect, beforeEach } from 'vitest';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { installFakeChrome } from './fakeChrome.js';

installFakeChrome();

const { getOrCreateKeypair, importPrivateKey, exportPrivateKey, resetKeypairCache } = await import(
  '../src/lib/keys.js',
);
const { loadPrivateKey } = await import('../src/lib/storage.js');

describe('key management', () => {
  beforeEach(async () => {
    // Reset both halves of the state: cleared storage plus a dropped memo is
    // what a fresh worker lifetime actually looks like.
    await chrome.storage.local.clear();
    resetKeypairCache();
  });

  it('generates a key on first run and persists it', async () => {
    const first = await getOrCreateKeypair();
    expect(await loadPrivateKey()).toBe(first.getSecretKey());
  });

  it('reuses the stored key across worker restarts, keeping the same address', async () => {
    const first = await getOrCreateKeypair();
    // A fresh worker lifetime: storage survives, the in-memory memo does not.
    resetKeypairCache();
    const second = await getOrCreateKeypair();

    expect(second.toSuiAddress()).toBe(first.toSuiAddress());
  });

  it('imports a valid key and reports its address', async () => {
    const other = Ed25519Keypair.generate();
    const address = await importPrivateKey(other.getSecretKey());

    expect(address).toBe(other.toSuiAddress());
    expect(await exportPrivateKey()).toBe(other.getSecretKey());
  });

  it('tolerates surrounding whitespace from a paste', async () => {
    const other = Ed25519Keypair.generate();
    const address = await importPrivateKey(`  ${other.getSecretKey()}\n`);
    expect(address).toBe(other.toSuiAddress());
  });

  it('rejects a bad key without overwriting the working one', async () => {
    const original = await getOrCreateKeypair();
    await expect(importPrivateKey('not-a-key')).rejects.toThrow(/Invalid scheduler private key/);
    expect(await loadPrivateKey()).toBe(original.getSecretKey());
  });
});

describe('concurrent first run', () => {
  beforeEach(async () => {
    await chrome.storage.local.clear();
    resetKeypairCache();
  });

  it('generates exactly one key when several callers race at install', async () => {
    // chrome.runtime.onInstalled and the popup's first status request both
    // fire at install. Without a single-flight guard each generated its own
    // key and the later write won, so the address shown to the user could be
    // one the extension no longer held the key for.
    const results = await Promise.all([
      getOrCreateKeypair(),
      getOrCreateKeypair(),
      getOrCreateKeypair(),
    ]);

    const addresses = new Set(results.map((r) => r.toSuiAddress()));
    expect(addresses.size).toBe(1);
    expect(await loadPrivateKey()).toBe(results[0].getSecretKey());
  });

  it('picks up an imported key rather than serving the memoized one', async () => {
    const original = await getOrCreateKeypair();
    const other = Ed25519Keypair.generate();
    await importPrivateKey(other.getSecretKey());

    const after = await getOrCreateKeypair();
    expect(after.toSuiAddress()).toBe(other.toSuiAddress());
    expect(after.toSuiAddress()).not.toBe(original.toSuiAddress());
  });
});
