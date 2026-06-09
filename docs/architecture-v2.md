# Sui Subscriptions — v2 Architecture

**Version**: 2.0.0
**Date**: 2026-06-09
**Status**: Approved design — pending implementation
**Supersedes**: `architecture-proposal.md` (v2.0.0-draft)
**Builds on**: `smart-contract-requirements.md` (v1 spec), current `move/subscriptions/sources/*` (v1 impl)

---

## 1. Executive Summary

This document defines **v2** of the PayStreamer subscription contracts: a clean rewrite of the current three-module v1 implementation, delivered as a **new package** (not an in-place upgrade) so that the v1 code can stay live during a 3–6 month migration window without upgrade-cap risk. The v1 bugs identified in §2 of this document are corrected; the OZ-based primitives from the v2 draft are kept; and two seams — confidential transfers and agentic commerce — are built in from day one even though no confidential logic ships yet.

The driving constraints are:

- **Secure by default.** Battle-tested OpenZeppelin primitives (AccessControl with timelock, RateLimiter with three strategies) replace ad-hoc capability patterns and ad-hoc month math.
- **Composable.** Eight small, focused modules with a one-way dependency graph. Each module can be reasoned about, tested, and (within `extensions/`) replaced independently.
- **Extensible.** A `BalanceContainer` and `Asset<T>` abstraction decouple the account, policy, billing, and payment logic from the underlying coin type. When Sui confidential transfers ship on mainnet, the confidential path lives in `extensions::confidential` and core is untouched.
- **Auditable.** One role per module (OZ invariant); one mutating path per object; explicit invariants in code; structured events with version markers.
- **Upgradable without surprise.** A two-package split (`core/` and `extensions/`) with different upgrade policies: `core/` is multisig + 7-day veto; `extensions/` is multisig + 24-hour timelock. Versioned subscription structs (`SubscriptionV1`, `SubscriptionV2`, …) make migration a generic pattern, not a one-off.

The v1 code remains live and serves as the audit baseline; v2 ships as a separate package that v1 owners migrate to voluntarily.

---

## 2. v1 Audit Findings

These are the issues identified by reading `move/subscriptions/sources/subscription_account.move`, `platform_registry.move`, and `subscription_manager.move` end-to-end. They are the **reasons** v2 exists in the shape it does.

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| 1 | **`AccountCap.permissions` is decorative** — the bitfield is declared in the spec, but the live `AccountCap` struct has no `permissions` field and no function reads one. Delegation is unchecked. | `subscription_account.move:99-103` | High |
| 2 | **Off-chain `SCHEDULER_SECRET` is a single point of failure** — a single Ed25519 key on the operator server can drain every account that has a `SchedulerCap` for it. No timelock, no in-flight cancel, no permissionless alternative. | `scripts/scheduler.ts`, `platform_registry.move:88-92` | Critical |
| 3 | **No denomination enforcement** — `SubscriptionAccount<USDC>` and `SubscriptionAccount<USDSui>` are both valid `<T>` instantiations, but `withdraw` checks only `vec_map::contains(&account.subscriptions, &platform_id)`. A platform registered against USDC can bill a USDSui account because the discriminator is `platform_id`, not a `TypeName`/denomination pair. The `phantom T` does not save us. | `subscription_account.move:265-326`, `subscription_manager.move:113-172` | Critical |
| 4 | **`batch_withdraw` is dead code** — `vector<SubscriptionAccount<T>>` is not legal as a PTB argument for shared objects. The script falls back to per-account transactions, but the function is shipped anyway. | `platform_registry.move:402-423`, `build-context.md` confirms | High |
| 5 | **`tier_amount` is not enforced** — `withdraw` accepts any `amount` up to `max_per_transaction`. A platform can over-bill if the user policy allows it. | `subscription_account.move:265-326` | High |
| 6 | **`subscriber_count` is never updated** — `Platform.subscriber_count` is a dead field per `build-context.md`. Discovery is broken. | `platform_registry.move:75` | Medium |
| 7 | **Approximate month math** — `(days/30)*30` breaks across Feb, leap years, etc. | `subscription_account.move:364-369` | Medium |
| 8 | **No pause cascade** — pausing the account does not pause subscriptions. Platforms keep billing a paused account. | v1 spec | Medium |
| 9 | **No upgrade path** — structs are frozen. Any breaking change requires a package upgrade. | All v1 modules | High for mainnet |
| 10 | **`update_policy` allows `min_balance > balance`** — spec says "min_balance must be less than current balance"; v1 does not check. A user can brick their own account. | `subscription_account.move:330-360` | High |
| 11 | **No retry/failure state on `Subscription`** — a single failed `withdraw` leaves the schedule stuck. No `last_attempt_time`, no `attempt_count`. | `subscription_account.move:71-82` | Medium |
| 12 | **No events for failed payments or `SchedulerCap` lifecycle** — off-chain reconciliation is incomplete. | v1 events | Medium |
| 13 | **`process_withdrawal` and `process_withdrawal_scheduler` are 95% duplicated** — maintenance hazard. | `platform_registry.move:362-460` | Low (smell) |
| 14 | **`SchedulerCap` is unmotivated** — it exists so the off-chain bot can sign tx. On-chain, you cannot distinguish a legitimate scheduler from a stolen one. | `platform_registry.move:88-92` | High |
| 15 | **`SubscriptionAccount<SUI>` is allowed** — volatile, defeats the "stablecoin MRR" pitch. The Sui coin standard does not gate against this. | `<T>` parameter | Low for code, high for product |

The v2 design below fixes all 15.

---

## 3. v2 Goals and Non-Goals

### Goals

1. **Mainnet-ready security.** OZ AccessControl for every authority. OZ RateLimiter at every boundary. No custom caps. No off-chain signing authority over user funds.
2. **Clean module boundaries.** Each module has one responsibility and a one-way dependency graph.
3. **Type-extensibility.** New stablecoin types can be added via multisig tx, not package upgrade.
4. **Confidential-transfer readiness.** A `BalanceContainer` abstraction makes adding a confidential balance a new variant, not a new account type.
5. **Agentic-commerce readiness.** A delegated `AccountCap` with a `permissions` bitfield + the embedded `AccessControl` enables sub-capabilities (depositor-only, agent, time-limited) without modifying core.
6. **Permissionless scheduler with circuit breaker.** No signing key. Global `RateLimiter::Bucket` bounds total throughput. Per-platform limiters bound per-platform throughput.
7. **Two-tier upgrade governance.** Critical patches: 3-of-5 multisig + 24h timelock, no veto. Non-critical: 3-of-5 + 7-day + user veto.

### Non-Goals

- **Confidential transfer logic in v2.** The seam is there; the implementation is in `extensions::confidential` later.
- **Agentic commerce logic in v2.** Same — seam is there, implementation later.
- **Stablecoin-issuer hooks.** We do not implement freeze/seize/auditor flows in v2. We detect and reject denied-coin deposits at the boundary (free), and we let the confidential extension integrate with the issuer's CT package when it stabilizes.
- **Fiat on/off ramp.** Out of scope (matches v1).
- **Refunds / disputes.** Out of scope (matches v1).
- **DAO governance.** Two-tier multisig is governance v1. Full on-chain DAO is governance v2, not in this document.

---

## 4. Package Layout

Two packages, separate upgrade policies:

```
packages/
  core/                              <-- never upgraded without 7-day veto
    Move.toml                        (depends on openzeppelin_access, openzeppelin_utils)
    sources/
      version.move                   <-- UpgradeVersion, VERSION_MAJOR/MINOR/PATCH
      access_control.move            <-- role types, AccountCap, AC wiring
      asset.move                     <-- Asset<T>, BalanceContainer (the CT seam)
      account.move                   <-- SubscriptionAccount<T>, deposit/withdraw
      billing.move                   <-- Subscription lifecycle, BillingSchedule
      policies.move                  <-- PolicySet, plugin evaluation
      platform.move                  <-- Platform, tiers, treasury, pending changes
      payment.move                   <-- the single money-moving path
      scheduler.move                 <-- on-chain permissionless PaymentScheduler
      registry.move                  <-- shared CoinTypeRegistry / AccountType registry
  extensions/                        <-- upgradeable, opt-in
    Move.toml                        (depends on core)
    sources/
      confidential.move              <-- subscribes to asset.move's confidential adapter
      agent_pay.move                 <-- delegated AccountCap with budget envelope
      rate_limit_extra.move          <-- additional policy plugins
```

### Why two packages

- **`core/`** is the system of record. Multisig + 7-day timelock + user veto on any change. Every bug fix here is a *fork* of trust.
- **`extensions/`** is where new product features land. Faster review, more permissive upgrade. The CT integration, the agentic pay path, and any future policy plugins live here without risk to the system of record.
- A v3 to v4 migration in `core/` is a generic pattern (consume old struct, mint new struct). An `extensions/` module can be added in one tx without touching core at all.

### Module dependency graph

```
                  ┌──────────────┐
                  │  version     │ (no deps; consulted by all)
                  └──────┬───────┘
                         │
       ┌─────────────────┼─────────────────┐
       │                 │                 │
   ┌───▼────┐    ┌───────▼──────┐   ┌──────▼──────┐
   │registry│    │access_control│   │   asset     │
   └───┬────┘    └───────┬──────┘   └──────┬──────┘
       │                 │                 │
       │        ┌────────┼────────┐        │
       │        │        │        │        │
   ┌───▼────────▼─┐  ┌──▼───┐ ┌──▼────┐ ┌──▼────┐
   │  account     │  │policies│ │platform│ │billing│
   └───┬────────┬─┘  └────┬───┘ └──┬────┘ └──┬────┘
       │        │         │        │         │
       └────┬───┘         │        │         │
            │             │        │         │
            ▼             ▼        ▼         │
         ┌──────────────────────────────┐    │
         │          payment             │◄───┘
         └──────────────┬───────────────┘
                        │
                        ▼
                   ┌──────────┐
                   │scheduler │
                   └──────────┘

extensions/confidential  →  asset, account, billing, payment (consumes, not modifies)
extensions/agent_pay     →  account, payment, policies
```

The graph is acyclic and one-way. `core` does not import from `extensions`. `extensions` modules may consume `core` only.

---

## 5. Data Structures

### 5.1 `Asset<T>` and `BalanceContainer` (the CT seam)

```move
// packages/core/sources/asset.move

public struct Asset<phantom Tag> has copy, drop, store {
    _tag: std::type_name::TypeName,
}

public fun public<T>(): Asset<T> {
    Asset { _tag: std::type_name::with_original_ids<T>() }
}

/// Pluggable balance container. v2 ships only `PublicBalance<T>`;
/// `ConfidentialBalance<T>` is added later in extensions::confidential.
public struct BalanceContainer has store, drop {
    variant: u8,
    // variant 0: PublicBalance<T>       { balance: Balance<T> }
    // variant 1: ConfidentialBalance<T> { ctoken_id: ID, public_pending: Balance<T> }
    // The fields are encoded in a single `bytes` blob for forward-compat.
    bytes: vector<u8>,
}

/// Abstract interface implemented per variant.
public fun view_value<T>(c: &BalanceContainer, clock: &Clock): u64;
public fun try_withdraw<T>(c: &mut BalanceContainer, amount: u64, ctx: &mut TxContext): Balance<T>;
public fun deposit<T>(c: &mut BalanceContainer, coin: Coin<T>, ctx: &mut TxContext);
public fun is_denied_for<T>(c: &BalanceContainer, addr: address): bool;  // CT-specific
```

The point: **the core does not know or care** whether the value is in a public `Balance<T>` or a confidential `TokenAccount<T>`. It calls the abstract interface. When CT stabilizes on mainnet, you add `ConfidentialBalance<T>` as a new variant in `extensions/confidential.move` and the contract gains a new asset class without touching `account`, `billing`, `policies`, or `payment`.

### 5.2 `SubscriptionAccount<T>`

```move
// packages/core/sources/account.move

public struct SubscriptionAccount<phantom T> has key, store {
    id: UID,
    /// Embedded per-account AccessControl. The user holds a discoverable
    /// `AccountCap`; this AC backs fine-grained role checks inside functions.
    access_control: AccessControl<CORE>,
    /// Per-account asset metadata. Resolved at creation from CoinTypeRegistry.
    account_type: AccountType,
    /// v2: public balance via BalanceContainer. Future: confidential via extension.
    balance: BalanceContainer,
    /// Subscriptions remain embedded in a VecMap, per project rules in CLAUDE.md.
    /// Versioned wrapper enables in-place upgrade from V1 to V2 etc.
    subscriptions: VecMap<ID, SubscriptionV1>,
    /// Plugin-based policy set. v2: per-account only. Platform-wide minimums in
    /// `extensions::agent_pay` / `extensions::rate_limit_extra`.
    policies: PolicySet,
    /// Lifecycle status. Pause cascades to subscriptions (BUG FIX #8).
    status: AccountStatus,
    /// Creation timestamp.
    created_at: u64,
    /// Per-account replay nonce. Bumped on every successful payment.
    nonce: u64,
    /// v2 protocol version. Bumped on account-creating migration.
    version: u16,
}

public struct AccountCap has key {
    id: UID,
    account_id: ID,
    /// Actually-enforced permission bitfield (BUG FIX #1).
    /// OWNER=1, DEPOSITOR=2, AGENT=4.
    permissions: u32,
    /// Cap version, bumped when permissions are extended or revoked.
    version: u8,
    created_at: u64,
}
```

`AccountCap` is `key` only, not `store` — non-transferable by default. Delegation works by minting a new `AccountCap` with restricted `permissions` and granting the matching role on the embedded `AccessControl`. The cap is the **discovery handle** (visible in the wallet); the `AccessControl` is the **authority**.

### 5.3 `SubscriptionV1`

```move
public struct SubscriptionV1 has store, drop {
    platform_id: ID,
    tier_index: u64,
    tier_amount: u64,
    tier_frequency_ms: u64,
    /// NEW: explicit denomination, set at creation from CoinTypeRegistry.
    /// Enforced at payment time (BUG FIX #3).
    denomination: AccountType,
    status: SubscriptionStatus,
    schedule: BillingSchedule,
    total_paid: u64,
    payment_count: u64,
    /// NEW: retry state (BUG FIX #11).
    last_attempt_time: u64,
    attempt_count: u8,
    max_attempts: u8,
    /// NEW: nonce consumed on each successful payment.
    nonce: u64,
    created_at: u64,
    updated_at: u64,
    /// Optional metadata for v2+ extensions (e.g. confidential cap reference).
    extensions: std::option::Option<std::type_name::TypeName>,
}
```

Versioned wrapper: when v3 needs new fields, we ship `SubscriptionV2 has key, store` with a `migrate(v1: SubscriptionV1): SubscriptionV2` function. Existing accounts migrate explicitly.

### 5.4 `PolicySet`

```move
public struct PolicySet has store, drop {
    per_tx: std::option::Option<PerTxPolicy>,
    monthly: std::option::Option<MonthlyPolicy>,
    min_balance: std::option::Option<MinBalancePolicy>,
    frequency: std::option::Option<FrequencyPolicy>,
}

public struct PerTxPolicy has store, drop {
    max_amount: u64,
    /// Cooldown: one charge per billing cycle, enforced at successful record_payment.
    rate_limiter: RateLimiter,
}

public struct MonthlyPolicy has store, drop {
    max_monthly: u64,
    /// FixedWindow: monthly reset.
    rate_limiter: RateLimiter,
}

public struct MinBalancePolicy has store, drop { min_balance: u64 }
public struct FrequencyPolicy has store, drop {
    max_per_interval: u64,
    refill_amount: u64,
    refill_interval_ms: u64,
    rate_limiter: RateLimiter,
}
```

`PolicySet::evaluate` runs in two passes:

1. **Project, do not mutate.** For each `Some(policy)`, call `rate_limiter::available(clock)` (read-only) and compare against the requested amount. Build `vector<PolicyFailure>` with the specific reason.
2. **Consume on success.** Only if all checks pass, call `rate_limiter::try_consume` in a single ordered sweep.

This fixes the bug in the v2 proposal where a failed `evaluate` would still burn tokens from a `Bucket`.

### 5.5 `Platform`

```move
public struct Platform has key, store {
    id: UID,
    access_control: AccessControl<CORE>,
    treasury: address,
    /// Timelocked treasury change (BUG FIX on treasury hijack).
    pending_treasury: std::option::Option<PendingTreasuryChange>,
    name: std::string::String,
    description: std::string::String,
    category: std::string::String,
    webhook_url: std::option::Option<std::string::String>,
    is_verified: bool,
    /// BUG FIX #6: actually updated by create_subscription and cancel.
    subscriber_count: u64,
    created_at: u64,
    status: PlatformStatus,
    tiers: VecMap<u64, SubscriptionTier>,
    /// Per-platform withdrawal volume cap (FixedWindow 30d, $X).
    volume_limiter: RateLimiter,
    /// Per-platform withdrawal frequency cap (Bucket, N per hour).
    frequency_limiter: RateLimiter,
    /// NEW: how many distinct accounts can be billed per window (DoS bound).
    account_billing_limiter: RateLimiter,
    version: u16,
}

public struct PendingTreasuryChange has store, drop {
    new_treasury: address,
    execute_after_ms: u64,
}
```

Treasury change is a two-step flow: admin calls `propose_treasury_change(new_addr)` (writes to `pending_treasury`, sets `execute_after_ms = now + 48h`, emits `TreasuryChangeProposed`); anyone calls `accept_treasury_change(platform, clock)` after the timelock. A compromised admin key thus has a 48-hour cancel window — same pattern as the OZ root-role timelock, but stored per-Platform for the off-the-shelf case.

### 5.6 `PaymentScheduler`

```move
public struct PaymentScheduler has key {
    id: UID,
    /// Global circuit breaker: 10k payments per refill interval, 1k refill per hour.
    /// Bounds the worst case of a malicious scheduler bot burning gas.
    global_limiter: RateLimiter,
    /// Multisig-pausable kill switch (separate from OZ access pause).
    pause_flag: bool,
    last_processed_at: u64,
    version: u16,
}
```

`init(ctx)` (one-time) mints the shared `PaymentScheduler` and grants `PLATFORM_GLOBAL_ADMIN_ROLE` to the multisig.

### 5.7 `CoinTypeRegistry`

```move
public struct CoinTypeRegistry has key {
    id: UID,
    /// TypeName -> AccountType. Set by multisig tx.
    coin_to_account_type: Table<TypeName, AccountType>,
    /// AccountType -> metadata (name, decimals, issuer, future: CT auditor pks).
    account_types: Table<u8, AccountTypeInfo>,
    /// Only the multisig can call register/remove.
    multisig_address: address,
}

public enum AccountType has copy, drop, store {
    USDC,
    USDSui,
    // Future variants are added via multisig tx, not package upgrade.
}
```

This resolves the v2 proposal's open question #1: stablecoin diversity is **governance-extensible**, not type-frozen.

---

## 6. Module Specifications

### 6.1 `core::version`

Central place for protocol-wide version constants. `VERSION_MAJOR: u16 = 2`, `VERSION_MINOR: u16 = 0`, `VERSION_PATCH: u16 = 0`. Every `init` and every migration bumps the right field. Migration functions in core and extensions read the current value to decide whether to apply.

### 6.2 `core::access_control`

The single role registry per module. Defines:

```move
public struct CORE has drop {}
public struct PLATFORM_ADMIN_ROLE        {}
public struct PLATFORM_SCHEDULER_ROLE   {}
public struct PLATFORM_TREASURY_ROLE    {}
public struct PLATFORM_GLOBAL_ADMIN_ROLE {}    // for global scheduler pause
public struct ACCOUNT_OWNER_ROLE         {}
public struct ACCOUNT_DEPOSITOR_ROLE     {}
public struct ACCOUNT_AGENT_ROLE         {}    // agentic commerce seam
public struct REGISTRY_ADMIN_ROLE        {}    // for CoinTypeRegistry
```

Each `Platform` and each `SubscriptionAccount` embeds `AccessControl<CORE>`. Role types live in the same module as the OTW — OZ invariant.

`AccessControl` is a `Table<TypeName, RoleData>` under the hood. The user-facing wallet object is still `AccountCap`. The cap is checked at PTB start (mints a witness), the witness is consumed by gated functions.

### 6.3 `core::asset`

The seam. Defines `Asset<T>`, `BalanceContainer`, the public-balance implementation, and the abstract interface. Public functions: `public<T>(): Asset<T>`, `new_public_balance<T>(): BalanceContainer`, plus the four interface functions `view_value`, `try_withdraw`, `deposit`, `is_denied_for`.

`is_denied_for` returns `false` for public balances; the confidential extension overrides.

### 6.4 `core::account`

The `SubscriptionAccount<T>`. Public surface:

```move
public fun create_account<T>(
    asset: Asset<T>,
    initial_policies: PolicySet,
    access_control: &mut AccessControl<CORE>,    // must be granted ACCOUNT_OWNER_ROLE
    registry: &CoinTypeRegistry,
    clock: &Clock,
    ctx: &mut TxContext,
): (SubscriptionAccount<T>, AccountCap);

public fun deposit<T>(
    cap: &AccountCap,                              // OR Auth<ACCOUNT_DEPOSITOR_ROLE>
    account: &mut SubscriptionAccount<T>,
    coin: Coin<T>,
    registry: &CoinTypeRegistry,                   // for denom check + deny list
    clock: &Clock,
    ctx: &mut TxContext,
);

public(package) fun withdraw<T>(                  // internal — payment.move is the only caller
    account: &mut SubscriptionAccount<T>,
    amount: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): Balance<T>;

public fun pause_account<T>(...);                  // cascades to subscriptions
public fun resume_account<T>(...);
public fun close_account<T>(...);
public fun update_policies<T>(...);                // replaces the whole PolicySet
public fun mint_delegated_cap<T>(...);             // for agentic commerce seam
```

`withdraw` is `public(package)` so only `payment.move` can call it. Combined with the access control check in `payment`, the user funds are protected against any non-payment-path code.

### 6.5 `core::billing`

Subscription lifecycle. `create_subscription`, `pause_subscription`, `resume_subscription`, `cancel_subscription`, `record_payment`, `record_failed_payment`, `can_bill`. Calendar-accurate via `clock.timestamp_ms()` (BUG FIX #7). `record_payment` is called by `payment.move` and is the function that arms the per-cycle `PerTxPolicy` cooldown — the cooldown is *armed at successful payment*, not at consume (fixes the v2 proposal mis-model).

### 6.6 `core::policies`

`PolicySet` and its evaluation. `evaluate` follows the two-pass projection-then-consume order described in §5.4. Returns a typed `PolicyFailure` vector with reason enums, not raw error codes — events can show *which* policy failed and *why*, not just "yes/no" booleans.

### 6.7 `core::platform`

Platform registration, tier management, treasury, limiters. Public surface: `register_platform`, `update_platform`, `create_tier`, `update_tier`, `deactivate_tier`, `propose_treasury_change`, `accept_treasury_change`, `cancel_treasury_change`, view functions. The platform's `AccessControl` gates admin/scheduler/treasury.

### 6.8 `core::payment`

The single money-moving path. One function:

```move
public fun process_due_payment<T>(
    scheduler: &mut PaymentScheduler,
    platform: &Platform,
    account: &mut SubscriptionAccount<T>,
    policies: &PolicySet,                          // OR pull from account.policies
    clock: &Clock,
    ctx: &mut TxContext,
);
```

Inside, in order:

1. Global circuit breaker: `scheduler.global_limiter.try_consume(1, clock)`.
2. Pause check: `!scheduler.pause_flag`.
3. Platform subscription exists, status is active, `can_bill == true`.
4. Denomination match: `account.account_type == sub.denomination` (BUG FIX #3).
5. Amount is exactly `sub.tier_amount` (BUG FIX #5).
6. Platform auth: `Auth<PLATFORM_SCHEDULER_ROLE>` is valid for the *platform's* AC.
7. Platform rate limiters: `volume_limiter`, `frequency_limiter`, `account_billing_limiter`.
8. Policy eval: two-pass projection-then-consume.
9. Withdraw from account: `account.withdraw(amount)`.
10. `record_payment` on the subscription: advances schedule, bumps `nonce`, arms per-cycle cooldown.
11. Transfer to platform treasury: `transfer::public_transfer(coin, platform.treasury)`.
12. Emit `PaymentProcessed` event with full policy results.

`process_due_payment` is **the only function that moves money**. There is no `SchedulerCap` (BUG FIX #14). To stop a malicious bot, the platform admin revokes `PLATFORM_SCHEDULER_ROLE`. To stop a compromised platform, the multisig flips `scheduler.pause_flag`.

### 6.9 `core::scheduler`

The shared `PaymentScheduler` object. `init` mints it, grants the multisig `PLATFORM_GLOBAL_ADMIN_ROLE`. Public surface: `process_due_payment` (delegates to `payment.move`), `pause`, `unpause`, `last_processed_at`, view functions.

Anyone can call `process_due_payment` — there is no `signer` check on the caller. The function is gated by the platform's pre-authorized scheduler role (minting `Auth` internally) and the global limiter. **The off-chain indexer becomes read-only.** No signing key, no `SCHEDULER_SECRET`, no SPOF (BUG FIX #2).

### 6.10 `core::registry`

The `CoinTypeRegistry`. Multisig-only `register_coin_type<T>(info: AccountTypeInfo)`, `remove_coin_type<T>`, `set_account_type_metadata`. Resolves v2 proposal open question #1 in favor of governance extensibility.

### 6.11 `extensions::confidential` (shipped later)

Implements the `ConfidentialBalance<T>` variant of `BalanceContainer`. Wraps a `TokenAccount<T>` from `MystenLabs/confidential-transfers`. When the public package stabilizes on mainnet, this module is added in a single tx. Core does not change.

### 6.12 `extensions::agent_pay` (shipped later)

Implements delegated payment from an agent address on behalf of the user. Adds a `Payment::agent_pay` entry point that:

1. Verifies caller is in `ACCOUNT_AGENT_ROLE` holders.
2. Verifies cumulative agent spend this month is within the `agent_budget` field (which lives in the account, not in core).
3. Otherwise identical to `process_due_payment` minus the per-cycle frequency check.

---

## 7. Key Architectural Decisions

### 7.1 Two access mechanisms: `AccountCap` (discovery) + OZ `Auth<Role>` (authority)

The v2 draft waffled between Option A (keep `AccountCap`) and Option B (replace with OZ Auth). This v2 picks **both**:

- `AccountCap` is the user-owned, wallet-visible discovery handle. It carries a `permissions: u32` bitfield (BUG FIX #1) and a `version: u8`. The wallet shows it; the user signs with it.
- The cap is presented in PTBs and gates `new_auth` calls against the embedded `AccessControl`. The actual `Auth<ACCOUNT_OWNER_ROLE>` witness is minted at call time, used once, dropped.
- Delegation: user calls `mint_delegated_cap(permissions = DEPOSITOR)` and grants the depositor address `ACCOUNT_DEPOSITOR_ROLE` on the embedded AC. The delegated cap is itself a `key`-only object held by the depositor.

This is the correct interpretation. OZ Auth alone is fine for the platform side (where the user rarely interacts); for the user side, the wallet-visible cap is what users expect.

### 7.2 Embedded `AccessControl` per Platform AND per Account

`Platform` and `SubscriptionAccount` each embed their own `AccessControl<CORE>`. The OTW + same-module invariant (OZ invariant 2) means foreign role types are rejected at the boundary, and the singleton-per-module rule means there is exactly one `AccessControl<CORE>` per `Platform` and one per `SubscriptionAccount`.

Storage cost: ~2KB per object for the `Table<TypeName, RoleData>`. For 1000 platforms and 100k accounts, ~200MB on-chain. Cheap insurance for blast-radius isolation.

### 7.3 On-chain permissionless scheduler

Eliminates the off-chain `SCHEDULER_SECRET` (BUG FIX #2, BUG FIX #14). Anyone can call `process_due_payment`. The function is gated by the platform's pre-authorized `PLATFORM_SCHEDULER_ROLE` (any caller can submit; the authority comes from the platform's pre-existing grant). The global `RateLimiter::Bucket` is the circuit breaker.

This is the design the v2 draft proposed; v2 makes the role-grant semantic explicit.

### 7.4 Two-pass policy evaluation

Project first, consume on success. Fixes the v2-draft bug where a failed `evaluate` would still burn tokens. Events emit the full `vector<PolicyFailure>` with reason enums, not boolean flags.

### 7.5 `BalanceContainer` as the CT seam

`BalanceContainer` is a tagged variant that can hold either a public `Balance<T>` or a confidential reference. The interface (`view_value`, `try_withdraw`, `deposit`, `is_denied_for`) is fixed; implementations are pluggable. Core never knows which variant is in use. When CT ships, `extensions::confidential` adds the new variant.

### 7.6 Versioned subscription structs

`SubscriptionV1` is the v2 wire format. `SubscriptionV2`, when needed, adds fields (e.g. confidential cap reference) and includes a `migrate(v1: SubscriptionV1): SubscriptionV2` function. The pattern is generic: every version bump is a structured migration with a single entry point and explicit field-level rationale.

### 7.7 Pause cascade

Pausing the account cascades to all active subscriptions. `pause_account` walks `account.subscriptions`, sets each active subscription to paused, emits `AccountPaused { subscription_count }`. `resume_account` does not auto-resume subscriptions; the user must do that explicitly to prevent surprise billing.

### 7.8 Timelocked treasury changes

Two-step `propose_treasury_change` → `accept_treasury_change` (48h) pattern, similar to OZ root-role transfer. Closes the v1 hijack gap.

---

## 8. Events

Every state transition emits a typed event. Events are versioned: a `v: u16` field on every event payload. Indexers can use this to discriminate v2 from v3 events without parsing the type string.

| Event | Trigger | Key fields |
|-------|---------|------------|
| `AccountCreated` | create_account | account_id, cap_id, owner, account_type, v |
| `Deposit` | deposit | account_id, depositor, amount, new_balance, v |
| `Withdrawal` | withdraw (internal) | account_id, amount, remaining_balance, v |
| `PolicyUpdated` | update_policies | account_id, old_set, new_set, v |
| `AccountPaused` | pause_account | account_id, subscription_count, v |
| `AccountResumed` | resume_account | account_id, v |
| `SubscriptionCreated` | create_subscription | account_id, platform_id, tier_index, denomination, v |
| `SubscriptionUpdated` | update_subscription_* | account_id, platform_id, change_kind, v |
| `SubscriptionCancelled` | cancel_subscription | account_id, platform_id, v |
| `PaymentProcessed` | process_due_payment | account_id, platform_id, amount, policy_results, nonce, v |
| `PaymentFailed` | process_due_payment failure | account_id, platform_id, amount, reason, v |
| `PlatformRegistered` | register_platform | platform_id, owner, v |
| `PlatformUpdated` | update_platform | platform_id, v |
| `TierCreated` | create_tier | platform_id, tier_index, v |
| `TierUpdated` | update_tier | platform_id, tier_index, v |
| `TierDeactivated` | deactivate_tier | platform_id, tier_index, v |
| `TreasuryChangeProposed` | propose_treasury_change | platform_id, new_treasury, execute_after_ms, v |
| `TreasuryChangeAccepted` | accept_treasury_change | platform_id, new_treasury, v |
| `TreasuryChangeCancelled` | cancel_treasury_change | platform_id, v |
| `SchedulerPaused` | pause | multisig, v |
| `SchedulerResumed` | unpause | multisig, v |
| `CoinTypeRegistered` | register_coin_type | type_name, account_type, v |
| `CoinTypeRemoved` | remove_coin_type | type_name, v |
| `MigrationApplied` | migrate_v1_to_v2 / SubscriptionV1→V2 | source_version, target_version, account_id, v |

The `v` field is bumped when the *event shape* changes. Adding a new field is a minor version bump; renaming or removing is a major version bump that requires a migration.

---

## 9. Upgrade Governance

### 9.1 Two-tier model

- **Tier 1 (critical security patches)**: 3-of-5 multisig, 24-hour timelock, no user veto. The multisig declares "this is critical" at proposal time; that declaration is itself a public event for accountability.
- **Tier 2 (non-critical upgrades)**: 3-of-5 multisig, 7-day timelock, user veto. During the 7-day window, any account owner can call `veto_upgrade(proposal_id)`. If vetoes exceed 10% of the snapshot total (snapshot taken at timelock start), the upgrade is automatically cancelled.

### 9.2 Per-package policies

- `core/`: Tier 2 by default. Tier 1 only for active exploits.
- `extensions/`: Tier 1 by default (smaller blast radius; faster iteration).

### 9.3 Recommended multisig composition

- 2 internal team members
- 1 external security researcher (independent)
- 2 community members (elected or appointed, depending on governance maturity)

This composition balances accountability and independence. Adjust as the community grows.

### 9.4 Upgrade-cap lifecycle

- v2 ships with the upgrade cap held by the multisig. **Not burned.**
- v2 → v3 transitions preserve the upgrade cap on the multisig.
- If at some point the community wants to renounce the upgrade cap on `core/`, that itself goes through the Tier 2 process with a 30-day timelock.

---

## 10. v1 → v2 Migration

### 10.1 Strategy

```
v1 (current)        v2 (new package)              v2 (after window)
─────────────────   ──────────────────────────    ─────────────────
live                live                          live (v1 frozen)
                    optional: migrate v1 → v2      required: any new account
                    3–6 month window              must be v2
```

The v1 package is **left alive** throughout the window. Its events remain queryable. The v1 contract is not upgraded.

A separate migration package `packages/migrate/` depends on both v1 and v2 and exposes one function:

```move
public fun migrate_v1_account<T>(
    v1_account: V1SubscriptionAccount<T>,
    v1_cap: V1AccountCap,
    registry_v2: &mut CoinTypeRegistry,
    clock: &Clock,
    ctx: &mut TxContext,
): (V2SubscriptionAccount<T>, V2AccountCap);
```

Inside: read v1 balance, transfer it into a v2 `BalanceContainer::PublicBalance`, walk v1 `subscriptions` and re-insert as `SubscriptionV1`, mint v2 `AccountCap`, emit `MigrationApplied`. The v1 account and cap are consumed (move-semantics: the migration function takes them by value).

### 10.2 Migration window

- 3–6 months active. After that, v1 is **frozen** — its contract code is not changed, but the frontends and indexer no longer index new v1 events.
- Existing v1 accounts that haven't migrated continue to work via v1 contracts; they just don't get the v2 features (no CT, no agent pay, no per-cycle cooldown arms).
- A v1 account owner can migrate any time; the migration is one tx and is atomic.

### 10.3 What does NOT migrate

- The off-chain `SCHEDULER_SECRET` is gone. v1 platforms that used it must mint a `PLATFORM_SCHEDULER_ROLE` member for their bot, or let the v2 permissionless scheduler handle them.
- v1 `SchedulerCap` objects become inert. They still exist on-chain; they just have no caller in v2.
- v1 `PlatformOwnerCap` is replaced by the platform's `AccessControl` admin role on migrate. The migrate function calls `grant_role<_, PLATFORM_ADMIN_ROLE>(v1_owner, ctx)` on the new v2 platform.

---

## 11. Comparison: v1 vs v2

| Property | v1 | v2 |
|----------|----|----|
| Access control | Custom caps (`AccountCap`, `PlatformOwnerCap`, `SchedulerCap`) | OZ AccessControl with `Auth<Role>`, embedded per Platform and per Account |
| User-side auth | `AccountCap` with decorative `permissions` (BUG #1) | `AccountCap` with enforced `permissions` bitfield + OZ `Auth<Role>` as the actual gate |
| Denomination | None — `T` is the only discriminator (BUG #3) | `AccountType` field, looked up in `CoinTypeRegistry` at create, enforced at payment |
| Rate limiting | `min_frequency_days` blunt check | OZ RateLimiter (Bucket / FixedWindow / Cooldown) at 6+ levels |
| Policy model | Monolithic `PolicyConfig` struct | Plugin `PolicySet`, two-pass evaluation, typed `PolicyFailure` reasons |
| Subscription storage | Embedded `VecMap<ID, Subscription>` (kept) | Same, but versioned (`SubscriptionV1` wrapper, with retry state) |
| Tier amount enforcement | None (BUG #5) | Enforced at payment time |
| Treasury change | Direct, no timelock | Two-step with 48h timelock |
| Pause cascade | Account pause ≠ subscription pause (BUG #8) | Account pause cascades to subscriptions |
| Month math | Approximate `(days/30)*30` (BUG #7) | Real clock timestamps |
| Batch operations | `&mut vector<Account>` (dead code, BUG #4) | Per-account PTB, parallel execution |
| Upgrade path | None | Versioned structs + migration package |
| Platform rate limit | None | Volume + frequency + distinct-account-billing |
| Global circuit breaker | None | On-chain `PaymentScheduler` with Bucket limiter + pause flag |
| Scheduler signing | Single Ed25519 key on server (BUG #2) | None — permissionless on-chain entry point |
| Stablecoin support | Generic `<T>`, SUI allowed (BUG #15) | `CoinTypeRegistry`, multisig-extensible, SUI explicitly not registered |
| Confidental transfer | None | `BalanceContainer` seam, `extensions::confidential` ships later |
| Agentic commerce | None | `AccountCap.permissions` + `ACCOUNT_AGENT_ROLE` + `extensions::agent_pay` ships later |
| Upgrade governance | Single deployer key | Two-tier multisig with user veto for `core/`, Tier 1 only for `extensions/` |
| Failed payment handling | Schedule stuck on first failure (BUG #11) | `last_attempt_time`, `attempt_count`, `max_attempts` on `SubscriptionV1` |
| `subscriber_count` | Never updated (BUG #6) | Updated on subscribe and cancel |

---

## 12. Implementation Phases

| Phase | Modules | Duration | Exit criterion |
|-------|---------|----------|----------------|
| 1 | `version`, `access_control`, `asset` (public only), `registry` | 2–3 weeks | All unit tests pass, OZ deps compile, `CoinTypeRegistry::register_coin_type` round-trips |
| 2 | `account`, `billing` | 2–3 weeks | Create/deposit/pause/subscribe/record_payment all observable; `SubscriptionV1` serialization stable |
| 3 | `policies`, `payment` | 2–3 weeks | Full payment flow; all 6 policy failure paths tested |
| 4 | `platform` | 2 weeks | Register, tier management, treasury timelock round-trip |
| 5 | `scheduler` | 1–2 weeks | Permissionless caller, global limiter, pause flag |
| 6 | Integration tests + devnet deploy | 1–2 weeks | ≥1000 due payments across 5 platforms with no double-charges |
| 7 | Migration package | 1 week | All v1 fixtures migrate 1:1 |
| 8 | Audit prep + audit | 4–8 weeks | Audit report |
| 9 | Bug bounty (testnet) | 2–4 weeks | No critical-severity findings open for 14 days |
| 10 | Mainnet deploy | 1 week | Multisig holds upgrade cap; first non-critical upgrade via 7-day veto |

Total: 4–6 months for a small team.

---

## 13. Resolved Decisions

The following open questions from the v2 draft are now resolved:

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | AccountCap vs OZ Auth for user accounts | **Both, distinct roles** | `AccountCap` is the discovery handle; OZ `Auth<Role>` is the authority. The cap is presented in PTBs and mints the witness at call time. |
| 2 | Scheduler model | **On-chain permissionless, rate-limited** | The function is callable by anyone; authority comes from the platform's pre-authorized `PLATFORM_SCHEDULER_ROLE`; circuit breaker is the global `RateLimiter::Bucket`. |
| 3 | Stablecoin diversity | **`CoinTypeRegistry`, governance-extensible** | Multisig tx adds new coin types. USDC and USDSui ship pre-registered. SUI is not registered (intentional). |
| 4 | Upgrade governance | **Two-tier multisig with user veto** | 3-of-5 multisig. Tier 1 (critical): 24h, no veto. Tier 2 (non-critical): 7d + user veto. Per-package: `core/` = Tier 2 default, `extensions/` = Tier 1 default. |
| 5 | Confidential transfer readiness | **`BalanceContainer` seam, no CT logic in v2** | `extensions::confidential` ships when CT stabilizes on mainnet. Core is asset-agnostic. |
| 6 | Agentic commerce readiness | **`AccountCap.permissions` + `ACCOUNT_AGENT_ROLE` seam** | `extensions::agent_pay` ships separately. Core exposes `mint_delegated_cap` for the user. |
| 7 | Per-tx policy semantics | **Cooldown armed at successful payment, not at consume** | A Cooldown with `capacity = max_amount` does not enforce "one charge per cycle" unless the gate is armed by `record_payment`. |
| 8 | Policy eval order | **Project first, consume on success** | Fixes the "burn tokens on failed evaluate" bug in the v2 draft. |

---

## 14. Open Questions

These are product/business decisions, not architecture:

1. **Multisig composition.** The 3-of-5 split is a recommendation. Final composition depends on community input and may shift as the protocol grows.
2. **Veto threshold.** 10% is a placeholder. The threshold needs to balance "veto should be hard to weaponize" against "veto should not be ignorable."
3. **Migration window length.** 3–6 months is a recommendation. Final length depends on observed migration rate.
4. **Initial stablecoin list.** USDC and USDSui are confirmed (per `intent.md`). Other coins are added by multisig later.
5. **Agent budget enforcement.** `extensions::agent_pay` needs a per-agent spend cap. The exact model (per-month vs per-day vs lifetime) is a product decision.

---

## 15. References

- **OpenZeppelin Contracts for Sui**: [https://github.com/OpenZeppelin/contracts-sui](https://github.com/OpenZeppelin/contracts-sui)
  - [`rate_limiter.move`](https://github.com/OpenZeppelin/contracts-sui/blob/main/contracts/utils/sources/rate_limiter.move)
  - [`access_control.move`](https://github.com/OpenZeppelin/contracts-sui/blob/main/contracts/access/sources/access_control.move)
- **Sui Confidential Transfers**: [https://github.com/MystenLabs/confidential-transfers](https://github.com/MystenLabs/confidential-transfers)
  - [`contra.move`](https://github.com/MystenLabs/confidential-transfers/blob/main/move/sources/contra.move) — public `Coin<T>` ↔ confidential `TokenAccount<T>` wrap/unwrap
  - [`twisted_elgamal.move`](https://github.com/MystenLabs/confidential-transfers/blob/main/move/sources/twisted_elgamal.move) — encryption primitive
- **Sui Confidential Transfers announcement**: [https://blog.sui.io/confidential-transfers-public-beta](https://blog.sui.io/confidential-transfers-public-beta) (2026-06-08)
- **Move Book**: [https://move-book.com/](https://move-book.com/)
- **Sui Docs**: [https://docs.sui.io/](https://docs.sui.io/)
- **Sui Move examples**: [https://github.com/MystenLabs/sui/tree/main/examples/move](https://github.com/MystenLabs/sui/tree/main/examples/move)

---

*Document Version: 2.0.0*
*Last Updated: 2026-06-09*
*Prepared by: Architecture Review*
*Supersedes: architecture-proposal.md (2.0.0-draft)*
