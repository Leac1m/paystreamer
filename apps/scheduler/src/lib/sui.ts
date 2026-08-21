import { SuiGrpcClient } from '@mysten/sui/grpc';
import { SuiGraphQLClient } from '@mysten/sui/graphql';
import { parseSchedulerKeypair } from '@paystreamer/scheduler-core';
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
  return parseSchedulerKeypair(SCHEDULER_PRIVATE_KEY);
}

export function getSchedulerAddress() {
  return getSchedulerKeypair().toSuiAddress();
}
