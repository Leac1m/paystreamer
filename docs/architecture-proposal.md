# Sui Subscriptions — Refactored Architecture Proposal

**Version**: 2.0.0-draft
**Date**: 2026-06-06
**Status**: Draft — For Review
**Supersedes**: Section 2–3 of `smart-contract-requirements.md`

---

## 1. Executive Summary

The current contract architecture (v1) is sufficient for an MVP/demo but contains structural limitations that would become liabilities on mainnet with real money. This document proposes a refactored architecture that is:

- **Secure by default** — uses OpenZeppelin Contracts for Sui battle-tested primitives instead of ad-hoc capability patterns
- **Composable** — small, focused modules that can be upgraded independently
- **Extensible** — a plugin-based policy system so platforms can enforce custom rules without modifying core logic
- **Auditable** — each module has a single responsibility, making formal verification tractable

The refactored architecture decomposes the monolithic `subscription_account` into four focused modules, adopts OZ's `access_control` and `rate_limiter` primitives, and introduces a structured upgrade path via versioned subscription objects.

---

## 2. Current Architecture Analysis

### 2.1 What Exists Today

The v1 contract package contains three modules:

| Module | Responsibilities | LOC (approx) |
|--------|-----------------|--------------|
| `subscription_account` | Account creation, deposits, withdrawals, policy enforcement, subscription storage, billing schedule management | ~580 |
| `platform_registry` | Platform registration, tier management, withdrawal processing, scheduler capabilities | ~560 |
| `subscription_manager` | Subscription lifecycle (create, pause, resume, cancel) | ~310 |

Key design choices in v1:
- `Subscription` structs are **embedded** in `SubscriptionAccount<VecMap<ID, Subscription>>` — not standalone objects
- `PlatformOwnerCap` / `SchedulerCap` / `AccountCap` are custom capability structs
- `PolicyConfig` is a monolithic struct with hard-coded fields (`max_monthly_withdrawal`, `max_per_transaction`, `min_balance`, `min_frequency_days`)
- Approximate month calculation: `(days / 30) * 30`

### 2.2 Gaps That Prevent Mainnet Readiness

| Gap | Severity | Impact on Mainnet |
|-----|----------|-------------------|
| Ad-hoc capability model | High | No timelock on admin actions, no role revocation, no governance integration |
| Monolithic policy struct | High | Can't add new policy types without re-deploying core contracts |
| No rate limiting | High | `min_frequency_days` is a blunt last-resort check; no proper token bucket or cooldown |
| Approximate month math | Medium | Billing cycle edge cases near month boundaries |
| No pause cascade | Medium | Pausing account doesn't pause subscriptions — platforms keep billing a paused account |
| No upgrade path | High | All structs are frozen; any breaking change requires complete re-deployment |
| Monolithic batch operations | Medium | `batch_withdraw` takes `&mut vector<SubscriptionAccount<T>>` — expensive for large batches |
| No platform-level rate limit | Low | Platforms can be spammed with withdrawal requests |
| Scheduler is off-chain secret key | High | Single secret key controls all withdrawals; no circuit breaker |

### 2.3 What OpenZeppelin Contracts for Sui Provides

Two OZ primitives are directly applicable:

**`openzeppelin_utils::rate_limiter`** — Three embeddable strategies (`store + drop`, no shared object needed):
- `Bucket` — continuously refilling token bucket. Use for: account deposit rate limits, platform withdrawal frequency
- `FixedWindow` — fixed capacity per time window. Use for: platform monthly withdrawal caps, account monthly limits
- `Cooldown` — drain-to-zero then wait. Use for: subscription frequency enforcement (one charge per billing cycle)

Key insight: the limiter is embedded inside the struct that needs it. The scope is whatever object it lives inside. No registry, no separate ID to track.

**`openzeppelin_access::access_control`** — Role-based access with:
- Singleton per module via One-Time Witness (OTW) pattern — enforced at runtime
- `Auth<Role>` self-validating capability — consumers take `&Auth<Role>` with no body checks
- Timelocked root role transfer/renounce (48h max wait, 60-day max delay)
- Rich event emission for off-chain indexing

---

## 3. Proposed Architecture

### 3.1 Module Decomposition

```
┌─────────────────────────────────────────────────────────────┐
│                    subscription_manager                       │
│         Facade: orchestrates cross-module calls              │
│         Entry points for users and platforms                  │
└─────────────────────────────────────────────────────────────┘
         │              │              │              │
 ┌───────▼───┐  ┌───────▼───┐  ┌──────▼────┐  ┌───▼──────┐
 │ sub_      │  │ platform_ │  │ billing_  │  │ payment_ │
 │ core      │  │ registry  │  │           │  │ processor│
 └───────┬───┘  └───────┬───┘  └──────┬────┘  └───┬──────┘
         │              │              │           │
         └──────────────┴──────────────┴───────────┘
                    ┌────────▼────────┐
                    │ subscription_   │
                    │ policies        │
                    │ (plugin layer)  │
                    └─────────────────┘
                            │
                    ┌───────▼───────┐
                    │ payment_       │
                    │ scheduler      │
                    │ (on-chain)     │
                    └───────────────┘
```

**New module list:**

| Module | Responsibility |
|--------|----------------|
| `subscription_core` | Minimal account primitive: hold balance, map subscriptions, owner auth via OZ AccessControl |
| `subscription_policies` | Policy plugin system using OZ RateLimiter. PerTx, Monthly, MinBalance, Frequency policies |
| `subscription_billing` | Pure billing logic: subscription lifecycle, calendar-accurate billing schedules |
| `platform_registry` | Platform management. OZ Auth<Role> per platform. Platform-level rate limiters |
| `payment_processor` | Payment execution: orchestrates withdraw + policy check + billing record |
| `payment_scheduler` | On-chain scheduler entry point. Global circuit breaker via OZ RateLimiter. Permissionless callers |
| `subscription_manager` | Facade module. User-facing API. Delegates to appropriate submodule |

### 3.2 Dependency Graph

```
subscription_manager
  ├── subscription_core (account creation, deposits)
  ├── subscription_billing (subscription lifecycle)
  ├── subscription_policies (policy evaluation)
  └── platform_registry (tier lookup, platform info)

platform_registry
  └── openzeppelin_access::access_control (admin/scheduler roles — embedded per platform)

payment_processor
  ├── subscription_core (withdraw)
  ├── subscription_billing (record_payment)
  └── platform_registry (treasury lookup)

payment_scheduler
  ├── payment_processor (process_withdrawal)
  ├── platform_registry (platform lookup)
  └── openzeppelin_utils::rate_limiter (global circuit breaker)

subscription_policies
  └── openzeppelin_utils::rate_limiter (all policy types)
```

---

## 4. Module Specifications

### 4.1 `subscription_core` — Minimal Account Primitive

**File**: `move/subscriptions/sources/subscription_core.move`

Replaces the account portion of the old `subscription_account` module. Only three responsibilities: hold balance, map subscriptions, enforce owner auth.

#### Data Structures

```move
module subscriptions::subscription_core {
    use openzeppelin_access::access_control::{AccessControl, Auth};
    use openzeppelin_access::access_control;
    use sui::balance::Balance;
    use sui::vec_map::{Self, VecMap};
    use sui::transfer;

    // === OTW and Roles ===

    /// One-Time Witness for subscription_core module
    public struct SUBSCRIPTION_CORE has drop {}

    /// Role types — defined in the same module as the OTW (OZ invariant)
    public struct ACCOUNT_OWNER_ROLE {}
    public struct ACCOUNT_DEPOSITOR_ROLE {}

    // === Errors ===
    const E_INVALID_CAP: u64 = 0x10001;
    const E_ACCOUNT_PAUSED: u64 = 0x1000C;
    const E_ZERO_AMOUNT: u64 = 0x1000B;
    const E_INSUFFICIENT_BALANCE: u64 = 0x1000D;

    // === Account ===

    /// The core subscription account.
    /// Shared object. Balance and subscription map are the only state.
    /// Authorization is via openzeppelin_access::Auth<ACCOUNT_OWNER_ROLE>, not a custom cap.
    public struct SubscriptionAccount<phantom T> has key, store {
        id: UID,
        /// Denomination tag — distinguishes USDC vs USDSui accounts.
        /// Enforced at payment time: a USDC subscription can only bill a USDC account.
        account_type: AccountType,
        /// Internal balance — used by payment_processor for withdrawals
        balance: Balance<T>,
        /// Platform ID -> Subscription (versioned wrapper)
        subscriptions: VecMap<ID, SubscriptionV1>,
        /// Version for upgrade tracking
        version: u8,
        created_at: u64,
        status: AccountStatus,
    }

    /// Account denomination type tag.
    /// SUI is deprecated for mainnet — subscriptions should be in stablecoins.
    public enum AccountType has store, drop {
        USDC,
        USDSui,
    }

    /// Account lifecycle status
    public struct AccountStatus has store, drop {
        variant: u8,
    }

    public fun account_status_active(): AccountStatus { AccountStatus { variant: 0 } }
    public fun account_status_paused(): AccountStatus { AccountStatus { variant: 1 } }
    public fun account_status_closed(): AccountStatus { AccountStatus { variant: 2 } }

    /// Versioned subscription wrapper.
    /// Allows migration between versions without breaking existing accounts.
    public struct SubscriptionV1 has store, drop {
        platform_id: ID,
        tier_index: u64,
        tier_amount: u64,
        tier_frequency_ms: u64,
        status: SubscriptionStatus,
        schedule: BillingSchedule,
        total_paid: u64,
        payment_count: u64,
        created_at: u64,
        updated_at: u64,
    }

    /// Billing schedule for a subscription
    public struct BillingSchedule has store, drop {
        frequency_ms: u64,
        next_billing_time: u64,
        last_billing_time: u64,
    }
}
```

#### Key Functions

```move
/// Creates a new SubscriptionAccount and AccessControl singleton.
/// The transaction sender automatically receives ACCOUNT_OWNER_ROLE.
/// Returns the account ID. The Auth witness is minted separately via new_auth().
public fun create_usdc_account<T: drop>(
    ctx: &mut TxContext
): ID {
    // 1. Create AccessControl singleton (OZ pattern)
    let ac = access_control::new<SUBSCRIPTION_CORE>(ctx);

    // 2. Grant ACCOUNT_OWNER_ROLE to sender
    ac.grant_role<_, ACCOUNT_OWNER_ROLE>(ctx.sender(), ctx);

    // 3. Create and share the account with USDC type tag
    let account = SubscriptionAccount<T> {
        id: object::new(ctx),
        account_type: AccountType::USDC,
        balance: balance::zero(),
        subscriptions: vec_map::empty(),
        version: 1,
        created_at: ctx.epoch_timestamp_ms(),
        status: account_status_active(),
    };
    transfer::share_object(account);

    // 4. Share the AccessControl
    transfer::public_share_object(ac);

    object::id(&account)
}

/// Deposits stablecoins. Requires Auth<ACCOUNT_DEPOSITOR_ROLE> or Auth<ACCOUNT_OWNER_ROLE>.
public fun deposit<T: drop>(
    auth: &Auth<ACCOUNT_DEPOSITOR_ROLE>,
    account: &mut SubscriptionAccount<T>,
    coin: Coin<T>,
    ctx: &mut TxContext
) {
    assert!(object::id(account) == auth::auth_addr(auth), E_INVALID_CAP);
    assert!(account.status.variant == 0, E_ACCOUNT_PAUSED);
    let amount = coin.value();
    assert!(amount > 0, E_ZERO_AMOUNT);
    let deposit_balance = coin.into_balance();
    account.balance.join(deposit_balance);
    // emit Deposit event
}

/// Internal withdraw — called by payment_processor only.
/// Returns the withdrawn Balance so the PTB can transfer to recipient.
/// No capability check here; payment_processor's Auth<PLATFORM_SCHEDULER_ROLE> is the gate.
public fun withdraw<T>(
    account: &mut SubscriptionAccount<T>,
    amount: u64,
    ctx: &mut TxContext
): Balance<T> {
    assert!(account.status.variant == 0, E_ACCOUNT_PAUSED);
    assert!(amount > 0, E_ZERO_AMOUNT);
    assert!(account.balance.value() >= amount, E_INSUFFICIENT_BALANCE);
    account.balance.split(amount)
}
```

#### Why this design?

- **No custom AccountCap** — uses OZ `Auth<ACCOUNT_OWNER_ROLE>` instead. The same pattern works for any role.
- **Balance is internal** — only `withdraw` (internal) and `deposit` (auth-gated) modify it. No direct public access.
- **Subscriptions are versioned** — `SubscriptionV1` wrapper allows migration to V2 without breaking existing accounts.
- **AccessControl is a shared object** — multiple roles can be granted, revoked, and audited.
- **`account_type` type tag** — USDC vs USDSui enforced at contract level. Payment processor checks `account_type` matches the subscription's denomination before processing.

---

### 4.2 `subscription_policies` — Policy Plugin System

**File**: `move/subscriptions/sources/subscription_policies.move`

Replaces the monolithic `PolicyConfig` with a composable plugin system. Each policy is a small embeddable struct using OZ's `RateLimiter`.

#### Data Structures

```move
module subscriptions::subscription_policies {
    use openzeppelin_utils::rate_limiter::{Self, RateLimiter};
    use sui::clock::Clock;

    // === Policy: Per-Transaction Limit ===
    // Uses Cooldown strategy: once drained, must wait cooldown_ms before next withdrawal.
    // The "cooldown" is the billing cycle — enforces exactly one charge per cycle.

    public struct PerTxPolicy has store, drop {
        max_amount: u64,
        /// Uses Cooldown: one attempt per billing cycle
        rate_limiter: RateLimiter,
    }

    // === Policy: Monthly Aggregate Limit ===
    // Uses FixedWindow: resets to capacity at the start of each window.

    public struct MonthlyPolicy has store, drop {
        max_monthly: u64,
        /// Uses FixedWindow: monthly reset
        rate_limiter: RateLimiter,
    }

    // === Policy: Minimum Balance ===
    // Not a rate limiter — a simple floor check.

    public struct MinBalancePolicy has store, drop {
        min_balance: u64,
    }

    // === Policy: Frequency Enforcement ===
    // Uses Bucket: continuously refilling, models "N withdrawals per day/week"

    public struct FrequencyPolicy has store, drop {
        max_per_interval: u64,
        refill_amount: u64,
        refill_interval_ms: u64,
        rate_limiter: RateLimiter,
    }

    // === Policy Set ===
    // A collection of policies attached to an account or platform.
    // Evaluation is sequential — all must pass.

    public struct PolicySet has store, drop {
        per_tx: Option<PerTxPolicy>,
        monthly: Option<MonthlyPolicy>,
        min_balance: Option<MinBalancePolicy>,
        frequency: Option<FrequencyPolicy>,
    }
}
```

#### Key Functions

```move
/// Creates a PerTxPolicy with Cooldown strategy.
public fun new_per_tx_policy(
    max_amount: u64,
    billing_cycle_ms: u64,  // e.g., 2592000000 for 30 days
    clock:&Clock,
): PerTxPolicy {
    // Cooldown: drain-to-zero then wait billing_cycle_ms
    PerTxPolicy {
        max_amount,
        rate_limiter: rate_limiter::new_cooldown(
            max_amount,
            billing_cycle_ms,
            max_amount,  // initial available = full capacity
            0,           // no cooldown armed initially
            clock,
        ),
    }
}

/// Creates a MonthlyPolicy with FixedWindow strategy.
public fun new_monthly_policy(
    max_monthly: u64,
    window_start_ms: u64,
    clock: &Clock,
): MonthlyPolicy {
    MonthlyPolicy {
        max_monthly,
        rate_limiter: rate_limiter::new_fixed_window(
            max_monthly,
            30 * 24 * 60 * 60 * 1000,  // 30-day window
            window_start_ms,
            max_monthly,
            clock,
        ),
    }
}

/// Evaluates all policies for a proposed withdrawal.
/// Returns (allowed, vector of error codes).
public fun evaluate(
    policies: &PolicySet,
    amount: u64,
    current_balance: u64,
    clock: &Clock,
): (bool, vector<u64>) {
    let mut errors = vector[];

    // Per-transaction check
    if (policies.per_tx.is_some()) {
        let p = policies.per_tx.borrow();
        if (amount > p.max_amount) {
            errors.push_back(E_POLICY_EXCEEDED_TRANSACTION);
        };
        // Also check cooldown
        if (!rate_limiter::try_consume(&mut p.rate_limiter, amount, clock)) {
            errors.push_back(E_POLICY_FREQUENCY_VIOLATION);
        };
    };

    // Monthly check
    if (policies.monthly.is_some()) {
        let p = policies.monthly.borrow();
        if (!rate_limiter::try_consume(&mut p.rate_limiter, amount, clock)) {
            errors.push_back(E_POLICY_EXCEEDED_MONTHLY);
        };
    };

    // Min balance check
    if (policies.min_balance.is_some()) {
        let p = policies.min_balance.borrow();
        if (current_balance - amount < p.min_balance) {
            errors.push_back(E_POLICY_MIN_BALANCE_VIOLATION);
        };
    };

    let allowed = errors.is_empty();
    (allowed, errors)
}
```

#### Why this design?

- **Composable** — platforms can attach/detach policies without modifying core logic
- **Uses OZ RateLimiter** — three strategies cover all rate-limiting needs
- **PerTxPolicy with Cooldown** — naturally models "one charge per billing cycle"
- **PolicySet is a struct** — can be stored in `SubscriptionAccount` or passed as a function argument
- **Evaluation returns all failures** — not just the first, so users see all issues at once

---

### 4.3 `subscription_billing` — Pure Billing Logic

**File**: `move/subscriptions/sources/subscription_billing.move`

No account management, no policies. Just subscription lifecycle and billing schedule management.

#### Data Structures

```move
module subscriptions::subscription_billing {
    use subscriptions::subscription_core::{SubscriptionAccount, SubscriptionV1, BillingSchedule, AccountStatus};
    use sui::vec_map::{Self, VecMap};
    use sui::clock::Clock;

    // === Status ===

    public struct SubscriptionStatus has store, drop {
        variant: u8,
    }

    public fun subscription_status_active(): SubscriptionStatus { SubscriptionStatus { variant: 0 } }
    public fun subscription_status_paused(): SubscriptionStatus { SubscriptionStatus { variant: 1 } }
    public fun subscription_status_cancelled(): SubscriptionStatus { SubscriptionStatus { variant: 2 } }
    public fun subscription_status_variant(s:&SubscriptionStatus): u8 { s.variant }
    public fun subscription_status_is_active(s: &SubscriptionStatus): bool { s.variant == 0 }
    public fun subscription_status_is_paused(s: &SubscriptionStatus): bool { s.variant == 1 }

    // === Errors ===
    const E_INVALID_TIER: u64 = 0x30003;
    const E_SUBSCRIPTION_ALREADY_EXISTS: u64 = 0x30008;
    const E_SUBSCRIPTION_NOT_FOUND: u64 = 0x30009;
    const E_SUBSCRIPTION_PAUSED: u64 = 0x1000E;
}
```

#### Key Functions

```move
/// Creates a new subscription embedded in the account's VecMap.
public fun create_subscription<T>(
    account:&mut SubscriptionAccount<T>,
    platform_id: ID,
    tier_index: u64,
    tier_amount: u64,
    tier_frequency_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext
) {
    // Idempotency check
    assert!(!vec_map::contains(&account.subscriptions, &platform_id), E_SUBSCRIPTION_ALREADY_EXISTS);

    let now = clock.timestamp_ms();
    let schedule = BillingSchedule {
        frequency_ms: tier_frequency_ms,
        next_billing_time: now + tier_frequency_ms,
        last_billing_time: 0,
    };

    let sub = SubscriptionV1 {
        platform_id,
        tier_index,
        tier_amount,
        tier_frequency_ms,
        status: subscription_status_active(),
        schedule,
        total_paid: 0,
        payment_count: 0,
        created_at: now,
        updated_at: now,
    };

    vec_map::insert(&mut account.subscriptions, platform_id, sub);
    // emit SubscriptionCreated event
}

/// Pauses a subscription and cascades the pause to billing schedule.
public fun pause_subscription<T>(
    account: &mut SubscriptionAccount<T>,
    platform_id: ID,
    clock: &Clock,
    ctx: &mut TxContext
) {
    let sub = vec_map::get_mut(&mut account.subscriptions, &platform_id);
    assert!(subscription_status_is_active(subscription_status(sub)), E_SUBSCRIPTION_NOT_PAUSED);
    sub.status = subscription_status_paused();
    sub.updated_at = clock.timestamp_ms();
    // emit SubscriptionPaused event
}

/// Records a successful payment and advances the billing schedule.
public fun record_payment<T>(
    account:&mut SubscriptionAccount<T>,
    platform_id: ID,
    amount: u64,
    clock: &Clock,
    ctx: &mut TxContext
) {
    let sub = vec_map::get_mut(&mut account.subscriptions, &platform_id);
    assert!(subscription_status_is_active(subscription_status(sub)), E_SUBSCRIPTION_PAUSED);

    let now = clock.timestamp_ms();
    sub.total_paid = sub.total_paid + amount;
    sub.payment_count = sub.payment_count + 1;
    sub.schedule.last_billing_time = now;
    sub.schedule.next_billing_time = now + sub.schedule.frequency_ms;
    sub.updated_at = now;

    // emit PaymentRecorded event
}

/// Checks if a subscription is due for billing.
public fun can_bill<T>(
    account:&SubscriptionAccount<T>,
    platform_id: ID,
    clock: &Clock
): bool {
    if (!vec_map::contains(&account.subscriptions, &platform_id)) return false;
    let sub = vec_map::get(&account.subscriptions, &platform_id);
    if (!subscription_status_is_active(subscription_status(sub))) return false;
    clock.timestamp_ms() >= sub.schedule.next_billing_time
}
```

#### Why this design?

- **No balance management** — purely about subscription lifecycle
- **Pause cascades** — pausing the subscription also stops billing (unlike v1 where account pause ≠ subscription pause)
- **Calendar-accurate billing** — uses real clock timestamps, not approximate `(days/30)*30`
- **Versioned subscription** — `SubscriptionV1` can be migrated to `SubscriptionV2` for future fields (e.g., retry state)

---

### 4.4 `platform_registry` — Platform Management with OZ AccessControl

**File**: `move/subscriptions/sources/platform_registry.move`

Replaces `PlatformOwnerCap`/`SchedulerCap` with OZ's `Auth<Role>` pattern. **Each platform embeds its own AccessControl singleton** — platforms are fully isolated. A compromised admin key for Platform A cannot affect Platform B.

Embeds platform-level rate limiters for withdrawal volume and frequency.

#### Data Structures

```move
module subscriptions::platform_registry {
    use openzeppelin_access::access_control::{AccessControl, Auth};
    use openzeppelin_access::access_control;
    use openzeppelin_utils::rate_limiter::{Self, RateLimiter};
    use sui::clock::Clock;
    use sui::vec_map::{Self, VecMap};

    // === OTW and Roles ===

    public struct PLATFORM_REGISTRY has drop {}

    /// Admin role: full platform control
    public struct PLATFORM_ADMIN_ROLE {}
    /// Scheduler role: authorized to process withdrawals (delegated by admin)
    public struct PLATFORM_SCHEDULER_ROLE {}

    // === Platform ===

    /// Each Platform embeds its own AccessControl singleton.
    /// This is the key isolation decision: a compromised admin key for Platform A
    /// cannot affect Platform B. Storage cost is ~2KB extra per platform.
    public struct Platform has key, store {
        id: UID,
        /// OZ AccessControl singleton — unique per platform
        access_control: AccessControl<PLATFORM_REGISTRY>,
        treasury: address,
        name: std::string::String,
        description: std::string::String,
        category: std::string::String,
        webhook_url: std::option::Option<std::string::String>,
        is_verified: bool,
        subscriber_count: u64,
        created_at: u64,
        status: PlatformStatus,
        /// Platform-level withdrawal volume rate limiter (FixedWindow)
        withdrawal_volume_limiter: RateLimiter,
        /// Platform-level withdrawal frequency rate limiter (Bucket)
        withdrawal_frequency_limiter: RateLimiter,
        tiers: VecMap<u64, SubscriptionTier>,
    }

    public struct PlatformStatus has store, drop {
        variant: u8,
    }

    public struct SubscriptionTier has store, drop {
        name: std::string::String,
        amount: u64,
        frequency_ms: u64,
        is_active: bool,
    }
}
```

#### Key Functions

```move
/// Registers a new platform.
/// The transaction sender automatically receives PLATFORM_ADMIN_ROLE.
/// A PLATFORM_SCHEDULER_ROLE is also created so the admin can grant it to a scheduler.
public fun register_platform(
    name: std::string::String,
    description: std::string::String,
    category: std::string::String,
    webhook_url: std::option::Option<std::string::String>,
    clock: &Clock,
    ctx: &mut TxContext
): ID {
    // 1. Create OZ AccessControl singleton (one per platform)
    let ac = access_control::new<PLATFORM_REGISTRY>(ctx);

    // 2. Grant PLATFORM_ADMIN_ROLE to sender
    ac.grant_role<_, PLATFORM_ADMIN_ROLE>(ctx.sender(), ctx);

    // 3. Create rate limiters
    let withdrawal_volume_limiter = rate_limiter::new_fixed_window(
        1_000_000_000_000,  // $1M monthly cap (example)
        30 * 24 * 60 * 60 * 1000,
        ctx.epoch_timestamp_ms(),
        1_000_000_000_000,
        clock,
    );

    let withdrawal_frequency_limiter = rate_limiter::new_bucket(
        1000,              // 1000 withdrawals per interval
        100,               // refill 100 per interval
        60 * 60 * 1000,    // 1-hour refill interval
        1000,              // start full
        ctx.epoch_timestamp_ms(),
        clock,
    );

    // 4. Create and share platform
    let platform = Platform {
        id: object::new(ctx),
        access_control: ac,
        treasury: ctx.sender(),
        name,
        description,
        category,
        webhook_url,
        is_verified: false,
        subscriber_count: 0,
        created_at: ctx.epoch_timestamp_ms(),
        status: platform_status_active(),
        withdrawal_volume_limiter,
        withdrawal_frequency_limiter,
        tiers: vec_map::empty(),
    };

    let platform_id = object::id(&platform);
    transfer::share_object(platform);

    // emit PlatformRegistered event
    platform_id
}

/// Grants SCHEDULER_ROLE to a wallet address.
/// The platform admin calls this to authorize the off-chain scheduler.
/// This is the only path to get a valid Auth<PLATFORM_SCHEDULER_ROLE>.
public fun grant_scheduler_role(
    admin_auth: &Auth<PLATFORM_ADMIN_ROLE>,
    platform: &mut Platform,
    scheduler_address: address,
    ctx: &mut TxContext
) {
    // Verify admin_auth is for this platform's access_control
    assert!(access_control::auth_addr(admin_auth) == ctx.sender(), E_UNAUTHORIZED);
    platform.access_control.grant_role<_, PLATFORM_SCHEDULER_ROLE>(scheduler_address, ctx);
    // emit SchedulerRoleGranted { platform_id, scheduler_address }
}

/// Checks platform-level rate limiters before delegating to payment_processor.
/// This is called by the on-chain payment_scheduler, not directly by platforms.
public fun process_withdrawal<T>(
    platform: &Platform,
    account: &mut SubscriptionAccount<T>,
    amount: u64,
    clock: &Clock,
    ctx: &mut TxContext
): Balance<T> {
    // 1. Check platform-level rate limiters
    assert!(rate_limiter::try_consume(&mut platform.withdrawal_volume_limiter, amount, clock), E_PLATFORM_RATE_LIMITED);
    assert!(rate_limiter::try_consume(&mut platform.withdrawal_frequency_limiter, 1, clock), E_PLATFORM_RATE_LIMITED);

    // 2. Delegate to payment_processor
    payment_processor::process_withdrawal(platform, account, amount, clock, ctx)
}
```

#### Why this design?

- **Embedded AccessControl per platform** — platform isolation is a security property, not just organizational preference
- **Timelock on admin actions** — if the admin key is compromised, there's a 48h cancel window before a transfer takes effect
- **Platform-level rate limiters** — prevents spam/DoS on individual platforms
- **Scheduler is delegated** — admin grants `PLATFORM_SCHEDULER_ROLE` to a scheduler wallet; can be revoked at any time without transferring objects
- **No custom caps** — the scheduler's `Auth<PLATFORM_SCHEDULER_ROLE>` is minted via `new_auth()` at call time, not stored as a transferable object

---

### 4.5 `payment_processor` — Payment Execution

**File**: `move/subscriptions/sources/payment_processor.move`

Small, focused module. Orchestrates: core withdraw + policy check + billing record + denomination verification.

```move
module subscriptions::payment_processor {
    use subscriptions::subscription_core::{SubscriptionAccount, SubscriptionV1, AccountType, withdraw};
    use subscriptions::subscription_billing::{self, record_payment};
    use subscriptions::subscription_policies::PolicySet;
    use subscriptions::platform_registry::Platform;
    use sui::coin::Coin;
    use sui::clock::Clock;

    // === Errors ===
    const E_UNAUTHORIZED_PLATFORM: u64 = 0x10003;
    const E_POLICY_VIOLATION: u64 = 0x10006;
    const E_DENOMINATION_MISMATCH: u64 = 0x10010;

    /// Orchestrates a withdrawal:
    /// 1. Verify platform is authorized via subscription
    /// 2. Verify account denomination matches subscription denomination
    /// 3. Evaluate policy set
    /// 4. Execute withdraw from account
    /// 5. Record payment in billing
    /// 6. Return Balance for PTB transfer to treasury
    public fun process_withdrawal<T>(
        platform:&Platform,
        account: &mut SubscriptionAccount<T>,
        amount: u64,
        policies: &PolicySet,
        clock: &Clock,
        ctx: &mut TxContext
    ): Balance<T> {
        let platform_id = object::id(platform);

        // 1. Verify platform has an active subscription in this account
        assert!(subscription_billing::has_subscription(account, &platform_id), E_UNAUTHORIZED_PLATFORM);

        // 2. Verify denomination matches (USDC account -> USDC subscription)
        let sub = subscription_billing::get_subscription(account, &platform_id);
        assert!(sub.tier_denomination == account.account_type, E_DENOMINATION_MISMATCH);

        // 3. Evaluate policies
        let (allowed, errors) = subscription_policies::evaluate(
            policies,
            amount,
            account.balance.value(),
            clock,
        );
        assert!(allowed, E_POLICY_VIOLATION);

        // 4. Execute withdraw
        let withdrawn: Balance<T> = withdraw(account, amount, ctx);

        // 5. Record payment
        record_payment(account, platform_id, amount, clock, ctx);

        // 6. Emit Withdrawal event with policy results
        // emit Withdrawal { platform_id, amount, policy_results: errors.is_empty() ... }

        withdrawn
    }
}
```

---

### 4.6 `payment_scheduler` — On-Chain Scheduler Entry Point

**File**: `move/subscriptions/sources/payment_scheduler.move`

**Key design decision: the scheduler runs as an on-chain contract, not an off-chain secret key.** This eliminates the single-secret-key single-point-of-failure. The `PaymentScheduler` shared object holds a global `RateLimiter` circuit breaker. **Anyone can call `process_due_payments`** — it is permissionless but rate-limited. The off-chain indexer still finds due payments (Sui has no built-in query for "all accounts due at time T"), but the execution is trust-minimized.

#### Data Structures

```move
module subscriptions::payment_scheduler {
    use openzeppelin_utils::rate_limiter::{Self, RateLimiter};
    use sui::clock::Clock;
    use sui::transfer;

    // === Global Scheduler ===

    /// The on-chain scheduler entry point.
    /// A single shared object that acts as the global circuit breaker for all billing.
    /// Anyone can call process_due_payments — it is permissionless but rate-limited.
    public struct PaymentScheduler has key {
        id: UID,
        /// Global circuit breaker — all scheduler activity flows through this.
        /// Uses Bucket: refills over time, prevents the scheduler from burning
        /// all gas in a gas spike scenario.
        global_limiter: RateLimiter,
        /// Last processed timestamp (for off-chain indexing)
        last_processed_at: u64,
    }

    // === Errors ===
    const E_GLOBAL_RATE_LIMITED: u64 = 0x50001;
    const E_NO_DUE_SUBSCRIPTION: u64 = 0x50002;
}
```

#### Key Functions

```move
/// Creates the global PaymentScheduler.
/// Called once at package initialization.
public fun init(ctx: &mut TxContext) {
    let scheduler = PaymentScheduler {
        id: object::new(ctx),
        global_limiter: rate_limiter::new_bucket(
            10_000,           // 10,000 payments per interval — global cap
            1_000,            // refill 1,000 per interval
            60 * 60 * 1000,   // 1-hour refill interval
            10_000,           // start full
            ctx.epoch_timestamp_ms(),
        ),
        last_processed_at: 0,
    };
    transfer::share_object(scheduler);
}

/// Processes a single due payment for a platform-account pair.
/// Permissionless — anyone can call. Rate-limited by global_limiter.
///
/// The off-chain indexer finds due accounts and constructs the PTB calling this.
/// This design means: no secret key needed, global circuit breaker protects the system,
/// anyone can run the scheduler (including competing bots), and execution is transparent.
public fun process_due_payment<T>(
    scheduler: &mut PaymentScheduler,
    platform: &Platform,
    account: &mut SubscriptionAccount<T>,
    amount: u64,
    policies: &PolicySet,
    clock: &Clock,
    ctx: &mut TxContext
) {
    // 1. Check global circuit breaker
    assert!(
        rate_limiter::try_consume(&mut scheduler.global_limiter, 1, clock),
        E_GLOBAL_RATE_LIMITED
    );

    // 2. Verify this payment is actually due
    assert!(
        subscription_billing::can_bill(account, object::id(platform), clock),
        E_NO_DUE_SUBSCRIPTION
    );

    // 3. Delegate to platform_registry (which checks platform-level limiters and calls payment_processor)
    let withdrawn: Balance<T> = platform_registry::process_withdrawal<T>(
        platform,
        account,
        amount,
        clock,
        ctx,
    );

    // 4. Transfer to treasury
    let coin: Coin<T> = sui::coin::from_balance(withdrawn, ctx);
    transfer::public_transfer(coin, platform.treasury);

    // 5. Update last processed timestamp
    scheduler.last_processed_at = clock.timestamp_ms();

    // emit PaymentProcessed { platform_id, account_id, amount, timestamp }
}
```

#### Why this design?

- **No secret key** — the scheduler is a smart contract. The "key" is the ability to submit a transaction, which is permissionless.
- **Global circuit breaker** — the `global_limiter` prevents any caller (including a compromised bot) from burning through all scheduler capacity in a gas spike.
- **Permissionless** — anyone can run the scheduler. This is a feature, not a bug: competing schedulers keep each other honest.
- **Transparent** — all payment attempts are on-chain events. No more "payments happened off-chain and we have to trust the server."
- **Off-chain indexer still needed** — Sui has no built-in query for "find all accounts with `next_billing_time <= now`". The indexer reads `SubscriptionCreated` and `PaymentRecorded` events to build its due-payments list. This is unavoidable but the execution is trust-minimized.

---

### 4.7 `subscription_manager` — Facade Module

**File**: `move/subscriptions/sources/subscription_manager.move`

User-facing API. Delegates to appropriate submodule. This is what most users and platforms interact with.

```move
module subscriptions::subscription_manager {
    use openzeppelin_access::access_control::Auth;
    use subscriptions::subscription_core::{self, SubscriptionAccount, create_usdc_account};
    use subscriptions::subscription_billing;
    use subscriptions::platform_registry::{self, Platform, get_tier, get_platform_tiers};
    use subscriptions::subscription_policies;
    use sui::clock::Clock;

    // === Errors ===
    const E_INVALID_TIER: u64 = 0x30003;
    const E_SUBSCRIPTION_ALREADY_EXISTS: u64 = 0x30008;

    /// Creates a new USDC-denominated subscription account.
    /// The caller receives Auth<ACCOUNT_OWNER_ROLE> via the returned AccountCap equivalent.
    public fun create_usdc_account<T: drop>(
        ctx: &mut TxContext
    ): ID {
        subscription_core::create_usdc_account<T>(ctx)
    }

    /// Creates a subscription to a platform tier.
    /// Combines: tier validation + subscription creation + policy attachment.
    public fun create_subscription<T>(
        owner_auth: &Auth<ACCOUNT_OWNER_ROLE>,
        account: &mut SubscriptionAccount<T>,
        platform: &Platform,
        tier_index: u64,
        policies: &PolicySet,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // 1. Validate tier
        let tiers = get_platform_tiers(platform);
        assert!(tier_index < vector::length(tiers), E_INVALID_TIER);
        let tier = get_tier(platform, tier_index);
        assert!(tier.is_active, E_INVALID_TIER);

        // 2. Create subscription in billing module
        subscription_billing::create_subscription(
            account,
            object::id(platform),
            tier_index,
            tier.amount,
            tier.frequency_ms,
            clock,
            ctx,
        );

        // 3. Attach policies (stored in account or passed to payment_processor on each bill)
        // emit SubscriptionCreated event
    }

    /// Pauses a subscription and its billing schedule.
    public fun pause_subscription<T>(
        owner_auth: &Auth<ACCOUNT_OWNER_ROLE>,
        account: &mut SubscriptionAccount<T>,
        platform_id: ID,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        subscription_billing::pause_subscription(account, platform_id, clock, ctx);
    }

    /// Cancels a subscription.
    public fun cancel_subscription<T>(
        owner_auth:&Auth<ACCOUNT_OWNER_ROLE>,
        account: &mut SubscriptionAccount<T>,
        platform_id: ID,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        subscription_billing::cancel_subscription(account, platform_id, clock, ctx);
    }
}
```

---

## 5. Key Architectural Decisions

### 5.1 OZ Auth<Role> Instead of Custom Capabilities

**Old (v1):**
```move
public struct SchedulerCap has key, store {
    id: UID,
    platform_id: ID,
    created_at: u64,
}
```

**New (v2):**
```move
// Platform admin grants SCHEDULER_ROLE to a wallet
platform.access_control.grant_role<_, PLATFORM_SCHEDULER_ROLE>(scheduler_address, ctx);

// Scheduler uses Auth witness in PTB (minted at call time, not stored)
let auth = access_control::new_auth<PLATFORM_REGISTRY, PLATFORM_SCHEDULER_ROLE>(&platform.access_control, ctx);
payment_processor::process_withdrawal(auth, platform, account, amount, clock, ctx);
```

**Benefits:**
- Timelock on root role transfer (48h cancel window)
- Role revocation without transferring objects
- Role hierarchy (admin > scheduler)
- Governance-compatible (multisig can hold roles)
- Single pattern across all modules

### 5.2 Embedded AccessControl Per Platform (Not Global)

Each `Platform` object embeds its own `AccessControl<PLATFORM_REGISTRY>` singleton. This means:

- A compromised admin key for Platform A **cannot** affect Platform B
- Each platform sets its own `default_admin_delay_ms` independently
- The scheduler's `Auth<PLATFORM_SCHEDULER_ROLE>` is inherently bound to the platform that issued it

Storage cost: ~2KB extra per platform (the AccessControl internal Table). For 1000 platforms, ~2MB on-chain. This is cheap insurance for platform isolation.

### 5.3 On-Chain Scheduler with Permissionless Callers

The scheduler is a `PaymentScheduler` shared object. The off-chain indexer still finds due payments, but execution is on-chain and rate-limited by a global `RateLimiter`. The secret key goes away.

```move
// Anyone can call — no signer needed
const tx = new Transaction();
tx.moveCall({
    target: `...payment_scheduler::process_due_payment`,
    arguments: [scheduler, platform, account, amount, policies, clock]
});
// No signer — permissionless but rate-limited
```

The off-chain indexer (today's TypeScript scheduler) becomes a pure indexing and transaction-submission service. It finds due payments from events, constructs the PTB, and submits it. It no longer holds a secret key that can drain accounts.

### 5.4 Type-Tagged Stablecoin Accounts

```move
public enum AccountType has store, drop {
    USDC,
    USDSui,
}

public struct SubscriptionAccount<phantom T> has key, store {
    account_type: AccountType,  // Enforced at payment time
    balance: Balance<T>,
    // ...
}
```

The `account_type` field prevents currency mismatches: a USDC subscription cannot bill a USDSui account. SUI as a subscription currency is deprecated for mainnet — it introduces volatility that defeats the purpose of stablecoin subscriptions.

### 5.5 Embedding Rate Limiters at Every Boundary

Rate limiting is applied at multiple levels:

| Level | Limiter Type | Strategy | Purpose |
|-------|-------------|----------|---------|
| Account deposit | `Bucket` | Continuous refill | Prevent rapid small deposits that waste gas |
| Subscription frequency | `Cooldown` | Drain then wait | Exactly one charge per billing cycle |
| Account monthly | `FixedWindow` | Monthly reset | Enforce monthly spending cap |
| Platform withdrawal volume | `FixedWindow` | Monthly reset | Prevent platform from draining too fast |
| Platform withdrawal frequency | `Bucket` | Refill-based | Prevent spam/DoS on platform |
| Global scheduler | `Bucket` | Circuit breaker | Overall system circuit breaker — protects against gas spike exhaustion |

### 5.6 Versioned Subscription Objects

```move
/// V1: original subscription structure
public struct SubscriptionV1 has store, drop {
    platform_id: ID,
    tier_index: u64,
    tier_amount: u64,
    tier_frequency_ms: u64,
    status: SubscriptionStatus,
    schedule: BillingSchedule,
    total_paid: u64,
    payment_count: u64,
    created_at: u64,
    updated_at: u64,
}

/// V2: adds retry state for failed payments
public struct SubscriptionV2 has store, drop {
    platform_id: ID,
    tier_index: u64,
    tier_amount: u64,
    tier_frequency_ms: u64,
    status: SubscriptionStatus,
    schedule: BillingSchedule,
    total_paid: u64,
    payment_count: u64,
    created_at: u64,
    updated_at: u64,
    // NEW FIELDS
    last_attempt_time: u64,
    attempt_count: u8,
    max_attempts: u8,
}

/// Migration function
public fun migrate(sub: &SubscriptionV1): SubscriptionV2 {
    SubscriptionV2 {
        platform_id: sub.platform_id,
        tier_index: sub.tier_index,
        tier_amount: sub.tier_amount,
        tier_frequency_ms: sub.tier_frequency_ms,
        status: sub.status,
        schedule: sub.schedule,
        total_paid: sub.total_paid,
        payment_count: sub.payment_count,
        created_at: sub.created_at,
        updated_at: sub.updated_at,
        last_attempt_time: 0,
        attempt_count: 0,
        max_attempts: 3,
    }
}
```

### 5.7 Pause Cascade

In v1, pausing the account does not pause subscriptions — platforms can keep billing. In v2:

```move
public fun pause_account<T>(
    auth: &Auth<ACCOUNT_OWNER_ROLE>,
    account: &mut SubscriptionAccount<T>,
    clock: &Clock,
    ctx: &mut TxContext
) {
    account.status = account_status_paused();

    // Cascade pause to all active subscriptions
    let subs = vec_map::values(&mut account.subscriptions);
    let mut i = 0;
    while (i < vector::length(subs)) {
        let sub = vector::borrow_mut(subs, i);
        if (subscription_status_is_active(subscription_status(sub))) {
            subscription_set_status(sub, subscription_status_paused());
        };
        i = i + 1;
    };
    // emit AccountPaused event with subscription count
}
```

### 5.8 Structured Events

Every event is typed with all relevant context:

```move
public struct PaymentProcessed has copy, drop {
    account_id: ID,
    platform_id: ID,
    amount: u64,
    new_total_paid: u64,
    payment_number: u64,
    policy_results: vector<bool>,  // Which policies passed
    timestamp_ms: u64,
}

public struct RoleGranted has copy, drop {
    role: TypeName, // OZ Auth uses TypeName for roles
    account: address,
    granted_by: address,
    timestamp_ms: u64,
}
```

---

## 6. Upgrade Path and Governance

### 6.1 Two-Tier Upgrade Rights

For a subscriptions product holding user funds, a single upgrade key (or pure multisig) is insufficient. A two-tier model balances security and agility:

**Tier 1 — Critical security patches** (active exploits, arithmetic bugs, access control bypasses):
- 3-of-5 multisig required
- 24-hour timelock
- No user veto period (speed over process for active exploits)

**Tier 2 — Non-critical upgrades** (new features, policy changes, gas optimization):
- 3-of-5 multisig required
- 7-day timelock
- User veto period: during the timelock, any account owner can call `veto_upgrade()` — if >10% of accounts veto, the upgrade is cancelled

The distinction between "critical" and "non-critical" is declared by the multisig at proposal time. This creates accountability without requiring full DAO governance.

**Multisig composition (recommended):**
- 2 team members (internal)
- 1 external security researcher (independent)
- 2 community members (elected or appointed)

### 6.2 Migration Strategy

```
V1 (current) ---> Migration (6 months) ---> V2 (refactored)
```

1. **Phase 1**: Publish V2 packages alongside V1
2. **Phase 2**: Add `migrate_account` entry point callable by account owner
3. **Phase 3**: Migration window (3-6 months). Both V1 and V2 accounts work.
4. **Phase 4**: Deprecate V1. V1 accounts that haven't migrated must call migrate before V1 package is deprecated.

### 6.3 Migration Function

```move
/// Migrates a V1 account to V2.
/// Callable by account owner. Transfers balance and subscriptions.
public fun migrate_account<T>(
    auth: &Auth<ACCOUNT_OWNER_ROLE>,
    v1_account: &mut SubscriptionAccount<T>,
    v2_account: &mut SubscriptionAccountV2<T>,
    ctx: &mut TxContext
) {
    // 1. Transfer balance
    v2_account.balance.join(v1_account.balance.split(v1_account.balance.value()));

    // 2. Migrate subscriptions
    let v1_subs = v1_account.subscriptions;
    let mut i = 0;
    while (i < vec_map::size(&v1_subs)) {
        let (key, val) = vec_map::get_entry_by_idx(&v1_subs, i);
        let migrated = migrate_subscription(val);
        vec_map::insert(&mut v2_account.subscriptions, *key, migrated);
        i = i + 1;
    };

    // 3. Mark V1 account as migrated
    v1_account.status = account_status_closed();
    // emit MigrationComplete event
}
```

---

## 7. Comparison: v1 vs v2

| Property | v1 | v2 |
|----------|----|----|
| Access control | Custom caps (PlatformOwnerCap, SchedulerCap, AccountCap) | OZ AccessControl with Auth<Role> — embedded per platform |
| AccessControl scope | N/A | Embedded per Platform (isolation) |
| Rate limiting | `min_frequency_days` (blunt check) | OZ RateLimiter (Cooldown/Bucket/FixedWindow) at6 levels |
| Policy model | Monolithic PolicyConfig struct | Plugin-based PolicySet |
| Subscription storage | Embedded in account VecMap | Same, but versioned (V1, V2...) |
| Platform auth | Custom SchedulerCap | OZ Auth<PLATFORM_SCHEDULER_ROLE> with timelock, delegated by admin |
| Admin timelock | None | 48h via OZ AccessControl |
| Pause cascade | Account pause ≠ subscription pause | Account pause cascades to all subscriptions |
| Month calculation | Approximate `(days/30)*30` | Real clock timestamps |
| Batch operations | Monolithic `&mut vector<Account>` | Per-account PTB (parallel execution) |
| Upgrade path | None | Versioned structs + migration functions |
| Platform rate limit | None | Volume (FixedWindow) + frequency (Bucket) |
| Global circuit breaker | None | On-chain PaymentScheduler with Bucket rate limiter |
| Scheduler secret key | Single Ed25519 keypair on server | None — permissionless on-chain entry point |
| Stablecoin support | Generic `<T>`, scheduler hardcoded to SUI | Type-tagged AccountType (USDC/USDSui), enforced at payment time |
| Upgrade governance | None | Two-tier multisig (24h critical / 7-day + veto non-critical) |

---

## 8. Implementation Phases

### Phase 1: Foundation (4-6 weeks)
- Implement `subscription_core` with OZ AccessControl + AccountType tag
- Migrate account creation and deposits
- Write comprehensive tests

### Phase 2: Policy System (3-4 weeks)
- Implement `subscription_policies` with OZ RateLimiter
- Migrate policy evaluation logic
- Test all policy combinations

### Phase 3: Billing & Platform (4-6 weeks)
- Implement `subscription_billing`
- Refactor `platform_registry` with embedded OZ AccessControl + platform rate limiters
- Implement `payment_processor` with denomination check

### Phase 4: Scheduler (2-3 weeks)
- Implement `payment_scheduler` as on-chain contract
- Integrate global Bucket rate limiter
- Test permissionless caller flow

### Phase 5: Facade & Migration (2-3 weeks)
- Implement `subscription_manager` facade
- Write migration functions
- Integration tests

### Phase 6: Audit & Governance (4-8 weeks)
- Third-party security audit
- Multisig setup for upgrade keys
- Staging environment testing

**Total estimated time: 4-6 months for a small team**

---

## 9. Resolved Decisions

The following open questions from the initial draft have been resolved through analysis:

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | AccessControl: embedded per platform or global? | **Embedded per platform** | Platform isolation is a security property. A compromised admin key for Platform A cannot affect Platform B. ~2KB extra storage per platform is acceptable. |
| 2 | Scheduler: on-chain or off-chain? | **On-chain with permissionless callers** | Eliminates the single-secret-key single-point-of-failure. Global `RateLimiter` acts as circuit breaker. Off-chain indexer still finds due payments (unavoidable) but execution is trust-minimized. |
| 3 | Stablecoin diversity | **Type-tagged AccountType (USDC/USDSui)** | `account_type` field prevents currency mismatches at contract level. SUI deprecated for mainnet subscriptions. |
| 4 | Upgrade governance | **Two-tier multisig with timelock** | 3-of-5 multisig. Critical patches: 24h timelock. Non-critical: 7-day + user veto. Distinguishing "critical" vs "non-critical" is the multisig's call at proposal time. |

---

## 10. Open Questions (Remaining)

These questions require product/business decisions beyond the scope of this technical document:

1. **Should `AccountType` be extensible to new stablecoins via governance, or fixed to USDC/USDSui?**
   - Governance: a `CoinTypeRegistry` shared object lets the multisig add new stablecoin types over time
   - Fixed: simpler, but requires a package upgrade to add new stablecoins

2. **What is the minimum viable multisig composition?**
   - 3-of-5 (recommended above) provides good fault tolerance
   - 2-of-3 is simpler but less resilient
   - Should community members be elected, appointed, or open to anyone who stakes a token?

3. **How should the off-chain indexer handle due-payment discovery?**
   - Current approach: poll `AccountCreated` + `SubscriptionCreated` + `PaymentRecorded` events to build a due-payments list
   - Alternative: a dedicated `DuePaymentsRegistry` shared object updated by billing events (more complex but more efficient)

4. **Should platforms be able to customize their own policy sets, or are policies account-level only?**
   - Account-level: users set their own `PolicySet` per subscription
   - Platform-level: platforms can define minimum policy requirements that accounts must meet
   - Both: account policies must be at least as restrictive as platform minimums

---

## 11. References

- [OpenZeppelin Contracts for Sui](https://github.com/OpenZeppelin/contracts-sui)
  - [`rate_limiter.move`](https://github.com/OpenZeppelin/contracts-sui/blob/main/contracts/utils/sources/rate_limiter.move) — embeddable rate limiting primitives
  - [`access_control.move`](https://github.com/OpenZeppelin/contracts-sui/blob/main/contracts/access/sources/access_control.move) — role-based access with timelock
- [Move Book](https://move-book.com/)
- [Sui Move Examples](https://github.com/MystenLabs/sui/tree/main/examples/move)
- [Sui Docs](https://docs.sui.io/)

---

*Document Version: 2.0.0-draft*
*Last Updated: 2026-06-06*
*Prepared by: Architecture Review*
