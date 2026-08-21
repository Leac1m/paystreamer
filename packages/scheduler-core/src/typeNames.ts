import { normalizeStructTag } from '@mysten/sui/utils';

/**
 * Canonicalizes a Sui coin type so two spellings of the same coin compare
 * equal.
 *
 * This is not cosmetic. The two sides the scheduler compares arrive in
 * genuinely different encodings from the chain:
 *
 *  - An account's coin type is parsed out of its object *type string*, which
 *    carries the `0x` prefix:
 *    `...::account::SubscriptionAccount<0x74d1…::pusd::PUSD>`
 *  - A tier's `denomination` is a Move `TypeName`, which gRPC encodes
 *    **without** the prefix: `74d1…::pusd::PUSD`
 *
 * Verified directly against the live testnet demo platform
 * (`0xe6baf886…eb1eb`) — a strict `===` between those two reports a
 * currency mismatch for what is literally the same coin. Short addresses
 * (`0x2::sui::SUI`) versus their zero-padded form are the same hazard.
 *
 * Anything that isn't a parseable struct tag is returned unchanged rather
 * than throwing: a malformed type from one account must never take down a
 * whole billing cycle.
 */
export function normalizeCoinType(coinType: string): string {
  try {
    return normalizeStructTag(coinType);
  } catch {
    return coinType;
  }
}

/** True when both strings denote the same coin type, whatever their encoding. */
export function isSameCoinType(a: string, b: string): boolean {
  return normalizeCoinType(a) === normalizeCoinType(b);
}
