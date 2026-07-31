import { NextRequest, NextResponse } from 'next/server';
import { SuiGrpcClient as SuiClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

const getRpcUrl = (network: string) => {
  if (network === 'localnet' || network === 'local') return 'http://127.0.0.1:9000';
  return `https://fullnode.${network}.sui.io:443`;
};

const isTestMode = process.env.NODE_ENV === 'test' || process.env.NEXT_PUBLIC_IS_TEST_MODE === 'true';
const SUI_NETWORK = (process.env.NEXT_PUBLIC_NETWORK || (isTestMode ? 'localnet' : 'testnet')) as 'localnet' | 'devnet' | 'testnet' | 'mainnet';
const client = new SuiClient({ 
  baseUrl: getRpcUrl(SUI_NETWORK),
  network: SUI_NETWORK === 'localnet' ? 'local' : SUI_NETWORK as any
});

function getSponsorKeypair() {
  const privateKey = process.env.SPONSOR_PRIVATE_KEY || (isTestMode ? process.env.E2E_PRIVATE_KEY : undefined);
  if (!privateKey) {
    throw new Error('SPONSOR_PRIVATE_KEY or E2E_PRIVATE_KEY is missing');
  }
  let bech32Key = privateKey.trim();
  if (!bech32Key.startsWith('suiprivkey')) {
    bech32Key = Buffer.from(bech32Key, 'hex').toString('utf8');
  }
  const { secretKey } = decodeSuiPrivateKey(bech32Key);
  return Ed25519Keypair.fromSecretKey(secretKey);
}

function getSponsorAddress() {
  if (process.env.SPONSOR_ADDRESS) {
    return process.env.SPONSOR_ADDRESS;
  }
  // Automatically derive address from private key if SPONSOR_ADDRESS is omitted
  return getSponsorKeypair().toSuiAddress();
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

function corsJson(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders });
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
        return corsJson({ error: 'Missing parameters', code: 'VALIDATION_ERROR' }, 400);
      }

      const transaction = Transaction.from(txJson);
      transaction.setSender(userAddress);
      
      const sponsorAddress = getSponsorAddress();
      transaction.setGasOwner(sponsorAddress);

      const coins = await client.listCoins({
        owner: sponsorAddress,
        coinType: '0x2::sui::SUI',
      });

      if (coins.objects.length === 0) {
        return corsJson({ error: 'Sponsor has no gas', code: 'SUBMISSION_FAILED' }, 400);
      }

      const gasCoin = coins.objects[0];
      transaction.setGasPayment([{
        objectId: gasCoin.objectId,
        digest: gasCoin.digest,
        version: gasCoin.version,
      }]);
      transaction.setGasBudget(50000000);

      const builtTx = await transaction.build({ client });
      return corsJson({ bytes: Buffer.from(builtTx).toString('base64') });

    } else if (action === 'execute') {
      const { bytes, userSignature, userAddress } = body;
      if (!bytes || !userSignature || !userAddress) {
        return corsJson({ error: 'Missing parameters', code: 'VALIDATION_ERROR' }, 400);
      }

      const transactionBytes = Buffer.from(bytes, 'base64');
      const sponsorKeypair = getSponsorKeypair();
      const { signature: sponsorSignature } = await sponsorKeypair.signTransaction(transactionBytes);

      const signatures = [userSignature, sponsorSignature];
      const result = await client.executeTransaction({
        transaction: transactionBytes,
        signatures,
      });

      if (result.$kind === 'FailedTransaction') {
        const errStr = result.FailedTransaction.status.error ? JSON.stringify(result.FailedTransaction.status.error) : 'Sponsor execution failed';
        return corsJson({ error: errStr, code: 'SUBMISSION_FAILED' }, 400);
      }

      return corsJson({ digest: result.Transaction?.digest || '' });
    } else {
      return corsJson({ error: 'Invalid action', code: 'VALIDATION_ERROR' }, 404);
    }

  } catch (error: any) {
    console.error('[API Sponsor] Error:', error);
    return corsJson({ error: error?.message || 'Internal server error', code: 'SUBMISSION_FAILED' }, 500);
  }
}
