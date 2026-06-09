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

## Phases 1–4 — pending

