# PayStreamer v3 Contract Migration

## Contract Changes

- `AccountType` enum removed — `TypeName` is now the denomination
- PUSD is the only payment denomination (no SUI option in subscription creation)
- SUI is only used for gas
- `register_platform_with_tier` creates platform + tier in one transaction
- `CoinTypeRegistry` uses `TypeName` keys — `register_coin_type` auto-assigns discriminant
- Balance queries use `addressBalance` field (not `balance.value`)

## Frontend Constants (src/constants.ts)

```ts
DEVNET_V3_PACKAGE_ID = ""          // TODO: fill after v3 deployment
PUSD_PACKAGE_ID = ""               // TODO: fill after stablecoin deployment
PUSD_TYPE_ARG = "${PUSD_PACKAGE_ID}::pusd::PUSD"
SUI_TYPE_ARG = "0x2::sui::SUI"     // gas only
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

## Remaining TODO

- [ ] Fill `DEVNET_V3_PACKAGE_ID` after v3 contract deployment
- [ ] Fill `PUSD_PACKAGE_ID` after stablecoin deployment
- [ ] Build stablecoin: `cd move/stablecoin && sui move build`
- [ ] Register PUSD in CoinTypeRegistry on app load (if not already registered)
- [ ] Consider using `register_platform_with_tier` in RegisterPlatformModal for single-step creation