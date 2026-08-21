import { SuiGrpcClient } from '@mysten/sui/grpc';
import { SuiGraphQLClient } from '@mysten/sui/graphql';
import {
  createScheduler,
  parseRoutingAllowlist,
  parseSchedulerKeypair,
  type Scheduler,
  type SchedulerContext,
} from '@paystreamer/scheduler-core';
import { NETWORK, loadPrivateKey, loadRoutingAllowlistJson, networkConfig } from './config.js';

/**
 * Deliberately does NOT import `@paystreamer/scheduler-core/routed-payment`.
 * That is the only module pulling in `@mysten/deepbook-v3`, and no real
 * DeepBook liquidity exists for any PayStreamer token, so routing would be
 * dead weight in a service worker bundle. Routed payments are therefore
 * skipped rather than mispaid — see `processDuePayments`.
 */

let cached: { context: SchedulerContext; scheduler: Scheduler } | null = null;

export async function getScheduler() {
  if (cached) return cached;

  const cfg = networkConfig();
  const keypair = parseSchedulerKeypair(await loadPrivateKey());

  const context: SchedulerContext = {
    grpcClient: new SuiGrpcClient({
      network: NETWORK as any,
      baseUrl: cfg.GRPC_URL || `https://fullnode.${NETWORK}.sui.io:443`,
    }),
    gqlClient: new SuiGraphQLClient({
      network: NETWORK as any,
      url: cfg.GRAPHQL_URL,
    }),
    signer: keypair,
    senderAddress: keypair.toSuiAddress(),
    network: NETWORK,
    packageId: cfg.PACKAGE_ID,
    registryId: cfg.COIN_TYPE_REGISTRY_ID,
    paymentSchedulerId: cfg.PAYMENT_SCHEDULER_ID,
    routingAllowlist: parseRoutingAllowlist(await loadRoutingAllowlistJson()),
  };

  cached = { context, scheduler: createScheduler(context) };
  return cached;
}
