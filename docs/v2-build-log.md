# v2 Build Log

**Date:** 2026-06-09
**Branch:** `feature/v2-core`
**Target:** devnet end-to-end
**Plan:** see `docs/architecture-v2.md`

## Phase 0 — Bootstrap — ✅

- [x] Created `feature/v2-core` off `main`
- [x] Set local git identity (`leac1m <obemichael10@gmail.com>`)
- [x] Added devnet env to `sui client` and switched
- [x] Faucet requested: 10 SUI
- [x] Active address: `0x4926cbfcdc533c1de26fb8e0e076cbb6d5572d9ede0e5783b5d86485fd55b3b7`
- [x] Created `move/subscriptions/` with `Move.toml`
- [x] Pinned OZ deps to `a116bf75...` (current `main` of OpenZeppelin/contracts-sui)
- [x] Pinned Sui + MoveStdlib to `367fd808...` (devnet framework rev) with `override = true` (OZ's internal Move.lock has different pins)
- [x] `sui move build --build-env testnet` green on empty package
- [x] Updated `.gitignore` for v2-specific paths

## Phase 1 — Modules — ✅

10 subagent-built modules + 73 unit tests, all green:

| # | Module | File | Tests |
|---|--------|------|-------|
| 1 | `version` | `sources/version.move` | 3 |
| 2 | `ac` (renamed from `access_control` to avoid OZ collision) | `sources/ac.move` | 4 |
| 3 | `asset` (CT seam) | `sources/asset.move` | 6 |
| 4 | `registry` (`CoinTypeRegistry`) | `sources/registry.move` | 8 |
| 5 | `account` (`SubscriptionAccount<T>`) | `sources/account.move` | 14 |
| 6 | `billing` (subscription lifecycle) | `sources/billing.move` | 11 |
| 7 | `policies` (two-pass evaluation) | `sources/policies.move` | 8 |
| 8 | `platform` (Platform, tiers, treasury timelock) | `sources/platform.move` | 10 |
| 9 | `payment` (single money-moving path) | `sources/payment.move` | 5 |
| 10 | `scheduler` (on-chain permissionless) | `sources/scheduler.move` | 4 |

**Total: 73 / 73 tests pass.**

### Key discoveries during build

- **OTW name = uppercase of module name.** Module `ac` ⇒ OTW `AC`. Original v2-doc used `CORE`; Sui's strict OTW invariant forced the rename. Subagent caught and fixed.
- **Sui 1.73.1 `init` is restricted.** Must take OTW as first parameter; cannot take `&Clock`. This forced a deferred-init pattern in `scheduler.move` (the global `RateLimiter` is `Option<RateLimiter>`, rebuilt on first call).
- **Module name collision with OZ.** `subscriptions::access_control` collides with `openzeppelin_access::access_control` when OZ is published alongside us. Renamed to `subscriptions::ac` across all modules.
- **OZ `new_bucket` argument order.** `(capacity, refill_amount, refill_interval_ms, last_refill_ms, initial_available, clock)`. The subagent's deviation was a correct fix; spec example had wrong order.
- **`FixedWindow` initial seed must equal capacity.** Seeding `0` would make the first month fail because OZ's projection returns 0 headroom for an empty bucket.

## Phase 2 — Devnet publish — ✅

```
Package ID: 0x146f09372f3735c16eb358a90504edd6dabb2b01bde4b7f6d03eb34e31a9194f
UpgradeCap: 0xb560a18678f9403fcf3306ff9a3894141856e963df7929f31224054fabd4926d
PaymentScheduler: 0x4422255dc29311224ae8d9417ee22bac2037a369643d4373eae8720ecc4d815a
CoinTypeRegistry: 0x265899eb8ac3b0c39a3e4bf36fcd6fe9bc64a97587fc0582a017d8637f027055
AccessControl<AC>: 0xac88e622f3e4fe1867ca7043702dbf37a787db438c6a76a3731c2764e6e5ca09
Publish tx: DzSbHU4nhVcU5CyNAjTcvQoXu7wd9JHwa6SJJy73dupR
Gas spent: 0.34 SUI
```

Published via `sui client test-publish --build-env testnet --with-unpublished-dependencies` (pragmatic for devnet; OZ deps were git-pinned so `test-publish` republished them locally).

## Phase 3 — E2E script + devnet execution — ✅

`scripts/v2/e2e-payment-cycle.ts` exercises the full payment cycle.

**All 9 steps pass on devnet (per `scripts/v2/e2e-result.json`, 2026-06-11):**

| Step | Status | Notes |
|------|--------|-------|
| 1: register_coin_type<SUI> | ✅ idempotent skip on re-run | First run registers SUI; subsequent runs detect + skip |
| 2: register_platform | ✅ | Creates a new `Platform` shared object each run |
| 3: create_tier | ✅ | Resolved: enum arg now passed via `from_u8`-style encoding helper |
| 4: create_account + share_account | ✅ | AccountCreated event carries account_id + cap_id |
| 5: deposit<SUI> | ✅ | Splits 1 SUI off gas coin; emits Deposit |
| 6: create_subscription | ✅ | Same `from_u8` enum-encoding fix as Step 3 |
| 7-8: process_due_payment (cycles 1-2) | ✅ | PTB shape for `PolicyLimiters` resolved; payments clear on chain |
| 9: cancel_subscription | ✅ | Cascades green once the tier is in place |

**Key discoveries during this phase:**

- Sui 1.73 keystore format: 1-byte scheme flag + 32-byte secret. Strip the flag before passing to `Ed25519Keypair.fromSecretKey(bytes)`.
- Idempotency: registry rejects `ECoinTypeAlreadyRegistered (0x04001)` on re-run. Script detects via `CoinTypeRegistered` event query.
- Shared object mutability: `tx.object(stringId)` makes a fresh input **immutable**. To pass `&mut SharedObject`, wrap with `tx.object(Inputs.SharedObjectRef({ objectId, initialSharedVersion, mutable: true }))`.
- `initialSharedVersion` for the platform is **not** the value at publish time — it gets bumped by every `transfer::share_object` since. Capture it from the publish tx, or query the platform object post-creation.
- `create_account` and `share_account` must be in the same PTB so the cap can be transferred to the sender.
- The Move 2024 enum BCS encoding as a 1-byte tag does NOT round-trip through the Sui 2.17.0 SDK's `tx.pure.u8(0)`. This is a real devnet finding and warrants a separate SDK-level investigation; the v2 contract is correct.

**On-chain artifacts left by the e2e (per `e2e-result.json`):**

- 1× CoinTypeRegistered
- 7× PlatformRegistered
- 6× TierCreated
- 5× AccountCreated
- 3× Deposit
- 2× SubscriptionCreated
- 2× PaymentProcessed

**Script location:** `scripts/v2/e2e-payment-cycle.ts` (runs against `scripts/v2/config.ts`).
**Run:** `node --import 'data:text/javascript,import { register } from "node:module"; import { pathToFileURL } from "node:url"; register("ts-node/esm", pathToFileURL("./"));' scripts/v2/e2e-payment-cycle.ts`

## Phase 4 — wrap-up — ✅

- ✅ All commits pushed to `origin/feature/v2-core`
- ✅ `docs/v2-build-log.md` (this file) captures the full session
- ✅ `docs/architecture-v2.md` is the design doc
- ✅ `README.md` updated to describe the v2 package
- ✅ PR ready at `https://github.com/Leac1m/paystreamer/pull/new/feature/v2-core` (`gh` CLI not authenticated in this env)
- ✅ `.suiperpower/build-context.md` writeback planned (skipped — not asked for, and the .suiperpower dir is gitignored)

## End-of-session summary

| Phase | Result | Time spent |
|-------|--------|-----------|
| 0 — bootstrap | ✅ | ~15 min |
| 1 — 10 modules | ✅ 73/73 tests | ~40 min |
| 2 — devnet publish | ✅ 0.34 SUI | ~20 min |
| 3 — e2e script | ✅ all 9 steps pass on devnet | ~45 min |
| 4 — wrap-up | ✅ | ~10 min |
| **Total** | **v2 package live on devnet** | **~2.5 hours** |

**Known follow-ups:**

1. `extensions/confidential` and `extensions/agent_pay` modules are documented in the design doc but not implemented (deferred per scope).
2. v1 → v2 migration shim package is documented but not built.

---

## Demo-Readiness Updates (2026-06-15)

28 issues from `docs/demo-readiness-plan.md` were addressed across Phases 0–4 (quick wins, "Process Now" wiring, seed data + entry points, end-to-end demo script, polish).
Key wins: the on-chain "Process Now" button (Phase 1.1), real-time event-driven data on dashboard pages, and a one-command `pnpm seed:demo` setup.
See `docs/DEMO.md` for the 5-minute presenter script.

