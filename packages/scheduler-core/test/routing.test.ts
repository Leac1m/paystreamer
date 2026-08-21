import { describe, it, expect } from 'vitest';
import { classifyPayment } from '../src/routing.js';
import { parseRoutingAllowlist, type RoutingAllowlist } from '../src/routingConfig.js';
import { makeSub } from './helpers.js';

const POOL = { poolKey: 'SUI_PUSD', isBaseToCoin: true, deepAmount: '1000000', maxSpend: '2000000000' };

const ALLOWLIST: RoutingAllowlist = {
  platform1: { '0x2::sui::SUI': POOL },
};

describe('classifyPayment', () => {
  it('classifies same-currency accounts as direct', () => {
    const sub = makeSub({ denomination: '0xcoin::USDC', settlementDenomination: '0xcoin::USDC' });
    expect(classifyPayment(sub, ALLOWLIST)).toEqual({ kind: 'direct' });
  });

  it('classifies as direct when settlementDenomination is unknown (failed tier lookup), never routes on missing data', () => {
    const sub = makeSub({ denomination: '0x2::sui::SUI', settlementDenomination: undefined });
    expect(classifyPayment(sub, ALLOWLIST)).toEqual({ kind: 'direct' });
  });

  it('classifies a mismatched currency as unroutable when the platform has not opted in', () => {
    const sub = makeSub({ denomination: '0x2::sui::SUI', settlementDenomination: '0xcoin::PUSD' });
    expect(classifyPayment(sub, {})).toEqual({ kind: 'unroutable' });
  });

  it('classifies a mismatched currency as unroutable when the platform opted in a different funding currency', () => {
    const sub = makeSub({ denomination: '0xcoin::WBTC', settlementDenomination: '0xcoin::PUSD' });
    expect(classifyPayment(sub, ALLOWLIST)).toEqual({ kind: 'unroutable' });
  });

  it('classifies a mismatched currency as routed when the platform has opted in for that funding currency', () => {
    const sub = makeSub({ denomination: '0x2::sui::SUI', settlementDenomination: '0xcoin::PUSD' });
    expect(classifyPayment(sub, ALLOWLIST)).toEqual({ kind: 'routed', pool: POOL });
  });
});

describe('parseRoutingAllowlist', () => {
  it('parses a real allowlist payload, canonicalizing the funding-coin keys', () => {
    // The operator writes the short, natural form; the chain reports the
    // zero-padded one, so the key is canonicalized at parse time.
    expect(parseRoutingAllowlist(JSON.stringify(ALLOWLIST))).toEqual({
      platform1: {
        '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI': POOL,
      },
    });
  });

  it('returns an empty allowlist for missing config rather than throwing', () => {
    expect(parseRoutingAllowlist(undefined)).toEqual({});
    expect(parseRoutingAllowlist('')).toEqual({});
  });

  it('disables routing on malformed JSON instead of taking the cycle down', () => {
    expect(parseRoutingAllowlist('{not json')).toEqual({});
  });
});
