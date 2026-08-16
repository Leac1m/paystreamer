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

type RoutingAllowlist = Record<string, Record<string, RoutingPoolConfig>>;

function parseRoutingAllowlist(raw: string | undefined): RoutingAllowlist {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as RoutingAllowlist;
  } catch (err) {
    console.error('[RoutingConfig] Failed to parse ROUTING_ALLOWLIST_JSON — routing disabled:', err);
    return {};
  }
}

// Keyed by platformId -> fundingCoinType -> pool config. Set via
// ROUTING_ALLOWLIST_JSON, e.g.:
//   {"0xPLATFORM": {"0x2::sui::SUI": {"poolKey": "SUI_PUSD", "isBaseToCoin": true, "deepAmount": "1000000"}}}
export const ROUTING_ALLOWLIST: RoutingAllowlist = parseRoutingAllowlist(process.env.ROUTING_ALLOWLIST_JSON);

/** The DEEP token's coin type, needed to pay DeepBook trading fees. Routing is skipped if unset. */
export const DEEP_COIN_TYPE = process.env.DEEP_COIN_TYPE;

export function getRoutingPoolConfig(platformId: string, fundingCoinType: string): RoutingPoolConfig | undefined {
  return ROUTING_ALLOWLIST[platformId]?.[fundingCoinType];
}
