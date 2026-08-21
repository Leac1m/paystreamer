import type { DiscoveredSubscription } from './discovery.js';
import { getRoutingPoolConfig, type RoutingAllowlist, type RoutingPoolConfig } from './routingConfig.js';
import { isSameCoinType } from './typeNames.js';

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
 * into the allowlist; otherwise it's left unpaid ('unroutable') rather
 * than mispaid, until it either gets opted in or the subscriber deposits
 * the platform's actual currency.
 *
 * The two denominations are compared by canonical coin type, not raw
 * string: an account's type comes from its object type string (`0x`-prefixed)
 * while a tier's comes from a Move `TypeName` (no prefix), so a strict
 * `===` reports a mismatch for identical coins and silently strands every
 * payment as unroutable. See `normalizeCoinType`.
 *
 * `settlementDenomination` is undefined when the tier lookup failed
 * (see `getPlatformTierDenominations`) — treated as 'direct' so a
 * transient RPC error can't itself cause a routing decision; the
 * downstream `process_due_payment` call is what will actually fail safe.
 */
export function classifyPayment(
  sub: DiscoveredSubscription,
  allowlist: RoutingAllowlist,
): PaymentClassification {
  if (!sub.settlementDenomination || isSameCoinType(sub.settlementDenomination, sub.denomination)) {
    return { kind: 'direct' };
  }

  const pool = getRoutingPoolConfig(allowlist, sub.platformId, sub.denomination);
  if (!pool) return { kind: 'unroutable' };

  return { kind: 'routed', pool };
}
