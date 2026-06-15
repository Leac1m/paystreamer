import { SUI_TYPE_ARG, USDC_TYPE_ARG, USDSUI_TYPE_ARG } from "../constants";

export const DECIMALS_BY_TYPE: Record<string, number> = {
  [SUI_TYPE_ARG]: 9,
  [USDC_TYPE_ARG]: 6,
  [USDSUI_TYPE_ARG]: 6,
};

export function getDenominationDecimals(type: string): number {
  return DECIMALS_BY_TYPE[type] ?? 9;
}

export function symbolFor(type: string): string {
  if (type.includes("usdc")) return "USDC";
  if (type.includes("usdsui")) return "USDSui";
  return "SUI";
}

export function formatAmount(amount: string | number, type: string): string {
  const raw = typeof amount === "string" ? parseInt(amount) : amount;
  if (Number.isNaN(raw) || !raw) return `0 ${symbolFor(type)}`;
  const decimals = getDenominationDecimals(type);
  const normalized = raw / Math.pow(10, decimals);
  return `${normalized.toFixed(4)} ${symbolFor(type)}`;
}
