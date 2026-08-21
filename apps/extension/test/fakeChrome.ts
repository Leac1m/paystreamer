import { vi } from 'vitest';

/**
 * Minimal in-memory stand-in for the `chrome.*` APIs the extension uses.
 * Real Chrome behavior is covered by `scripts/spike.ts`, which drives the
 * actual extension in a browser; these fakes exist so the storage, key, and
 * formatting logic can be tested without one.
 */
export function installFakeChrome() {
  const store = new Map<string, unknown>();
  const alarms = new Map<string, { name: string; periodInMinutes?: number; scheduledTime: number }>();

  const chrome = {
    storage: {
      local: {
        get: vi.fn(async (key: string | string[] | null) => {
          if (key === null) return Object.fromEntries(store);
          const keys = Array.isArray(key) ? key : [key];
          const out: Record<string, unknown> = {};
          for (const k of keys) if (store.has(k)) out[k] = store.get(k);
          return out;
        }),
        set: vi.fn(async (values: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(values)) store.set(k, v);
        }),
        clear: vi.fn(async () => store.clear()),
      },
    },
    alarms: {
      create: vi.fn(async (name: string, info: { periodInMinutes?: number }) => {
        alarms.set(name, { name, ...info, scheduledTime: Date.now() + 60_000 });
      }),
      clear: vi.fn(async (name: string) => alarms.delete(name)),
      get: vi.fn(async (name: string) => alarms.get(name)),
      getAll: vi.fn(async () => [...alarms.values()]),
      onAlarm: { addListener: vi.fn() },
    },
    runtime: {
      onMessage: { addListener: vi.fn() },
      onInstalled: { addListener: vi.fn() },
      onStartup: { addListener: vi.fn() },
      sendMessage: vi.fn(),
    },
  };

  (globalThis as any).chrome = chrome;
  return { chrome, store, alarms };
}
