import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/lib/routingConfig.js', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/routingConfig.js')>('../src/lib/routingConfig.js');
  return {
    ...actual,
    getRoutingPoolConfig: vi.fn(),
  };
});

import { classifyPayment } from '../src/scheduler/routing.js';
import { getRoutingPoolConfig } from '../src/lib/routingConfig.js';
import { DiscoveredSubscription } from '../src/scheduler/discovery.js';

function makeSub(overrides: Partial<DiscoveredSubscription> = {}): DiscoveredSubscription {
  return {
    accountId: 'acc1',
    platformId: 'platform1',
    nextBillingTime: 1000n,
    denomination: '0xcoin::USDC',
    tierIndex: 0,
    tierAmount: 5_000_000n,
    settlementDenomination: '0xcoin::USDC',
    ...overrides,
  };
}

describe('classifyPayment', () => {
  it('classifies same-currency accounts as direct', () => {
    const sub = makeSub({ denomination: '0xcoin::USDC', settlementDenomination: '0xcoin::USDC' });
    expect(classifyPayment(sub)).toEqual({ kind: 'direct' });
    expect(getRoutingPoolConfig).not.toHaveBeenCalled();
  });

  it('classifies as direct when settlementDenomination is unknown (failed tier lookup), never routes on missing data', () => {
    const sub = makeSub({ denomination: '0xcoin::USDC', settlementDenomination: undefined });
    expect(classifyPayment(sub)).toEqual({ kind: 'direct' });
    expect(getRoutingPoolConfig).not.toHaveBeenCalled();
  });

  it('classifies a mismatched currency as unroutable when the platform has not opted in', () => {
    (getRoutingPoolConfig as any).mockReturnValueOnce(undefined);
    const sub = makeSub({ denomination: '0x2::sui::SUI', settlementDenomination: '0xcoin::PUSD' });

    expect(classifyPayment(sub)).toEqual({ kind: 'unroutable' });
    expect(getRoutingPoolConfig).toHaveBeenCalledWith('platform1', '0x2::sui::SUI');
  });

  it('classifies a mismatched currency as routed when the platform has opted in for that funding currency', () => {
    const pool = { poolKey: 'SUI_PUSD', isBaseToCoin: true, deepAmount: '1000000', maxSpend: '2000000000' };
    (getRoutingPoolConfig as any).mockReturnValueOnce(pool);
    const sub = makeSub({ denomination: '0x2::sui::SUI', settlementDenomination: '0xcoin::PUSD' });

    expect(classifyPayment(sub)).toEqual({ kind: 'routed', pool });
  });
});
