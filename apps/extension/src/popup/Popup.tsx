import { useCallback, useEffect, useState } from 'react';
import { send, type EarningsResponse, type StatusResponse } from '../lib/messages.js';
import { countdown, formatPusd, formatSui, relativeTime, shortAddress } from '../lib/format.js';

/**
 * The popup is the surface the person earning the fee actually sees, so it
 * leads with earnings and gas health rather than with internals.
 *
 * It reads persisted state through the service worker rather than holding
 * any of its own: the worker is usually suspended when the popup opens, and
 * a message is what wakes it.
 */
export function Popup() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [earnings, setEarnings] = useState<EarningsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await send<StatusResponse>({ type: 'status' }));
      setError(null);
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  }, []);

  const refreshEarnings = useCallback(async () => {
    try {
      setEarnings(await send<EarningsResponse>({ type: 'earnings' }));
    } catch (err: any) {
      // Earnings need a network round trip and can fail independently of
      // status; surfacing it here rather than blanking the whole popup.
      setError(err?.message || String(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
    void refreshEarnings();
  }, [refresh, refreshEarnings]);

  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await refresh();
      await refreshEarnings();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setBusy(null);
    }
  }

  if (!status) {
    return (
      <div className="w-[380px] p-4 text-sm">
        {error ? <ErrorBox message={error} /> : <p className="text-slate-500">Loading…</p>}
      </div>
    );
  }

  const lastCycle = status.cycles[0];

  return (
    <div className="w-[380px] bg-white text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h1 className="text-sm font-semibold">PayStreamer Scheduler</h1>
          <p className="text-xs text-slate-500">{status.network}</p>
        </div>
        <button
          type="button"
          onClick={() => act('toggle', () => send({ type: 'setEnabled', enabled: !status.enabled }))}
          disabled={busy !== null}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            status.enabled
              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
          } disabled:opacity-50`}
        >
          {status.enabled ? '● Running' : '❚❚ Paused'}
        </button>
      </header>

      <section className="border-b border-slate-200 px-4 py-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Fees earned</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {earnings ? `${formatPusd(earnings.totalFee)} PUSD` : '—'}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {earnings
            ? `${earnings.truncated ? 'at least ' : ''}${earnings.paymentCount} payment${
                earnings.paymentCount === 1 ? '' : 's'
              } settled`
            : 'reading payment history…'}
        </p>
      </section>

      {status.lowGas && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <p className="font-medium">Gas is nearly out.</p>
          <p className="mt-1">
            Cycles will start failing without SUI for gas. Fund{' '}
            <span className="font-mono">{shortAddress(status.address)}</span>.
          </p>
          {(status.network === 'testnet' || status.network === 'devnet') && (
            <button
              type="button"
              onClick={() => act('faucet', () => send({ type: 'requestFaucet' }))}
              disabled={busy !== null}
              className="mt-2 rounded bg-amber-200 px-2 py-1 font-medium hover:bg-amber-300 disabled:opacity-50"
            >
              {busy === 'faucet' ? 'Requesting…' : 'Request testnet gas'}
            </button>
          )}
        </div>
      )}

      <section className="grid grid-cols-2 gap-px border-b border-slate-200 bg-slate-200 text-xs">
        <Stat label="Gas" value={`${formatSui(status.suiBalance)} SUI`} />
        <Stat
          label="Next cycle"
          value={status.enabled && status.nextCycleAt ? countdown(status.nextCycleAt) : 'paused'}
        />
      </section>

      <section className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-slate-500">Last cycle</p>
          <button
            type="button"
            onClick={() => act('run', () => send({ type: 'runNow' }))}
            disabled={busy !== null}
            className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50 disabled:opacity-50"
          >
            {busy === 'run' ? 'Running…' : 'Run now'}
          </button>
        </div>
        {lastCycle ? (
          <div className="mt-2 text-xs text-slate-600">
            <p>
              <span className="tabular-nums">{relativeTime(lastCycle.at)}</span> · {lastCycle.dueFound} due ·{' '}
              <span className="text-emerald-700">{lastCycle.succeeded} billed</span>
              {lastCycle.skipped > 0 && <> · {lastCycle.skipped} skipped</>}
              {lastCycle.failed > 0 && <span className="text-rose-700"> · {lastCycle.failed} failed</span>}
            </p>
            <p className="mt-0.5 text-slate-500">
              {lastCycle.platformsScanned} of {lastCycle.platformsDiscovered} platforms served
            </p>
            {(lastCycle.error || lastCycle.firstFailure) && (
              <p className="mt-1 rounded bg-rose-50 px-2 py-1 text-rose-800">
                {lastCycle.error || lastCycle.firstFailure}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">No cycle has run yet.</p>
        )}
      </section>

      <section className="px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">Recent payments</p>
        {earnings && earnings.recent.length > 0 ? (
          <ul className="mt-2 space-y-1.5">
            {earnings.recent.slice(0, 5).map((r) => (
              <li key={r.digest} className="flex items-baseline justify-between text-xs">
                <span className="font-mono text-slate-500">{shortAddress(r.platformId, 8, 4)}</span>
                <span className="tabular-nums text-slate-500">{relativeTime(r.timestampMs)}</span>
                <span className="font-medium tabular-nums text-emerald-700">
                  +{formatPusd(r.schedulerFee)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            {earnings ? 'No payments settled by this address yet.' : 'Loading…'}
          </p>
        )}
      </section>

      <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-2 text-xs">
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(status.address);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="font-mono text-slate-500 hover:text-slate-900"
          title={status.address}
        >
          {copied ? 'copied!' : shortAddress(status.address)}
        </button>
        <button
          type="button"
          onClick={() => chrome.runtime.openOptionsPage()}
          className="text-slate-500 hover:text-slate-900"
        >
          Settings
        </button>
      </footer>

      {error && (
        <div className="px-4 pb-3">
          <ErrorBox message={error} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-2">
      <p className="text-slate-500">{label}</p>
      <p className="mt-0.5 font-medium tabular-nums">{value}</p>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <p className="rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-800">{message}</p>
  );
}
