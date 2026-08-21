import { useCallback, useEffect, useState } from 'react';
import { send, type StatusResponse } from '../lib/messages.js';
import { formatSui, shortAddress } from '../lib/format.js';
import type { SupportedNetwork } from '@paystreamer/sdk/constants';

const NETWORKS: SupportedNetwork[] = ['testnet', 'devnet', 'mainnet', 'local'];

export function Options() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [platformsText, setPlatformsText] = useState('');
  const [routingText, setRoutingText] = useState('');
  const [importText, setImportText] = useState('');
  const [revealed, setRevealed] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await send<StatusResponse>({ type: 'status' });
      setStatus(next);
      setPlatformsText(next.settings.platformAllowlist.join('\n'));
      setRoutingText(next.settings.routingAllowlistJson);
      setError(null);
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function act(fn: () => Promise<unknown>, message: string) {
    setError(null);
    setNotice(null);
    try {
      await fn();
      await refresh();
      setNotice(message);
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  }

  if (!status) {
    return <main className="mx-auto max-w-2xl p-8 text-sm">{error ?? 'Loading…'}</main>;
  }

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-8 text-sm text-slate-900">
      <header>
        <h1 className="text-xl font-semibold">PayStreamer Scheduler</h1>
        <p className="mt-1 text-slate-600">
          Runs billing cycles in the background and earns the 1% scheduler fee.
        </p>
      </header>

      {notice && <Banner tone="ok">{notice}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}

      <Section
        title="Scheduler identity"
        description="The address that signs billing transactions and receives the fee."
      >
        <div className="rounded border border-slate-200 bg-slate-50 p-3">
          <p className="font-mono text-xs break-all">{status.address}</p>
          <p className="mt-2 text-xs text-slate-600">
            Gas balance: <span className="font-medium">{formatSui(status.suiBalance)} SUI</span>
            {status.lowGas && <span className="ml-2 text-amber-700">— nearly out</span>}
          </p>
          {(status.network === 'testnet' || status.network === 'devnet') && (
            <button
              type="button"
              className="mt-2 rounded border border-slate-300 px-2 py-1 text-xs hover:bg-white"
              onClick={() => act(() => send({ type: 'requestFaucet' }), 'Faucet request sent.')}
            >
              Request testnet gas
            </button>
          )}
        </div>

        <Banner tone="warn">
          <p className="font-medium">This key is stored unencrypted.</p>
          <p className="mt-1">
            A scheduler must sign every cycle unattended, so it cannot prompt a wallet or hold a
            passphrase that a suspended service worker would forget. Anyone with access to this
            browser profile can read it. Treat it as a low-value key holding only gas and accrued
            fees — never reuse an address you keep other funds on.
          </p>
        </Banner>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50"
            onClick={async () => {
              const { secret } = await send<{ secret: string | null }>({ type: 'exportKey' });
              setRevealed(secret);
            }}
          >
            Reveal private key
          </button>
          {revealed && (
            <button
              type="button"
              className="rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50"
              onClick={() => setRevealed(null)}
            >
              Hide
            </button>
          )}
        </div>
        {revealed && (
          <p className="rounded border border-rose-200 bg-rose-50 p-3 font-mono text-xs break-all text-rose-900">
            {revealed}
          </p>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-700" htmlFor="import">
            Import a different key
          </label>
          <p className="mt-0.5 text-xs text-slate-500">
            Accepts a <code>suiprivkey1…</code> string, or that string hex-encoded. Replaces the
            current key — export it first if you still need it.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              id="import"
              type="password"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="suiprivkey1…"
              className="flex-1 rounded border border-slate-300 px-2 py-1.5 font-mono text-xs"
            />
            <button
              type="button"
              disabled={importText.trim().length === 0}
              className="rounded bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-700 disabled:opacity-40"
              onClick={() =>
                act(async () => {
                  await send({ type: 'importKey', secret: importText });
                  setImportText('');
                  setRevealed(null);
                }, 'Key imported.')
              }
            >
              Import
            </button>
          </div>
        </div>
      </Section>

      <Section title="Network" description="Which deployment this scheduler bills against.">
        <select
          value={status.settings.network}
          onChange={(e) =>
            act(
              () => send({ type: 'saveSettings', patch: { network: e.target.value as SupportedNetwork } }),
              'Network updated.',
            )
          }
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          {NETWORKS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </Section>

      <Section
        title="Platform allowlist"
        description="One platform id per line. Leave empty to serve every platform discovered on chain."
      >
        <textarea
          value={platformsText}
          onChange={(e) => setPlatformsText(e.target.value)}
          rows={4}
          placeholder="0x…"
          className="w-full rounded border border-slate-300 p-2 font-mono text-xs"
        />
        <button
          type="button"
          className="rounded bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-700"
          onClick={() =>
            act(
              () =>
                send({
                  type: 'saveSettings',
                  patch: {
                    platformAllowlist: platformsText
                      .split('\n')
                      .map((l) => l.trim())
                      .filter(Boolean),
                  },
                }),
              'Platform allowlist saved.',
            )
          }
        >
          Save platforms
        </button>
      </Section>

      <Section
        title="DeepBook routing allowlist"
        description="Opt-in per platform and funding currency. Off by default."
      >
        <Banner tone="warn">
          This extension does not bundle DeepBook, so routed payments are skipped rather than
          mispaid. No real DeepBook liquidity exists for any PayStreamer token on any network yet.
          The field is here so configuration survives, and takes effect only in the standalone
          scheduler service.
        </Banner>
        <textarea
          value={routingText}
          onChange={(e) => setRoutingText(e.target.value)}
          rows={4}
          placeholder='{"0xPLATFORM":{"0x2::sui::SUI":{"poolKey":"SUI_PUSD","isBaseToCoin":true,"deepAmount":"1000000","maxSpend":"2000000000"}}}'
          className="w-full rounded border border-slate-300 p-2 font-mono text-xs"
        />
        <button
          type="button"
          className="rounded bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-700"
          onClick={() =>
            act(
              () => send({ type: 'saveSettings', patch: { routingAllowlistJson: routingText } }),
              'Routing allowlist saved.',
            )
          }
        >
          Save routing
        </button>
      </Section>

      <footer className="border-t border-slate-200 pt-4 text-xs text-slate-500">
        <p>
          Cycles run once per minute — <code>chrome.alarms</code> cannot go faster, and a suspended
          MV3 service worker loses <code>setInterval</code> timers entirely. The browser must be
          running for cycles to fire.
        </p>
        <p className="mt-1">Scheduler address: {shortAddress(status.address, 10, 6)}</p>
      </footer>
    </main>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-xs text-slate-600">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Banner({ tone, children }: { tone: 'ok' | 'warn' | 'error'; children: React.ReactNode }) {
  const styles = {
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-rose-200 bg-rose-50 text-rose-900',
  }[tone];
  return <div className={`rounded border p-3 text-xs ${styles}`}>{children}</div>;
}
