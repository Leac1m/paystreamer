import { NextRequest, NextResponse } from 'next/server';
import { SuiJsonRpcClient as SuiClient } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

const getFullnodeUrl = (network: string) => {
  if (network === 'localnet' || network === 'local') return 'http://127.0.0.1:9000';
  return `https://fullnode.${network}.sui.io:443`;
};

const SUI_NETWORK = (process.env.NEXT_PUBLIC_NETWORK || 'localnet') as 'localnet' | 'devnet' | 'testnet' | 'mainnet';
const client = new SuiClient({ 
  url: getFullnodeUrl(SUI_NETWORK),
  network: SUI_NETWORK === 'localnet' ? 'local' : SUI_NETWORK as any
});

function getSponsorKeypair() {
  const privateKey = process.env.SPONSOR_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('SPONSOR_PRIVATE_KEY is missing');
  }
  const bech32Key = Buffer.from(privateKey, 'hex').toString('utf8');
  const { secretKey } = decodeSuiPrivateKey(bech32Key);
  return Ed25519Keypair.fromSecretKey(secretKey);
}

function getSponsorAddress() {
  const address = process.env.SPONSOR_ADDRESS;
  if (!address) {
    throw new Error('SPONSOR_ADDRESS is missing');
  }
  return address;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  try {
    const { action } = await params;
    const body = await request.json();

    if (action === 'prepare') {
      const { transaction: txJson, userAddress } = body;
      if (!txJson || !userAddress) {
        return NextResponse.json({ error: 'Missing parameters', code: 'VALIDATION_ERROR' }, { status: 400 });
      }

      const transaction = Transaction.from(txJson);
      transaction.setSender(userAddress);
      
      const sponsorAddress = getSponsorAddress();
      transaction.setGasOwner(sponsorAddress);

      const coins = await client.getCoins({
        owner: sponsorAddress,
        coinType: '0x2::sui::SUI',
      });

      if (coins.data.length === 0) {
        return NextResponse.json({ error: 'Sponsor has no gas', code: 'SUBMISSION_FAILED' }, { status: 400 });
      }

      const gasCoin = coins.data[0];
      transaction.setGasPayment([{
        objectId: gasCoin.coinObjectId,
        digest: gasCoin.digest,
        version: gasCoin.version,
      }]);
      transaction.setGasBudget(50000000);

      const builtTx = await transaction.build({ client });
      return NextResponse.json({ bytes: Buffer.from(builtTx).toString('base64') });

    } else if (action === 'execute') {
      const { bytes, userSignature, userAddress } = body;
      if (!bytes || !userSignature || !userAddress) {
        return NextResponse.json({ error: 'Missing parameters', code: 'VALIDATION_ERROR' }, { status: 400 });
      }

      const transactionBytes = Buffer.from(bytes, 'base64');
      const sponsorKeypair = getSponsorKeypair();
      const { signature: sponsorSignature } = await sponsorKeypair.signTransaction(transactionBytes);

      const signatures = [userSignature, sponsorSignature];
      const result = await client.executeTransactionBlock({
        transactionBlock: transactionBytes,
        signature: signatures,
        options: { showEffects: true, showEvents: true },
      });

      return NextResponse.json({ digest: result.digest });
    } else {
      return NextResponse.json({ error: 'Invalid action', code: 'VALIDATION_ERROR' }, { status: 404 });
    }

  } catch (error) {
    console.error('[API Sponsor] Error:', error);
    return NextResponse.json({ error: 'Internal server error', code: 'SUBMISSION_FAILED' }, { status: 500 });
  }
}
