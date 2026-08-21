/** PUSD and most PayStreamer settlement coins use 6 decimals; SUI uses 9. */
export function formatUnits(raw: bigint | string, decimals: number, maxFractionDigits = decimals): string {
  const value = typeof raw === 'string' ? BigInt(raw) : raw;
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = (value % base).toString().padStart(decimals, '0').slice(0, maxFractionDigits);
  const trimmed = fraction.replace(/0+$/, '');
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return trimmed ? `${grouped}.${trimmed}` : grouped;
}

export const formatPusd = (raw: bigint | string) => formatUnits(raw, 6, 2);
export const formatSui = (raw: bigint | string) => formatUnits(raw, 9, 4);

export function shortAddress(address: string, lead = 6, tail = 4): string {
  if (address.length <= lead + tail + 2) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

export function relativeTime(timestampMs: number, now = Date.now()): string {
  const delta = Math.round((now - timestampMs) / 1000);
  if (delta < 5) return 'just now';
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86_400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86_400)}d ago`;
}

export function countdown(targetMs: number, now = Date.now()): string {
  const delta = Math.max(0, Math.round((targetMs - now) / 1000));
  if (delta === 0) return 'any moment';
  if (delta < 60) return `in ${delta}s`;
  return `in ${Math.floor(delta / 60)}m ${delta % 60}s`;
}
