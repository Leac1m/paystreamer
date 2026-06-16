# PayStreamer v3 Contract Migration

## Contract Changes

- `AccountType` enum removed — `TypeName` is now the denomination
- PUSD is the only payment denomination (no SUI option in subscription creation)
- SUI is only used for gas
- `register_platform_with_tier` creates platform + tier in one transaction
- `CoinTypeRegistry` uses `TypeName` keys — `register_coin_type` auto-assigns discriminant
- Balance queries use `addressBalance` field (not `balance.value`)

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

```ts
DEVNET_V3_PACKAGE_ID = "0x877e4310138665b821d0d03aa61efcf98e0bdfa32a4cc32674f58c2ac0c26473"
PUSD_PACKAGE_ID = "0xc74cc40df740034795a0c27524b499c330e619e2406263f37d8b67b1f824f6fa"
PUSD_TYPE_ARG = "0xc74cc40df740034795a0c27524b499c330e619e2406263f37d8b67b1f824f6fa::pusd::PUSD"
SUI_TYPE_ARG = "0x2::sui::SUI"     // gas only
DEMO_PLATFORM_ID = "0xb84f8a6d57a20e605581a29342124762f2ac10c8c6d9f305a83edca5e7440aec"
DEMO_PLATFORM_INIT_VERSION = 1491862
```

## Files Changed

| File | Changes |
|------|---------|
| `src/constants.ts` | Added `DEVNET_V3_PACKAGE_ID`, `PUSD_PACKAGE_ID`, `PUSD_TYPE_ARG`. Updated `DEMO_DENOMINATIONS` to `[PUSD_TYPE_ARG]` |
| `src/lib/format.ts` | PUSD displays as "USD" with 2 decimal places. `symbolFor` returns "USD" for PUSD |
| `src/lib/graphql.ts` | `SubscriptionAccountObject.balance` changed to `address_balance: string` |
| `src/lib/platformDiscovery.ts` | `discoverAllPlatforms` filters out e2e test platforms by name prefix "Demo" |
| `src/components/subscriptions/SetupSubscriptionModal.tsx` | Uses `PUSD_TYPE_ARG`, removes `accountType` from `create_subscription` call |
| `src/components/subscriptions/SubscriptionCard.tsx` | Uses `V3_PACKAGE_ID`, `PUSD_TYPE_ARG`. Process Now button checks `isPusd` |
| `src/components/subscriptions/DenominationSelector.tsx` | Only shows USD denomination |
| `src/components/subscriptions/CreateAccountModal.tsx` | Uses `V3_PACKAGE_ID` |
| `src/components/platform/TierModal.tsx` | Uses `V3_PACKAGE_ID`. Removed `accountType` and denomination selector |
| `src/components/platform/RegisterPlatformModal.tsx` | Uses `V3_PACKAGE_ID` |
| `src/components/platform/TierCard.tsx` | Uses `V3_PACKAGE_ID` |
| `src/components/platform/TreasuryManager.tsx` | Uses `V3_PACKAGE_ID` |
| `src/components/platform/SchedulerControls.tsx` | Uses `V3_PACKAGE_ID` |
| `src/pages/SubscribePage.tsx` | Uses `address_balance` for balance, `PUSD_TYPE_ARG` as default |
| `src/pages/dashboard/SubscriptionsPage.tsx` | Tab "SUI" renamed to "USD", filter checks `pusd` |
| `src/pages/platforms/PlatformSettingsPage.tsx` | Uses `V3_PACKAGE_ID` |

## Scripts

- `pnpm seed:demo` — seeds demo platform on devnet (idempotent)
- `pnpm e2e` — runs e2e payment cycle test
- Both scripts use `scripts/v2/config.ts` (gitignored with deployment-specific IDs)

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