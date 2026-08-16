import { describe, it, expect, vi, beforeEach } from 'vitest';
import { discoverPlatforms, discoverSubscriptions, filterDueSubscriptions, getCurrentTime, getPlatformTierDenominations } from '../src/scheduler/discovery.js';
import { gqlClient, grpcClient } from '../src/lib/sui.js';

vi.mock('../src/lib/sui.js', () => ({
  gqlClient: {
    query: vi.fn()
  },
  grpcClient: {
    core: {
      getObjects: vi.fn(),
      getObject: vi.fn()
    }
  }
}));

vi.mock('../src/lib/config.js', () => ({
  PACKAGE_ID: '0xmock'
}));

describe('discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('discoverPlatforms parses graphql nodes correctly and checks last: 50', async () => {
    (gqlClient.query as any).mockResolvedValueOnce({
      data: {
        events: {
          nodes: [
            { contents: { json: { platform_id: '0x1' } } },
            { contents: { json: { id: '0x2' } } },
            { contents: null }
          ]
        }
      }
    });

    const platforms = await discoverPlatforms();
    expect(platforms).toEqual([
      { platformId: '0x1' },
      { platformId: '0x2' }
    ]);
    expect(gqlClient.query).toHaveBeenCalledWith(expect.objectContaining({
      query: expect.stringContaining('last: 50')
    }));
  });

  it('discoverSubscriptions filters by status 0, and attaches tier index/amount and settlement denomination', async () => {
    (gqlClient.query as any).mockResolvedValueOnce({
      data: {
        events: {
          nodes: [
            { contents: { json: { platform_id: '0x1', account_id: 'acc1' } } }
          ]
        }
      }
    });

    (grpcClient.core.getObjects as any).mockResolvedValueOnce({
      objects: [
        {
          objectId: 'acc1',
          type: '0xmock::account::Account<0xcoin::COIN>',
          json: {
            subscriptions: {
              fields: {
                contents: [
                  {
                    fields: {
                      key: '0x1',
                      value: {
                        fields: {
                          status: 0,
                          next_billing_time: '1000',
                          tier_index: '0',
                          tier_amount: '5000'
                        }
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      ]
    });

    (grpcClient.core.getObject as any).mockResolvedValueOnce({
      object: {
        json: {
          tiers: {
            contents: [
              { key: '0', value: { denomination: '0xcoin::PLATFORM_COIN' } }
            ]
          }
        }
      }
    });

    const subs = await discoverSubscriptions('0x1');
    expect(subs).toEqual([
      {
        accountId: 'acc1',
        platformId: '0x1',
        nextBillingTime: 1000n,
        denomination: '0xcoin::COIN',
        tierIndex: 0,
        tierAmount: 5000n,
        settlementDenomination: '0xcoin::PLATFORM_COIN',
      }
    ]);
  });

  it('getPlatformTierDenominations unwraps the tier VecMap into an index -> denomination map', async () => {
    (grpcClient.core.getObject as any).mockResolvedValueOnce({
      object: {
        json: {
          tiers: {
            contents: [
              { key: '0', value: { denomination: '0x2::sui::SUI', name: 'Basic' } },
              { key: '1', value: { denomination: '0xcoin::PUSD', name: 'Pro' } }
            ]
          }
        }
      }
    });

    const denominations = await getPlatformTierDenominations('0x1');
    expect(denominations.get(0)).toBe('0x2::sui::SUI');
    expect(denominations.get(1)).toBe('0xcoin::PUSD');
  });

  it('getPlatformTierDenominations returns an empty map and does not throw on RPC failure', async () => {
    (grpcClient.core.getObject as any).mockRejectedValueOnce(new Error('boom'));

    const denominations = await getPlatformTierDenominations('0x1');
    expect(denominations.size).toBe(0);
  });

  it('filterDueSubscriptions correctly filters based on time', () => {
    const subs = [
      { accountId: '1', platformId: 'p', nextBillingTime: 500n, denomination: 'd', tierIndex: 0, tierAmount: 0n },
      { accountId: '2', platformId: 'p', nextBillingTime: 1000n, denomination: 'd', tierIndex: 0, tierAmount: 0n },
      { accountId: '3', platformId: 'p', nextBillingTime: 1500n, denomination: 'd', tierIndex: 0, tierAmount: 0n },
    ];

    const due = filterDueSubscriptions(subs, 1000n);
    expect(due).toHaveLength(2);
    expect(due.map(d => d.accountId)).toEqual(['1', '2']);
  });
});
