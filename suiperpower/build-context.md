# PayStreamer v3 Contract Migration

## Contract Changes

- `AccountType` enum removed — `TypeName` is now the denomination
- PUSD is the only payment denomination (no SUI option in subscription creation)
- SUI is only used for gas
- `register_platform_with_tier` creates platform + tier in one transaction
- `CoinTypeRegistry` uses `TypeName` keys — `register_coin_type` auto-assigns discriminant
- Balance queries use `addressBalance` field (not `balance.value`)
- **pause/play removed from scheduler** — scheduler runs continuously

## Devnet Deployment (2026-06-16)

| Package | ID |
|---------|-----|
| Subscriptions v3 | `0x877e4310138665b821d0d03aa61efcf98e0bdfa32a4cc32674f58c2ac0c26473` |
| PUSD stablecoin | `0xc74cc40df740034795a0c27524b499c330e619e2406263f37d8b67b1f824f6fa` |
| CoinTypeRegistry | `0x2f7bc0af8c20cff6e772d3d411cc018550b958f1574f52d0d3c152f373ffd618` (shared v254755) |
| PaymentScheduler | `0x4d526187e4157fe58f2fc7111a733c3e9f419e7cd23dd528993d87e54a4eacda` (shared v254755) |
| AccessControl | `0x5b1bb002d8133a91002ffab3f6b2f9118703931685c78cccd793b8e929339e60` (shared v254755) |
| PUSD TreasuryCap | `0xdfbececa1253c80994b65a7d2f8e2b1697d28e64e6a7e5eeca559fe043ac90e0` |
| Demo Platform | `0xb84f8a6d57a20e605581a29342124762f2ac10c8c6d9f305a83edca5e7440aec` (v1491862) |

## Frontend Constants (src/constants.ts)

All deployment-specific IDs are centralized in `src/constants.ts`. Update on every redeployment.

```ts
PACKAGE_ID = "0x877e4310138665b821d0d03aa61efcf98e0bdfa32a4cc32674f58c2ac0c26473"
COIN_TYPE_REGISTRY_ID = "0x2f7bc0af8c20cff6e772d3d411cc018550b958f1574f52d0d3c152f373ffd618"
COIN_TYPE_REGISTRY_INIT_VERSION = 254755
PAYMENT_SCHEDULER_ID = "0x4d526187e4157fe58f2fc7111a733c3e9f419e7cd23dd528993d87e54a4eacda"
PAYMENT_SCHEDULER_INIT_VERSION = 254755
PUSD_PACKAGE_ID = "0xc74cc40df740034795a0c27524b499c330e619e2406263f37d8b67b1f824f6fa"
PUSD_TYPE_ARG = "0xc74cc40df740034795a0c27524b499c330e619e2406263f37d8b67b1f824f6fa::pusd::PUSD"
DEMO_PLATFORM_ID = "0xb84f8a6d57a20e605581a29342124762f2ac10c8c6d9f305a83edca5e7440aec"
DEMO_PLATFORM_INIT_VERSION = 1491862
```

## Verified PTB Signatures (2026-06-16)

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
- `pnpm e2e` — runs e2e payment cycle test (8/8 passing)

## E2E Test Result (2026-06-16)

All 8 steps pass on devnet:
- Step 1: register_coin_type<PUSD> (expected fail — already registered)
- Step 2: register_platform_with_tier
- Step 3: create_account + share_account
- Step 4a: mint PUSD
- Step 4b: deposit PUSD
- Step 5: create_subscription
- Step 6: process_due_payment (1st cycle)
- Step 7: process_due_payment (2nd cycle)
- Step 8: cancel_subscription
