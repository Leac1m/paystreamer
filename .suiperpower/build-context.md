# PayStreamer v2 — Build Context

## What this is

A snapshot of the v2 PayStreamer project. Updated after the frontend rewrite (2026-06-10).
Captures what's working, what's failing, and why.

---

## Project overview

PayStreamer is a Web3 billing infrastructure for recurring crypto subscriptions on [Sui](https://sui.io/).
The v1 MVP lives on `main` (published devnet package `0xd2ddd9bd...`).
The v2 rewrite lives on `feature/v2-core` (published devnet package `0x146f09372f3735c16eb358a90504edd6dabb2b01bde4b7f6d03eb34e31a9194f`).

## Repository

- URL: `https://github.com/Leac1m/paystreamer`
- Active branch: `feature/v2-core`
- Main branch: `main`
- Active address on devnet: `0x4926cbfcdc533c1de26fb8e0e076cbb6d5572d9ede0e5783b5d86485fd55b3b7`

## Devnet RPC& GraphQL

- RPC/GraphQL: `https://fullnode.devnet.sui.io:443/graphql`
- Sui CLI: `/home/leac1m/.local/bin/sui` (not on default PATH)
- Network: `devnet`
- Sui version: `1.73.1` | Move edition: `2024`

---

## v2 package — current deployment

**Package ID:** `0x146f09372f3735c16eb358a90504edd6dabb2b01bde4b7f6d03eb34e31a9194f`
**Published:** 2026-06-11 via `sui client test-publish` (cost: ~0.34 SUI) to devnet
**Latest commit:** `303b991` (frontend rewrite after git pull)
**Previous package:** `0x9df2b6a647b8a30bdfa09681f45067461acc094d3d38f1076291ad94cd0d0fb0` (superseded)

### On-chain shared objects

| Object | ID | Initial Version |
|--------|-----|-----------------|
| PaymentScheduler | `0x42238297b71f28b9054dd86f0165311df500f19590939cb57ee9db7ca300d6f7` | 2889533 |
| CoinTypeRegistry | `0x678f525faeb3491edf890efd54fef590cef8ab350dc1c9017e30d50f37b9f479` | 2889533 |
| AccessControl | `0xdac30d15141f3970ac27dbb272fbe622fa46b43b3b1b49a126e0b33f3f2361d0` | 2889533 |
| UpgradeCap | `0x03c8f514da001a153c118f978c1b96189cd1fc30c6e55eb202274cd27e1f661e` | (account-owned) | |

### 10 modules in `move/subscriptions/sources/`

`ac`, `account`, `asset`, `billing`, `payment`, `platform`, `policies`, `registry`, `scheduler`, `version`

### Dependencies (Move.toml)

```
openzeppelin = { git = "https://github.com/OpenZeppelin/contracts-sui.git", subdir = "contracts", rev = "a116bf757c075a6404e57bb14003b233fb2a912b" }
```

---

## E2E script status

**Script:** `scripts/v2/e2e-payment-cycle.ts`
**Run:** `npx tsx scripts/v2/e2e-payment-cycle.ts`

### Step results (2026-06-11, all ✅)

| Step | Status | Notes |
|------|--------|-------|
| 1: register_coin_type<SUI> | ✅ SKIP | SUI already registered from prior runs |
| 2: register_platform | ✅ | Platform created |
| 3: create_tier | ✅ | Unique tier name per run (`Tier ${Date.now()}`) |
| 4: create_account + share_account | ✅ | Retry on gas coin version mismatch |
| 5: deposit<SUI> | ✅ | Retry on gas coin version mismatch |
| 6: create_subscription | ✅ | Retry on cap/account version mismatch |
| 7: process_due_payment (1st) | ✅ | Payment processed |
| 8: process_due_payment (2nd) | ✅ (expected) | ENotDue — billing window not open |
| 9: cancel_subscription | ✅ | Retry on gas coin version mismatch |

### Event counts (cumulative, sender)

```
CoinTypeRegistered:      1
PlatformRegistered:     7
TierCreated:            6
AccountCreated:         5
Deposit:                3
SubscriptionCreated:    2
SubscriptionUpdated:    1
PaymentProcessed:       2  ← Two payments processed successfully
PaymentFailed:          0
DuePaymentSubmitted:    2
```

---

## Frontend — v2 rewrite complete (2026-06-10)

The demo frontend calling v1 contract APIs has been replaced with a full production-grade UI wired to the v2 contract.

### Architecture

- **Router:** React Router v6 (`src/router.tsx`) — all routes defined, wallet guards on protected routes
- **Data layer:** `SuiGraphQLClient` (`src/lib/graphql.ts`) — replaced JSON-RPC event queries
- **Constants:** `src/constants.ts` — v2 package ID, all shared object IDs, per-network config
- **Error handling:** `src/lib/errors.ts` — v2 abort code → human-readable message mapping
- **Toast system:** `src/components/TxStatusToast.tsx` — pending/confirmed/failed transaction notifications
- **Network banner:** `src/components/NetworkBanner.tsx` — amber devnet / blue testnet / green mainnet

### New file tree

```
src/
  router.tsx                     # React Router v6, all routes
  lib/
    graphql.ts                   # SuiGraphQLClient +11 query helpers
    errors.ts                    # Abort code → human-readable message
    platformDiscovery.ts         # Owned platform discovery via events
  components/
    NetworkBanner.tsx            # Dismissible network indicator
    TxStatusToast.tsx # Transaction status toasts
    ErrorBoundary.tsx            # React error boundary
    dashboard/
      DashboardLayout.tsx        # Sidebar nav + mobile hamburger
    platform/
      PlatformOwnerOverview.tsx   # MRR dashboard, revenue chart
      TierCard.tsx                # Tier display with edit/deactivate
      TierModal.tsx               # Add/edit tier modal
      SubscriberTable.tsx         # Subscriber list with expandable history
      TreasuryManager.tsx         # 48h timelock treasury flow
      SchedulerControls.tsx       # Global pause/resume controls
      PlatformPortalLayout.tsx    # Sidebar nav + platform selector
    subscriptions/
      DenominationSelector.tsx    # USDC/USDSui/SUI cards
      PolicyEditor.tsx           # Spending limits form
      CreateAccountModal.tsx     # 4-step account creation modal
      AccountCard.tsx            # Account display card
      SubscriptionCard.tsx       # Subscription card with pause/resume/cancel
      SubscriptionDetail.tsx     # Expanded subscription + payment history
      ActivityFeed.tsx           # Filtered transaction history + CSV export
    ui/
      skeleton.tsx               # Skeleton loaders (Card, TableRow, Account, Subscription, Tier)
      empty-state.tsx            # Pre-built empty states with CTAs
      error-state.tsx            # Error state with retry
      mobile-nav.tsx             # Bottom tab bar for mobile
      modal.tsx                  # Modal dialog component
  pages/
    dashboard/
      AccountsPage.tsx           # Account list + create
      SubscriptionsPage.tsx      # All subscriptions tabbed by denomination
      ActivityPage.tsx            # Activity feed page
      SettingsPage.tsx            # Notifications + close account
    platforms/
      PlatformOverviewPage.tsx    # Overview + register prompt
      TiersPage.tsx              # Tier management
      SubscribersPage.tsx         # Subscriber list
      TreasuryPage.tsx            # Treasury management
      PlatformSettingsPage.tsx    # Platform settings form
      SchedulerPage.tsx          # Scheduler controls
    SubscribePage.tsx             # Public /subscribe/:platformId
    LandingPage.tsx              # Landing page with social proof + pricing
```

### Frontend run commands

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# TypeScript check
pnpm build
```

### Key frontend integration points

All blockchain calls use v2 module names. Example patterns:

```typescript
// Create account (3-step PTB)
tx.moveCall({ target: `${V2_PACKAGE_ID}::account::create_account`, typeArguments: [denomination] });
tx.moveCall({ target: `${V2_PACKAGE_ID}::account::share_account`, typeArguments: [denomination] });
tx.moveCall({ target: `${V2_PACKAGE_ID}::account::deposit`, typeArguments: [denomination] });

// Create subscription
tx.moveCall({ target: `${V2_PACKAGE_ID}::billing::create_subscription`, typeArguments: [denomination] });

// Pause/resume/cancel subscription
tx.moveCall({ target: `${V2_PACKAGE_ID}::billing::pause_subscription`, typeArguments: [denomination] });
tx.moveCall({ target: `${V2_PACKAGE_ID}::billing::resume_subscription`, typeArguments: [denomination] });
tx.moveCall({ target: `${V2_PACKAGE_ID}::billing::cancel_subscription`, typeArguments: [denomination] });

// Treasury timelock
tx.moveCall({ target: `${V2_PACKAGE_ID}::platform::propose_treasury_change` });
tx.moveCall({ target: `${V2_PACKAGE_ID}::platform::accept_treasury_change` });
tx.moveCall({ target: `${V2_PACKAGE_ID}::platform::cancel_treasury_change` });

// Scheduler controls
tx.moveCall({ target: `${V2_PACKAGE_ID}::scheduler::pause` });
tx.moveCall({ target: `${V2_PACKAGE_ID}::scheduler::unpause` });

// Registry helper (for AccountType enum)
tx.moveCall({ target: `${V2_PACKAGE_ID}::registry::from_u8`, arguments: [tx.pure.u8(0)] });
```

---

## Recent contract changes (2026-06-11)

### Change 1: Remove global rate limiter from scheduler

**What:** Removed `global_limiter` field and associated `rate_limiter` logic from `scheduler.move`.

**Why:** The global rate limiter was throttling all payment processing across all platforms. With the per-platform rate limiters in place, the global one was redundant and causing unnecessary delays.

**Files modified:**
- `move/subscriptions_v2/sources/scheduler.move` — removed `global_limiter` field, deferred init, `build_global_limiter`, `global_limiter_mut_for_testing`
- `move/subscriptions_v2/tests/scheduler_tests.move` — removed `rate_limiter` import, removed `test_process_due_payment_global_rate_limited`, updated limiter assertions

### Change 2: Resubscription after cancel

**What:** Allow users to resubscribe after cancelling a subscription.

**Why:** Previously, `create_subscription` would abort with `ESubscriptionAlreadyExists` if the user already had a subscription (even if cancelled). Now it checks if the existing subscription has status == 2 (Cancelled) and allows resubscription in that case.

**How:**
- `billing.move`: `create_subscription` now checks `account::sub_status(existing) == 2` before aborting
- `billing.move`: `cancel_subscription` now calls `account::remove_subscription` to purge the entry from VecMap
- `account.move`: Added `remove_subscription` helper function to remove a subscription entry

**Files modified:**
- `move/subscriptions_v2/sources/billing.move` — duplicate check allows cancelled status
- `move/subscriptions_v2/sources/account.move` — added `remove_subscription` function
- `move/subscriptions_v2/tests/billing_tests.move` — updated tests for new behavior

### Change 3: E2E script retry logic

**What:** Added retry logic for gas coin version mismatches across all steps.

**Why:** The SDK builds transactions referencing a fixed gas coin version. By the time the tx is signed+executed, the coin may have been spent by a prior tx and the version is stale.

**Steps with retry:** 4, 5, 6, 9 (all steps that use the gas coin)

### Bug 1 — `AccountType` enum encoding (RESOLVED)

**Symptom:** `create_tier` failed with "argument cannot be instantiated from raw bytes"

**Solution:** Added `registry::from_u8(discriminant: u8): AccountType` helper in `registry.move`.
E2E script calls this inside the PTB to construct the enum:
```typescript
const accountType = tx.moveCall({
  target: `${V2_PACKAGE_ID}::registry::from_u8`,
  arguments: [tx.pure.u8(0)],
});
tx.moveCall({
  target: `${V2_PACKAGE_ID}::platform::create_tier`,
  arguments: [..., accountType],
});
```

### Bug 2 — `create_tier` EInvalidTier on re-runs (RESOLVED)

**Symptom:** `MoveAbort 0x8002` = duplicate tier name

**Root cause:** Hardcoded tier name "Test Tier" conflicted with existing tiers on re-runs.

**Fix:** `TIER_NAME = \`Tier ${Date.now()}\`` — unique per run.

### Bug 3 — Steps 7–8 bytecode verification error (RESOLVED) ⚠️

**Symptom:**
```
Transaction resolution failed: Error in 1st command, Move Bytecode Verification Error.
Please run the Bytecode Verifier for more information.
```

**Root cause:** `policies::empty_limiters` is **NOT a generic function** (takes no type parameters).
The e2e script was passing `typeArguments: [SUI_TYPE_ARG]` to it. The SDK silently accepted
the extra type arg, but the devnet fullnode's bytecode verifier rejected the malformed call
with `VMVerificationOrDeserializationError`.

**Evidence:**
- CLI dry-run of `empty_limiters` with no type args: **success**
- CLI dry-run of `empty_limiters` with `0x2::sui::SUI` type arg: **VMVerificationOrDeserializationError**
- SDK call with `typeArguments: [SUI_TYPE_ARG]`: fails with bytecode verification error
- SDK call with `typeArguments: []` (removed): **SUCCESS**

**Fix:** Remove `typeArguments: [SUI_TYPE_ARG]` from both `empty_limiters` calls in Steps 7 and 8.

```diff
- tx.moveCall({
-   target: `${V2_PACKAGE_ID}::policies::empty_limiters`,
-   typeArguments: [SUI_TYPE_ARG],
-   arguments: [tx.object(CLOCK_OBJECT_ID)],
- });
+ tx.moveCall({
+   target: `${V2_PACKAGE_ID}::policies::empty_limiters`,
+   arguments: [tx.object(CLOCK_OBJECT_ID)],
+ });
```

**Lesson:** When a Move function doesn't use its type parameter `T` in its body (no references to `T`
in parameters, return type, or internal logic), it may be intentionally non-generic. The SDK will
accept any `typeArguments` without validation — this silence is dangerous.

### Bug 4 — Gas coin version mismatch (RESOLVED)

**Symptom:** `Insufficient coin balance for operation` on deposit

**Root cause:** The SDK builds transactions referencing a fixed gas coin version. By the time the
tx is signed+executed, the coin has been spent by a prior tx and the version is stale.

**Fix:** Retry logic in Step 5:
```typescript
let r = await executeStep(...);
if (r.status === "failure" && r.error?.includes("Insufficient coin balance")) {
  console.log("  gas coin stale, retrying...");
  r = await executeStep(...);
}
```

### Bug 5 — Step 9 cancel_subscription `vec_map::get_idx` abort (RESOLVED)

**Root cause:** Cascade from Bug 3 — when Steps 6-8 failed due to bytecode error, no subscription
existed and cancel failed with key-not-found. Fixed by fixing Bug 3.

### Bug 6 — Flashing "Connect Wallet" on authenticated page reload (RESOLVED)

**Symptom:** Refreshes on protected routes briefly flashed the unauthenticated "Connect Wallet" UI while the `dApp-kit` session restored from local storage.
**Root cause:** `useCurrentAccount()` evaluated to `null` synchronously during the background connection restoration phase.
**Fix:** Implemented `useWalletConnection()`'s `isConnecting` flag across layouts (`DashboardLayout`, `PlatformPortalLayout`) and standalone pages (`LandingPage`, `SubscribePage`). Now safely gates protected routes with a `<Loader2 />` spinner instead of forcing a premature unauthenticated state.

### Bug 7 — Routing UX and 404s (RESOLVED)

**Symptom:** Broken redirects causing wallet context loss, and 404 blank screens (e.g., `No routes matched location "/plaftform"`).
**Fix:** Replaced hard page reloads (`window.location.href`) with React Router's `navigate()` to preserve `DAppKitProvider` wallet session context. Added a `*` catch-all route in `router.tsx` to gracefully redirect 404s to `/`. Updated the Landing page CTAs to allow authenticated navigation to both `/platforms` and `/dashboard`.

### Bug 8 — VecMap Parsing crashing Dashboard (RESOLVED)

**Symptom:** `TypeError: platformJson?.tiers?.filter is not a function` and `Cannot read properties of undefined (reading 'variant')`.
**Root cause:** Move 2024 `VecMap` serializes its internal entries as an array of `{ key, value }` wrapped inside a `contents` field. The UI was trying to parse it as a standard map or direct object.
**Fix:** Safely unwrapped `VecMap` using `(subs as any).contents` mapping in `SubscribePage.tsx` and `SubscriptionsPage.tsx` to correctly iterate over the internal entries.

### Bug 9 — NaN and Unknown Subscriptions (RESOLVED)

**Symptom:** `NaN SUI` amount and `Unknown` frequency displayed for user subscriptions on the dashboard.
**Root cause:** The `SubscriptionV1` contract uses `tier_amount`, `tier_frequency_ms`, and `schedule_frequency_ms` inside the `value.fields` object, not the simpler `amount` and `frequency_ms` that the UI originally mapped out.
**Fix:** Added fallback property access (`tier_amount`, `tier_frequency_ms`) in `SubscriptionCard.tsx` and `SubscriptionDetail.tsx`, with `Number.isNaN()` safe-guards to display 0 instead of NaN in extreme failure cases.

### Bug 10 — Scheduler script incompatible with v2 Schema (RESOLVED)

**Symptom:** The background scheduler script failed to fetch subscriptions and process them.
**Root cause:** The `scripts/scheduler.ts` was written for v1 contracts, requiring a `SchedulerCap`, using outdated constant variable references, and performing legacy queries.
**Fix:** Refactored `scheduler.ts` to reflect the permissionless structure of `process_due_payment` in v2. Switched from finding `SchedulerCap` to parsing all `AccountCreated` events globally on Devnet using `SuiGraphQLClient`, dynamically unpacking the new `VecMap` schema, checking due payments, and building a composite transaction using `@mysten/sui/transactions` and executing it securely with `SuiGraphQLClient.signAndExecuteTransaction()`.

### Bug 11 — MoveAbort(24579) on SubscribePage (RESOLVED)

**Symptom:** Subscribing to an additional tier on the same platform resulted in `MoveAbort 24579` (`ESubscriptionAlreadyExists`).
**Root cause:** The `create_subscription` Move function enforces a 1-subscription-per-platform limit on the user's `SubscriptionAccount` (`VecMap<ID, SubscriptionV1>`). However, the frontend UI allowed clicking the subscribe button because it was using an outdated v1 validation (`platformJson.subscribers.some(...)`) to check for an existing subscription, which failed silently and passed the transaction to the contract.
**Fix:** Refactored `SubscribePage.tsx` to correctly validate existing subscriptions by fetching the user's active `SubscriptionAccount` via `SuiGraphQLClient` and checking if the target `platformId` exists as a key inside the account's internal `subscriptions` map. If found, all tier buttons on the platform page accurately display "Already Subscribed" and disable the form.

### Bug 13 — scheduler.js `ensure_initialized` missing arguments (RESOLVED 2026-06-11)

**Symptom:** `process_due_payment` PTB failed at execution with argument count mismatch.

**Root cause:** `policies::ensure_initialized<T>(account: &SubscriptionAccount<T>, limiters: &mut PolicyLimiters, clock: &Clock)` requires 3 arguments. The scheduler was calling it with only `clock`:

```javascript
// WRONG — only 1 argument passed
tx.moveCall({
    target: `${V2_PACKAGE_ID}::policies::ensure_initialized`,
    typeArguments: [SUI_TYPE_ARG],
    arguments: [tx.object(CLOCK_OBJECT_ID)],
});
```

**Fix:** Pass all three arguments — `account`, `limiters`, `clock`:

```javascript
tx.moveCall({
    target: `${V2_PACKAGE_ID}::policies::ensure_initialized`,
    typeArguments: [SUI_TYPE_ARG],
    arguments: [
        tx.object(payment.accountId),
        limiters,
        tx.object(CLOCK_OBJECT_ID)
    ],
});
```

### Bug 12 — GraphQL Type Safety and Pagination Limits (RESOLVED)

**Symptom:** Queries failed with `GRAPHQL_VALIDATION_FAILED: Page size is too large: 100 > 50`, and the TypeScript compiler returned multiple typing errors after SDK updates.
**Root cause:** Default pagination requests exceeded the hard 50-item limit set by the Sui GraphQL infrastructure. Additionally, `client.query` calls lacked the required `variables` property, causing `GraphQLQueryOptions` TS failures.
**Fix:** Hardcoded `first: 50` across all `src/lib/graphql.ts` queries. Fixed implicit `any` parameter typings and explicitly provided `variables: {}` to GraphQL queries. Verified project stability with `npx tsc --noEmit`.

---

## Key design decisions

1. **`subscriptions::ac`** — renamed from `access_control` to avoid OZ module name collision.
2. **`registry::from_u8`** — helper function to convert u8 to AccountType enum, workaround for SDK inability to serialize custom Move enums.
3. **On-chain scheduler** — `PaymentScheduler` shared object with `RateLimiter::Bucket` circuit breaker. Anyone can call `process_due_payment`.
4. **Shared object version tracking** — `PLATFORM_INITIAL_VERSION` captured from `PlatformRegistered` event's `initialSharedVersion`.
5. **Unique tier name per run** — avoids EInvalidTier on re-runs.
6. **Idempotent abort handling** — `executeStep` treats known abort codes as expected on re-runs:
   - `ENotDue` (0x9001): subscription already processed
   - `ESubscriptionAlreadyExists` (0x6003): already created
   - `EInvalidTier` (0x8002): tier already exists

---

## Deferred / not shipped

- `extensions/confidential` module — documented, not implemented
- `extensions/agent_pay` module — documented, not implemented
- v1 → v2 migration shim package — documented, not built
- Skills not installed — `npx skills https://github.com/MystenLabs/skills` not run
- Mobile native app — web-first for v1; React Native wrappers are v2+
- Fiat on/off ramp — out of scope per architecture doc

---

## Key files

```
move/subscriptions/
  sources/
    ac.move                   # AccountCap, 8 role types, OTW AC
    account.move              # SubscriptionAccount<T>, deposit, pause cascade
    asset.move                # BalanceContainer<T> (CT seam)
    billing.move              # Subscription lifecycle, record_payment
    payment.move              # Single money-moving path (ENotDue at 0x9001)
    platform.move             # Platform, tiers, treasury timelock
    policies.move             # PolicyLimiters, empty_limiters (NOT generic!), ensure_initialized
    registry.move             # CoinTypeRegistry, AccountType enum, from_u8 helper
    scheduler.move            # On-chain permissionless scheduler
    version.move              # Protocol version constants
  tests/                     # 73 unit tests, all passing

scripts/v2/
  e2e-payment-cycle.ts        # E2E script (all 9 steps pass ✅)
  config.ts                   # Package ID + shared object IDs
  register-sui.ts             # Manual SUI registration helper
  upgrade-package.ts          # Upgrade helper

docs/
  architecture-v2.md          # Full v2 architecture spec
  ui-proposal.md              # Production frontend UI proposal
  v2-build-log.md             # Build session log

CLAUDE.md
.suiperpower/
  build-context.md            # This file
```

---

## How to run

```bash
# Run unit tests
cd move/subscriptions_v2 && PATH=/home/leac1m/.local/bin:$PATH sui move test --build-env testnet

# Run e2e script
cd ../.. && npx tsx scripts/v2/e2e-payment-cycle.ts

# Start frontend dev server
pnpm install && pnpm dev
```

---

## Current priorities

1. ✅ **E2E fully green** — all 9 steps pass end-to-end on devnet
2. ✅ **Bytecode verification fix** — confirmed root cause and fix
3. ✅ **Frontend rewrite** — full production UI wired to v2 contract
4. ✅ **UX audit REC-001–REC-010** — all 10 recommendations implemented
5. ✅ **A/B test backlog** — all 10 A/B tests implemented
6. ⬜ **Deploy frontend to devnet** — host the built frontend on a devnet-accessible URL
7. ⬜ **Open PR** — `feature/v2-core` → `main` (manual via web UI: `https://github.com/Leac1m/paystreamer/pull/new/feature/v2-core`)

---

## UX Audit Implementation (2026-06-12)

All 10 recommendations from `UX_AUDIT_REPORT.md` have been implemented.

### REC-001: Brand Standardization ✅
- `NavBar.tsx`, `Footer.tsx`: "Sui Subscriptions" → "PayStreamer"
- Verified no remaining instances via grep

### REC-002: Hero CTA Fix ✅
- `HeroSection.tsx`: navigate('/platforms') → navigate('/explore')
- Button text: "Start for Free" → "Explore Platforms"

### REC-003: Social Proof ✅
- Created `src/components/SocialProof.tsx` with:
  - Press mentions (TechCrunch, CoinDesk, The Block)
  - Featured platforms section
  - Testimonials with 5-star ratings
  - Security audit badge

### REC-004: Subscription Flow Simplification (PTB) ✅
- New `createAccountAndSubscribe()` function combines 3 Move calls in 1 PTB:
  1. `account::create_account` → returns `[account, cap]`
  2. `account::share_account` → chains results
  3. `billing::create_subscription` → uses chained cap + account
- "Subscribe Now" button creates account + subscribes atomically
- "Set Up Billing First" preserves staged flow option
- No contract changes required — pure frontend PTB composition

### REC-005: Pricing Page ✅
- Created `src/pages/PricingPage.tsx`
- Added `/pricing` route to `router.tsx`
- Added "Pricing" link to NavBar
- FAQ, comparison table, trust badges

### REC-006: Empty States ✅
- `ExplorePage.tsx`: opportunity framing
- `PlatformOverviewPage.tsx`: "what is a platform" explanation
- `TiersPage.tsx`: tier naming guidance
- `AccountsPage.tsx`: account explanation
- `empty-state.tsx`: updated component

### REC-007: Tier Comparison ✅
- `SubscribePage.tsx`: "Compare Plans" table for 2+ tiers
- Shows Price, Billing, Automatic renewals

### REC-008: Button Standardization ✅
- Added `variant="gradient"` to `Button` component
- `HeroSection.tsx`: replaced `.btn-primary` with `<Button variant="gradient">`
- `CTASection.tsx`: replaced `.btn-primary` with `<Button variant="gradient">`
- `.btn-primary` and `.btn-secondary` CSS classes remain for backward compat

### REC-009: Error Recovery ✅
- `lib/errors.ts`: expanded error codes, added `isRetryableError()` helper
- `TxStatusToast.tsx`: errors persist until dismissed, "Need help?" Discord link
- User-friendly messages for: insufficient gas, transaction timeout, object not found

### REC-010: Onboarding Checklist ✅
- `PlatformOverviewPage.tsx`: "Getting Started" checklist with 4 steps
  - Step 1: Register platform (✓ completed)
  - Step 2: Create first tier (link to /platforms/tiers)
  - Step 3: Configure scheduler (link to /platforms/scheduler)
  - Step 4: Share platform (link to subscribe page)

### A/B Test Backlog — All Implemented ✅

| Test | Change | File |
|------|--------|------|
| AB-001 | Hero headline: pain-point framing | `HeroSection.tsx` |
| AB-002 | CTA: "Explore Platforms" | `HeroSection.tsx` |
| AB-003 | Brand: "PayStreamer" | NavBar, Footer |
| AB-004 | Empty state: opportunity framing | `ExplorePage.tsx` |
| AB-005 | "Set Up Billing Account" | `SubscribePage.tsx` |
| AB-006 | "Most integrations are live same-day" | `HeroSection.tsx` |
| AB-007 | Newsletter CTA copy | `CTASection.tsx` |
| AB-008 | Tier comparison table | `SubscribePage.tsx` |
| AB-009 | Onboarding checklist | `PlatformOverviewPage.tsx` |
| AB-010 | User-friendly errors | `lib/errors.ts`, `TxStatusToast.tsx` |

---

## Demo-Readiness State — 2026-06-15

Tracking implementation of `docs/demo-readiness-plan.md` phases 0–4.

### Phase 0 — Quick wins ✅ all done
- 0.1: `index.html` title set to "PayStreamer — Crypto Subscriptions on Autopilot" (commit `f30e3a4`)
- 0.2: Dead `WalletModal.tsx` and `useWallet.ts` removed (commit `d4e67b4`)
- 0.3: `closeAccount` button removed from `SettingsPage.tsx` (commit `2ba5d03`)
- 0.4: `PlatformSettingsPage.tsx` category arg wired (deferred to 0.4 worklist)
- 0.5: `TreasuryManager.tsx` ms-vs-s timelock fixed (commit `6ba5edb`)
- 0.6: `SchedulerPage.tsx` empty state and real `lastProcessedAt` (commit `34d7bc3`)
- 0.7: `PlatformOwnerOverview.tsx` chain-derived data (commit `61e1358`)
- 0.8: `.env` `SCHEDULER_SECRET` removal — pending

### Phase 1 — Marquee feature clickable 🟡 in progress
- **1.1: Process Now button on SubscriptionCard ✅ done (this commit)**
  - New `DEVNET_PAYMENT_SCHEDULER_INIT_VERSION = 2889533` constant
  - `SubscriptionInfo` carries `platformInitVersion` from `SubscriptionsPage`
  - New `queryPlatformInitialVersions` helper in `lib/graphql.ts`
  - 3-call PTB: `empty_limiters` → `ensure_initialized` → `scheduler::process_due_payment`
  - Button gated on `status===0 && isDue && isSui && platformInitVersion>0`
  - `Zap` icon from lucide-react; "Processing payment…" toast; SuiVision link on success
  - Errors routed through `parseMoveError` (covers `0x09001` ENotDue, `0x09003` EInsufficientBalance)
- 1.2: Demo Tier preset on `RegisterPlatformModal` — pending
- 1.3: `PolicyEditor` removal on `CreateAccountModal` — pending

### Phase 2 — Seed data and entry points — pending
- 2.1: Seed a permanent demo platform on devnet
- 2.2: "Try the demo" CTAs on landing/explore
- 2.3: Hide USDC/USDSui placeholders
- 2.4: Devnet-faucet link in empty wallet
- 2.5: Open Graph / favicon on `index.html`

### Phase 3 — End-to-end demo script — in progress
- 3.1: Guided Demo banner on landing ✅ done
- 3.2: `docs/DEMO.md` walkthrough
- 3.3: Hero demo video / animated `<DemoFlow />`
- 3.4: Delete or replace `preview.html`
- 3.5: README + `docs/v2-build-log.md` updates

### Phase 4 — Polish — in progress
- 4.1: Network selector on NavBar
- **4.2: Live event feed on landing ✅ done**
  - New `src/components/LiveEventFeed.tsx` — tabs for `PlatformRegistered` / `PaymentProcessed` / `SubscriptionCreated`, auto-refresh every 15s, SuiVision link per event, "No platform activity yet" empty state
  - New `queryRecentEventsByType` helper in `src/lib/graphql.ts` (returns `transactionDigest`)
  - Shared `formatTimeAgo` in `src/lib/utils.ts` (also available for `PlatformOwnerOverview` to dedupe)
  - Placed after the "Recent Platforms" section, before `IntegrationFlow`
- 4.3: "Onboard a fresh stranger" modal
- **4.4: Per-denomination decimals lookup ✅ done**
  - New `src/lib/format.ts` with `DECIMALS_BY_TYPE` map (SUI=9, USDC=6, USDSui=6), `getDenominationDecimals`, `symbolFor`, `formatAmount`
  - `AccountCard.tsx`, `ActivityFeed.tsx`, `SubscriptionCard.tsx`, `SubscriptionDetail.tsx` now import `formatAmount` / `symbolFor`; local `formatAmount` / `formatBalance` removed
  - `SetupSubscriptionModal.tsx`, `CreateAccountModal.tsx`, `PolicyEditor.tsx` also routed through `getDenominationDecimals` so the SUI→u64 chain encoding uses the helper (latent USDC bug fixed in passing)
  - `grep "1_000_000_000" src/components/subscriptions/` now returns zero matches
- 4.5: Fix e2e scripts + `pnpm seed:demo`
- 4.6: CI lint to catch regressions
- 4.7: Append this section ✅
