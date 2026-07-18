import type { NextApiRequest, NextApiResponse } from 'next';
import { SuiGraphQLClient } from '@mysten/sui/graphql';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { bytes: bytesBase64, userSignature, userAddress } = req.body;

  if (!bytesBase64 || typeof bytesBase64 !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "bytes" field' });
  }

  if (!userSignature || typeof userSignature !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "userSignature" field' });
  }

  if (!userAddress || typeof userAddress !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "userAddress" field' });
  }

  const sponsorPrivateKey = process.env.SPONSOR_PRIVATE_KEY;
  if (!sponsorPrivateKey) {
    return res.status(500).json({ error: 'SPONSOR_PRIVATE_KEY environment variable is not configured' });
  }

  try {
    const client = new SuiGraphQLClient({
      url: 'https://graphql.testnet.sui.io/graphql',
      network: 'testnet',
    });

    // Decode the transaction bytes
    const transactionBytes = Buffer.from(bytesBase64, 'base64');

    // Recover sponsor keypair
    let sponsorKeypair: Ed25519Keypair;
    if (sponsorPrivateKey.startsWith('suiprivkey')) {
      const { secretKey } = decodeSuiPrivateKey(sponsorPrivateKey);
      sponsorKeypair = Ed25519Keypair.fromSecretKey(secretKey);
    } else {
      sponsorKeypair = Ed25519Keypair.fromSecretKey(
        new Uint8Array(Buffer.from(sponsorPrivateKey, 'hex'))
      );
    }

    // Sponsor signs the transaction
    const { signature: sponsorSignature } = await sponsorKeypair.signTransaction(transactionBytes);

    // Combine signatures: user signature first, then sponsor signature
    const signatures = [userSignature, sponsorSignature];

    // Execute the transaction
    const result = await client.executeTransaction({
      transaction: transactionBytes,
      signatures,
    });

    if (result.$kind === 'FailedTransaction') {
      const errStr = result.FailedTransaction.status.error
        ? JSON.stringify(result.FailedTransaction.status.error)
        : 'Sponsor execution failed';
      return res.status(400).json({ error: errStr });
    }

    const digest = result.Transaction?.digest;
    if (!digest) {
      return res.status(500).json({ error: 'Transaction executed but no digest returned' });
    }

    console.log(`[Sponsor API] Transaction sponsored successfully: ${digest}`);

    return res.status(200).json({ digest });
  } catch (error: any) {
    console.error('[Sponsor API] Error executing transaction:', error);
    return res.status(500).json({ error: error.message || 'Execution failed' });
  }
}
