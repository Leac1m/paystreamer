import { DiscoveredSubscription } from './discovery.js';
import { getRoutingPoolConfig, RoutingPoolConfig } from '../lib/routingConfig.js';

export type PaymentClassification =
  | { kind: 'direct' }
  | { kind: 'routed'; pool: RoutingPoolConfig }
  | { kind: 'unroutable' };

/**
 * Decides how a due subscription should be paid.
 *
 * `process_due_payment` never checks the account's actual coin type
 * against the platform tier's declared `denomination` on-chain — so a
 * currency-mismatched account would otherwise get silently billed in the
 * wrong coin. This classifier is what prevents that: same-currency
 * accounts (the common case — every demo platform today) always take the
 * plain payment path unchanged. A mismatch only routes through DeepBook
 * if the operator has explicitly opted the platform+funding-currency pair
 * into `ROUTING_ALLOWLIST_JSON`; otherwise it's left unpaid ('unroutable')
 * rather than mispaid, until it either gets opted in or the subscriber
 * deposits the platform's actual currency.
 *
 * `settlementDenomination` is undefined when the tier lookup failed
 * (see `getPlatformTierDenominations`) — treated as 'direct' so a
 * transient RPC error can't itself cause a routing decision; the
 * downstream `process_due_payment` call is what will actually fail safe.
 */
export function classifyPayment(sub: DiscoveredSubscription): PaymentClassification {
  if (!sub.settlementDenomination || sub.settlementDenomination === sub.denomination) {
    return { kind: 'direct' };
  }

  const pool = getRoutingPoolConfig(sub.platformId, sub.denomination);
  if (!pool) return { kind: 'unroutable' };

  return { kind: 'routed', pool };
}
