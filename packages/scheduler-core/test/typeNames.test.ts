import { describe, it, expect } from 'vitest';
import { isSameCoinType, normalizeCoinType } from '../src/typeNames.js';
import { classifyPayment } from '../src/routing.js';
import { makeSub } from './helpers.js';

// The exact pair observed on the live testnet demo platform
// (0xe6baf886…eb1eb): the account's coin type comes from its object type
// string and carries the `0x` prefix, while the tier's `denomination` is a
// Move `TypeName` that gRPC encodes without one.
const ACCOUNT_DENOM = '0x74d11b1c40509335fd139b7b173328a1e1d55d2816a55b893861148d3724a61f::pusd::PUSD';
const TIER_DENOM = '74d11b1c40509335fd139b7b173328a1e1d55d2816a55b893861148d3724a61f::pusd::PUSD';

describe('normalizeCoinType', () => {
  it('adds the 0x prefix a Move TypeName omits', () => {
    expect(normalizeCoinType(TIER_DENOM)).toBe(ACCOUNT_DENOM);
  });

  it('zero-pads a short address to its canonical form', () => {
    expect(normalizeCoinType('0x2::sui::SUI')).toBe(
      '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI',
    );
  });

  it('returns an unparseable type unchanged rather than throwing mid-cycle', () => {
    expect(normalizeCoinType('0xcoin::COIN')).toBe('0xcoin::COIN');
    expect(normalizeCoinType('')).toBe('');
  });

  it('treats both encodings of one coin as the same type', () => {
    expect(isSameCoinType(ACCOUNT_DENOM, TIER_DENOM)).toBe(true);
    expect(isSameCoinType('0x2::sui::SUI', ACCOUNT_DENOM)).toBe(false);
  });
});

describe('classifyPayment regression: prefix-only difference is not a currency mismatch', () => {
  it('bills a PUSD account against a PUSD tier instead of stranding it as unroutable', () => {
    // Before the fix this returned { kind: 'unroutable' }, and payment.ts
    // skipped it — which is why five real testnet subscriptions sat unbilled
    // for up to ~3.75 days.
    const sub = makeSub({ denomination: ACCOUNT_DENOM, settlementDenomination: TIER_DENOM });
    expect(classifyPayment(sub, {})).toEqual({ kind: 'direct' });
  });

  it('still catches a genuine currency mismatch', () => {
    const sub = makeSub({ denomination: '0x2::sui::SUI', settlementDenomination: TIER_DENOM });
    expect(classifyPayment(sub, {})).toEqual({ kind: 'unroutable' });
  });

  it('matches an allowlist entry written in the short form against the padded chain type', () => {
    const pool = { poolKey: 'SUI_PUSD', isBaseToCoin: true, deepAmount: '1000000', maxSpend: '2000000000' };
    const allowlist = {
      platform1: {
        '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI': pool,
      },
    };
    const sub = makeSub({ denomination: '0x2::sui::SUI', settlementDenomination: TIER_DENOM });
    expect(classifyPayment(sub, allowlist)).toEqual({ kind: 'routed', pool });
  });
});
