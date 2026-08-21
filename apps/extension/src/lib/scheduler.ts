import { SuiGrpcClient } from '@mysten/sui/grpc';
import { SuiGraphQLClient } from '@mysten/sui/graphql';
import { getConfig } from '@paystreamer/sdk/constants';
import {
  createScheduler,
  parseRoutingAllowlist,
  type Scheduler,
  type SchedulerContext,
} from '@paystreamer/scheduler-core';
import { getOrCreateKeypair } from './keys.js';
import { loadSettings, type Settings } from './storage.js';

/**
 * Builds the `SchedulerContext` from settings held in `chrome.storage.local`.
 *
 * Deliberately does NOT import `@paystreamer/scheduler-core/routed-payment`.
 * That is the only module pulling in `@mysten/deepbook-v3`, and no real
 * DeepBook liquidity exists for any PayStreamer token, so routing would be
 * dead weight in a service worker bundle. Routed payments are therefore
 * skipped rather than mispaid.
 *
 * `@paystreamer/sdk/constants` rather than the SDK root: the root barrel
 * re-exports `./react` and `./ui`, which would drag React into a worker
 * with no DOM to render into.
 */

let cached: { context: SchedulerContext; scheduler: Scheduler; settings: Settings } | null = null;

function buildContext(settings: Settings, keypair: Awaited<ReturnType<typeof getOrCreateKeypair>>): SchedulerContext {
  const cfg = getConfig(settings.network);
  const net = settings.network === 'local' ? 'localnet' : settings.network;

  return {
    grpcClient: new SuiGrpcClient({
      network: settings.network as any,
      baseUrl: cfg.GRPC_URL || `https://fullnode.${net}.sui.io:443`,
    }),
    gqlClient: new SuiGraphQLClient({
      network: net as any,
      url: cfg.GRAPHQL_URL,
    }),
    signer: keypair,
    senderAddress: keypair.toSuiAddress(),
    network: settings.network,
    packageId: cfg.PACKAGE_ID,
    registryId: cfg.COIN_TYPE_REGISTRY_ID,
    paymentSchedulerId: cfg.PAYMENT_SCHEDULER_ID,
    // An empty allowlist in settings means "serve everything", so it maps to
    // `undefined` here rather than to an empty array, which core reads as a
    // deliberate idle.
    platformAllowlist: settings.platformAllowlist.length > 0 ? settings.platformAllowlist : undefined,
    routingAllowlist: parseRoutingAllowlist(settings.routingAllowlistJson || undefined),
  };
}

/**
 * Returns a scheduler bound to current settings, rebuilding it whenever
 * settings change so an options-page edit takes effect on the next cycle
 * without needing the worker restarted.
 */
export async function getScheduler() {
  const settings = await loadSettings();
  if (cached && JSON.stringify(cached.settings) === JSON.stringify(settings)) {
    return cached;
  }

  const keypair = await getOrCreateKeypair();
  const context = buildContext(settings, keypair);
  cached = { context, scheduler: createScheduler(context), settings };
  return cached;
}

/** Drops the memoized context, e.g. after a key import. */
export function resetScheduler() {
  cached = null;
}

/** Total balance of a coin type. Uses `getBalance`, never a `listCoins` page sum. */
export async function getBalance(context: SchedulerContext, coinType: string): Promise<bigint> {
  const res: any = await (context.grpcClient as any).core.getBalance({
    owner: context.senderAddress,
    coinType,
  });
  return BigInt(res.balance.balance);
}
