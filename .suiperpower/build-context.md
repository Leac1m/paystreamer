# Build Context — 2026-06-05

## Project Status

**Phase:** B2B Landing Page Overhaul & Frontend Polish

**Summary:** The landing page copy and React components (`HeroSection`, `EndUserExperience`, `IntegrationFlow`, `CoreFeatures`) have been successfully rewritten to align with the new B2B Product Messaging Framework, targeting Founders and CTOs. Build errors caused by unused imports have also been resolved. The scheduler billing flow remains verified and operational.

---

## What Changed (This Session)

### Feature: B2B Messaging Overhaul
- **Problem:** The original landing page copy was too consumer-focused, obscuring the primary value proposition for SaaS platforms and Web3 businesses.
- **Solution:** Rewrote the key landing page components to emphasize the "Bleeding Neck" problem of manual crypto payments, and positioned PayStreamer as the "Autopilot" solution for stablecoin subscriptions with zero chargebacks.
- **Files Modified:**
  - `README.md`
  - `src/components/HeroSection.tsx`
  - `src/components/EndUserExperience.tsx`
  - `src/components/IntegrationFlow.tsx`
  - `src/components/CoreFeatures.tsx`

### Fix: Unused Import Build Errors
- **Problem:** `tsc && vite build` failed due to unused `Settings` and `RefreshCw` icons in `IntegrationFlow.tsx` after the layout was simplified.
- **Solution:** Removed the unused Lucide React imports.
- **Files Modified:** `src/components/IntegrationFlow.tsx`

## Previous Changes

### Fix: Scheduler Now Uses GraphQL Instead of gRPC

**Root Cause:** `SuiGrpcClient` (from `@mysten/sui/grpc`) does not expose event querying. The `client.core.queryEvents` method doesn't exist in the gRPC client.

**Solution:** Switched to `SuiGraphQLClient` (from `@mysten/sui/graphql`) which supports event queries via GraphQL.

**Files Modified:**
- `scripts/scheduler.ts` — Changed from `SuiGrpcClient` to `SuiGraphQLClient`
- Updated event querying to use GraphQL query format with pagination

### Fix: Individual Withdrawal Processing (Replaced Batch)

**Problem:** `batch_withdraw_scheduler` uses `vector<SubscriptionAccount<T>>` which is invalid for shared objects in Move PTBs. Transaction simulation failed with "Unused result without the drop ability."

**Solution:** Scheduler now processes withdrawals individually via `process_withdrawal_scheduler` in a loop. Each transaction is signed and executed separately.

**Files Modified:**
- `scripts/scheduler.ts` — Replaced batch logic with individual tx loop

### Fix: Digest Logging

**Problem:** `result.digest` returned `undefined` — response shape from `signAndExecuteTransaction` has digest at `result.Transaction.digest`.

**Solution:** Changed logging to `result.Transaction?.digest || result.digest`.

### DNS Resolution Issue Resolved

**Problem:** `fullnode.devnet.sui.io` DNS resolution was timing out, causing "fetch failed" errors.

**Solution:** Added known IPs to `/etc/hosts`:
```
34.160.50.222  fullnode.devnet.sui.io
34.49.79.168   fullnode.testnet.sui.io
```

---

## Architecture Summary

```
SubscriptionAccount<T> (shared object)
├── balance: Balance<T>
├── policies: PolicyConfig
├── subscriptions: VecMap<ID, Subscription>  // platform_id → embedded Subscription
├── monthly_withdrawn: u64
├── current_month_start: u64
├── created_at: u64
└── status: AccountStatus

Subscription (embedded struct, not a key object)
├── platform_id: ID
├── tier_index: u64
├── tier_amount: u64
├── tier_frequency_days: u64
├── status: SubscriptionStatus
├── schedule: BillingSchedule
├── total_paid: u64
├── payment_count: u64
├── created_at: u64
└── updated_at: u64
```

---

## Module Responsibilities

| Module | Responsibility |
|--------|----------------|
| `subscription_account` | Core account, Balance<T>, policy enforcement, Subscription struct, record_payment |
| `subscription_manager` | Subscription lifecycle (create, pause, resume, cancel) |
| `platform_registry` | Platform registration, tier management, withdrawal processing |

---

## Key Design Decisions

1. **Subscription embedded** — Non-key struct lives only inside `SubscriptionAccount`. Eliminates orphaned objects, reduces gas, atomic operations.
2. **PlatformOwnerCap only** — Removed `PlatformCap`. Single capability per platform for all platform operations.
3. **record_payment in subscription_account** — Called by `platform_registry.process_withdrawal` after each successful withdrawal.
4. **GraphQL for event queries** — gRPC client doesn't support event queries; use GraphQL client instead.
5. **/etc/hosts workaround** — DNS resolution for `fullnode.*.sui.io` fails in some environments; IP workaround required.

---

## Test Scripts Created

| Script | Purpose |
|--------|---------|
| `scripts/test-utils.ts` | Shared utilities (getKeypair, createGraphQLClient, PACKAGE_ID) |
| `scripts/find-objects.ts` | Find AccountCaps, SubscriptionAccounts, PlatformOwnerCaps, SchedulerCaps |
| `scripts/query-account.ts` | Query subscription account details |
| `scripts/test-scheduler-flow.ts` | Read-only commands: `check`, `list-events`, `list-tiers`, `list-accounts` |
| `scripts/execute-tx.ts` | Execute transactions using SCHEDULER_SECRET |

---

## Current Test Data

**Deployed Package:** `0xd2ddd9bd521bde4137d6b27312c73216924b8661420b25c1c37737c4bc43b76e`

**Scheduler Address:** `0x472083c45f28f6fed624f1f252966a753332111a931127f047a9759800672793`

**Known Objects:**
- PlatformOwnerCap: `0x93a19496ee48ed2e570786654263161711d02cb24eba114f6ffec4603887e079`
- Platform: `0x166bef556043506713e96c9afe05aea249a1eb7bc04a56efe4cc83279fcf3b33`
- SchedulerCap (for platform 0x735e19...): `0xabb516f92cfaf7853478302f9e8b89e1e751fb9a3da0533fd19df1a68217c427`

**Accounts Created:** 3 accounts owned by scheduler address

---

## GraphQL Endpoint Configuration

**Devnet GraphQL URL:** `https://fullnode.devnet.sui.io:443/graphql`

**Key GraphQL patterns:**
- Query events with type filter: `events(first: 50, filter: { type: "package::module::function" })`
- Query objects: `objects(first: 50, filter: { owner: "address" })`
- Max page size: 50 (not 100)
- Cursor format: Base64 encoded

---

## Known Issues

1. **batch_withdraw** — Scheduler now uses individual `process_withdrawal_scheduler` calls instead of batch_withdraw. The batch function is non-functional due to Move type constraints.
2. **subscriber_count not updated** — Platform's subscriber_count is never incremented on subscribe or decremented on cancel
3. **tier_amount not enforced** — Withdrawal can be any amount up to policy limits, not just the tier amount

---

## Intent Success Criteria

1. ✅ Users can create `SubscriptionAccount<T>`, deposit stablecoin, observe `Deposit` and `AccountCreated` events
2. ✅ Users can call `create_subscription` — subscription embedded in account, `SubscriptionCreated` emitted
3. ✅ Platform with `PlatformOwnerCap` can withdraw via `process_withdrawal`, `WithdrawalProcessed` and `PaymentRecorded` events emitted
4. ✅ Billing schedule advances after each withdrawal — `can_bill` returns `false` until next cycle
5. ✅ Scheduler uses GraphQL for event queries (fixed from JSON-RPC deprecation)
6. ✅ Individual withdrawals via `process_withdrawal_scheduler` — batch withdraw deferred
7. ⏳ Frontend integration — Next.js + dapp-kit integration not yet started