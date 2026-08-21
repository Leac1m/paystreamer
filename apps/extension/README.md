# PayStreamer Scheduler Extension

A Chrome MV3 extension that runs PayStreamer billing cycles in the
background and earns the 1% scheduler fee. Chrome only — Firefox's MV3
differs enough (background scripts rather than service workers, the
`browser.*` namespace, different alarm behavior) that it was descoped.

**Status: Milestone 2 (viability spike) complete.** The service worker runs
real billing cycles against testnet. There is no UI yet — the popup,
options page, key management, and earnings surface are Milestones 3-6. Do
not treat this as installable by an end user.

## What the spike proved

Run against a real Chromium with the extension loaded unpacked:

1. The MV3 service worker registers and boots.
2. Config loads asynchronously from `chrome.storage.local` — the path the
   `SchedulerContext` refactor exists to support. The old `process.env`
   singletons evaluated at import time and could not be satisfied here.
3. `SuiGrpcClient` and `SuiGraphQLClient` reach testnet from a service
   worker (proven separately from `apps/portal`, which runs them in a page).
4. `Ed25519Keypair` signs under the extension CSP — no eval, no remote
   code — and real billing transactions execute.
5. `chrome.alarms` fires on its own after ~60s and drives a full cycle with
   no page open, where `setInterval` cannot: a suspended MV3 worker loses
   its timers.
6. Cycle state persists to `chrome.storage.local`, so a popup can read a
   cycle it was not alive for.

```sh
pnpm build
pnpm spike                              # read-only: discovery + classification
pnpm spike -- --execute                 # bills real due payments on testnet
pnpm spike -- --execute --wait-alarm    # also waits ~60s for the alarm to fire
```

The spike is not in CI: it needs network, a browser, and it submits real
transactions. Only `pnpm build` is verified by `ci/verify-builds.sh`.

## Deliberate design notes

- **No DeepBook.** This app never imports
  `@paystreamer/scheduler-core/routed-payment`, the only module pulling in
  `@mysten/deepbook-v3`. No real DeepBook liquidity exists for any
  PayStreamer token, so routing would be dead weight in the worker bundle.
  Routed payments are skipped rather than mispaid. Verified against the
  built output: no DeepBook, React, Walrus, or Seal code in the bundle.
- **`@paystreamer/sdk/constants`, not the SDK root.** The root barrel
  re-exports `./react` and `./ui`; importing `getConfig` from it would drag
  React into a service worker with no DOM to render into.
- **`@crxjs/vite-plugin` over `wxt`.** Both support Vite 8 (checked against
  the registry, not assumed). `wxt`'s main draw is cross-browser support,
  which was descoped, and it imposes its own directory conventions —
  `@crxjs` keeps this a plain Vite app like every other app here.

## Known limits

- **1-minute alarm floor.** `chrome.alarms` cannot poll faster, versus the
  standalone service's 10s. Billing is due-time-based rather than
  latency-sensitive, so a missed cycle simply bills on the next one.
- **The browser must be running** for cycles to fire.
- **The signing key is seeded from a shared demo key** and stored
  unencrypted. Milestone 4 replaces this with real first-run generation,
  import/export, and a funding flow.
