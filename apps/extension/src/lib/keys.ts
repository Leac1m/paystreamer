import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { parseSchedulerKeypair } from '@paystreamer/scheduler-core';
import { loadPrivateKey, savePrivateKey } from './storage.js';

/**
 * Key management for the extension's scheduler identity.
 *
 * This is a **hot key stored unencrypted** in `chrome.storage.local`, and
 * the UI says so plainly. That is a deliberate trade, not an oversight: a
 * scheduler must sign every cycle unattended, so a connected wallet that
 * prompts per transaction cannot work, and passphrase-encrypting the secret
 * would stop background earning every time the service worker suspends —
 * defeating the entire point of the extension. It is treated as a low-value
 * key holding only gas plus accrued fees.
 */

/**
 * Single-flight guard around first-run generation.
 *
 * Without it, two concurrent callers — `chrome.runtime.onInstalled` and the
 * popup's first `status` request both fire at install — each read empty
 * storage, each generate a *different* keypair, and the later write wins.
 * That is not merely wasteful: the address shown to the user can be the one
 * that loses, so they could fund an address the extension no longer holds
 * the key for. Observed in a real browser before this guard existed.
 */
let inflight: Promise<Ed25519Keypair> | null = null;

async function loadOrGenerate(): Promise<Ed25519Keypair> {
  const existing = await loadPrivateKey();
  if (existing) return parseSchedulerKeypair(existing);

  const keypair = Ed25519Keypair.generate();
  await savePrivateKey(keypair.getSecretKey());
  return keypair;
}

/**
 * Returns the existing keypair, generating one on first run.
 *
 * Generation uses `Ed25519Keypair.generate()`, which draws from WebCrypto —
 * available in a service worker and permitted under the extension CSP.
 */
export async function getOrCreateKeypair(): Promise<Ed25519Keypair> {
  if (!inflight) {
    inflight = loadOrGenerate().catch((err) => {
      // Don't cache a failure; the next caller should get a fresh attempt.
      inflight = null;
      throw err;
    });
  }
  return inflight;
}

/** Drops the memo so a newly imported key is picked up. */
export function resetKeypairCache() {
  inflight = null;
}

/**
 * Replaces the stored key with an imported one. Validates before saving, so
 * a bad paste can't strand the extension with an unusable key.
 */
export async function importPrivateKey(secret: string): Promise<string> {
  const trimmed = secret.trim();
  const keypair = parseSchedulerKeypair(trimmed);
  await savePrivateKey(trimmed);
  resetKeypairCache();
  return keypair.toSuiAddress();
}

/** Reveals the secret for backup. Callers must warn the user first. */
export async function exportPrivateKey(): Promise<string | null> {
  return loadPrivateKey();
}
