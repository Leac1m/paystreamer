import { SuiGrpcClient } from '@mysten/sui/grpc';
import { SuiGraphQLClient } from '@mysten/sui/graphql';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { NETWORK, SUI_RPC_URL, GRAPHQL_URL, SCHEDULER_PRIVATE_KEY } from './config.js';

const netStr = NETWORK as string;
const targetNetwork = netStr === 'localnet' ? 'local' : netStr;
const defaultRpcUrl = (netStr === 'local' || netStr === 'localnet') ? 'http://127.0.0.1:9000' : `https://fullnode.${targetNetwork}.sui.io:443`;
const defaultGraphqlUrl = (netStr === 'local' || netStr === 'localnet') ? 'http://127.0.0.1:8000/graphql' : `https://graphql.${targetNetwork}.sui.io/graphql`;

export const grpcClient = new SuiGrpcClient({
  network: targetNetwork as any,
  baseUrl: SUI_RPC_URL || defaultRpcUrl,
});

export const gqlClient = new SuiGraphQLClient({
  network: (targetNetwork === 'local' ? 'localnet' : targetNetwork) as any,
  url: GRAPHQL_URL || defaultGraphqlUrl,
});

export function getSchedulerKeypair() {
  if (!SCHEDULER_PRIVATE_KEY) throw new Error("SCHEDULER_PRIVATE_KEY is missing");
  // Check if it's a bech32 string starts with 'suiprivkey'
  if (SCHEDULER_PRIVATE_KEY.startsWith('suiprivkey')) {
    const decoded = decodeSuiPrivateKey(SCHEDULER_PRIVATE_KEY);
    return Ed25519Keypair.fromSecretKey(decoded.secretKey);
  }
  
  // Otherwise try hex
  const decodedStr = Buffer.from(SCHEDULER_PRIVATE_KEY, 'hex').toString('utf8');
  if (decodedStr.startsWith('suiprivkey')) {
    const decoded = decodeSuiPrivateKey(decodedStr);
    return Ed25519Keypair.fromSecretKey(decoded.secretKey);
  }
  
  throw new Error("Invalid SCHEDULER_PRIVATE_KEY format");
}

export function getSchedulerAddress() {
  return getSchedulerKeypair().toSuiAddress();
}
