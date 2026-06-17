import { PUSD_TYPE_ARG } from "../constants";

export const APP_COIN_DECIMALS = 9;
export const APP_COIN_SYMBOL = "PUSD";
export const APP_COIN_TYPE = PUSD_TYPE_ARG;

export function formatMistToPUSD(mist: string | number | bigint | undefined | null): string {
  if (mist === undefined || mist === null) return `0 ${APP_COIN_SYMBOL}`;
  const raw = typeof mist === "string" ? parseInt(mist, 10) : Number(mist);
  if (Number.isNaN(raw)) return `0 ${APP_COIN_SYMBOL}`;
  const normalized = raw / Math.pow(10, APP_COIN_DECIMALS);
  return `${normalized.toFixed(2)} ${APP_COIN_SYMBOL}`;
}

export function parsePUSDToMist(amount: string | number): bigint {
  const raw = typeof amount === "string" ? parseFloat(amount) : amount;
  if (Number.isNaN(raw) || raw < 0) return 0n;
  return BigInt(Math.floor(raw * Math.pow(10, APP_COIN_DECIMALS)));
}

// Kept temporarily to make migration easier, they will be removed once all components are updated.
export function formatAmount(amount: string | number | bigint, _type?: string): string {
    return formatMistToPUSD(amount);
}

export function symbolFor(_type?: string): string {
    return APP_COIN_SYMBOL;
}

export function getDenominationDecimals(_type?: string): number {
    return APP_COIN_DECIMALS;
}
