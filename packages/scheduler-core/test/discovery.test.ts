import { describe, it, expect } from 'vitest';
import {
  discoverPlatforms,
  discoverSubscriptions,
  filterDueSubscriptions,
  getPlatformTierDenominations,
} from '../src/discovery.js';
import { makeContext } from './helpers.js';

describe('discovery', () => {
  it('discoverPlatforms parses graphql nodes correctly and checks last: 50', async () => {
    const ctx = makeContext();
    (ctx.gqlClient.query as any).mockResolvedValueOnce({
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

    const platforms = await discoverPlatforms(ctx);
    expect(platforms).toEqual([
      { platformId: '0x1' },
      { platformId: '0x2' }
    ]);
    expect(ctx.gqlClient.query).toHaveBeenCalledWith(expect.objectContaining({
      query: expect.stringContaining('last: 50')
    }));
  });

  it('discoverPlatforms derives the event type from the context package id', async () => {
    const ctx = makeContext({ packageId: '0xdeadbeef' });
    (ctx.gqlClient.query as any).mockResolvedValueOnce({ data: { events: { nodes: [] } } });

    await discoverPlatforms(ctx);
    expect(ctx.gqlClient.query).toHaveBeenCalledWith(expect.objectContaining({
      variables: { eventType: '0xdeadbeef::platform::PlatformRegistered' }
    }));
  });

  it('discoverSubscriptions filters by status 0, and attaches tier index/amount and settlement denomination', async () => {
    const ctx = makeContext();
    (ctx.gqlClient.query as any).mockResolvedValueOnce({
      data: {
        events: {
          nodes: [
            { contents: { json: { platform_id: '0x1', account_id: 'acc1' } } }
          ]
        }
      }
    });

    (ctx.grpcClient.core.getObjects as any).mockResolvedValueOnce({
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

    (ctx.grpcClient.core.getObject as any).mockResolvedValueOnce({
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

    const subs = await discoverSubscriptions(ctx, '0x1');
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
    const ctx = makeContext();
    (ctx.grpcClient.core.getObject as any).mockResolvedValueOnce({
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

    const denominations = await getPlatformTierDenominations(ctx, '0x1');
    // Canonicalized on the way out, so it can be compared against an
    // account's `0x`-prefixed, zero-padded coin type.
    expect(denominations.get(0)).toBe(
      '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI',
    );
    expect(denominations.get(1)).toBe('0xcoin::PUSD');
  });

  it('getPlatformTierDenominations returns an empty map and does not throw on RPC failure', async () => {
    const ctx = makeContext();
    (ctx.grpcClient.core.getObject as any).mockRejectedValueOnce(new Error('boom'));

    const denominations = await getPlatformTierDenominations(ctx, '0x1');
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
