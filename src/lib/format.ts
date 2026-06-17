import { SUI_TYPE_ARG, PUSD_TYPE_ARG } from "../constants";

export const DECIMALS_BY_TYPE: Record<string, number> = {
  [SUI_TYPE_ARG]: 9,
  [PUSD_TYPE_ARG]: 9,
};

export function getDenominationDecimals(type: string): number {
  return DECIMALS_BY_TYPE[type] ?? 9;
}

export function symbolFor(type: string): string {
  if (type.includes("pusd")) return "USD";
  if (type.includes("usdc")) return "USDC";
  if (type.includes("usdsui")) return "USDSui";
  return "SUI";
}

export function formatAmount(amount: string | number, type: string): string {
  const raw = typeof amount === "string" ? parseInt(amount) : amount;
  if (Number.isNaN(raw) || !raw) return `0 ${symbolFor(type)}`;
  const decimals = getDenominationDecimals(type);
  const normalized = raw / Math.pow(10, decimals);
  if (type.includes("pusd")) {
    return `${normalized.toFixed(2)} USD`;
  }
  return `${normalized.toFixed(4)} ${symbolFor(type)}`;
}
