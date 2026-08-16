import { describe, it, expect, vi } from 'vitest';
import { Transaction } from '@mysten/sui/transactions';
import { buildProcessRoutedPaymentTx } from '../src/core/transactions';

describe('buildProcessRoutedPaymentTx', () => {
  const baseParams = {
    packageId: '0xPKG',
    registryId: '0xREGISTRY',
    clockId: '0x6',
    fundingCoinType: '0xPKG::usdc::USDC',
    platformCoinType: '0xPKG::pusd::PUSD',
    accountId: '0xACCOUNT',
    platformId: '0xPLATFORM',
    platformInitVersion: 1,
    schedulerId: '0xSCHEDULER',
    schedulerInitVersion: 1,
    maxSpend: 100_000_000n,
  };

  it('withdraws via scheduler::withdraw_for_route, calls performSwap with the withdrawn coin, then settles via process_routed_payment', () => {
    const tx = new Transaction();
    const moveCallSpy = vi.spyOn(tx, 'moveCall');

    let capturedFundingCoinArg: any;
    const performSwap = vi.fn().mockImplementation((fundingCoin: any) => {
      capturedFundingCoinArg = fundingCoin;
      return {
        platformCoin: tx.pure.u64(0),
        fundingChange: fundingCoin,
      };
    });

    buildProcessRoutedPaymentTx({ tx, ...baseParams, performSwap });

    expect(performSwap).toHaveBeenCalledTimes(1);
    expect(capturedFundingCoinArg).toBeDefined();

    const targets = moveCallSpy.mock.calls.map((call) => (call[0] as any).target);
    expect(targets).toEqual([
      '0xPKG::policies::empty_limiters',
      '0xPKG::policies::ensure_initialized',
      '0xPKG::scheduler::withdraw_for_route',
      '0xPKG::scheduler::process_routed_payment',
    ]);

    const withdrawCall = moveCallSpy.mock.calls.find((c) => (c[0] as any).target === '0xPKG::scheduler::withdraw_for_route')![0] as any;
    expect(withdrawCall.typeArguments).toEqual([baseParams.fundingCoinType, baseParams.platformCoinType]);
    // arguments: [schedulerRef, platformRef, account, limiters, clock, maxSpend]
    expect(withdrawCall.arguments).toHaveLength(6);

    const settleCall = moveCallSpy.mock.calls.find((c) => (c[0] as any).target === '0xPKG::scheduler::process_routed_payment')![0] as any;
    expect(settleCall.typeArguments).toEqual([baseParams.fundingCoinType, baseParams.platformCoinType]);
    // arguments: [registry, schedulerRef, potato, platformRef, account, platformCoin, fundingChange, clock]
    expect(settleCall.arguments).toHaveLength(8);

    // the potato withdraw_for_route returned must be the exact one settle consumes.
    const [, withdrawPotato] = moveCallSpy.mock.results[2].value as [any, any];
    expect(settleCall.arguments[2]).toBe(withdrawPotato);
  });
});
