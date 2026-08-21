import type { SuiGrpcClient } from '@mysten/sui/grpc';
import type { SuiGraphQLClient } from '@mysten/sui/graphql';
import type { Signer } from '@mysten/sui/cryptography';
import type { RoutingAllowlist, RoutingPoolConfig } from './routingConfig.js';
import type { DiscoveredSubscription } from './discovery.js';

/** The Sui `Clock` shared object, at a fixed well-known address. */
export const CLOCK_OBJECT_ID =
  '0x0000000000000000000000000000000000000000000000000000000000000006';

export type SchedulerNetwork = 'local' | 'localnet' | 'devnet' | 'testnet' | 'mainnet';

/**
 * Executes the DeepBook-routed path for one due, currency-mismatched
 * subscription. Supplied by the host rather than imported directly so
 * that `@mysten/deepbook-v3` only enters a bundle when the host actually
 * opts into routing — the same optional-peer-dependency discipline the
 * SDK's `core/deepbook` subpath entry point exists for. A host that
 * leaves this undefined has routed payments skipped, not mispaid.
 */
export type RoutedPaymentExecutor = (
  sub: DiscoveredSubscription,
  pool: RoutingPoolConfig,
) => Promise<string>;

/**
 * Everything the scheduler needs from its host environment, passed in
 * explicitly instead of read from module-level `process.env` singletons.
 *
 * This is what makes the logic runtime-agnostic: a Node service builds a
 * context from `.env` at startup, while a browser extension builds one
 * from `chrome.storage.local` after the module graph has already loaded.
 * The previous singleton form couldn't serve the second case at all — it
 * evaluated (and threw on a missing key) at import time.
 */
export interface SchedulerContext {
  /** gRPC client used for object reads, gas selection, and execution. */
  grpcClient: SuiGrpcClient;
  /** GraphQL client used for event-based platform/subscription discovery. */
  gqlClient: SuiGraphQLClient;
  /** Signs the billing transactions; its address receives the 1% scheduler fee. */
  signer: Signer;
  /** Sender address for built transactions (`signer.toSuiAddress()`). */
  senderAddress: string;
  network: SchedulerNetwork;
  packageId: string;
  /** `CoinTypeRegistry` shared object id. */
  registryId: string;
  /** `PaymentScheduler` shared object id. */
  paymentSchedulerId: string;
  /** Overridable only for tests; defaults to `CLOCK_OBJECT_ID`. */
  clockId?: string;
  /**
   * Restricts which platforms this scheduler serves. `undefined` means all
   * discovered platforms (the standalone service's behavior). An explicit
   * array means exactly those ids — and an empty array therefore means
   * none, which is a deliberate way to idle without unregistering.
   */
  platformAllowlist?: string[];
  /** Opt-in DeepBook routing config, keyed platformId -> fundingCoinType. */
  routingAllowlist: RoutingAllowlist;
  /** The DEEP coin type used to pay DeepBook trading fees. Routing is skipped if unset. */
  deepCoinType?: string;
  /** See {@link RoutedPaymentExecutor}. Omit to disable the routed path. */
  routedPaymentExecutor?: RoutedPaymentExecutor;
}

export function getClockId(ctx: SchedulerContext): string {
  return ctx.clockId ?? CLOCK_OBJECT_ID;
}
