import { normalizeCoinType } from './typeNames.js';

/**
 * DeepBook routing is opt-in per platform, per funding currency — never
 * automatic. A mismatched-currency account (holding a coin type the
 * platform's tier doesn't settle in) is only routed through a DeepBook
 * swap if the operator has explicitly listed it here; otherwise the
 * scheduler leaves it unpaid rather than silently crediting the platform
 * in the wrong currency (the pre-routing behavior, since `process_due_payment`
 * doesn't enforce tier.denomination against the account's actual coin type
 * on-chain).
 *
 * No real DeepBook liquidity pool exists for PUSD (or any PayStreamer demo
 * token) on any network yet, so in practice this allowlist is empty in
 * every deployed environment today — it exists so the branching logic can
 * be exercised and tested ahead of that liquidity existing.
 */
export interface RoutingPoolConfig {
  /** DeepBook pool key, as registered in the DeepBookClient's `pools` map (PayStreamer uses DeepBook's own published `testnetPools`/`mainnetPools` registries — see `routedPayment.ts`). */
  poolKey: string;
  /** true if the account's funding coin is the pool's base asset. */
  isBaseToCoin: boolean;
  /** DEEP token amount to spend on trading fees for this swap. */
  deepAmount: string;
  /**
   * Upper bound on how much of the account's FundingCoin one payment
   * cycle may spend, in the FundingCoin's own smallest unit. There's no
   * price oracle here to derive this from the tier's PlatformCoin amount,
   * so the operator sets it explicitly per pair, based on the real-world
   * exchange rate plus whatever slippage buffer they're comfortable
   * pre-authorizing — the same reason `withdraw_for_route` itself takes
   * `max_spend` as a caller-supplied bound rather than computing one.
   */
  maxSpend: string;
}

/** Keyed by platformId -> fundingCoinType -> pool config. */
export type RoutingAllowlist = Record<string, Record<string, RoutingPoolConfig>>;

/**
 * Parses the operator-supplied allowlist JSON. Malformed input disables
 * routing entirely rather than throwing — a bad config should degrade to
 * "route nothing", never take the whole billing cycle down.
 *
 * Shape, e.g.:
 *   {"0xPLATFORM": {"0x2::sui::SUI": {"poolKey": "SUI_PUSD", "isBaseToCoin": true, "deepAmount": "1000000", "maxSpend": "2000000000"}}}
 */
export function parseRoutingAllowlist(raw: string | undefined | null): RoutingAllowlist {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as RoutingAllowlist;
    // Canonicalize the funding-coin keys so an operator can write the
    // short, natural form (`0x2::sui::SUI`) and still match the
    // zero-padded type the chain reports.
    const normalized: RoutingAllowlist = {};
    for (const [platformId, byCoin] of Object.entries(parsed)) {
      normalized[platformId] = {};
      for (const [coinType, pool] of Object.entries(byCoin ?? {})) {
        normalized[platformId][normalizeCoinType(coinType)] = pool;
      }
    }
    return normalized;
  } catch (err) {
    console.error('[RoutingConfig] Failed to parse routing allowlist JSON — routing disabled:', err);
    return {};
  }
}

export function getRoutingPoolConfig(
  allowlist: RoutingAllowlist,
  platformId: string,
  fundingCoinType: string,
): RoutingPoolConfig | undefined {
  const byCoin = allowlist[platformId];
  if (!byCoin) return undefined;
  return byCoin[fundingCoinType] ?? byCoin[normalizeCoinType(fundingCoinType)];
}
