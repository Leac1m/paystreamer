// Copyright (c) leac1m
// SPDX-License-Identifier: Apache-2.0

/// `SubscriptionAccount<T>` — the core user-facing object in PayStreamer v2.
///
/// This module owns:
/// 1. The `SubscriptionV1` value type (per Option C in the design notes:
///    declared here with the full field set; `billing.move` augments with
///    mutators and event emissions without redefining the type).
/// 2. The `PolicySet` value type (same pattern; `policies.move` augments
///    with evaluation, two-pass consume, and event emissions).
/// 3. The `AccountStatus` lifecycle enum (active / paused / closed).
/// 4. The shared `SubscriptionAccount<T>` object plus its discovery
///    handle `AccountCap`.
///
/// ## Authority model (architecture §7.1)
///
/// The v2 authority model is `AccountCap` (discovery) + `AccountCap.permissions`
/// (bitfield authority). There is no embedded `AccessControl<ACCESS_CONTROL>`
/// per account: the OZ `AccessControl` consumes its OTW exactly once at
/// `init`, so per-account ACs are infeasible (and unnecessary — see
/// `access_control.move`). Role checks in this module therefore consult
/// `has_permission(cap, perm)` against the bitfield on the cap, not an
/// embedded AC.
///
/// Per the v2 design doc (§5.2, §6.4, §7.7), this module:
///
/// - holds a `BalanceContainer<T>` (the CT seam; never a raw `Balance<T>`);
/// - holds a `VecMap<ID, SubscriptionV1>` per the project rules
///   (CLAUDE.md: subscriptions remain embedded, not standalone objects);
/// - cascades `pause_account` to all active subscriptions (BUG FIX #8);
/// - exposes `internal_withdraw` as `public(package)` so only
///   `payment.move` can call it (the only money-moving path);
/// - emits `v: u16 = 2` on every event for indexer discrimination.
///
/// ## Build-order note
///
/// `SubscriptionV1` and `PolicySet` are declared here per Option C of the
/// design notes. Downstream `billing.move` and `policies.move` add
/// behavior (mutators, event emissions, evaluation) without redefining
/// the types. The v1 module at `move/subscriptions/sources/subscription_account.move`
/// is the style reference for header, imports, and sectioning.
#[allow(lint(share_owned, custom_state_change))]
module paystreamer_v2::account {
    use sui::object;
    use sui::coin::{Self, Coin};
    use sui::balance::Balance;
    use sui::clock::Clock;
    use sui::vec_map::{Self, VecMap};
    use sui::event;
    use sui::transfer;
    use sui::tx_context::TxContext;
    use paystreamer_v2::access_control::{
        Self as ac,
        AccountCap,
        new_account_cap,
        has_permission,
        permission_owner,
    };
    use paystreamer_v2::asset::{Self, BalanceContainer};
    use paystreamer_v2::registry::{Self, CoinTypeRegistry, AccountType};
    use paystreamer_v2::version;

    // === SubscriptionV1 (declared here, augmented by billing.move) ===

    /// Per-platform subscription, embedded in the account's
    /// `VecMap<ID, SubscriptionV1>` keyed by `platform_id`. Versioned
    /// wrapper for in-place upgrades (`SubscriptionV2` will be a fresh
    /// type with a `migrate(v1)` function).
    ///
    /// `status: u8` is the lifecycle discriminant: 0 = active, 1 = paused,
    /// 2 = cancelled. Cascading the account-level pause flips active subs
    /// to 1 (paused); resuming the account does NOT flip them back
    /// (design §7.7 — explicit user action required to prevent surprise
    /// billing).
    public struct SubscriptionV1 has store, drop {
        platform_id: ID,
        tier_index: u64,
        tier_amount: u64,
        tier_frequency_ms: u64,
        denomination: AccountType,
        status: u8,
        schedule_frequency_ms: u64,
        next_billing_time: u64,
        last_billing_time: u64,
        total_paid: u64,
        payment_count: u64,
        last_attempt_time: u64,
        attempt_count: u8,
        max_attempts: u8,
        nonce: u64,
        created_at: u64,
        updated_at: u64,
    }

    /// Build a fresh `SubscriptionV1`. The account-module owner holds the
    /// canonical constructor; `billing.move` will expose higher-level
    /// `create_subscription(account, ...)` that calls this. Time fields
    /// are caller-supplied (use `clock.timestamp_ms()`) so the
    /// constructor remains pure and testable.
    public fun new_subscription_v1(
        platform_id: ID,
        tier_index: u64,
        tier_amount: u64,
        tier_frequency_ms: u64,
        denomination: AccountType,
        status: u8,
        schedule_frequency_ms: u64,
        next_billing_time: u64,
        last_billing_time: u64,
        total_paid: u64,
        payment_count: u64,
        last_attempt_time: u64,
        attempt_count: u8,
        max_attempts: u8,
        nonce: u64,
        created_at: u64,
        updated_at: u64,
    ): SubscriptionV1 {
        SubscriptionV1 {
            platform_id,
            tier_index,
            tier_amount,
            tier_frequency_ms,
            denomination,
            status,
            schedule_frequency_ms,
            next_billing_time,
            last_billing_time,
            total_paid,
            payment_count,
            last_attempt_time,
            attempt_count,
            max_attempts,
            nonce,
            created_at,
            updated_at,
        }
    }

    // === SubscriptionV1 accessors ===

    /// `platform_id` (map key).
    /// Role: any caller (read-only view).
    public fun sub_platform_id(s: &SubscriptionV1): ID { s.platform_id }
    /// `tier_index`.
    public fun sub_tier_index(s: &SubscriptionV1): u64 { s.tier_index }
    /// `tier_amount` (smallest unit of `T`).
    public fun sub_tier_amount(s: &SubscriptionV1): u64 { s.tier_amount }
    /// `tier_frequency_ms` between successful payments.
    public fun sub_tier_frequency_ms(s: &SubscriptionV1): u64 { s.tier_frequency_ms }
    /// `denomination` (the `AccountType` the sub is priced in).
    public fun sub_denomination(s: &SubscriptionV1): &AccountType { &s.denomination }
    /// `status` (0 active, 1 paused, 2 cancelled).
    public fun sub_status(s: &SubscriptionV1): u8 { s.status }
    /// True iff `status == 0`.
    public fun sub_is_active(s: &SubscriptionV1): bool { s.status == 0 }
    /// True iff `status == 1`.
    public fun sub_is_paused(s: &SubscriptionV1): bool { s.status == 1 }
    /// True iff `status == 2`.
    public fun sub_is_cancelled(s: &SubscriptionV1): bool { s.status == 2 }
    /// `schedule_frequency_ms` (may differ from `tier_frequency_ms` after edits).
    public fun sub_schedule_frequency_ms(s: &SubscriptionV1): u64 { s.schedule_frequency_ms }
    /// `next_billing_time` (ms).
    public fun sub_next_billing_time(s: &SubscriptionV1): u64 { s.next_billing_time }
    /// `last_billing_time` (ms; 0 if never billed).
    public fun sub_last_billing_time(s: &SubscriptionV1): u64 { s.last_billing_time }
    /// `total_paid` lifetime.
    public fun sub_total_paid(s: &SubscriptionV1): u64 { s.total_paid }
    /// `payment_count` lifetime.
    public fun sub_payment_count(s: &SubscriptionV1): u64 { s.payment_count }
    /// `last_attempt_time` ms (for failed-attempt retry).
    public fun sub_last_attempt_time(s: &SubscriptionV1): u64 { s.last_attempt_time }
    /// `attempt_count` (lifetime failed attempts; reset on success).
    public fun sub_attempt_count(s: &SubscriptionV1): u8 { s.attempt_count }
    /// `max_attempts` (per cycle; 0 = no cap).
    public fun sub_max_attempts(s: &SubscriptionV1): u8 { s.max_attempts }
    /// `nonce` (per-subscription replay nonce; bumped on successful payment).
    public fun sub_nonce(s: &SubscriptionV1): u64 { s.nonce }
    /// `created_at` ms.
    public fun sub_created_at(s: &SubscriptionV1): u64 { s.created_at }
    /// `updated_at` ms.
    public fun sub_updated_at(s: &SubscriptionV1): u64 { s.updated_at }

    // === PolicySet (declared here, augmented by policies.move) ===

    /// Per-account policy set. v2 ships a flat structure with raw caps;
    /// `policies.move` will wrap these in `Option<...>` and add the
    /// OZ `RateLimiter` machinery. For now the values are direct caps
    /// (0 = no cap on the corresponding dimension). `update_policies`
    /// replaces the whole struct wholesale.
    public struct PolicySet has store, drop, copy {
        /// Per-transaction maximum amount. `0` = no cap.
        per_tx_max: u64,
        /// Monthly maximum amount. `0` = no cap.
        monthly_max: u64,
        /// Minimum balance that must remain after any withdrawal. `0` = no min.
        min_balance: u64,
        /// Minimum cooldown between attempts. `0` = no cooldown.
        frequency_min_ms: u64,
    }

    /// Empty (no-cap) `PolicySet`. Equivalent to the v1 "effectively
    /// unlimited" defaults and a safe starting point for new accounts.
    /// Role: any caller.
    public fun empty_policy_set(): PolicySet {
        PolicySet { per_tx_max: 0, monthly_max: 0, min_balance: 0, frequency_min_ms: 0 }
    }

    /// Custom `PolicySet` constructor. `0` on any field means "no cap
    /// for this dimension" (semantics defined by `policies.move`).
    /// Role: any caller.
    public fun new_policy_set(
        per_tx_max: u64,
        monthly_max: u64,
        min_balance: u64,
        frequency_min_ms: u64,
    ): PolicySet {
        PolicySet { per_tx_max, monthly_max, min_balance, frequency_min_ms }
    }

    // === PolicySet accessors ===

    /// `per_tx_max` cap.
    public fun policy_per_tx_max(p: &PolicySet): u64 { p.per_tx_max }
    /// `monthly_max` cap.
    public fun policy_monthly_max(p: &PolicySet): u64 { p.monthly_max }
    /// `min_balance` floor.
    public fun policy_min_balance(p: &PolicySet): u64 { p.min_balance }
    /// `frequency_min_ms` cooldown.
    public fun policy_frequency_min_ms(p: &PolicySet): u64 { p.frequency_min_ms }

    // === AccountStatus ===

    /// Lifecycle status. 0 = active, 1 = paused, 2 = closed. `closed` is
    /// terminal; deposits are rejected. `paused` cascades to subscriptions
    /// but is reversible; `closed` is not.
    public struct AccountStatus has store, drop, copy { variant: u8 }

    /// `AccountStatus::active`.
    public fun account_status_active(): AccountStatus { AccountStatus { variant: 0 } }
    /// `AccountStatus::paused`.
    public fun account_status_paused(): AccountStatus { AccountStatus { variant: 1 } }
    /// `AccountStatus::closed`.
    public fun account_status_closed(): AccountStatus { AccountStatus { variant: 2 } }

    /// Raw `u8` discriminant.
    public fun status_variant(s: &AccountStatus): u8 { s.variant }
    /// True iff `variant == 0`.
    public fun is_active(s: &AccountStatus): bool { s.variant == 0 }
    /// True iff `variant == 1`.
    public fun is_paused(s: &AccountStatus): bool { s.variant == 1 }
    /// True iff `variant == 2`.
    public fun is_closed(s: &AccountStatus): bool { s.variant == 2 }

    // === SubscriptionAccount<T> ===

    /// The user's subscription account. Shared object, phantom-typed by
    /// the denomination. The `AccountCap` minted alongside is the
    /// wallet-visible discovery handle; its `permissions` bitfield is
    /// the authority. The protocol-wide `AccessControl<ACCESS_CONTROL>`
    /// is not embedded here — per-account authority is the
    /// `ac::account_id(cap) == object::id(account)` check plus the
    /// `has_permission(cap, ...)` bitfield test.
    public struct SubscriptionAccount<phantom T> has key, store {
        id: object::UID,
        /// Coin denomination. Set at creation from the registry; immutable
        /// thereafter. Enforced at payment time (BUG FIX #3).
        account_type: AccountType,
        /// Pluggable balance. v2: public via `BalanceContainer<T>`. The
        /// future confidential extension stores its state in
        /// `extension_bytes` (variant 1).
        balance: BalanceContainer<T>,
        /// Per-platform subscriptions, keyed by `platform_id`. The
        /// project rules (CLAUDE.md) keep them embedded; the wrapper
        /// type `SubscriptionV1` enables in-place upgrade to V2.
        subscriptions: VecMap<ID, SubscriptionV1>,
        /// Policy set. Replaced wholesale via `update_policies`.
        policies: PolicySet,
        /// Lifecycle status. Pause cascades to subscriptions; close
        /// is terminal.
        status: AccountStatus,
        /// Creation timestamp (ms, Sui `Clock`).
        created_at: u64,
        /// Per-account replay nonce. Bumped on every successful payment
        /// (via `bump_nonce` from `payment.move`).
        nonce: u64,
        /// Schema version (currently `2`). Bumped on account-creating
        /// migration.
        version: u16,
    }

    // === Errors ===

    /// The cap's `account_id` does not match the account it is being
    /// presented against. Wrong account, not just unauthorized.
    const EInvalidCap: u64 = 0x01001;
    /// The account is paused (`status.variant == 1`).
    #[allow(unused_const)]
    const EAccountPaused: u64 = 0x01002;
    /// The account is closed (`status.variant == 2`).
    const EAccountClosed: u64 = 0x01003;
    /// A zero-amount deposit. Programmer error.
    const EZeroAmount: u64 = 0x01004;
    /// `internal_withdraw` for an amount exceeding live headroom.
    const EInsufficientBalance: u64 = 0x01005;
    /// The coin `T` is not registered in the `CoinTypeRegistry`.
    const ECoinTypeNotRegistered: u64 = 0x01006;
    /// The `u8` discriminant in the registry is non-standard (no built-in
    /// `AccountType` variant). Treat as a misconfiguration.
    const EInvalidDiscriminant: u64 = 0x01007;
    /// The cap's `permissions` bitfield does not include the required
    /// bit. Wrong role.
    const EUnauthorized: u64 = 0x01008;
    /// The cap is present but does not hold the `OWNER` permission;
    /// specifically used by `mint_delegated_cap`.
    const ENotOwnerCap: u64 = 0x01009;
    /// `resume_account` was called on an account that is not paused.
    /// (Reusing `EAccountClosed` would be misleading; this is a separate
    /// programmer-facing condition.)
    const EAccountNotPaused: u64 = 0x0100A;

    // === Events ===
    //
    // All events carry a `v: u16 = 2` field for indexer discrimination
    // (architecture §8). The `v` field is bumped when the event *shape*
    // changes; adding a field is a minor version bump, removing a field
    // is a major version bump that requires a migration.

    /// Emitted on every successful `create_account`. Indexers use
    /// `account_id` as the canonical handle and `cap_id` to discover
    /// the user-facing capability.
    public struct AccountCreated has copy, drop {
        account_id: ID,
        cap_id: ID,
        owner: address,
        account_type: AccountType,
        v: u16,
    }

    /// Emitted on every successful `deposit`. `new_balance` is the
    /// post-deposit headroom.
    public struct Deposit has copy, drop {
        account_id: ID,
        depositor: address,
        amount: u64,
        new_balance: u64,
        v: u16,
    }

    /// Emitted on every successful `pause_account`. Includes
    /// `subscription_count` so off-chain indexers can verify the
    /// cascade without re-walking the `VecMap`.
    public struct AccountPaused has copy, drop {
        account_id: ID,
        subscription_count: u64,
        v: u16,
    }

    /// Emitted on every successful `resume_account`. Subscriptions
    /// are NOT auto-resumed (design §7.7); this event signals
    /// account-level state only.
    public struct AccountResumed has copy, drop {
        account_id: ID,
        v: u16,
    }

    /// Emitted on every successful `close_account`. Terminal.
    public struct AccountClosed has copy, drop {
        account_id: ID,
        v: u16,
    }

    /// Emitted on every successful `update_policies`. Both old and new
    /// sets are returned for off-chain reconciliation.
    public struct PoliciesUpdated has copy, drop {
        account_id: ID,
        old_policies: PolicySet,
        new_policies: PolicySet,
        v: u16,
    }

    // === create_account ===

    /// Create a new `SubscriptionAccount<T>` and mint a fresh `AccountCap`
    /// with the OWNER permission bit set. The coin `T` must be registered
    /// in the `CoinTypeRegistry`; the `AccountType` is resolved at
    /// creation time and stored in the account (BUG FIX #3).
    ///
    /// Returns the account and cap by value. The caller (PTB) is
    /// responsible for `share_account` to share the account and
    /// transfer the cap to the appropriate address. The cap's
    /// `account_id` field is pre-bound to the freshly-minted account.
    ///
    /// #### Aborts
    /// - `ECoinTypeNotRegistered` if `T` is not in the registry.
    /// - `EInvalidDiscriminant` if the registry's `u8` does not map to
    ///   a built-in `AccountType` variant.
    public fun create_account<T>(
        registry: &CoinTypeRegistry,
        initial_policies: PolicySet,
        clock: &Clock,
        ctx: &mut TxContext,
    ): (SubscriptionAccount<T>, AccountCap) {
        let account_type = resolve_account_type<T>(registry);
        let now = clock.timestamp_ms();

        let acct_uid = object::new(ctx);
        let account_id = object::uid_to_inner(&acct_uid);

        let account = SubscriptionAccount<T> {
            id: acct_uid,
            account_type,
            balance: asset::new_public<T>(),
            subscriptions: vec_map::empty(),
            policies: initial_policies,
            status: account_status_active(),
            created_at: now,
            nonce: 0,
            version: 2,
        };

        let cap = new_account_cap(account_id, permission_owner(), now, ctx);
        let cap_id = object::id(&cap);

        event::emit(AccountCreated {
            account_id,
            cap_id,
            owner: ctx.sender(),
            account_type,
            v: 2,
        });

        (account, cap)
    }

    /// Share the account and transfer the cap to `ctx.sender()`. The
    /// typical post-`create_account` step in a PTB:
    ///
    /// ```ignore
    /// let (account, cap) = account::create_account<T>(...);
    /// account::share_account(account, cap, ctx);
    /// ```
    ///
    /// The cap goes to the caller; the account is shared so that
    /// `payment.move` (and other PTB steps) can take `&mut` on it.
    public fun share_account<T>(
        account: SubscriptionAccount<T>,
        cap: AccountCap,
        ctx: &mut TxContext,
    ) {
        transfer::share_object(account);
        ac::transfer_account_cap(cap, ctx.sender());
    }

    // === deposit ===

    /// Deposit a `Coin<T>` into the account. The cap's `account_id` must
    /// match the account; the cap's `permissions` bitfield must include
    /// `permission_owner()` OR `permission_depositor()`. The account
    /// must not be closed.
    ///
    /// #### Aborts
    /// - `EInvalidCap` if `cap.account_id != object::id(account)`.
    /// - `EAccountClosed` if the account is closed.
    /// - `EUnauthorized` if the cap lacks OWNER or DEPOSITOR permission.
    /// - `EZeroAmount` if the coin has zero value.
    public fun deposit<T>(
        cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        coin: Coin<T>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(ac::account_id(cap) == object::id(account), EInvalidCap);
        assert!(!is_closed(&account.status), EAccountClosed);
        assert!(
            has_permission(cap, permission_owner()) ||
                has_permission(cap, ac::permission_depositor()),
            EUnauthorized,
        );
        let amt = coin::value(&coin);
        assert!(amt > 0, EZeroAmount);
        asset::deposit<T>(&mut account.balance, coin, ctx);
        event::emit(Deposit {
            account_id: object::id(account),
            depositor: ctx.sender(),
            amount: amt,
            new_balance: asset::view_value(&account.balance, clock),
            v: 2,
        });
    }

    // === pause / resume / close ===

    /// Pause the account. Cascades to all active subscriptions
    /// (sets each `status == 0` to `status == 1`, BUG FIX #8). The
    /// cap must hold the OWNER permission.
    ///
    /// #### Aborts
    /// - `EInvalidCap` if `cap.account_id != object::id(account)`.
    /// - `EAccountClosed` if the account is already closed.
    /// - `EUnauthorized` if the cap lacks the OWNER bit.
    public fun pause_account<T>(
        cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        clock: &Clock,
    ) {
        assert!(ac::account_id(cap) == object::id(account), EInvalidCap);
        assert!(!is_closed(&account.status), EAccountClosed);
        assert!(has_permission(cap, permission_owner()), EUnauthorized);
        account.status = account_status_paused();
        let now = clock.timestamp_ms();
        let sub_count = vec_map::length(&account.subscriptions);
        let mut i: u64 = 0;
        while (i < sub_count) {
            let (_, sub) = vec_map::get_entry_by_idx_mut(&mut account.subscriptions, i);
            if (sub.status == 0) {
                sub.status = 1;
                sub.updated_at = now;
            };
            i = i + 1;
        };
        event::emit(AccountPaused {
            account_id: object::id(account),
            subscription_count: sub_count,
            v: 2,
        });
    }

    /// Resume the account. Does NOT auto-resume subscriptions — the
    /// user must call `billing::resume_subscription` per platform to
    /// prevent surprise billing (design §7.7). The cap must hold
    /// the OWNER permission.
    ///
    /// #### Aborts
    /// - `EInvalidCap` if `cap.account_id != object::id(account)`.
    /// - `EAccountNotPaused` if the account is not in the paused state.
    /// - `EUnauthorized` if the cap lacks the OWNER bit.
    public fun resume_account<T>(
        cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        _clock: &Clock,
    ) {
        assert!(ac::account_id(cap) == object::id(account), EInvalidCap);
        assert!(is_paused(&account.status), EAccountNotPaused);
        assert!(has_permission(cap, permission_owner()), EUnauthorized);
        account.status = account_status_active();
        event::emit(AccountResumed {
            account_id: object::id(account),
            v: 2,
        });
    }

    /// Close the account. Terminal — deposits are rejected after close.
    /// The cap must hold the OWNER permission. Does NOT auto-drain
    /// remaining balance; the user or `payment.move` may still pull
    /// funds out via `internal_withdraw` until the container is empty.
    ///
    /// #### Aborts
    /// - `EInvalidCap` if `cap.account_id != object::id(account)`.
    /// - `EUnauthorized` if the cap lacks the OWNER bit.
    public fun close_account<T>(
        cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        _clock: &Clock,
    ) {
        assert!(ac::account_id(cap) == object::id(account), EInvalidCap);
        assert!(has_permission(cap, permission_owner()), EUnauthorized);
        account.status = account_status_closed();
        event::emit(AccountClosed {
            account_id: object::id(account),
            v: 2,
        });
    }

    // === update_policies ===

    /// Replace the account's `PolicySet` wholesale. The cap must hold
    /// the OWNER permission. Both old and new sets are emitted in the
    /// `PoliciesUpdated` event for off-chain reconciliation.
    ///
    /// #### Aborts
    /// - `EInvalidCap` if `cap.account_id != object::id(account)`.
    /// - `EUnauthorized` if the cap lacks the OWNER bit.
    public fun update_policies<T>(
        cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        new_policies: PolicySet,
        _clock: &Clock,
    ) {
        assert!(ac::account_id(cap) == object::id(account), EInvalidCap);
        assert!(has_permission(cap, permission_owner()), EUnauthorized);
        let old_policies = account.policies;
        account.policies = new_policies;
        event::emit(PoliciesUpdated {
            account_id: object::id(account),
            old_policies,
            new_policies,
            v: 2,
        });
    }

    // === mint_delegated_cap (agentic-commerce seam) ===

    /// Mint a fresh `AccountCap` for the same account with a caller-
    /// chosen `permissions` bitfield. The presented cap must hold the
    /// OWNER permission — delegated-cap minting is owner-only.
    ///
    /// The returned cap is `key`-only (not `store`), so it is
    /// non-transferable by default; the caller (PTB) transfers it
    /// to the agent address. The cap's `account_id` is pre-bound to
    /// `object::id(account)`.
    ///
    /// The bitfield is validated by `new_account_cap` (zero and bits
    /// beyond `OWNER|DEPOSITOR|AGENT` are rejected upstream).
    ///
    /// #### Aborts
    /// - `EInvalidCap` if `cap.account_id != object::id(account)`.
    /// - `ENotOwnerCap` if the cap lacks the OWNER bit.
    public fun mint_delegated_cap<T>(
        cap: &AccountCap,
        account: &SubscriptionAccount<T>,
        permissions: u32,
        clock: &Clock,
        ctx: &mut TxContext,
    ): AccountCap {
        assert!(ac::account_id(cap) == object::id(account), EInvalidCap);
        assert!(has_permission(cap, permission_owner()), ENotOwnerCap);
        new_account_cap(object::id(account), permissions, clock.timestamp_ms(), ctx)
    }

    // === public(package) withdraw — only callable by payment.move ===

    /// Split off `amount` from the account's balance container and
    /// return it as a `Balance<T>`. The caller (payment.move) is
    /// responsible for transferring the resulting coin to the
    /// platform treasury.
    ///
    /// `public(package)` ensures only `payment.move` (same package)
    /// can call this. Combined with the role check inside
    /// `payment.move`, user funds are protected against any
    /// non-payment-path code.
    ///
    /// The replay nonce is NOT bumped here — `payment.move` calls
    /// `bump_nonce` after the policy eval and `record_payment` both
    /// succeed, so a failed payment does not advance the nonce.
    ///
    /// #### Aborts
    /// - `EAccountClosed` if the account is closed.
    /// - `EZeroAmount` if `amount == 0`.
    /// - `EInsufficientBalance` if live headroom is below `amount`.
    public(package) fun internal_withdraw<T>(
        account: &mut SubscriptionAccount<T>,
        amount: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ): Balance<T> {
        assert!(!is_closed(&account.status), EAccountClosed);
        assert!(amount > 0, EZeroAmount);
        let current = asset::view_value(&account.balance, clock);
        assert!(current >= amount, EInsufficientBalance);
        asset::try_withdraw<T>(&mut account.balance, amount, ctx)
    }

    /// Bump the per-account replay nonce. Called by `payment.move`
    /// after a successful `process_due_payment`. `public(package)` to
    /// restrict the caller to same-package code.
    public(package) fun bump_nonce<T>(account: &mut SubscriptionAccount<T>) {
        account.nonce = account.nonce + 1;
    }

    // === Accessors (view) ===

    /// `object::id` of the account.
    /// Role: any caller (read-only view).
    public fun id<T>(account: &SubscriptionAccount<T>): ID { object::id(account) }

    /// Coin denomination (immutable after creation).
    /// Role: any caller (read-only view).
    public fun account_type<T>(account: &SubscriptionAccount<T>): &AccountType {
        &account.account_type
    }

    /// Live headroom in the smallest unit of `T`.
    /// Role: any caller (read-only view).
    public fun balance<T>(
        account: &SubscriptionAccount<T>,
        clock: &Clock,
    ): u64 { asset::view_value(&account.balance, clock) }

    /// Account lifecycle status.
    /// Role: any caller (read-only view).
    public fun status<T>(account: &SubscriptionAccount<T>): &AccountStatus {
        &account.status
    }

    /// Active `PolicySet` reference.
    /// Role: any caller (read-only view).
    public fun policies<T>(account: &SubscriptionAccount<T>): &PolicySet {
        &account.policies
    }

    /// Per-account replay nonce.
    /// Role: any caller (read-only view).
    public fun nonce<T>(account: &SubscriptionAccount<T>): u64 { account.nonce }

    /// Schema version (currently `2`).
    /// Role: any caller (read-only view).
    public fun version<T>(account: &SubscriptionAccount<T>): u16 { account.version }

    /// Creation timestamp (ms).
    /// Role: any caller (read-only view).
    public fun created_at<T>(account: &SubscriptionAccount<T>): u64 { account.created_at }

    /// Read-only handle to the subscriptions map. `billing.move`
    /// reads from this to look up per-platform state.
    /// Role: any caller (read-only view).
    public fun subscriptions<T>(
        account: &SubscriptionAccount<T>,
    ): &VecMap<ID, SubscriptionV1> { &account.subscriptions }

    /// Mutable handle to the subscriptions map. `billing.move` is the
    /// only expected caller (via `public(package)` access below).
    public(package) fun subscriptions_mut<T>(
        account: &mut SubscriptionAccount<T>,
    ): &mut VecMap<ID, SubscriptionV1> { &mut account.subscriptions }

    /// True iff the account has a subscription keyed by `platform_id`.
    /// Role: any caller (read-only view).
    public fun has_subscription<T>(
        account: &SubscriptionAccount<T>,
        platform_id: &ID,
    ): bool { vec_map::contains(&account.subscriptions, platform_id) }

    /// Read-only lookup of a single subscription by `platform_id`.
    /// Role: any caller (read-only view).
    public fun get_subscription<T>(
        account: &SubscriptionAccount<T>,
        platform_id: &ID,
    ): &SubscriptionV1 { vec_map::get(&account.subscriptions, platform_id) }

    /// Mutable lookup of a single subscription by `platform_id`.
    /// `public(package)` so only `billing.move` (same package) can mutate
    /// per-subscription state. Foreign modules cannot reach in and tamper
    /// with the schedule or counters.
    public(package) fun get_subscription_mut<T>(
        account: &mut SubscriptionAccount<T>,
        platform_id: &ID,
    ): &mut SubscriptionV1 {
        vec_map::get_mut(&mut account.subscriptions, platform_id)
    }

    /// Number of embedded subscriptions.
    /// Role: any caller (read-only view).
    public fun subscription_count<T>(account: &SubscriptionAccount<T>): u64 {
        vec_map::length(&account.subscriptions)
    }

    // === SubscriptionV1 mutators (public(package) — billing.move only) ===
    //
    // `SubscriptionV1` fields are private to `account.move`. `billing.move`
    // is the only module that should mutate per-platform subscription
    // state, so we expose the necessary writes here as `public(package)`
    // helpers rather than making the fields themselves package-visible.
    // Each helper is a single, audit-friendly write so reviewers can see
    // exactly which fields a given operation touches.

    /// Set the subscription's `status` field. Used by `pause/resume/cancel`.
    public(package) fun sub_set_status(s: &mut SubscriptionV1, status: u8) {
        s.status = status;
    }

    /// Set the subscription's `updated_at` field (ms).
    public(package) fun sub_set_updated_at(s: &mut SubscriptionV1, updated_at: u64) {
        s.updated_at = updated_at;
    }

    /// Apply the post-payment state update on a successful billing. All
    /// fields written here are part of the same logical step; bundling
    /// them in a single function keeps the schedule and counter invariants
    /// together. `now` is `clock.timestamp_ms()` from the caller.
    public(package) fun sub_apply_payment(
        s: &mut SubscriptionV1,
        amount: u64,
        now: u64,
    ) {
        s.total_paid = s.total_paid + amount;
        s.payment_count = s.payment_count + 1;
        s.last_billing_time = now;
        s.next_billing_time = now + s.tier_frequency_ms;
        s.last_attempt_time = now;
        s.attempt_count = 0;
        s.nonce = s.nonce + 1;
        s.updated_at = now;
    }

    /// Apply the failed-attempt state update. Bumps `attempt_count`,
    /// stamps `last_attempt_time` and `updated_at`. Does not touch the
    /// billing schedule (a failed bill does not advance `next_billing_time`).
    public(package) fun sub_apply_failed_attempt(
        s: &mut SubscriptionV1,
        now: u64,
    ) {
        s.attempt_count = s.attempt_count + 1;
        s.last_attempt_time = now;
        s.updated_at = now;
    }

    // === Helper ===

    /// Resolve the `AccountType` for `T` from the registry. Aborts with
    /// `ECoinTypeNotRegistered` if `T` is unknown, or
    /// `EInvalidDiscriminant` if the registry's discriminant does not
    /// map to a built-in `AccountType` variant.
    fun resolve_account_type<T>(registry: &CoinTypeRegistry): AccountType {
        let disc_opt = registry::discriminant_of<T>(registry);
        assert!(disc_opt.is_some(), ECoinTypeNotRegistered);
        let disc = *disc_opt.borrow();
        let acct_opt = registry::try_into_builtin(disc);
        assert!(acct_opt.is_some(), EInvalidDiscriminant);
        *acct_opt.borrow()
    }

    // === Test-only helpers ===

    /// Test-only constructor for `SubscriptionAccount<T>`. Mirrors
    /// `create_account` but returns the account by value without
    /// going through the shared-object protocol. Mirrors the v1
    /// `new_registry_for_testing` pattern in `registry.move`.
    #[test_only]
    public fun new_account_for_testing<T>(
        registry: &CoinTypeRegistry,
        initial_policies: PolicySet,
        clock: &Clock,
        ctx: &mut TxContext,
    ): SubscriptionAccount<T> {
        let account_type = resolve_account_type<T>(registry);
        let now = clock.timestamp_ms();
        SubscriptionAccount<T> {
            id: object::new(ctx),
            account_type,
            balance: asset::new_public<T>(),
            subscriptions: vec_map::empty(),
            policies: initial_policies,
            status: account_status_active(),
            created_at: now,
            nonce: 0,
            version: 2,
        }
    }

    /// Test-only destructor. `SubscriptionAccount<T>` has `key + store`
    /// but not `drop`, so unit tests need an explicit way to dispose of
    /// accounts they constructed. The `BalanceContainer` is destroyed
    /// via `asset::destroy_for_testing`; the `VecMap` is drained entry
    /// by entry (its values are `SubscriptionV1` with `store + drop`).
    #[test_only]
    public fun destroy_account_for_testing<T>(account: SubscriptionAccount<T>) {
        let SubscriptionAccount<T> {
            id,
            account_type: _,
            balance,
            mut subscriptions,
            policies: _,
            status: _,
            created_at: _,
            nonce: _,
            version: _,
        } = account;
        object::delete(id);
        asset::destroy_for_testing(balance);
        // Drain subscriptions: pop the last entry until empty. Each value
        // is destructured and dropped. `VecMap::pop` is the right call:
        // it returns `(K, V)` and is the canonical way to walk a `VecMap`
        // in reverse insertion order.
        while (!vec_map::is_empty(&subscriptions)) {
            let (_k, sub) = vec_map::pop(&mut subscriptions);
            let SubscriptionV1 {
                platform_id: _,
                tier_index: _,
                tier_amount: _,
                tier_frequency_ms: _,
                denomination: _,
                status: _,
                schedule_frequency_ms: _,
                next_billing_time: _,
                last_billing_time: _,
                total_paid: _,
                payment_count: _,
                last_attempt_time: _,
                attempt_count: _,
                max_attempts: _,
                nonce: _,
                created_at: _,
                updated_at: _,
            } = sub;
        };
        vec_map::destroy_empty(subscriptions);
    }
}
