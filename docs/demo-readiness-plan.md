# PayStreamer Demo-Readiness Plan

**Branch:** `feature/v2-core`
**Goal:** A judge / stranger can clone the repo, run one command, and complete the full subscribe-and-bill loop with **zero prior knowledge of Sui, devnet, or our contracts**, in under 5 minutes.

The plan is organized in 4 phases. Phases 1–3 are demo-blockers (no reasonable demo without them). Phase 4 is polish that elevates a working demo to a memorable one. Each item lists the file(s) to touch, the change, and the acceptance test.

---

## Phase 0 — Quick wins (do first, in order)

These are 1–10 line changes that take <30 minutes each and unblock everything else.

### 0.1 Update `index.html` title

- **File:** `index.html:7`
- **Change:** `<title>Sui dApp Starter</title>` → `<title>PayStreamer — Crypto Subscriptions on Autopilot</title>`
- **Acceptance:** Browser tab shows PayStreamer.

### 0.2 Delete dead-code mocks

- **Files:** `src/components/WalletModal.tsx`, `src/hooks/useWallet.ts`
- **Why:** They mint fake addresses with `Math.random()` and are not imported anywhere. New readers assume they're the real wallet flow.
- **Verify they're unused:**
  ```bash
  rg -l "WalletModal|useWallet" src/
  ```
  (Nothing but the files themselves should match — if a match exists, fix that importer to use the real `useCurrentAccount` / `ConnectModal` from `@mysten/dapp-kit-react` first.)
- **Acceptance:** `rg "WalletModal|useWallet" src/` returns zero matches.

### 0.3 Fix `SettingsPage.tsx` closeAccount bug

- **File:** `src/pages/dashboard/SettingsPage.tsx:180`
- **Change:** The handler calls `closeAccount("", "")` with empty strings — guaranteed abort. Either (a) wire it to a confirmation modal that captures the actual `accountId` and `capId` from the row, or (b) remove the button entirely and add a "Coming soon" tooltip. **Recommend (b) for the demo.**
- **Acceptance:** No clickable button in Settings leads to an abort.

### 0.4 Fix `PlatformSettingsPage.tsx` category arg

- **File:** `src/pages/platforms/PlatformSettingsPage.tsx:54-68`
- **Bug:** `update_platform` Move signature is `(platform, name: Option<String>, description: Option<String>, webhook_url: Option<Option<String>>, ctx)` — 4 args. The current code calls with 3, silently dropping `category`.
- **Change:** Read `category` from form state, add a 4th `tx.pure.option("string", category || null)` argument.
- **Acceptance:** Editing a platform's category in the UI persists to chain.

### 0.5 Fix `TreasuryManager.tsx` ms-vs-s timelock

- **File:** `src/components/platform/TreasuryManager.tsx:38-53`
- **Bug:** Contract emits `execute_after_ms: u64` (milliseconds). Frontend computes `elapsed = now - changeTime` treating `changeTime` as seconds, so the countdown is 1000x too short and always shows "eligible."
- **Change:** Multiply `changeTime` by 1000 when reading from chain, or use `(changeTime - Date.now())` directly if the value is already in ms. Verify with `platform.move:294-300`.
- **Acceptance:** After proposing a treasury change, the countdown reads ~48h 0m, not 0h 0m.

### 0.6 Fix `SchedulerPage.tsx` empty state and fake `lastProcessedAt`

- **File:** `src/pages/platforms/SchedulerPage.tsx:25-31, 53`
- **Bugs:**
  - Line 25-31: Empty state says "You don't own any platforms" — wrong, the scheduler is global.
  - Line 53: `lastProcessedAt = now - 3600` is hardcoded fake data.
- **Change:**
  - Empty state: "The payment scheduler is a shared resource — anyone can submit a due payment on chain. Connect a platform to test the 'Process Now' button below."
  - `lastProcessedAt`: query the `PaymentScheduler.last_processed_at` field (binding in `src/contracts/subscriptions/scheduler.ts`). Render `—` or "Never" if 0, else a relative timestamp.
- **Acceptance:** Scheduler page shows real or honest-empty values, not fake ones.

### 0.7 Fix `PlatformOwnerOverview.tsx` hardcoded fake data

- **File:** `src/components/platform/PlatformOwnerOverview.tsx`
- **Bugs:** Three places with literal fake data:
  - Lines 56-59: `calculateChurnRate` returns `"2.1%"` literal
  - Lines 93-111: `recentActivity` is 3 hardcoded rows
  - Lines 113-121: chart data is `[420, 580, 720, 890, 1050, 1230]`
- **Change:**
  - **Churn rate:** compute from `SubscriptionUpdated` events with `status.variant === 2` (cancelled) in the last 30 days, divided by total subs. If 0 subs, return `—`.
  - **Recent activity:** query `PaymentProcessed` and `SubscriptionCreated` events for this platform; render the latest 5 with relative timestamps.
  - **Chart:** query `PaymentProcessed` events grouped by month for the last 6 months. If no events, render an honest empty state ("No payments yet — your chart will populate as you receive subscriptions").
- **Acceptance:** Platform Overview shows real numbers derived from chain events. Fresh platform shows 0 / "No data yet", not fake 2.1% / $1,230.

### 0.8 Rotate or remove `.env` `SCHEDULER_SECRET`

- **File:** `.env:1`
- **Risk:** Contains a bech32-encoded ed25519 private key. Gitignored, so not in the repo, but the file is on disk. v2 is permissionless — the off-chain scheduler is no longer load-bearing.
- **Change:** Either delete the file (preferred) or comment out the line. Remove `pnpm scheduler` from `package.json:11` and remove the "Running the Scheduler" section from `README.md:86-96`. Keep `scripts/scheduler.ts` for now, but flag it as legacy in a top-of-file comment.
- **Acceptance:** A fresh clone has no `.env`, and the README does not instruct the user to run the off-chain scheduler.

---

## Phase 1 — Make the marquee feature clickable (the "wow" button)

**The single most important demo moment is the on-chain permissionless scheduler.** Right now, v2 advertises it but the frontend has no way to trigger it. A judge who subscribes will see "Next billing: in 30 days" and think "this is just a database row." They need to click a button and watch a payment execute on chain in real time.

### 1.1 Add "Process Payment Now" button to `SubscriptionCard`

- **File:** `src/components/subscriptions/SubscriptionCard.tsx`
- **Pre-req:** The component already imports `DEVNET_V2_PACKAGE_ID` and `CLOCK_OBJECT_ID`. Add `DEVNET_PAYMENT_SCHEDULER_ID` and a constant for the scheduler's `initialSharedVersion` (look up from `Published.toml` or `e2e-result.json`; should be in `constants.ts`).
- **Pre-req:** The component receives `platformId` but not the platform's `initialSharedVersion`. Either:
  - (a) Pass `initialSharedVersion` from `SubscriptionsPage.tsx` (cleaner), or
  - (b) Look it up via `client.core.getObject` on click (slower but localized).
  **Recommend (a).** `SubscriptionsPage` already has the data via the platform discovery query.
- **Button placement:** Add a third button next to "Pause" and "Cancel", labeled "Process Now" with a `Zap` icon. Gate it on:
  - `subscription.status.variant === 0` (active)
  - `subscription.next_billing_ts` <= now (i.e., due)
- **Click handler PTB (3 calls):**
  ```ts
  const tx = new Transaction();
  const limiters = tx.moveCall({
    target: `${DEVNET_V2_PACKAGE_ID}::policies::empty_limiters`,
    arguments: [tx.object(CLOCK_OBJECT_ID)],
  });
  tx.moveCall({
    target: `${DEVNET_V2_PACKAGE_ID}::policies::ensure_initialized`,
    typeArguments: [denomination],
    arguments: [tx.object(accountId), limiters, tx.object(CLOCK_OBJECT_ID)],
  });
  tx.moveCall({
    target: `${DEVNET_V2_PACKAGE_ID}::scheduler::process_due_payment`,
    typeArguments: [denomination],
    arguments: [
      tx.sharedObjectRef({ objectId: DEVNET_PAYMENT_SCHEDULER_ID, initialSharedVersion: SCHEDULER_INIT_VERSION, mutable: true }),
      tx.sharedObjectRef({ objectId: platformId, initialSharedVersion: platformInitVersion, mutable: true }),
      tx.object(accountId),
      limiters,
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  ```
- **UX:** Show a "Processing payment…" spinner, then on success refresh the subscription query and show a success toast with the SuiVision link. On `ENotDue`, show "This subscription isn't due yet — try a tier with frequency < 1 minute for the demo." On `EInsufficientBalance`, show a clear "Add funds to your billing account" CTA.
- **Acceptance:** A demo user can subscribe to a 1-minute-frequency tier, wait 60 seconds, click "Process Now", and see the balance decrease + the platform's pending treasury increase, all in <10 seconds.

### 1.2 Add a "Demo Tier" preset to `RegisterPlatformModal`

- **File:** `src/components/platform/RegisterPlatformModal.tsx`
- **Change:** Add a "Use demo defaults" checkbox that pre-fills:
  - Name: "Demo SaaS"
  - Description: "A demo platform for the PayStreamer hackathon."
  - Category: "SaaS"
  - Tier: $0.001 SUI, **every 60 seconds** (so the demo loop is fast)
- **Acceptance:** A user can register a working demo platform with 1 click on the form defaults.

### 1.3 Wire `CreateAccountModal` PolicyEditor values

- **File:** `src/components/subscriptions/CreateAccountModal.tsx:88-114`
- **Bug:** The form has a `PolicyEditor` step but `empty_policy_set()` is hardcoded regardless of the user's selections.
- **Change:** Either (a) wire the editor's output into the `create_account` call, or (b) remove the policy step entirely and document it as "v2.1 feature." **Recommend (b) for the demo** — the policy logic is a v2.1 item and showing a non-functional editor in a demo is worse than omitting it.
- **Acceptance:** The 4-step account-creation modal collapses to 3 functional steps.

---

## Phase 2 — Seed data and demo entry points (the "first 60 seconds")

A stranger landing on `/explore` and seeing nothing is the single biggest demo failure. They never even know the product exists.

### 2.1 Seed a permanent demo platform on devnet

- **Pre-req:** Re-run `scripts/v2/e2e-payment-cycle.ts` against the current `DEVNET_V2_PACKAGE_ID` to produce one clean platform with one active subscription, **then leave it alive**.
- **Capture:** The platform's `objectId` and `initialSharedVersion` from the script output. Add to `src/constants.ts`:
  ```ts
  export const DEMO_PLATFORM_ID = "0x...";        // from latest e2e run
  export const DEMO_PLATFORM_INIT_VERSION = 1234567; // from latest e2e run
  ```
- **Document:** Add a `scripts/v2/seed-demo-platform.ts` that runs the e2e and prints the IDs. Make it idempotent (use a fixed name; on `EPlatformAlreadyExists` or duplicate event, look up the existing one and re-print its ID).
- **Acceptance:** `pnpm seed:demo` produces (or re-discovers) a working demo platform and prints its object ID.

### 2.2 Add "Try the demo" CTAs to the landing and explore pages

- **File:** `src/pages/LandingPage.tsx`, `src/pages/ExplorePage.tsx`
- **Change:**
  - On the landing page, add a secondary CTA below "Create Free Platform": "Try a live demo → /subscribe/<DEMO_PLATFORM_ID>".
  - On the explore page, when no platforms are found, show a hero card: "No platforms registered yet on this network. Try our demo platform →" with the same link.
  - The SubscribePage for `DEMO_PLATFORM_ID` gets a "🌟 Featured Demo" badge.
- **Acceptance:** A stranger can click from `/` to a working subscribe flow without registering anything.

### 2.3 Fix `USDC_TYPE_ARG` and `USDSUI_TYPE_ARG` placeholders

- **File:** `src/constants.ts:22-23`
- **Bug:** Lines 22-23 are placeholder hex strings. Selecting USDC or USDSui in `DenominationSelector.tsx:49-65` will fail with `ECoinTypeNotRegistered (0x01006)`.
- **Option A (preferred for demo):** Hide USDC and USDSui in `DenominationSelector` for the demo. SUI only.
- **Option B (production-grade):** Find the real published USDC treasury package on devnet (typically the Circle-published one), register it via `registry::register_coin_type<USDC>`, and replace the hex strings with the real `package::module::Type` strings.
- **Recommend A** for the hackathon.
- **Acceptance:** Selecting a denomination in the demo always succeeds.

### 2.4 Add a devnet-faucet link in the WalletModal flow

- **File:** `src/components/WalletModal.tsx` is being deleted. Instead, add the link to `src/components/NavBar.tsx` and the empty-state on `DashboardLayout.tsx`.
- **Change:** When the user is on devnet and the wallet has 0 SUI, show a yellow banner: "Need testnet SUI to pay gas? Get some at https://faucet.sui.io/?network=devnet" with a copy-link icon.
- **Acceptance:** A stranger with an empty wallet sees the faucet link without having to read docs.

### 2.5 Fix `index.html` and add Open Graph / favicon

- **File:** `index.html`
- **Change:** Add `<meta name="description" content="Automated stablecoin subscriptions on Sui. One wallet approval, recurring billing forever.">`, an OG image tag, and a `link rel="icon"` pointing to a small PayStreamer logo (or `data:image/svg+xml,<svg>...</svg>` inline).
- **Acceptance:** Sharing the URL on Twitter/Slack shows a PayStreamer card.

---

## Phase 3 — End-to-end demo script (the "show, don't tell")

Once the above is done, the demo is *technically* functional. Phase 3 makes it *narratively* clear.

### 3.1 Add a "Guided Demo" walkthrough banner on the landing page

- **File:** `src/pages/LandingPage.tsx`
- **Change:** Add a 4-step sticky banner at the top: "1. Get devnet SUI → 2. Click 'Try the demo' → 3. Approve subscription → 4. Watch it auto-bill every 60 seconds." Steps 2-4 are deep links; step 1 links to the faucet.
- **Dismiss:** Persist dismissal in localStorage.
- **Acceptance:** A stranger who has never used Sui can follow the banner and complete the flow without reading the README.

### 3.2 Add a `docs/DEMO.md` walkthrough

- **File:** `docs/DEMO.md` (new)
- **Content:** A 5-minute script the presenter reads aloud:
  1. "PayStreamer is automated stablecoin subscription billing on Sui."
  2. "Here's a live platform on devnet — let me click 'Try the demo'."
  3. "I sign once. From now on, PayStreamer pulls the payment automatically every 60 seconds — no further signatures."
  4. "Watch the dashboard. 60 seconds later, the balance drops, the platform's treasury grows, and an event is emitted on chain."
  5. "And here's the kicker: that 'Process Now' button? It's permissionless. Anyone could click it. There's no Stripe, no API key, no monthly fee. Just smart contracts."
- **Acceptance:** A presenter can read this script verbatim and the demo will work.

### 3.3 Add a hero "Live Demo" video to the landing page

- **File:** `src/pages/LandingPage.tsx`
- **Change:** Embed a 60-second Loom or `asciinema` recording of the flow above, autoplay-muted on hover.
- **Alternative (no recording needed):** Build a small `<DemoFlow />` component that animates 3 cards (subscribe → due → paid) on a 5-second loop, mimicking the live state transitions.
- **Acceptance:** A landing-page visitor who doesn't want to connect a wallet can still see the product work.

### 3.4 Replace `preview.html` with a working static export

- **File:** `preview.html`
- **Current state:** A UX-audit annotation page, not a working product. Confusing.
- **Change:** Either delete it, or replace with a Vite static build of the production app pointed at a read-only `view` mode. Recommend **delete** — the production app is the demo.
- **Acceptance:** `rg "preview.html" .` shows no demo-relevant references.

### 3.5 Update `README.md` and `docs/v2-build-log.md`

- **Files:** `README.md:7-15, 38-43, 86-96`, `docs/v2-build-log.md:9, 51, 66`
- **Changes:**
  - Remove the "Running the Scheduler" section (off-chain scheduler is deprecated for v2).
  - Update "4 of 9 steps work" → "All 9 e2e steps pass on devnet" — the e2e from 2026-06-11 shows 9/9 success.
  - Fix `move/subscriptions_v2/` → `move/subscriptions/` everywhere.
  - Add a "Demo in 5 minutes" section at the top linking to `docs/DEMO.md`.
  - Pin the devnet package ID `0x146f09…` (currently the README references `0xe49283…` from a prior publish).
- **Acceptance:** README is consistent with the current code state.

---

## Phase 4 — Polish (elevate from "working" to "memorable")

These don't block the demo but are the difference between "this works" and "this is impressive."

### 4.1 Add a network selector to the navbar

- **File:** `src/components/NavBar.tsx`
- **Change:** Small dropdown for Devnet / Testnet / Mainnet. `dApp-kit.ts:28` already supports all three networks; only the UI is missing.
- **Acceptance:** A user can switch networks from the UI; the dApp-kit `useSwitchNetwork` hook handles state.

### 4.2 Live event feed on the landing page

- **File:** `src/pages/LandingPage.tsx`
- **Change:** Replace the static "X platforms accepting payments" badge with a live tail of `PlatformRegistered` and `PaymentProcessed` events from the GraphQL endpoint. Refresh every 15 seconds.
- **Acceptance:** The landing page shows real activity, not a snapshot from page-load.

### 4.3 Add an "Onboard a fresh stranger" modal to landing-page CTA

- **File:** `src/pages/LandingPage.tsx`
- **Change:** "Create Free Platform" opens a 2-step modal: (1) install Sui Wallet + get test SUI, (2) connect wallet. After connect, route to the platform portal. The current abrupt jump to the dashboard is jarring.
- **Acceptance:** A first-time user is guided through wallet setup before being asked to sign a transaction.

### 4.4 Replace hardcoded SUI decimals with a per-denomination lookup

- **Files:** `src/components/subscriptions/AccountCard.tsx:30, 44`, `src/components/subscriptions/ActivityFeed.tsx:46`, `src/components/subscriptions/SubscriptionCard.tsx:49`, `src/components/subscriptions/SubscriptionDetail.tsx`
- **Bug:** All four hardcode `1_000_000_000` (SUI has 9 decimals). USDC and USDSui have 6.
- **Change:** Add a `DECIMALS_BY_TYPE` map in `src/lib/format.ts`:
  ```ts
  export const DECIMALS_BY_TYPE: Record<string, number> = {
    "0x2::sui::SUI": 9,
    "0x...::usdc::USDC": 6,
    "0x...::usdsui::USDSui": 6,
  };
  ```
- **Acceptance:** Switching between SUI and USDC display formats correctly without manual adjustment.

### 4.5 Fix the e2e scripts and add a single "demo bootstrap" entry point

- **Files:** `scripts/v2/register-sui.ts:40-42`, `scripts/v2/upgrade-package.ts:6-7, 25`, `package.json`
- **Changes:**
  - Fix the stale package IDs in `register-sui.ts` and `upgrade-package.ts` to use the current `0x146f09…` (or read from env).
  - Re-add a `helpers.ts` for `executeTransaction` that `upgrade-package.ts` imports.
  - Add a `package.json` script: `"seed:demo": "tsx scripts/v2/seed-demo-platform.ts"`.
- **Acceptance:** `pnpm seed:demo` works from a clean clone.

### 4.6 Add CI lint to catch regressions

- **File:** `.github/workflows/ci.yml` (new, if not present) or `package.json` scripts
- **Change:** Add `"lint": "tsc --noEmit"` and `"check:rg-fakes": "..."` that greps for `Math.random()` in `src/` and `hardcoded 1_000_000_000`.
- **Acceptance:** A future PR that hardcodes fake data fails CI.

### 4.7 Update `.suiperpower/build-context.md`

- **File:** `suiperpower/build-context.md` (per CLAUDE.md rule, this must stay in sync)
- **Change:** Append a "Demo-Readiness State — 2026-06-15" section summarizing which of the above are done, which are in progress, and which are deferred. Update after each phase.

---

## Execution order & estimated effort

| Phase | Items | Estimated time | Cumulative |
|-------|-------|----------------|------------|
| **Phase 0** — Quick wins | 0.1–0.8 (8 items) | ~2 hours | 2 h |
| **Phase 1** — "Process Now" button | 1.1–1.3 (3 items) | ~4 hours | 6 h |
| **Phase 2** — Seed data & entry points | 2.1–2.5 (5 items) | ~3 hours | 9 h |
| **Phase 3** — Demo narrative | 3.1–3.5 (5 items) | ~3 hours | 12 h |
| **Phase 4** — Polish | 4.1–4.7 (7 items) | ~5 hours | 17 h |

**Phases 0–2 are the demo-blocker minimum** (~9 hours of focused work). With those done, a stranger can complete the loop. Phase 3 turns it into a presentable demo. Phase 4 turns it into a polished one.

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Devnet state rots between demo prep and demo day | Phase 2.1: idempotent `seed:demo` script that re-prints the platform ID on every run. Pin a known-good package ID in `constants.ts`. |
| The off-chain scheduler interferes with the on-chain one | Phase 0.8: remove `pnpm scheduler` from `package.json` and from the README. |
| USDC denomination causes an unrecoverable abort in a live demo | Phase 2.3: hide USDC/USDSui in the demo denomination selector. |
| A judge doesn't have devnet SUI | Phase 2.4: in-UI faucet link with one-click copy. |
| The "Process Now" button is gated on `next_billing_ts <= now`, which is hard to demo with a 30-day tier | Phase 1.2: demo tier preset with 60-second frequency. |
| The seeded demo platform's `initialSharedVersion` becomes stale after a contract republish | Phase 2.1: re-run `seed:demo` after every publish, and pin the new versions in `constants.ts`. |
| A code review of the demo plan surfaces a contract bug | The `e2e-result.json` snapshot from 2026-06-11 shows all 9 steps pass; the contract surface is verified. |

---

## Definition of Done

The project is "demo-able" when **all** of the following are true:

1. A stranger can `git clone && pnpm install && pnpm dev` and see the landing page render with PayStreamer branding.
2. From the landing page, the stranger can click "Try the demo" and reach a working `/subscribe/:id` page with a "Featured Demo" badge.
3. From that page, with one wallet signature, the stranger is subscribed.
4. Within 60 seconds, a "Process Now" button becomes available. Clicking it executes a real on-chain transaction in <10 seconds.
5. The dashboard updates to show the decreased balance, and the platform overview updates to show the increased treasury.
6. The README + `docs/DEMO.md` together walk a presenter through the script in <5 minutes.
7. No fake / hardcoded data appears on any user-facing page.
8. The off-chain scheduler, dead `WalletModal.tsx`, and `SCHEDULER_SECRET` are gone from the demo path.
9. `pnpm build` succeeds; `pnpm dev` runs without console errors.
10. The `.suiperpower/build-context.md` reflects the new state.

When all 10 are green, the project is ready to ship as a hackathon demo.
