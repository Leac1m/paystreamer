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
- [x] Created `move/subscriptions_v2/` with `Move.toml`
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
- **Module name collision with OZ.** `paystreamer_v2::access_control` collides with `openzeppelin_access::access_control` when OZ is published alongside us. Renamed to `paystreamer_v2::ac` across all modules.
- **OZ `new_bucket` argument order.** `(capacity, refill_amount, refill_interval_ms, last_refill_ms, initial_available, clock)`. The subagent's deviation was a correct fix; spec example had wrong order.
- **`FixedWindow` initial seed must equal capacity.** Seeding `0` would make the first month fail because OZ's projection returns 0 headroom for an empty bucket.

## Phase 2 — Devnet publish — ✅

```
Package ID: 0xe4928343c89668936e3bac1daf786ca7ba1ab295489921caf4894f5a7a3694ca
UpgradeCap: 0xb560a18678f9403fcf3306ff9a3894141856e963df7929f31224054fabd4926d
PaymentScheduler: 0x4422255dc29311224ae8d9417ee22bac2037a369643d4373eae8720ecc4d815a
CoinTypeRegistry: 0x265899eb8ac3b0c39a3e4bf36fcd6fe9bc64a97587fc0582a017d8637f027055
AccessControl<AC>: 0xac88e622f3e4fe1867ca7043702dbf37a787db438c6a76a3731c2764e6e5ca09
Publish tx: DzSbHU4nhVcU5CyNAjTcvQoXu7wd9JHwa6SJJy73dupR
Gas spent: 0.34 SUI
```

Published via `sui client test-publish --build-env testnet --with-unpublished-dependencies` (pragmatic for devnet; OZ deps were git-pinned so `test-publish` republished them locally).

## Phases 3–4 — pending

