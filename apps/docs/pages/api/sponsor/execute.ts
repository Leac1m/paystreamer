import type { NextApiRequest, NextApiResponse } from 'next';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

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
    const client = new SuiGrpcClient({
      network: 'testnet',
      baseUrl: 'https://fullnode.testnet.sui.io:443',
    });

    // Decode the transaction bytes
    const transactionBytes = Buffer.from(bytesBase64, 'base64');

    // Recover sponsor keypair
    const sponsorKeypair = Ed25519Keypair.fromSecretKey(sponsorPrivateKey);

    // Sponsor signs the transaction
    const { signature: sponsorSignature } = await sponsorKeypair.signTransaction(transactionBytes);

    // Combine signatures: user signature first, then sponsor signature
    const signatures = [userSignature, sponsorSignature];

    // Execute the transaction
    const result = await client.core.executeTransaction({
      transaction: transactionBytes,
      signatures,
      include: {
        effects: true,
        events: true,
      },
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
