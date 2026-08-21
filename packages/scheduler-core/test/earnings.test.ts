import { describe, it, expect } from 'vitest';
import { fetchSchedulerEarnings } from '../src/earnings.js';
import { makeContext } from './helpers.js';

function node(fee: string, digest: string, ts = '2026-08-21T10:00:00.000Z') {
  return {
    timestamp: ts,
    transaction: { digest },
    contents: {
      json: {
        account_id: '0xacc',
        platform_id: '0xplat',
        amount: '10000000000',
        scheduler_fee: fee,
      },
    },
  };
}

function page(nodes: any[], hasNextPage = false, endCursor: string | null = null) {
  return { data: { events: { pageInfo: { hasNextPage, endCursor }, nodes } } };
}

describe('fetchSchedulerEarnings', () => {
  it('sums scheduler_fee, not the billed amount', async () => {
    const ctx = makeContext();
    (ctx.gqlClient.query as any).mockResolvedValueOnce(
      page([node('100000000', '0xa'), node('100000000', '0xb')]),
    );

    const summary = await fetchSchedulerEarnings(ctx);
    expect(summary.totalFee).toBe(200000000n);
    expect(summary.paymentCount).toBe(2);
    expect(summary.truncated).toBe(false);
  });

  it('attributes by transaction sender, since the event has no scheduler address', async () => {
    const ctx = makeContext({ senderAddress: '0xme', packageId: '0xpkg' });
    (ctx.gqlClient.query as any).mockResolvedValueOnce(page([]));

    await fetchSchedulerEarnings(ctx);
    expect(ctx.gqlClient.query).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          sender: '0xme',
          type: '0xpkg::payment::PaymentProcessed',
        }),
      }),
    );
  });

  it('follows pagination and returns the newest payments first', async () => {
    const ctx = makeContext();
    (ctx.gqlClient.query as any)
      .mockResolvedValueOnce(page([node('1', '0xoldest')], true, 'cursor1'))
      .mockResolvedValueOnce(page([node('2', '0xnewest')], false));

    const summary = await fetchSchedulerEarnings(ctx);
    expect(summary.totalFee).toBe(3n);
    expect(summary.paymentCount).toBe(2);
    expect(summary.recent.map((r) => r.digest)).toEqual(['0xnewest', '0xoldest']);
    expect((ctx.gqlClient.query as any).mock.calls[1][0].variables.after).toBe('cursor1');
  });

  it('caps retained history to recentLimit while still counting everything', async () => {
    const ctx = makeContext();
    (ctx.gqlClient.query as any).mockResolvedValueOnce(
      page([node('1', '0xa'), node('1', '0xb'), node('1', '0xc')]),
    );

    const summary = await fetchSchedulerEarnings(ctx, { recentLimit: 2 });
    expect(summary.paymentCount).toBe(3);
    expect(summary.totalFee).toBe(3n);
    expect(summary.recent.map((r) => r.digest)).toEqual(['0xc', '0xb']);
  });

  it('reports truncation instead of silently understating the total', async () => {
    const ctx = makeContext();
    (ctx.gqlClient.query as any).mockResolvedValue(page([node('5', '0xa')], true, 'more'));

    const summary = await fetchSchedulerEarnings(ctx, { maxPages: 2 });
    expect(summary.truncated).toBe(true);
    expect(summary.paymentCount).toBe(2);
  });
});
