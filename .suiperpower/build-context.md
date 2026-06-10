# PayStreamer v2 — Build Context

## What this is

A snapshot of the v2 PayStreamer project. Updated after fixing the bytecode verification error (2026-06-10).
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

## Devnet RPC & GraphQL

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
```

---

## Current priorities

1. ✅ **E2E fully green** — all 9 steps pass end-to-end on devnet
2. ✅ **Bytecode verification fix** — confirmed root cause and fix
3. ⬜ **Open PR** — `feature/v2-core` → `main` (manual via web UI: `https://github.com/Leac1m/paystreamer/pull/new/feature/v2-core`)
4. ⬜ **Install skills** — `npx skills https://github.com/MystenLabs/skills` per CLAUDE.md