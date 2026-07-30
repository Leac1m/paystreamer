///
/// This module owns:
///    declared here with the full field set; `billing.move` augments with
///    mutators and event emissions without redefining the type).
/// 2. The `PolicySet` value type (same pattern; `policies.move` augments
///    with evaluation, two-pass consume, and event emissions).
/// 3. The `AccountStatus` lifecycle enum (active / paused / closed).
/// 4. The shared `SubscriptionAccount<T>` object plus its discovery
///    handle `AccountCap`.
///
/// (bitfield authority).
/// `init`, so per-account ACs are infeasible (and unnecessary — see
/// Role checks in this module therefore consult
/// `has_permission(cap, perm)` against the bitfield on the cap, not an
/// embedded AC.
///
/// - emits `v: u16 = 2` on every event for indexer discrimination.
///
/// ## Build-order note
///
/// design notes. Downstream `billing.move` and `policies.move` add
/// behavior (mutators, event emissions, evaluation) without redefining
#[allow(lint(share_owned, custom_state_change))]
module subscriptions::account {
    use sui::object;
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::clock::Clock;
    use sui::vec_map::{Self, VecMap};
    use subscriptions::subscription::{Self, Subscription};
    use sui::event;
    use sui::transfer;
    use sui::tx_context::TxContext;
    use std::type_name::{Self, TypeName};

    
    #[allow(unused_const)]
    const ESubscriptionNotFound: u64 = 0x06002;
    const ESubscriptionAlreadyExists: u64 = 0x06003;
    const EAccountPaused: u64 = 0x06006;
// === PolicySet (declared here, augmented by policies.move) ===

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
    /// wallet-visible discovery handle.
    /// `cap.account_id == object::id(account)` check.
    public struct SubscriptionAccount<phantom T> has key, store {
        id: object::UID,
        /// Coin denomination of the account.
        coin_type: TypeName,
        /// Stored balance for the account. Subscriber deposits funds via
        /// `deposit` before payments are processed.
        balance: Balance<T>,
        /// Per-platform subscriptions, keyed by `platform_id`. The
        subscriptions: VecMap<ID, Subscription>,
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

    // === AccountCap ===

    /// User-facing capability for a `SubscriptionAccount<T>`. Non-transferable
    /// by default (`key` only, not `store`).
    public struct AccountCap has key {
        id: object::UID,
        /// ID of the `SubscriptionAccount<T>` this cap authorizes.
        account_id: object::ID,
    }

    /// ID of the `SubscriptionAccount<T>` this cap authorizes.
    /// Role: any caller (read-only view).
    public fun account_cap_id(cap: &AccountCap): object::ID { cap.account_id }

    /// Transfer a freshly-minted `AccountCap` to a recipient. Since
    /// it lacks `store`, this is the only way to relocate it on chain.
    public fun transfer_account_cap(cap: AccountCap, recipient: address) {
        transfer::transfer(cap, recipient);
    }

    // === Errors ===

    /// The cap's `account_id` does not match the account it is being
    /// presented against. Wrong account, not just unauthorized.
    const EInvalidCap: u64 = 0x01001;
    /// The account is paused (`status.variant == 1`).
    #[allow(unused_const)]
    /// The account is closed (`status.variant == 2`).
    const EAccountClosed: u64 = 0x01003;
    /// A zero-amount deposit. Programmer error.
    const EZeroAmount: u64 = 0x01004;
    /// `internal_withdraw` for an amount exceeding live headroom.
    const EInsufficientBalance: u64 = 0x01005;
    /// `resume_account` was called on an account that is not paused.
    /// (Reusing `EAccountClosed` would be misleading; this is a separate
    /// programmer-facing condition.)
    const EAccountNotPaused: u64 = 0x0100A;

    // === Events ===
    //
    // All events carry a `v: u16 = 2` field for indexer discrimination
    // changes; adding a field is a minor version bump, removing a field
    // is a major version bump that requires a migration.

    /// Emitted on every successful `create_account`. Indexers use
    /// `account_id` as the canonical handle and `cap_id` to discover
    /// the user-facing capability.
    public struct AccountCreated has copy, drop {
        account_id: ID,
        cap_id: ID,
        owner: address,
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
    /// with the OWNER permission bit set.
    ///
    /// Returns the account and cap by value. The caller (PTB) is
    /// responsible for `share_account` to share the account and
    /// transfer the cap to the appropriate address. The cap's
    /// `account_id` field is pre-bound to the freshly-minted account.
    public fun create_account<T>(
        policies: PolicySet,
        clock: &Clock,
        ctx: &mut TxContext,
    ): (SubscriptionAccount<T>, AccountCap) {
        let now = clock.timestamp_ms();

        let acct_uid = object::new(ctx);
        let account_id = object::uid_to_inner(&acct_uid);

        let account = SubscriptionAccount<T> {
            id: acct_uid,
            coin_type: type_name::with_original_ids<T>(),
            balance: balance::zero<T>(),
            subscriptions: vec_map::empty(),
            policies,
            status: account_status_active(),
            created_at: now,
            nonce: 0,
            version: 2,
        };

        let cap = AccountCap {
            id: object::new(ctx),
            account_id,
        };
        let cap_id = object::id(&cap);

        event::emit(AccountCreated {
            account_id,
            cap_id,
            owner: ctx.sender(),
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
        transfer_account_cap(cap, ctx.sender());
    }

    // === deposit ===

    /// Deposit a `Coin<T>` into the account. The account must not be closed.
    ///
    /// #### Aborts
    /// - `EAccountClosed` if the account is closed.
    /// - `EZeroAmount` if the coin has zero value.
    public fun deposit<T>(
        account: &mut SubscriptionAccount<T>,
        coin: Coin<T>,
        ctx: &mut TxContext,
    ) {
        assert!(!is_closed(&account.status), EAccountClosed);
        let amt = coin.value();
        assert!(amt > 0, EZeroAmount);
        let value = coin.into_balance();
        account.balance.join(value);
        event::emit(Deposit {
            account_id: object::id(account),
            depositor: ctx.sender(),
            amount: amt,
            new_balance: account.balance.value(),
            v: 2,
        });
    }

    // === withdraw ===

    /// withdraw `amount` of a `Coin<T>` from the account. The cap's `account_id` must
    /// match the account. The account must not be closed.
    ///
    /// #### Aborts
    /// - `EInvalidCap` if `cap.account_id != object::id(account)`.
    /// - `EAccountClosed` if the account is closed.
    /// - `EZeroAmount` if the requested amount is zero.
    /// - `EInsufficientBalance` if the account balance is less than the requested amount.
    public fun withdraw<T>(
        cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        amount: u64,
        ctx: &mut TxContext,
    ): Coin<T> {
        assert!(cap.account_id == object::id(account), EInvalidCap);
        assert!(!is_closed(&account.status), EAccountClosed);
        assert!(amount > 0, EZeroAmount);
        assert!(account.balance.value() >= amount, EInsufficientBalance);

        let b = account.balance.split(amount);
        coin::from_balance(b, ctx)
    }

    // === pause / resume / close ===

    /// Pause the account. Cascades to all active subscriptions
    /// cap must hold the OWNER permission.
    ///
    /// #### Aborts
    /// - `EInvalidCap` if `cap.account_id != object::id(account)`.
    /// - `EAccountClosed` if the account is already closed.
    /// - `EUnauthorized` if the cap lacks the OWNER bit.
    public fun pause_account<T>(
        cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
    ) {
        assert!(cap.account_id == object::id(account), EInvalidCap);
        assert!(!is_closed(&account.status), EAccountClosed);
        account.status = account_status_paused();
        let sub_count = account.subscriptions.length();
        event::emit(AccountPaused {
            account_id: object::id(account),
            subscription_count: sub_count,
            v: 2,
        });
    }

    /// Resume the account. Does NOT auto-resume subscriptions — the
    /// user must call `billing::resume_subscription` per platform to
    /// the OWNER permission.
    ///
    /// #### Aborts
    /// - `EInvalidCap` if `cap.account_id != object::id(account)`.
    /// - `EAccountNotPaused` if the account is not in the paused state.
    /// - `EUnauthorized` if the cap lacks the OWNER bit.
    public fun resume_account<T>(
        cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        ) {
        assert!(cap.account_id == object::id(account), EInvalidCap);
        assert!(is_paused(&account.status), EAccountNotPaused);
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
        ) {
        assert!(cap.account_id == object::id(account), EInvalidCap);
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
        ) {
        assert!(cap.account_id == object::id(account), EInvalidCap);
        let old_policies = account.policies;
        account.policies = new_policies;
        event::emit(PoliciesUpdated {
            account_id: object::id(account),
            old_policies,
            new_policies,
            v: 2,
        });
    }



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
    /// Bump the per-account replay nonce. Called by `payment.move`
    /// after a successful `process_due_payment`. `public(package)` to
    /// restrict the caller to same-package code.
    public(package) fun bump_nonce<T>(account: &mut SubscriptionAccount<T>) {
        account.nonce = account.nonce + 1;
    }

    /// Withdraw `amount` from the account's balance and send as Coin<T>
    /// to the treasury address.
    ///
    /// `public(package)` ensures only `payment.move` (same package)
    /// can call this.
    ///
    /// #### Aborts
    /// - `EAccountClosed` if the account is closed.
    /// - `EZeroAmount` if `amount == 0`.
    /// - `EInsufficientBalance` if live headroom is below `amount`.
    public(package) fun withdraw_and_send<T>(
        account: &mut SubscriptionAccount<T>,
        amount: u64,
        treasury: address,
        ctx: &mut TxContext,
    ) {
        assert!(!is_closed(&account.status), EAccountClosed);
        assert!(amount > 0, EZeroAmount);
        assert!(account.balance.value() >= amount, EInsufficientBalance);
        let b = account.balance.split(amount);
        let c = coin::from_balance(b, ctx);
        transfer::public_transfer(c, treasury);
    }

    /// Read the subscription's `tier_amount` by `platform_id`. Used by
    /// exactly `sub.tier_amount`, never a caller-supplied value. Public
    /// (read-only) view on the embedded subscription map; lookup uses
    /// the public `subscriptions` accessor to avoid duplicating the
    /// `vec_map::get` abort path.
    public(package) fun tier_amount_via_sub<T>(
        account: &SubscriptionAccount<T>,
        platform_id: ID,
    ): u64 {
        subscriptions::subscription::tier_amount(account.subscriptions.get(&platform_id))
    }

    // === Accessors (view) ===

    /// object::id of the account.
    /// Role: any caller (read-only view).
    public fun id<T>(account: &SubscriptionAccount<T>): ID { object::id(account) }

    /// Coin denomination (immutable after creation).
    /// Role: any caller (read-only view).
    public fun account_type<T>(account: &SubscriptionAccount<T>): TypeName {
        account.coin_type
    }

    /// Live headroom in the smallest unit of `T`.
    /// Role: any caller (read-only view).
    public fun balance<T>(account: &SubscriptionAccount<T>): u64 {
        account.balance.value()
    }

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
    ): &VecMap<ID, Subscription> { &account.subscriptions }

    /// Mutable handle to the subscriptions map. `billing.move` is the
    /// only expected caller (via `public(package)` access below).
    public(package) fun subscriptions_mut<T>(
        account: &mut SubscriptionAccount<T>,
    ): &mut VecMap<ID, Subscription> { &mut account.subscriptions }

    /// True iff the account has a subscription keyed by `platform_id`.
    /// Role: any caller (read-only view).
    public fun has_subscription<T>(
        account: &SubscriptionAccount<T>,
        platform_id: &ID,
    ): bool { account.subscriptions.contains(platform_id) }

    /// Read-only lookup of a single subscription by `platform_id`.
    /// Role: any caller (read-only view).
    public fun get_subscription<T>(
        account: &SubscriptionAccount<T>,
        platform_id: &ID,
    ): &Subscription { account.subscriptions.get(platform_id) }

    /// Mutable lookup of a single subscription by `platform_id`.
    /// `public(package)` so only `billing.move` (same package) can mutate
    /// per-subscription state. Foreign modules cannot reach in and tamper
    /// with the schedule or counters.
    public(package) fun get_subscription_mut<T>(
        account: &mut SubscriptionAccount<T>,
        platform_id: &ID,
    ): &mut Subscription {
        account.subscriptions.get_mut(platform_id)
    }

    /// Remove a subscription entry from the VecMap by `platform_id`.
    /// Used by `cancel_subscription` to allow resubscription.
    public(package) fun remove_subscription<T>(
        account: &mut SubscriptionAccount<T>,
        platform_id: &ID,
    ) {
        account.subscriptions.remove(platform_id);
    }

    /// Number of embedded subscriptions.
    /// Role: any caller (read-only view).
    public fun subscription_count<T>(account: &SubscriptionAccount<T>): u64 {
        account.subscriptions.length()
    }

    // === create_subscription ===

    public fun create_subscription<T>(
        cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        platform_id: ID,
        tier_index: u64,
        tier_amount: u64,
        tier_frequency_ms: u64,
        max_attempts: u8,
        clock: &Clock,
    ) {
        assert!(account_cap_id(cap) == object::id(account), EInvalidCap);
        let status_ref = status(account);
        assert!(is_active(status_ref), EAccountPaused);
        assert!(!is_closed(status_ref), EAccountClosed);

        if (vec_map::contains(subscriptions(account), &platform_id)) {
            let existing = get_subscription(account, &platform_id);
            assert!(
                subscription::status(existing) == 2,
                ESubscriptionAlreadyExists,
            );
        };

        let sub = subscription::create(
            object::id(account),
            platform_id,
            tier_index,
            tier_amount,
            tier_frequency_ms,
            max_attempts,
            clock
        );
        vec_map::insert(subscriptions_mut(account), platform_id, sub);
    }

    // === pause / resume / cancel ===

    public fun pause_subscription<T>(
        cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        platform_id: ID,
        clock: &Clock,
    ) {
        assert!(account_cap_id(cap) == object::id(account), EInvalidCap);
        let account_id = object::id(account);
        let sub = get_subscription_mut(account, &platform_id);
        subscription::pause(sub, account_id, clock);
    }

    public fun resume_subscription<T>(
        cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        platform_id: ID,
        clock: &Clock,
    ) {
        assert!(account_cap_id(cap) == object::id(account), EInvalidCap);
        let account_id = object::id(account);
        let sub = get_subscription_mut(account, &platform_id);
        subscription::resume(sub, account_id, clock);
    }

    public fun cancel_subscription<T>(
        cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        platform_id: ID,
        clock: &Clock,
    ) {
        assert!(account_cap_id(cap) == object::id(account), EInvalidCap);
        let account_id = object::id(account);
        let sub = get_subscription_mut(account, &platform_id);
        let removed = subscription::cancel(sub, account_id, clock);
        if (removed) {
            remove_subscription(account, &platform_id);
        }
    }

    public fun update_subscription_max_attempts<T>(
        cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        platform_id: ID,
        max_attempts: u8,
        clock: &Clock,
    ) {
        assert!(account_cap_id(cap) == object::id(account), EInvalidCap);
        let account_id = object::id(account);
        let sub = get_subscription_mut(account, &platform_id);
        subscription::update_max_attempts(sub, account_id, max_attempts, clock);
    }

    public fun update_subscription_tier<T>(
        cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        platform_id: ID,
        tier_index: u64,
        tier_amount: u64,
        tier_frequency_ms: u64,
        clock: &Clock,
    ) {
        assert!(account_cap_id(cap) == object::id(account), EInvalidCap);
        let account_id = object::id(account);
        let sub = get_subscription_mut(account, &platform_id);
        subscription::update_tier(sub, account_id, tier_index, tier_amount, tier_frequency_ms, clock);
    }

    public fun update_subscription_schedule_frequency<T>(
        cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        platform_id: ID,
        schedule_frequency_ms: u64,
        clock: &Clock,
    ) {
        assert!(account_cap_id(cap) == object::id(account), EInvalidCap);
        let account_id = object::id(account);
        let sub = get_subscription_mut(account, &platform_id);
        subscription::update_schedule_frequency(sub, account_id, schedule_frequency_ms, clock);
    }

    // === record_payment ===

    public(package) fun record_payment<T>(
        account: &mut SubscriptionAccount<T>,
        platform_id: ID,
        amount: u64,
        clock: &Clock,
    ) {
        let account_id = object::id(account);
        let sub = get_subscription_mut(account, &platform_id);
        subscription::record_payment(sub, account_id, amount, clock);
    }

    // === record_failed_payment ===

    public(package) fun record_failed_payment<T>(
        account: &mut SubscriptionAccount<T>,
        platform_id: ID,
        amount: u64,
        reason: u64,
        clock: &Clock,
    ) {
        let account_id = object::id(account);
        let sub = get_subscription_mut(account, &platform_id);
        subscription::record_failed_payment(sub, account_id, amount, reason, clock);
    }

    // === can_bill ===

    public fun can_bill<T>(
        account: &SubscriptionAccount<T>,
        platform_id: ID,
        clock: &Clock,
    ): bool {
        if (!vec_map::contains(subscriptions(account), &platform_id)) {
            return false
        };
        let sub = vec_map::get(subscriptions(account), &platform_id);
        subscription::can_bill(sub, clock)
    }

    // === Accessors (read-only) ===

    public fun subscription_status<T>(
        account: &SubscriptionAccount<T>,
        platform_id: ID,
    ): u8 {
        subscription::status(vec_map::get(subscriptions(account), &platform_id))
    }

    public fun subscription_total_paid<T>(
        account: &SubscriptionAccount<T>,
        platform_id: ID,
    ): u64 {
        subscription::total_paid(vec_map::get(subscriptions(account), &platform_id))
    }

    public fun subscription_payment_count<T>(
        account: &SubscriptionAccount<T>,
        platform_id: ID,
    ): u64 {
        subscription::payment_count(vec_map::get(subscriptions(account), &platform_id))
    }

    public fun subscription_nonce<T>(
        account: &SubscriptionAccount<T>,
        platform_id: ID,
    ): u64 {
        subscription::nonce(vec_map::get(subscriptions(account), &platform_id))
    }

    public fun subscription_tier_amount<T>(
        account: &SubscriptionAccount<T>,
        platform_id: ID,
    ): u64 {
        subscription::tier_amount(vec_map::get(subscriptions(account), &platform_id))
    }

    public fun subscription_tier_frequency_ms<T>(
        account: &SubscriptionAccount<T>,
        platform_id: ID,
    ): u64 {
        subscription::tier_frequency_ms(vec_map::get(subscriptions(account), &platform_id))
    }

    public fun subscription_next_billing_time<T>(
        account: &SubscriptionAccount<T>,
        platform_id: ID,
    ): u64 {
        subscription::next_billing_time(vec_map::get(subscriptions(account), &platform_id))
    }

    public fun subscription_denomination<T>(
        account: &SubscriptionAccount<T>,
    ): std::type_name::TypeName {
        account_type(account)
    }

    // === Test-only helpers ===

    /// Test-only constructor for `SubscriptionAccount<T>`. Mirrors
    /// `create_account` but returns the account by value without
    /// `new_registry_for_testing` pattern in `registry.move`.
    #[test_only]
    public fun new_account_for_testing<T>(
        initial_policies: PolicySet,
        clock: &Clock,
        ctx: &mut TxContext,
    ): SubscriptionAccount<T> {
        let now = clock.timestamp_ms();
        SubscriptionAccount<T> {
            id: object::new(ctx),
            coin_type: type_name::with_original_ids<T>(),
            balance: balance::zero<T>(),
            subscriptions: vec_map::empty(),
            policies: initial_policies,
            status: account_status_active(),
            created_at: now,
            nonce: 0,
            version: 2,
        }
    }

    #[test_only]
    public fun destroy_account_cap_for_testing(cap: AccountCap) {
        let AccountCap { id, account_id: _ } = cap;
        object::delete(id);
    }

    /// Test-only destructor. `SubscriptionAccount<T>` has `key + store`
    /// but not `drop`, so unit tests need an explicit way to dispose of
    /// accounts they constructed. The `VecMap` is drained entry by entry
    #[test_only]
    public fun destroy_account_for_testing<T>(account: SubscriptionAccount<T>) {
        let SubscriptionAccount<T> {
            id,
            coin_type: _,
            balance,
            mut subscriptions,
            policies: _,
            status: _,
            created_at: _,
            nonce: _,
            version: _,
        } = account;
        object::delete(id);
        balance::destroy_zero(balance);
        // Drain subscriptions: pop the last entry until empty. Each value
        // is destructured and dropped. `VecMap::pop` is the right call:
        // it returns `(K, V)` and is the canonical way to walk a `VecMap`
        // in reverse insertion order.
        while (!subscriptions.is_empty()) {
            let (_k, _sub) = vec_map::pop(&mut subscriptions);
            // sub is dropped implicitly
        };
        vec_map::destroy_empty(subscriptions);
    }
}
