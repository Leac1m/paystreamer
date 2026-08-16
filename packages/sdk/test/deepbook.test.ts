import { describe, it, expect, vi } from 'vitest';

const { mockSwapExactQuantity, MockDeepBookClient } = vi.hoisted(() => {
  const mockSwapExactQuantity = vi.fn();
  const MockDeepBookClient = vi.fn().mockImplementation(function (this: any, options: any) {
    this.__options = options;
    this.deepBook = { swapExactQuantity: mockSwapExactQuantity };
  });
  return { mockSwapExactQuantity, MockDeepBookClient };
});

vi.mock('@mysten/deepbook-v3', () => ({
  DeepBookClient: MockDeepBookClient,
}));

import { createDeepBookClient, swapExactQuantity } from '../src/core/deepbook';

describe('core/deepbook', () => {
  it('createDeepBookClient constructs a DeepBookClient with the given options', () => {
    const client = {} as any;
    const coins = { USDC: { address: '0x1', type: '0x2::usdc::USDC', scalar: 6 } } as any;
    const pools = { 'USDC_PUSD': { address: '0xPOOL', baseCoin: 'USDC', quoteCoin: 'PUSD' } } as any;

    const deepbook = createDeepBookClient({ client, address: '0xSENDER', network: 'testnet', coins, pools });

    expect(MockDeepBookClient).toHaveBeenCalledWith({ client, address: '0xSENDER', network: 'testnet', coins, pools });
    expect(deepbook).toBeDefined();
  });

  it('swapExactQuantity picks the quote-coin result as output when swapping base to quote', () => {
    const baseResult = { __kind: 'base-leftover' };
    const quoteResult = { __kind: 'quote-output' };
    const deepResult = { __kind: 'deep-change' };
    mockSwapExactQuantity.mockReturnValue(() => [baseResult, quoteResult, deepResult] as const);

    const deepbook = createDeepBookClient({ client: {} as any, address: '0xSENDER', network: 'testnet', coins: {} as any, pools: {} as any });
    const tx = {} as any;

    const result = swapExactQuantity({
      deepbook,
      tx,
      poolKey: 'USDC_PUSD',
      isBaseToCoin: true,
      amount: 1_000_000n,
      minOut: 900_000n,
      deepAmount: 1_000n,
    });

    expect(mockSwapExactQuantity).toHaveBeenCalledWith({
      poolKey: 'USDC_PUSD',
      isBaseToCoin: true,
      amount: 1_000_000n,
      minOut: 900_000n,
      deepAmount: 1_000n,
      deepCoin: undefined,
      baseCoin: undefined,
      quoteCoin: undefined,
    });
    expect(result.outputCoin).toBe(quoteResult);
    expect(result.inputChange).toBe(baseResult);
    expect(result.deepChange).toBe(deepResult);
  });

  it('swapExactQuantity picks the base-coin result as output when swapping quote to base', () => {
    const baseResult = { __kind: 'base-output' };
    const quoteResult = { __kind: 'quote-leftover' };
    const deepResult = { __kind: 'deep-change' };
    mockSwapExactQuantity.mockReturnValue(() => [baseResult, quoteResult, deepResult] as const);

    const deepbook = createDeepBookClient({ client: {} as any, address: '0xSENDER', network: 'testnet', coins: {} as any, pools: {} as any });
    const tx = {} as any;

    const result = swapExactQuantity({
      deepbook,
      tx,
      poolKey: 'USDC_PUSD',
      isBaseToCoin: false,
      amount: 1_000_000n,
      minOut: 900_000n,
      deepAmount: 1_000n,
    });

    expect(result.outputCoin).toBe(baseResult);
    expect(result.inputChange).toBe(quoteResult);
    expect(result.deepChange).toBe(deepResult);
  });
});
