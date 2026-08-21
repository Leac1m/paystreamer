/**
 * Runtime-agnostic PayStreamer scheduler logic.
 *
 * Every entry point takes an explicit {@link SchedulerContext} rather than
 * reading module-level environment singletons, so the same code drives both
 * the standalone Node service (`apps/scheduler`, config from `.env` at
 * startup) and a browser extension (config from `chrome.storage.local`,
 * which only resolves after the module graph has loaded).
 *
 * The DeepBook-routed payment path lives behind the separate
 * `@paystreamer/scheduler-core/routed-payment` entry point so that
 * `@mysten/deepbook-v3` never enters a bundle that doesn't opt into it.
 */
export {
  CLOCK_OBJECT_ID,
  getClockId,
  type RoutedPaymentExecutor,
  type SchedulerContext,
  type SchedulerNetwork,
} from './context.js';

export {
  discoverPlatforms,
  discoverSubscriptions,
  filterDueSubscriptions,
  getCurrentTime,
  getPlatformTierDenominations,
  type DiscoveredPlatform,
  type DiscoveredSubscription,
} from './discovery.js';

export {
  processDuePayments,
  type PaymentFailure,
  type PaymentRunResult,
  type PaymentSkip,
  type PaymentSuccess,
} from './payment.js';

export { classifyPayment, type PaymentClassification } from './routing.js';

export {
  getRoutingPoolConfig,
  parseRoutingAllowlist,
  type RoutingAllowlist,
  type RoutingPoolConfig,
} from './routingConfig.js';

export { createScheduler, runCycle, type CycleResult, type Scheduler } from './cycle.js';

export { parseSchedulerKeypair } from './keypair.js';

export { isSameCoinType, normalizeCoinType } from './typeNames.js';
