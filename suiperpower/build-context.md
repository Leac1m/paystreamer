# PayStreamer v3 — Build Context

## Contract Changes

- `AccountType` enum removed — `TypeName` is now the denomination
- PUSD is the only payment denomination (no SUI option in subscription creation)
- SUI is only used for gas
- `register_platform_with_tier` creates platform + tier in one transaction
- `CoinTypeRegistry` uses `TypeName` keys — `register_coin_type` auto-assigns discriminant
- Balance queries use `addressBalance` field (not `balance.value`)
- **pause/play removed from scheduler** — scheduler runs continuously

## Devnet Deployment (2026-06-17)

| Package | ID |
|---------|-----|
| Subscriptions v3 | `0xf310efaea5adf4bba799c3628563f8c6e0c9677785dca6d7865744e4a3b80afb` |
| PUSD stablecoin | `0x7b09f1813d3e96e7759983486e40b4ec4ac32dc802095cbe9ff384d421383160` |
| CoinTypeRegistry | `0x076e62b38cbe903413cb7ee9a177eef0c593a9bac40d0dcdbc7d46315af65639` (shared v14) |
| PaymentScheduler | `0x09d3b621355da923e9076fa95a8ff253331b44b8a0f4fa61b0ca51878b1d1c4e` (shared v14) |
| AccessControl | `0x938eebde0b5cab85934b0875b34b1854181ceb62437de22af177880abe312a97` |
| PUSD TreasuryCap | `0xf04e1201cc50fa5401c2d3c37ac7284873282e7bfd3c6a7885f6f6989aebb68a` (v15) |
| Demo Platform | `0x1240aa8e48d2df02ff25a359b3b83bc04c749aa6234a9234193f5c0d9903d746` (v3233540) |

## Frontend Constants (src/constants.ts)

All deployment-specific IDs are centralized in `src/constants.ts`. Update on every redeployment.

```ts
SUBSCRIPTION_DEVNET_PACKAGE_ID = "0xf310efaea5adf4bba799c3628563f8c6e0c9677785dca6d7865744e4a3b80afb"
COIN_TYPE_REGISTRY_ID = "0x076e62b38cbe903413cb7ee9a177eef0c593a9bac40d0dcdbc7d46315af65639"
COIN_TYPE_REGISTRY_INIT_VERSION = 14
PAYMENT_SCHEDULER_ID = "0x09d3b621355da923e9076fa95a8ff253331b44b8a0f4fa61b0ca51878b1d1c4e"
PAYMENT_SCHEDULER_INIT_VERSION = 14
PUSD_DEVNET_PACKAGE_ID = "0x7b09f1813d3e96e7759983486e40b4ec4ac32dc802095cbe9ff384d421383160"
PUSD_TYPE_ARG = "0x7b09f1813d3e96e7759983486e40b4ec4ac32dc802095cbe9ff384d421383160::pusd::PUSD"
DEMO_PLATFORM_ID = "0x1240aa8e48d2df02ff25a359b3b83bc04c749aa6234a9234193f5c0d9903d746"
DEMO_PLATFORM_INIT_VERSION = 3233540
```

## Verified PTB Signatures (2026-06-17)

All user-facing flows tested in TypeScript SDK and CLI:

| Function | Args | Status |
|----------|------|--------|
| `account::create_account<T>` | registry, clock | ✓ |
| `account::share_account<T>` | account, cap | ✓ |
| `account::deposit<T>` | cap, account, coin, clock | ✓ |
| `billing::create_subscription<T>` | cap, account, platform_id, tier_index, tier_amount, tier_frequency_ms, clock | ✓ |
| `billing::pause_subscription<T>` | cap, account, platform_id, clock | ✓ |
| `billing::resume_subscription<T>` | cap, account, platform_id, clock | ✓ |
| `billing::cancel_subscription<T>` | cap, account, platform_id, clock | ✓ |
| `scheduler::process_due_payment<T>` | scheduler, platform, account, limiters, clock | ✓ |
| `platform::register_platform` | name, description, category, webhook_url, clock | ✓ |
| `platform::create_tier` | platform, name, amount, frequency_ms, denomination: TypeName | ✓ |
| `platform::deactivate_tier_by_index` | platform, tier_index | ✓ |
| `platform::update_platform` | platform, name, description, webhook_url (nested Option) | ✓ |
| `platform::propose_treasury_change` | platform, new_treasury, clock | ✓ |
| `platform::accept_treasury_change` | platform, clock | ✓ |
| `platform::cancel_treasury_change` | platform | ✓ |
| `policies::empty_limiters` | clock | ✓ |
| `policies::ensure_initialized<T>` | account, limiters, clock | ✓ |

## Key Frontend Bugs Fixed

1. **CreateAccountModal/SetupSubscriptionModal**: `create_account` takes 2 args (registry, clock) not 3
2. **TierModal**: `create_tier` requires `TypeName` argument (use `type_name::get`)
3. **TierCard**: `deactivate_tier_by_index` not `deactivate_tier`; no clock arg
4. **SchedulerControls**: pause/unpause removed in v3
5. **All components**: use centralized constants (PACKAGE_ID, not V3_PACKAGE_ID)

## Scripts

- `pnpm seed:demo` — seeds demo platform on devnet (idempotent)
- `pnpm e2e` — runs e2e payment cycle test (uses scripts/v2/e2e-payment-cycle.ts)

## E2E Test Result (2026-06-16, OLD deployment)

All 8 steps pass on devnet (package `0x877e431...`):
- Step 1: register_coin_type<PUSD> (expected fail — already registered)
- Step 2: register_platform_with_tier ✅
- Step 3: create_account + share_account ✅
- Step 4a: mint PUSD ✅
- Step 4b: deposit PUSD ✅
- Step 5: create_subscription ✅
- Step 6: process_due_payment (1st cycle) ✅
- Step 7: process_due_payment (2nd cycle) ✅
- Step 8: cancel_subscription ✅

## Modules (10 total)

`ac`, `account`, `asset`, `billing`, `payment`, `platform`, `policies`, `registry`, `scheduler`, `version`

## Key Files

```
src/
  constants.ts                   # All deployment IDs centralized
  components/subscriptions/
    CreateAccountModal.tsx       # create_account PTB
    SetupSubscriptionModal.tsx  # create_account + create_subscription PTB
    DepositModal.tsx            # deposit PTB
    WithdrawModal.tsx            # withdraw PTB
  components/platform/
    TierModal.tsx               # create_tier with TypeName
    TierCard.tsx                 # deactivate_tier_by_index
    SchedulerControls.tsx        # Simplified (no pause/unpause)
  contracts/subscriptions/
    platform_registry.ts         # Platform registry helpers
    subscription_account.ts      # Account helpers
    subscription_manager.ts      # Subscription helpers

scripts/v2/
  e2e-payment-cycle.ts           # E2E test
  seed-demo-platform.ts          # Demo platform seeder
  config.ts                      # Environment-specific config
```

## How to Run

```bash
# Build contracts
cd move/subscriptions && sui move build

# Run tests
cd move/subscriptions && sui move test

# Seed demo platform
pnpm seed:demo

# Run e2e
pnpm e2e

# Start dev server
pnpm dev --port 5176 --host 0.0.0.0
```

## Current Status

- Devnet deployment: **LIVE** (2026-06-17)
- E2E test: **NEEDS RE-RUN** against new deployment
- Frontend: running on port 5176 with cloudflared tunnel
