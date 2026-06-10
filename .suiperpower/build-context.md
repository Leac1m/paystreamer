# PayStreamer v2 — Build Context

## What this is

A snapshot of the v2 PayStreamer project at end of build session (2026-06-10).
Captures what's working, what's failing, and why. Updated with latest findings.

---

## Project overview

PayStreamer is a Web3 billing infrastructure for recurring crypto subscriptions on [Sui](https://sui.io/).
The v1 MVP lives on `main` (published devnet package `0xd2ddd9bd...`).
The v2 rewrite lives on `feature/v2-core`.

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

### On-chain shared objects (fresh deployment)

| Object | ID | Version |
|--------|----|---------|
| PaymentScheduler | `0xf475cb554d3d6f367085f6bdf9eb38effe590503dc6a9cd14ae611b8be2c8c26` | 2824956 |
| CoinTypeRegistry | `0x51de469c0f465c4b789520451cb2249bacbcfc7ee441977b564d564cc6a2d0e2` | 2824956 |
| AccessControl | `0x97ae33555f82bcbb9b6e2de3ce190e92793c7e091781b6227ec0ffa9ea87c487` | 2824956 |

### 14 modules in `move/subscriptions_v2/sources/`

`ac`, `access_control`, `account`, `asset`, `billing`, `delayed_transfer`, `payment`, `platform`, `policies`, `rate_limiter`, `registry`, `scheduler`, `two_step_transfer`, `version`

### Dependencies (Move.toml)

```
openzeppelin_access = { git = "https://github.com/OpenZeppelin/contracts-sui.git", subdir = "contracts/access", rev = "a116bf757c075a6404e57bb14003b233fb2a912b" }
openzeppelin_utils = { git = "https://github.com/OpenZeppelin/contracts-sui.git", subdir = "contracts/utils", rev = "a116bf757c075a6404e57bb14003b233fb2a912b" }
```

No explicit Sui/MoveStdlib deps — auto-resolved via edition 2024.

---

## E2E script status

**Script:** `scripts/v2/e2e-payment-cycle.ts`
**Run:** `npx tsx scripts/v2/e2e-payment-cycle.ts`

### Step results (2026-06-10)

| Step | Status | Notes |
|------|--------|-------|
| 1: register_coin_type<SUI> | ✅ SKIP | SUI already registered |
| 2: register_platform | ✅ | Platform created |
| 3: create_tier | ❌ | `MoveAbort 0x8002` (EInvalidTier) — "duplicate tier name" |
| 4: create_account + share_account | ✅ | |
| 5: deposit<SUI> | ❌ | Gas coin version mismatch (SDK rebuild issue) |
| 6: create_subscription | ❌ | Gas coin mismatch or `0x6003` (ESubscriptionAlreadyExists) |
| 7: process_due_payment (1st) | ❌ | Move Bytecode Verification Error |
| 8: process_due_payment (2nd) | ❌ | Same bytecode error |
| 9: cancel_subscription | ✅ | Sometimes works if subscription exists |

### Event counts (cumulative, sender)

```
CoinTypeRegistered:      1
PlatformRegistered:     7+
TierCreated:            1  ← create_tier DID succeed once
AccountCreated:         5+
Deposit:               2+
SubscriptionCreated:   1
SubscriptionUpdated:   1  ← billing worked at some point
PaymentProcessed:       0
PaymentFailed:          0
DuePaymentSubmitted:    0
```

---

## Known bugs / issues

### Bug 1 — `AccountType` enum workaround (RESOLVED)

**What was tried:**
- `tx.pure.u8(0)` → fullnode rejects raw bytes for enum
- `bcs.U8.serialize(0)` → same
- Both produce identical PTB bytes `AA==` (base64)

**Solution found:** Added `registry::from_u8(discriminant: u8): AccountType` helper in `registry.move`.
E2E script calls this inside the PTB to construct the enum:
```typescript
const accountType = tx.moveCall({
  target: `${V2_PACKAGE_ID}::registry::from_u8`,
  arguments: [tx.pure.u8(0)],
});
tx.moveCall({
  target: `${V2_PACKAGE_ID}::platform::create_tier`,
  arguments: [..., accountType],  // pass result directly
});
```

**Status:** Step 3 still fails — not the enum issue anymore. Fails with `EInvalidTier` (abort 0x8002 = duplicate tier name) because the e2e script always tries to create "Test Tier" and if a platform already has that tier, it aborts.

### Bug 2 — `create_tier` EInvalidTier (MEDIUM)

**Symptom:** `MoveAbort in 2nd command, abort code: 32770` (0x8002 = `EInvalidTier`)

**Context:** The e2e script uses hardcoded tier name "Test Tier". On reruns with existing platforms, this fails with "duplicate tier name".

**Root cause:** Not an SDK bug — the contract correctly rejects duplicate tier names. This is a cascade failure from prior runs creating the same tier.

**Note:** The registry stores `USDC = 0` for SUI. But `create_tier` uses `AccountType` from the call, not from registry discriminant. The `from_u8(0)` returns `USDC` which is correct.

**Workaround:** Need to either delete the platform or use a different tier name.

### Bug 3 — Steps 7–8 bytecode verification error (MEDIUM)

**Symptom:** `process_due_payment` fails with:
```
Transaction resolution failed: Error in 1st command, Move Bytecode Verification Error.
Please run the Bytecode Verifier for more information.
```

**Local verification:** `sui client verify-bytecode-meter --module build/paystreamer_v2/bytecode_modules/scheduler.mv` passes metering check.

**Hypothesis:** The error is in `empty_limiters` or `ensure_initialized` calls (first commands in the PTB), not in `process_due_payment` itself. The `PolicyLimiters` struct ABI may not match between what `empty_limiters` returns and what `process_due_payment` expects.

**SDK workaround attempted:** `tx.setGasOwner(keypair.toSuiAddress())` in `newTx()` to avoid gas coin version mismatch, but this doesn't fix the bytecode error.

**Next steps:**
1. Try calling `scheduler::process_due_payment` directly via CLI to isolate
2. Check if `PolicyLimiters` struct ABI changed between deployments

### Bug 4 — Gas coin version mismatch (LOW)

**Symptom:**
```
Transaction needs to be rebuilt because object 0x7e594344b8fa... version X is unavailable for consumption, current version: Y
```

**Root cause:** The SDK builds transactions with a fixed gas coin version, but devnet is progressing. By the time the tx is signed+executed, the gas coin has been mutated by a prior tx and the version is stale.

**Workaround:** Just retry — eventually the versions align. The e2e script is idempotent enough to handle this.

### Bug 5 — Step 9 cancel_subscription `vec_map::get_idx` abort

**Symptom:** `MoveAbort in 1st command, abort code: 1, in vec_map::get_idx`

**Context:** When no subscription exists (Steps 6-8 failed), there's nothing to cancel, and the `cancel_subscription` call fails with key-not-found.

**Resolution:** Fix Steps 6-8 and Step 9 will work.

---

## Key design decisions

1. **`paystreamer_v2::ac`** — renamed from `access_control` to avoid OZ module name collision.
2. **`registry::from_u8`** — helper function to convert u8 to AccountType enum, workaround for SDK inability to serialize custom enums.
3. **On-chain scheduler** — `PaymentScheduler` shared object with `RateLimiter::Bucket` circuit breaker. Anyone can call `process_due_payment`.
4. **Shared object version tracking** — `PLATFORM_INITIAL_VERSION` captured from `PlatformRegistered` event's `initialSharedVersion`.
5. **No environment in Move.toml** — Devnet is ephemeral; use `sui client test-publish` for fresh deployments.

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
    registry.move          # AccountType enum + from_u8 helper
    platform.move          # create_tier lives here
    account.move           # SubscriptionAccount<T>
    billing.move           # Subscription lifecycle
    policies.move          # PolicyLimiters, empty_limiters, ensure_initialized
    scheduler.move         # process_due_payment entry point
    payment.move          # Single money-moving path
  tests/                   # 73 unit tests, all passing

scripts/v2/
  e2e-payment-cycle.ts     # E2E script
  config.ts               # Package ID + shared object IDs
  register-sui.ts         # Manual SUI registration helper

CLAUDE.md
.suiperpower/
  build-context.md       # This file
```

---

## How to run

```bash
# Fresh deployment
cd move/subscriptions_v2
rm -rf build Move.lock Pub.devnet*.toml
sui client test-publish . --build-env testnet --skip-dependency-verification --with-unpublished-dependencies --gas-budget 1000000000 --pubfile-path Pub.devnet.toml

# Update config.ts with new IDs from the publish output

# Update shared object versions in e2e-payment-cycle.ts
# SHARED_INIT_VERSION_REGISTRY = <version from publish>
# SHARED_INIT_VERSION_SCHEDULER = <version from publish>

# Run unit tests
sui move test --build-env testnet

# Run e2e script
cd ../.. && npx tsx scripts/v2/e2e-payment-cycle.ts
```

---

## Current priorities

1. **Fix Steps 7–8 bytecode verification error** — this is the main blocker for the payment cycle
2. **Fix Step 3** — either delete existing platforms or use unique tier names per run
3. **Full e2e green** — all 9 steps succeeding end-to-end on devnet
4. **Open PR** — `feature/v2-core` → `main`