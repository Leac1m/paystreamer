import { describe, it, expect } from 'vitest';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { parseSchedulerKeypair } from '../src/keypair.js';

const KEYPAIR = Ed25519Keypair.generate();
const BECH32 = KEYPAIR.getSecretKey();

function toHex(value: string): string {
  return Array.from(new TextEncoder().encode(value))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('parseSchedulerKeypair', () => {
  it('accepts a bech32 suiprivkey string', () => {
    expect(parseSchedulerKeypair(BECH32).toSuiAddress()).toBe(KEYPAIR.toSuiAddress());
  });

  it('accepts the same key hex-encoded, without depending on Node Buffer', () => {
    expect(parseSchedulerKeypair(toHex(BECH32)).toSuiAddress()).toBe(KEYPAIR.toSuiAddress());
  });

  it('rejects an empty secret', () => {
    expect(() => parseSchedulerKeypair('')).toThrow(/missing/i);
  });

  it('rejects a secret that is neither bech32 nor hex-encoded bech32', () => {
    expect(() => parseSchedulerKeypair('not-a-key')).toThrow(/Invalid scheduler private key/);
    expect(() => parseSchedulerKeypair(toHex('hello world'))).toThrow(/Invalid scheduler private key/);
  });
});
