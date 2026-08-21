import { describe, it, expect } from 'vitest';
import { countdown, formatPusd, formatSui, relativeTime, shortAddress } from '../src/lib/format.js';

describe('formatPusd', () => {
  it('renders 6-decimal amounts to 2 places', () => {
    expect(formatPusd('100000000')).toBe('100');
    expect(formatPusd('10000000000')).toBe('10,000');
    expect(formatPusd('1500000')).toBe('1.5');
  });

  it('groups thousands so a large fee total stays readable', () => {
    expect(formatPusd('2129947000000')).toBe('2,129,947');
  });

  it('renders zero without a stray decimal point', () => {
    expect(formatPusd('0')).toBe('0');
  });
});

describe('formatSui', () => {
  it('renders 9-decimal gas balances', () => {
    expect(formatSui('49251668968')).toBe('49.2516');
    expect(formatSui('50000000')).toBe('0.05');
  });
});

describe('shortAddress', () => {
  it('elides the middle of a full address', () => {
    expect(shortAddress('0x472083c45f28f6fed624f1f252966a753332111a931127f047a9759800672793')).toBe(
      '0x4720…2793',
    );
  });

  it('leaves an already-short string alone', () => {
    expect(shortAddress('0x1234')).toBe('0x1234');
  });
});

describe('relativeTime', () => {
  const now = 1_000_000_000;
  it('describes recent activity in the largest sensible unit', () => {
    expect(relativeTime(now - 1_000, now)).toBe('just now');
    expect(relativeTime(now - 30_000, now)).toBe('30s ago');
    expect(relativeTime(now - 300_000, now)).toBe('5m ago');
    expect(relativeTime(now - 7_200_000, now)).toBe('2h ago');
    expect(relativeTime(now - 172_800_000, now)).toBe('2d ago');
  });
});

describe('countdown', () => {
  const now = 1_000_000_000;
  it('counts down to the next cycle', () => {
    expect(countdown(now + 45_000, now)).toBe('in 45s');
    expect(countdown(now + 90_000, now)).toBe('in 1m 30s');
  });

  it('never shows a negative time for an overdue alarm', () => {
    expect(countdown(now - 5_000, now)).toBe('any moment');
  });
});
