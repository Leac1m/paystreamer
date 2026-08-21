import {
  createScheduler,
  parseRoutingAllowlist,
  type SchedulerContext,
  type SchedulerNetwork,
} from '@paystreamer/scheduler-core';
import { createRoutedPaymentExecutor } from '@paystreamer/scheduler-core/routed-payment';
import { grpcClient, gqlClient, getSchedulerKeypair, getSchedulerAddress } from '../lib/sui.js';
import {
  NETWORK,
  PACKAGE_ID,
  REGISTRY_ID,
  PAYMENT_SCHEDULER_ID,
  ROUTING_ALLOWLIST_JSON,
  DEEP_COIN_TYPE,
} from '../lib/config.js';

/**
 * The standalone service's adapter over `@paystreamer/scheduler-core`:
 * it owns `.env` loading and the `setInterval` process lifecycle, and the
 * shared package owns all the actual billing logic. The browser extension
 * is the same shape with `chrome.storage.local` and `chrome.alarms` in
 * place of these two.
 */
const keypair = getSchedulerKeypair();

export const context: SchedulerContext = {
  grpcClient,
  gqlClient,
  signer: keypair,
  senderAddress: getSchedulerAddress(),
  network: NETWORK as SchedulerNetwork,
  packageId: PACKAGE_ID,
  registryId: REGISTRY_ID,
  paymentSchedulerId: PAYMENT_SCHEDULER_ID,
  routingAllowlist: parseRoutingAllowlist(ROUTING_ALLOWLIST_JSON),
  deepCoinType: DEEP_COIN_TYPE,
};

// Assigned after construction because the executor closes over the very
// context it's attached to. This service always wires routing; a host that
// doesn't simply leaves the field undefined and routed payments are
// skipped rather than mispaid.
context.routedPaymentExecutor = createRoutedPaymentExecutor(context);

const scheduler = createScheduler(context);

let interval: ReturnType<typeof setInterval> | null = null;

export async function runCycle() {
  return scheduler.runCycle();
}

export function start(intervalMs = 15000) {
  console.log(`[Scheduler] Starting loop (${intervalMs}ms)...`);
  runCycle();
  interval = setInterval(runCycle, intervalMs);
}

export function stop() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
