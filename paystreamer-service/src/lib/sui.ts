import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
import { SPONSOR_PRIVATE_KEY, SPONSOR_ADDRESS, SUI_RPC_URL } from './config.js';

// Initialize SuiClient
export const client = new SuiClient({
  url: SUI_RPC_URL,
});

// Initialize sponsor keypair
let sponsorKeypair: Ed25519Keypair | null = null;

export function getSponsorKeypair(): Ed25519Keypair {
  if (!sponsorKeypair) {
    if (!SPONSOR_PRIVATE_KEY) {
      throw new Error('SPONSOR_PRIVATE_KEY is not set in environment variables');
    }
    // The private key is stored as base64
    const secretKey = fromBase64(SPONSOR_PRIVATE_KEY);
    sponsorKeypair = Ed25519Keypair.fromSecretKey(secretKey);
  }
  return sponsorKeypair;
}

export function getSponsorAddress(): string {
  if (!SPONSOR_ADDRESS) {
    throw new Error('SPONSOR_ADDRESS is not set in environment variables');
  }
  return SPONSOR_ADDRESS;
}

export async function signAndSubmitTransaction(
  transaction: Transaction,
  userSignature: string,
  userAddress: string
): Promise<{ digest: string }> {
  const sponsorKeypair = getSponsorKeypair();
  const sponsorAddress = getSponsorAddress();

  // Build the transaction bytes
  const builtTx = transaction.build({ client });

  // Sponsor signs the transaction
  const sponsorSignature = await sponsorKeypair.signTransaction(builtTx);

  // Combine signatures: user signature first, then sponsor signature
  const signatures = [userSignature, sponsorSignature];

  // Execute the transaction
  const result = await client.executeTransaction({
    transaction: builtTx,
    signatures,
    options: {
      showEffects: true,
      showEvents: true,
    },
  });

  return { digest: result.digest };
}

export { Transaction, toBase64, fromBase64 };
