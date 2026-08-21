# PayStreamer Scheduler Extension

A Chrome MV3 extension that runs PayStreamer billing cycles in the
background and earns the 1% scheduler fee. Chrome only — Firefox's MV3
differs enough (background scripts rather than service workers, the
`browser.*` namespace, different alarm behavior) that it was descoped.

## Install

```sh
pnpm --filter @paystreamer/extension build
```

Then in Chrome: open `chrome://extensions`, enable **Developer mode**, choose
**Load unpacked**, and select `apps/extension/dist`. It generates a signing key
on first run and shows the address — fund it with a little SUI for gas (the
popup has a testnet faucet button) and it starts earning on the next cycle.

Distributed unpacked rather than through the Chrome Web Store.

## What it does

- **Background worker** — `chrome.alarms` drives a billing cycle once a
  minute. Every cycle's summary is written to `chrome.storage.local`, because
  the popup usually opens with no worker alive to ask.
- **Popup** — fees earned, gas health, last cycle, recent payments, and a
  running/paused toggle that actually clears the alarm rather than just
  flipping a flag.
- **Options** — network, an opt-in platform allowlist, the DeepBook routing
  allowlist, and key import/export.

## Verification

Unit tests fake `chrome.*`; `scripts/spike.ts` drives the real extension in a
real Chromium via Playwright, which is the only place real Chrome behavior is
knowable.

```sh
pnpm test                              # unit tests (faked chrome.*)
pnpm spike                             # real browser, read-only
pnpm spike -- --execute --wait-alarm   # bills on testnet; waits for the alarm
```

The spike checks, end to end: the worker registers; a key is generated on
install with none in the source; importing a funded key replaces it; testnet
reads work from a worker; a real cycle bills due payments; pausing clears the
alarm and resuming restores it; the alarm fires on its own and drives a cycle
with no page open; and both the popup and options page render real state and
persist changes.

Only `pnpm build` and `pnpm test` are in CI — the spike needs a network and a
browser, and submits real transactions.

## Deliberate design notes

- **Unencrypted hot key.** A scheduler signs every cycle unattended, so it
  cannot prompt a wallet, and passphrase-encrypting the secret would stop
  background earning every time the worker suspends — defeating the point.
  Framed as a low-value key holding only gas and fees, and the options page
  says so plainly.
- **Earnings come from `PaymentProcessed.scheduler_fee`, never a balance
  delta.** The fee lands as a real coin, so watching the balance is tempting,
  but on the demo deployment the platform and protocol treasuries are the same
  address as the scheduler — the balance moves by the full billed amount, not
  the 1% cut. Verified live on testnet.
- **No DeepBook.** This app never imports
  `@paystreamer/scheduler-core/routed-payment`, the only module pulling in
  `@mysten/deepbook-v3`. No real DeepBook liquidity exists for any PayStreamer
  token, so routing would be dead weight in the worker bundle; routed payments
  are skipped rather than mispaid. Verified against the built output: no
  DeepBook, React, Walrus, or Seal code in the service worker bundle.
- **`@paystreamer/sdk/constants`, not the SDK root.** The root barrel
  re-exports `./react` and `./ui`, which would drag React into a worker with no
  DOM.
- **`@crxjs/vite-plugin` over `wxt`.** Both support Vite 8 (checked against the
  registry, not assumed). `wxt`'s main draw is cross-browser support, which was
  descoped, and it imposes its own directory conventions.

## Known limits

- **1-minute alarm floor.** `chrome.alarms` cannot poll faster, versus the
  standalone service's 10s — so the standalone service will usually win a
  contested payment. Billing is due-time-based rather than latency-sensitive,
  so a late cycle simply bills on the next pass.
- **The browser must be running** for cycles to fire.
- Platform discovery re-queries the last 50 `PlatformRegistered` events and
  walks every account each cycle. Fine at demo scale, not how this would work
  at real volume.
