import type { SchedulerContext } from './context.js';
import { discoverPlatforms, discoverSubscriptions, filterDueSubscriptions, getCurrentTime } from './discovery.js';
import { processDuePayments, type PaymentFailure, type PaymentSkip, type PaymentSuccess } from './payment.js';

/**
 * Summary of a single billing cycle. Returned rather than only logged so a
 * host can persist it — a Node service prints it, while an extension's
 * service worker writes it to storage for a popup that reads it long after
 * the worker itself has been suspended.
 */
export interface CycleResult {
  startedAt: number;
  finishedAt: number;
  /** false when the cycle was declined because a previous one was still running. */
  ran: boolean;
  /** Platforms found on chain, before the allowlist is applied. */
  platformsDiscovered: number;
  /** Platforms actually billed against, after the allowlist. */
  platformsScanned: number;
  dueFound: number;
  succeeded: PaymentSuccess[];
  skipped: PaymentSkip[];
  failed: PaymentFailure[];
  /** Set when the cycle itself (not an individual payment) threw. */
  error?: string;
}

function emptyResult(startedAt: number, ran: boolean): CycleResult {
  return {
    startedAt,
    finishedAt: startedAt,
    ran,
    platformsDiscovered: 0,
    platformsScanned: 0,
    dueFound: 0,
    succeeded: [],
    skipped: [],
    failed: [],
  };
}

/**
 * Runs one full billing pass: discover platforms, find their due
 * subscriptions, and bill each one. Individual payment failures are
 * collected, not thrown — a single bad account must never abort the cycle.
 *
 * Concurrency is the caller's business; use {@link createScheduler} for a
 * runner that declines overlapping cycles.
 */
export async function runCycle(ctx: SchedulerContext): Promise<CycleResult> {
  const result = emptyResult(Date.now(), true);

  try {
    console.log('[Scheduler] Starting cycle...');
    const now = await getCurrentTime(ctx);

    const discovered = await discoverPlatforms(ctx);
    const platforms = ctx.platformAllowlist
      ? discovered.filter((p) => ctx.platformAllowlist!.includes(p.platformId))
      : discovered;
    result.platformsDiscovered = discovered.length;
    result.platformsScanned = platforms.length;

    if (ctx.platformAllowlist && platforms.length < discovered.length) {
      console.log(`[Scheduler] Platform allowlist active: serving ${platforms.length} of ${discovered.length} discovered platforms`);
    }

    for (const p of platforms) {
      const subs = await discoverSubscriptions(ctx, p.platformId);
      const due = filterDueSubscriptions(subs, now);

      if (due.length > 0) {
        console.log(`[Scheduler] Found ${due.length} due payments for ${p.platformId}`);
        result.dueFound += due.length;
        const run = await processDuePayments(ctx, due);
        result.succeeded.push(...run.succeeded);
        result.skipped.push(...run.skipped);
        result.failed.push(...run.failed);
      }
    }
  } catch (err: any) {
    console.error('[Scheduler] Error in cycle:', err);
    result.error = err?.message || String(err);
  }

  result.finishedAt = Date.now();
  return result;
}

export interface Scheduler {
  /** Runs a cycle unless one is already in flight, in which case it resolves with `ran: false`. */
  runCycle(): Promise<CycleResult>;
  /** True while a cycle is in flight. */
  isRunning(): boolean;
}

/**
 * Wraps {@link runCycle} with the single-flight guard the standalone
 * service has always had: a cycle that is still working when the next tick
 * fires is left alone rather than run concurrently against the same
 * account set.
 */
export function createScheduler(ctx: SchedulerContext): Scheduler {
  let running = false;

  return {
    isRunning: () => running,
    async runCycle() {
      if (running) return emptyResult(Date.now(), false);
      running = true;
      try {
        return await runCycle(ctx);
      } finally {
        running = false;
      }
    },
  };
}
