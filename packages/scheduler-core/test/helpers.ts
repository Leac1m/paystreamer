import { vi } from 'vitest';
import type { SchedulerContext } from '../src/context.js';
import type { DiscoveredSubscription } from '../src/discovery.js';

/**
 * A `SchedulerContext` whose clients are plain vitest mocks. Injecting the
 * context is what replaced the old `vi.mock('../src/lib/sui.js')` module
 * stubbing — the fakes are now ordinary values, so a test can vary config
 * per case instead of per module.
 */
export function makeContext(overrides: Partial<SchedulerContext> = {}): SchedulerContext {
  return {
    grpcClient: {
      core: {
        getObject: vi.fn(),
        getObjects: vi.fn(),
        listCoins: vi.fn(),
        executeTransaction: vi.fn(),
      },
      waitForTransaction: vi.fn(),
    } as any,
    gqlClient: { query: vi.fn() } as any,
    signer: { signTransaction: vi.fn() } as any,
    senderAddress: '0xscheduler',
    network: 'testnet',
    packageId: '0xmock',
    registryId: '0xregistry',
    paymentSchedulerId: '0xpaymentscheduler',
    routingAllowlist: {},
    ...overrides,
  };
}

export function makeSub(overrides: Partial<DiscoveredSubscription> = {}): DiscoveredSubscription {
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
