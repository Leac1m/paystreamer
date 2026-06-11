# PayStreamer v2 — Build Context

## What this is

A snapshot of the v2 PayStreamer project. Updated after the frontend rewrite (2026-06-10).
Captures what's working, what's failing, and why.

---

## Project overview

PayStreamer is a Web3 billing infrastructure for recurring crypto subscriptions on [Sui](https://sui.io/).
The v1 MVP lives on `main` (published devnet package `0xd2ddd9bd...`).
The v2 rewrite lives on `feature/v2-core` (published devnet package `0x9df2b6a647b8a30b...`).

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

**Package ID:** `0x9df2b6a647b8a30bdfa09681f45067461acc094d3d38f1076291ad94cd0d0fb0`
**Published:** 2026-06-10 via `sui client test-publish` (cost: ~0.34 SUI)
**Latest commit:** `79d2404` ("fix(v2): resolve bytecode verification error and make e2e idempotent")

### On-chain shared objects

| Object | ID |
|--------|-----|
| PaymentScheduler | `0xf475cb554d3d6f367085f6bdf9eb38effe590503dc6a9cd14ae611b8be2c8c26` |
| CoinTypeRegistry | `0x51de469c0f465c4b789520451cb2249bacbcfc7ee441977b564d564cc6a2d0e2` |
| AccessControl | `0x97ae33555f82bcbb9b6e2de3ce190e92793c7e091781b6227ec0ffa9ea87c487` |

### 10 modules in `move/subscriptions_v2/sources/`

`ac`, `account`, `asset`, `billing`, `payment`, `platform`, `policies`, `registry`, `scheduler`, `version`

### Dependencies (Move.toml)

```
openzeppelin = { git = "https://github.com/OpenZeppelin/contracts-sui.git", subdir = "contracts", rev = "a116bf757c075a6404e57bb14003b233fb2a912b" }
```

---

## E2E script status

**Script:** `scripts/v2/e2e-payment-cycle.ts`
**Run:** `npx tsx scripts/v2/e2e-payment-cycle.ts`

### Step results (2026-06-10, all ✅)

| Step | Status | Notes |
|------|--------|-------|
| 1: register_coin_type<SUI> | ✅ SKIP | SUI already registered from prior runs |
| 2: register_platform | ✅ | Platform created |
| 3: create_tier | ✅ | Unique tier name per run (`Tier ${Date.now()}`) |
| 4: create_account + share_account | ✅ | |
| 5: deposit<SUI> | ✅ | Retry on gas coin version mismatch |
| 6: create_subscription | ✅ (expected) | ESubscriptionAlreadyExists on re-runs |
| 7: process_due_payment (1st) | ✅ (expected) | ENotDue — already processed in prior run |
| 8: process_due_payment (2nd) | ✅ (expected) | ENotDue — subscription billing window not open |
| 9: cancel_subscription | ✅ | |

### Event counts (cumulative, sender)

```
CoinTypeRegistered:      1
PlatformRegistered:     12
TierCreated:            4
AccountCreated:         10
Deposit:                5
SubscriptionCreated:    1
SubscriptionUpdated:    1
PaymentProcessed:       0  ← ENotDue means payment already happened; this is correct
PaymentFailed:          0
DuePaymentSubmitted:    0  ← scheduler emits DuePaymentSubmitted on process_due_payment
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

## Known bugs / issues — ALL RESOLVED

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

---

## Key design decisions

1. **`paystreamer_v2::ac`** — renamed from `access_control` to avoid OZ module name collision.
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
move/subscriptions_v2/
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
4. ⬜ **Deploy frontend to devnet** — host the built frontend on a devnet-accessible URL
5. ⬜ **Open PR** — `feature/v2-core` → `main` (manual via web UI: `https://github.com/Leac1m/paystreamer/pull/new/feature/v2-core`)
6. ⬜ **Install skills** — `npx skills https://github.com/MystenLabs/skills` per CLAUDE.md
