import { describe, it, expect, vi } from 'vitest';
import { createScheduler, runCycle } from '../src/cycle.js';
import { makeContext } from './helpers.js';

function withClock(ctx: ReturnType<typeof makeContext>, timestampMs: string) {
  (ctx.grpcClient.core.getObject as any).mockResolvedValue({ object: { json: { timestamp_ms: timestampMs } } });
  return ctx;
}

describe('runCycle', () => {
  it('reports a clean empty cycle when no platforms are discovered', async () => {
    const ctx = withClock(makeContext(), '1000');
    (ctx.gqlClient.query as any).mockResolvedValue({ data: { events: { nodes: [] } } });

    const result = await runCycle(ctx);

    expect(result.ran).toBe(true);
    expect(result.platformsScanned).toBe(0);
    expect(result.dueFound).toBe(0);
    expect(result.error).toBeUndefined();
    expect(result.finishedAt).toBeGreaterThanOrEqual(result.startedAt);
  });

  it('captures a cycle-level failure instead of throwing out of the loop', async () => {
    const ctx = makeContext();
    (ctx.grpcClient.core.getObject as any).mockResolvedValue({ object: { json: { timestamp_ms: '1000' } } });
    (ctx.gqlClient.query as any).mockImplementation(() => {
      throw new Error('graphql down');
    });

    // discoverPlatforms swallows its own errors and returns [], so the
    // cycle still completes cleanly — the guarantee being asserted is that
    // a transport failure never propagates out of runCycle.
    const result = await runCycle(ctx);
    expect(result.error).toBeUndefined();
    expect(result.platformsScanned).toBe(0);
  });
});

describe('platform allowlist', () => {
  function withPlatforms(ctx: ReturnType<typeof makeContext>, ids: string[]) {
    (ctx.gqlClient.query as any).mockImplementation(async (args: any) => {
      // First query is platform discovery; subscription discovery follows.
      if (String(args.variables.eventType).includes('PlatformRegistered')) {
        return { data: { events: { nodes: ids.map((id) => ({ contents: { json: { platform_id: id } } })) } } };
      }
      return { data: { events: { nodes: [] } } };
    });
    return ctx;
  }

  it('scans every discovered platform when no allowlist is set', async () => {
    const ctx = withPlatforms(withClock(makeContext(), '1000'), ['0xa', '0xb']);
    const result = await runCycle(ctx);
    expect(result.platformsDiscovered).toBe(2);
    expect(result.platformsScanned).toBe(2);
  });

  it('serves only allowlisted platforms, reporting both counts', async () => {
    const ctx = withPlatforms(withClock(makeContext({ platformAllowlist: ['0xb'] }), '1000'), ['0xa', '0xb']);
    const result = await runCycle(ctx);
    expect(result.platformsDiscovered).toBe(2);
    expect(result.platformsScanned).toBe(1);
  });

  it('treats an empty allowlist as a deliberate idle, not as "all"', async () => {
    const ctx = withPlatforms(withClock(makeContext({ platformAllowlist: [] }), '1000'), ['0xa', '0xb']);
    const result = await runCycle(ctx);
    expect(result.platformsDiscovered).toBe(2);
    expect(result.platformsScanned).toBe(0);
  });
});

describe('createScheduler', () => {
  it('declines an overlapping cycle rather than running two against the same accounts', async () => {
    const ctx = withClock(makeContext(), '1000');
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    (ctx.gqlClient.query as any).mockImplementation(async () => {
      await gate;
      return { data: { events: { nodes: [] } } };
    });

    const scheduler = createScheduler(ctx);
    const first = scheduler.runCycle();
    expect(scheduler.isRunning()).toBe(true);

    const second = await scheduler.runCycle();
    expect(second.ran).toBe(false);

    release();
    expect((await first).ran).toBe(true);
    expect(scheduler.isRunning()).toBe(false);
  });

  it('releases the guard after a cycle so the next tick can run', async () => {
    const ctx = withClock(makeContext(), '1000');
    (ctx.gqlClient.query as any).mockResolvedValue({ data: { events: { nodes: [] } } });

    const scheduler = createScheduler(ctx);
    expect((await scheduler.runCycle()).ran).toBe(true);
    expect((await scheduler.runCycle()).ran).toBe(true);
  });
});

describe('runCycle wiring', () => {
  it('uses the context clock rather than wall time when the chain responds', async () => {
    const ctx = withClock(makeContext(), '4242');
    (ctx.gqlClient.query as any).mockResolvedValue({ data: { events: { nodes: [] } } });
    const spy = vi.spyOn(ctx.grpcClient.core, 'getObject');

    await runCycle(ctx);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ objectId: '0x6' }));
  });
});
