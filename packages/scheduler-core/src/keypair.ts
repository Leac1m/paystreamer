import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

/** Decodes hex to its UTF-8 string, returning '' for anything that isn't valid hex. */
function hexToUtf8(hex: string): string {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) return '';
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Builds the scheduler's signing keypair from an operator-supplied secret,
 * accepting either a bech32 `suiprivkey1...` string or that same string
 * hex-encoded (the form some secret stores hand back).
 *
 * Deliberately uses `TextDecoder` rather than `Buffer` so the same code
 * runs unchanged in a browser extension's service worker, where no Node
 * globals exist.
 */
export function parseSchedulerKeypair(secret: string): Ed25519Keypair {
  if (!secret) throw new Error('Scheduler private key is missing');

  if (secret.startsWith('suiprivkey')) {
    const decoded = decodeSuiPrivateKey(secret);
    return Ed25519Keypair.fromSecretKey(decoded.secretKey);
  }

  const decodedStr = hexToUtf8(secret);
  if (decodedStr.startsWith('suiprivkey')) {
    const decoded = decodeSuiPrivateKey(decodedStr);
    return Ed25519Keypair.fromSecretKey(decoded.secretKey);
  }

  throw new Error('Invalid scheduler private key format');
}
