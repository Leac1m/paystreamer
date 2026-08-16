import { DeepBookClient } from "@mysten/deepbook-v3";
import type { CoinMap, PoolMap } from "@mysten/deepbook-v3";
import type { Transaction, TransactionObjectArgument } from "@mysten/sui/transactions";
import type { ClientWithCoreApi, SuiClientTypes } from "@mysten/sui/client";

// Thin wrapper around @mysten/deepbook-v3, scoped to what PayStreamer's
// routing feature needs: a one-off swap composed into a larger PTB (the
// scheduler's routed-payment flow, or a new user's pay-with-any-token
// onboarding flow). Deliberately does not wrap DeepBook's BalanceManager,
// margin, or admin surfaces — those aren't part of this integration.
//
// No real DeepBook liquidity pool exists for PUSD on any network today, so
// `poolKey`/`coins`/`pools` below can't point at anything real yet — the
// interface is isolated behind `swapExactQuantity` specifically so callers
// (and tests) can inject a mock instead of a live DeepBookClient until
// that changes. See roadmap.md Phase 3.
export { DeepBookClient };

export interface CreateDeepBookClientParams {
  client: ClientWithCoreApi;
  address: string;
  network: SuiClientTypes.Network;
  /** Coin type registry DeepBook needs for scaling amounts and building types (must include the pool's base/quote coins and "DEEP" for trading fees). */
  coins: CoinMap;
  /** Pool registry, keyed by an arbitrary human-readable pool key. */
  pools: PoolMap;
}

export function createDeepBookClient(params: CreateDeepBookClientParams): DeepBookClient {
  return new DeepBookClient(params);
}

export interface SwapExactQuantityParams {
  deepbook: DeepBookClient;
  tx: Transaction;
  poolKey: string;
  /** true: swap the pool's base asset for its quote asset. false: quote for base. */
  isBaseToCoin: boolean;
  /** Amount of the input side to swap, in the input coin's own decimal units. */
  amount: number | bigint;
  /** Minimum acceptable output — the slippage guard. */
  minOut: number | bigint;
  /**
   * DeepBook charges trading fees in its own DEEP token, separate from the
   * coins being swapped. Callers must supply how much DEEP they're willing
   * to spend and, in `deepCoin`, a coin to draw it from — this is a real
   * cost the original conceptual routing.mdx example omitted entirely.
   */
  deepAmount: number | bigint;
  deepCoin?: TransactionObjectArgument;
  baseCoin?: TransactionObjectArgument;
  quoteCoin?: TransactionObjectArgument;
}

export interface SwapExactQuantityResult {
  /** The coin actually produced by the swap (quote if isBaseToCoin, base otherwise) — pipe this into the next call. */
  outputCoin: TransactionObjectArgument;
  /** Unused DEEP fee change — refund or reuse it, don't let it silently vanish from the PTB's result set. */
  deepChange: TransactionObjectArgument;
}

/**
 * Swaps within `tx` using DeepBook's manager-less `swapExactQuantity` — no
 * BalanceManager setup required, suited for a one-off swap inside a larger
 * PTB. Picks the correct output coin out of DeepBook's 3-tuple result
 * (`[baseCoinResult, quoteCoinResult, deepCoinResult]`) based on swap
 * direction; the other leg's result is intentionally not exposed since a
 * `swapExactQuantity` call always fully consumes its input side.
 */
export function swapExactQuantity({
  deepbook,
  tx,
  poolKey,
  isBaseToCoin,
  amount,
  minOut,
  deepAmount,
  deepCoin,
  baseCoin,
  quoteCoin,
}: SwapExactQuantityParams): SwapExactQuantityResult {
  const [baseCoinResult, quoteCoinResult, deepCoinResult] = deepbook.deepBook.swapExactQuantity({
    poolKey,
    isBaseToCoin,
    amount,
    minOut,
    deepAmount,
    deepCoin,
    baseCoin,
    quoteCoin,
  })(tx);

  return {
    outputCoin: isBaseToCoin ? quoteCoinResult : baseCoinResult,
    deepChange: deepCoinResult,
  };
}
