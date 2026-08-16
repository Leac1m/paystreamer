import { describe, it, expect, vi } from 'vitest';
import { Transaction } from '@mysten/sui/transactions';
import { buildOnboardWithSwapTx } from '../src/core/transactions';

describe('buildOnboardWithSwapTx', () => {
  it('performs the swap first, then deposits its output while creating the account and subscribing', () => {
    const tx = new Transaction();
    const moveCallSpy = vi.spyOn(tx, 'moveCall');

    const performSwap = vi.fn().mockReturnValue(tx.pure.u64(0));

    buildOnboardWithSwapTx({
      tx,
      packageId: '0xPKG',
      clockId: '0x6',
      denomination: '0xPKG::pusd::PUSD',
      platformId: '0x1',
      tierIndex: 0,
      tierAmount: 10_000_000_000n,
      tierFrequencyMs: 2_592_000_000n,
      performSwap,
    });

    expect(performSwap).toHaveBeenCalledTimes(1);

    const targets = moveCallSpy.mock.calls.map((call) => (call[0] as any).target);
    // swap happens before performSwap's caller returns, so it isn't a
    // moveCall captured by this spy directly (it's whatever the caller's
    // own swap wrapper does) -- what matters is the order of PayStreamer's
    // own calls: account creation, then deposit, then subscribe, then share.
    expect(targets).toEqual([
      '0xPKG::account::empty_policy_set',
      '0xPKG::account::create_account',
      '0xPKG::account::deposit',
      '0xPKG::account::create_subscription',
      '0xPKG::account::share_account',
    ]);

    const depositCall = moveCallSpy.mock.calls.find((c) => (c[0] as any).target === '0xPKG::account::deposit')![0] as any;
    expect(depositCall.arguments).toHaveLength(2);
    expect(depositCall.arguments[1]).toBe(performSwap.mock.results[0].value);
  });

  it('performSwap runs before any PayStreamer account/deposit calls are made', () => {
    const tx = new Transaction();
    const callOrder: string[] = [];
    const moveCallSpy = vi.spyOn(tx, 'moveCall').mockImplementation((...args) => {
      callOrder.push((args[0] as any).target);
      return (Transaction.prototype.moveCall as any).apply(tx, args);
    });
    const performSwap = vi.fn().mockImplementation(() => {
      callOrder.push('performSwap');
      return tx.pure.u64(0);
    });

    buildOnboardWithSwapTx({
      tx,
      packageId: '0xPKG',
      clockId: '0x6',
      denomination: '0xPKG::pusd::PUSD',
      platformId: '0x1',
      tierIndex: 0,
      tierAmount: 10_000_000_000n,
      tierFrequencyMs: 2_592_000_000n,
      performSwap,
    });

    expect(callOrder[0]).toBe('performSwap');
    void moveCallSpy;
  });
});
