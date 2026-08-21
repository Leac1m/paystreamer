import { describe, it, expect, vi } from 'vitest';
import { processDuePayments } from '../src/payment.js';
import { makeContext, makeSub } from './helpers.js';
import type { RoutingAllowlist } from '../src/routingConfig.js';

const POOL = { poolKey: 'SUI_PUSD', isBaseToCoin: true, deepAmount: '1000000', maxSpend: '2000000000' };
const ALLOWLIST: RoutingAllowlist = { platform1: { '0x2::sui::SUI': POOL } };

const MISMATCHED = { denomination: '0x2::sui::SUI', settlementDenomination: '0xcoin::PUSD' };

describe('processDuePayments', () => {
  it('skips an unroutable mismatch instead of billing it in the wrong coin', async () => {
    const ctx = makeContext({ routingAllowlist: {} });
    const result = await processDuePayments(ctx, [makeSub(MISMATCHED)]);

    expect(result.skipped).toEqual([{ accountId: 'acc1', reason: 'unroutable' }]);
    expect(result.succeeded).toEqual([]);
    // Never reached the plain billing path, which is the whole point.
    expect(ctx.grpcClient.core.listCoins).not.toHaveBeenCalled();
  });

  it('skips a routed payment when the host wired no routed executor, rather than falling through', async () => {
    const ctx = makeContext({ routingAllowlist: ALLOWLIST });
    const result = await processDuePayments(ctx, [makeSub(MISMATCHED)]);

    expect(result.skipped).toEqual([{ accountId: 'acc1', reason: 'no-routed-executor' }]);
    expect(ctx.grpcClient.core.listCoins).not.toHaveBeenCalled();
  });

  it('delegates an opted-in mismatch to the routed executor and reports the digest', async () => {
    const routedPaymentExecutor = vi.fn().mockResolvedValue('0xdigest');
    const ctx = makeContext({ routingAllowlist: ALLOWLIST, routedPaymentExecutor });
    const sub = makeSub(MISMATCHED);

    const result = await processDuePayments(ctx, [sub]);

    expect(routedPaymentExecutor).toHaveBeenCalledWith(sub, POOL);
    expect(result.succeeded).toEqual([
      { accountId: 'acc1', platformId: 'platform1', digest: '0xdigest', amount: 5_000_000n, routed: true },
    ]);
    expect(result.failed).toEqual([]);
  });

  it('records a routed failure and keeps going instead of aborting the batch', async () => {
    const routedPaymentExecutor = vi
      .fn()
      .mockRejectedValueOnce(new Error('no liquidity'))
      .mockResolvedValueOnce('0xdigest2');
    const ctx = makeContext({ routingAllowlist: ALLOWLIST, routedPaymentExecutor });

    const result = await processDuePayments(ctx, [
      makeSub({ ...MISMATCHED, accountId: 'acc1' }),
      makeSub({ ...MISMATCHED, accountId: 'acc2' }),
    ]);

    expect(result.failed).toEqual([{ accountId: 'acc1', error: 'no liquidity' }]);
    expect(result.succeeded.map((s) => s.accountId)).toEqual(['acc2']);
  });
});
