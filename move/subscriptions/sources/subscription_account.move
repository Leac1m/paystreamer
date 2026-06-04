// Copyright (c) leac1m
// SPDX-License-Identifier: Apache-2.0

/// SubscriptionAccount module: core account management, balance operations,
/// and on-chain policy enforcement for stablecoin-denominated subscriptions.
module subscriptions::subscription_account {
    use sui::coin::Coin;
    use sui::balance::{Self, Balance};
    use sui::vec_map::{Self, VecMap};
    use sui::clock::Clock;
    use sui::event::emit;
    use sui::transfer;

    // === Error constants ===
    const E_INVALID_CAP: u64 = 0x10001;
    const E_UNAUTHORIZED_PLATFORM: u64 = 0x10003;
    const E_POLICY_EXCEEDED_TRANSACTION: u64 = 0x10006;
    const E_POLICY_MIN_BALANCE_VIOLATION: u64 = 0x10007;
    const E_POLICY_EXCEEDED_MONTHLY: u64 = 0x10008;
    const E_POLICY_FREQUENCY_VIOLATION: u64 = 0x10009;
    const E_INVALID_POLICY: u64 = 0x1000A;
    const E_ZERO_AMOUNT: u64 = 0x1000B;
    const E_ACCOUNT_PAUSED: u64 = 0x1000C;
    const E_SUBSCRIPTION_PAUSED: u64 = 0x1000E;

    // === Enums ===

    /// Account lifecycle status
    public struct AccountStatus has store, drop {
        variant: u8,
    }

    public fun account_status_active(): AccountStatus { AccountStatus { variant: 0 } }
    public fun account_status_paused(): AccountStatus { AccountStatus { variant: 1 } }
    public fun account_status_closed(): AccountStatus { AccountStatus { variant: 2 } }
    public fun account_status_variant(s: &AccountStatus): u8 { s.variant }

    /// Subscription lifecycle status
    public struct SubscriptionStatus has store, drop {
        variant: u8,
    }

    public fun subscription_status_active(): SubscriptionStatus { SubscriptionStatus { variant: 0 } }
    public fun subscription_status_paused(): SubscriptionStatus { SubscriptionStatus { variant: 1 } }
    public fun subscription_status_cancelled(): SubscriptionStatus { SubscriptionStatus { variant: 2 } }
    public fun subscription_status_variant(s: &SubscriptionStatus): u8 { s.variant }
    public fun subscription_status_is_active(s: &SubscriptionStatus): bool { s.variant == 0 }
    public fun subscription_status_is_paused(s: &SubscriptionStatus): bool { s.variant == 1 }
    public fun subscription_status_is_cancelled(s: &SubscriptionStatus): bool { s.variant == 2 }

    // === Data structures ===

    /// Defines withdrawal constraints enforced by the smart contract.
    public struct PolicyConfig has store, drop {
        max_monthly_withdrawal: u64,
        max_per_transaction: u64,
        min_balance: u64,
        min_frequency_days: u64,
        last_withdrawal_time: u64,
    }

    /// Billing schedule for a subscription
    public struct BillingSchedule has store, drop {
        frequency_days: u64,
        next_billing_time: u64,
        last_billing_time: u64,
    }

    /// Individual subscription embedded in SubscriptionAccount.
    /// Tracks lifecycle, billing schedule, and payment history.
    public struct Subscription has store, drop {
        platform_id: ID,
        tier_index: u64,
        tier_amount: u64,
        tier_frequency_days: u64,
        status: SubscriptionStatus,
        schedule: BillingSchedule,
        total_paid: u64,
        payment_count: u64,
        created_at: u64,
        updated_at: u64,
    }

    /// Represents a user's subscription account holding stablecoin funds and policy configuration.
    /// Shared object enabling concurrent access for deposits and withdrawals.
    public struct SubscriptionAccount<phantom T> has key, store {
        id: UID,
        balance: Balance<T>,
        policies: PolicyConfig,
        subscriptions: VecMap<ID, Subscription>,  // platform_id -> Subscription
        monthly_withdrawn: u64,
        current_month_start: u64,
        created_at: u64,
        status: AccountStatus,
    }

    /// Capability granting account management authority.
    /// Non-transferable; holder is determined by owning this object.
    public struct AccountCap has key, store {
        id: UID,
        account_id: ID,
        created_at: u64,
    }

    // === Events ===

    public struct AccountCreated has copy, drop {
        account_id: ID,
        cap_id: ID,
        owner: address,
        timestamp: u64,
    }

    public struct Deposit has copy, drop {
        account_id: ID,
        depositor: address,
        amount: u64,
        new_balance: u64,
        timestamp: u64,
    }

    public struct Withdrawal has copy, drop {
        account_id: ID,
        platform_id: ID,
        platform_address: address,
        amount: u64,
        remaining_balance: u64,
        monthly_total: u64,
        policy_passed: vector<bool>,
        timestamp: u64,
    }

    public struct PolicyUpdated has copy, drop {
        account_id: ID,
        old_max_monthly: u64,
        new_max_monthly: u64,
        old_max_per_tx: u64,
        new_max_per_tx: u64,
        old_min_balance: u64,
        new_min_balance: u64,
        timestamp: u64,
    }

    public struct PaymentRecorded has copy, drop {
        account_id: ID,
        platform_id: ID,
        amount: u64,
        new_total_paid: u64,
        timestamp: u64,
    }

    // === Accessors ===

    public fun account_id<T>(account: &SubscriptionAccount<T>): ID {
        object::id(account)
    }

    public fun account_balance<T>(account: &SubscriptionAccount<T>): u64 {
        account.balance.value()
    }

    public fun account_status<T>(account: &SubscriptionAccount<T>): &AccountStatus {
        &account.status
    }

    public fun account_created_at<T>(account: &SubscriptionAccount<T>): u64 {
        account.created_at
    }

    public fun account_policies<T>(account: &SubscriptionAccount<T>): &PolicyConfig {
        &account.policies
    }

    public fun cap_account_id(cap: &AccountCap): ID {
        cap.account_id
    }

    // === Entry points ===

    /// Creates a new subscription account for the caller.
    /// Returns the AccountCap to the transaction sender.
    public fun create_account<T: drop>(
        ctx: &mut TxContext
    ): (ID, AccountCap) {
        let id = object::new(ctx);
        let account_id = object::id_from_address(object::uid_to_address(&id));
        let now = ctx.epoch_timestamp_ms();

        let account = SubscriptionAccount<T> {
            id,
            balance: balance::zero(),
            policies: PolicyConfig {
                max_monthly_withdrawal: 0xFFFFFFFFFFFFFFFF, // effectively unlimited
                max_per_transaction: 1_000_000_000,          // ~$1000 with 6 decimals
                min_balance: 10_000_000,                     // ~$10
                min_frequency_days: 0,
                last_withdrawal_time: 0,
            },
            subscriptions: vec_map::empty(),
            monthly_withdrawn: 0,
            current_month_start: get_month_start(now),
            created_at: now,
            status: account_status_active(),
        };

        transfer::share_object(account);

        let cap = AccountCap {
            id: object::new(ctx),
            account_id,
            created_at: now,
        };

        let cap_id = object::id_from_address(object::uid_to_address(&cap.id));

        emit(AccountCreated {
            account_id,
            cap_id,
            owner: ctx.sender(),
            timestamp: now,
        });

        (account_id, cap)
    }

    /// Entry function version that transfers AccountCap to sender immediately.
    public fun create_account_entry<T: drop>(
        ctx: &mut TxContext
    ) {
        let (_account_id, cap) = create_account<T>(ctx);
        transfer::transfer(cap, ctx.sender());
    }

    /// Deposits stablecoins into the subscription account.
    /// Requires a valid AccountCap.
    public fun deposit<T>(
        cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        coin: Coin<T>,
        _ctx: &mut TxContext
    ) {
        assert!(object::id(account) == cap.account_id, E_INVALID_CAP);
        assert!(account.status.variant == 0, E_ACCOUNT_PAUSED);

        let amount = coin.value();
        assert!(amount > 0, E_ZERO_AMOUNT);

        let deposit_balance = coin.into_balance();
        account.balance.join(deposit_balance);

        emit(Deposit {
            account_id: object::id(account),
            depositor: _ctx.sender(),
            amount,
            new_balance: account.balance.value(),
            timestamp: _ctx.epoch_timestamp_ms(),
        });
    }

    /// Withdraws stablecoins from the account to a specified recipient.
    /// Used by platforms to collect subscription payments.
    /// Requires platform authorization via platform_id (checked by caller).
    /// Enforces all policy constraints.
    /// Returns the withdrawn Balance so the PTB can transfer to recipient.
    public fun withdraw<T>(
        platform_id: ID,
        account: &mut SubscriptionAccount<T>,
        amount: u64,
        _recipient: address,
        _clock: &Clock,
        _ctx: &mut TxContext
    ): Balance<T> {
        assert!(amount > 0, E_ZERO_AMOUNT);
        assert!(account.status.variant == 0, E_ACCOUNT_PAUSED);

        // Verify platform is authorized via subscription
        assert!(vec_map::contains(&account.subscriptions, &platform_id), E_UNAUTHORIZED_PLATFORM);

        let max_per_tx = account.policies.max_per_transaction;
        let min_balance = account.policies.min_balance;
        let max_monthly = account.policies.max_monthly_withdrawal;
        let min_freq_days = account.policies.min_frequency_days;

        // Per-transaction limit
        assert!(amount <= max_per_tx, E_POLICY_EXCEEDED_TRANSACTION);

        // Minimum balance check
        assert!(account.balance.value() - amount >= min_balance, E_POLICY_MIN_BALANCE_VIOLATION);

        // Monthly limit check
        check_and_reset_month<T>(account, _clock);
        assert!(account.monthly_withdrawn + amount <= max_monthly, E_POLICY_EXCEEDED_MONTHLY);

        // Frequency check
        if (min_freq_days > 0) {
            let now = _clock.timestamp_ms();
            let min_interval_ms = (min_freq_days as u64) * 86400000;
            assert!(now - account.policies.last_withdrawal_time >= min_interval_ms, E_POLICY_FREQUENCY_VIOLATION);
        };

        // All checks passed — split off the withdrawn balance
        let withdrawn = account.balance.split(amount);
        account.monthly_withdrawn = account.monthly_withdrawn + amount;
        account.policies.last_withdrawal_time = _clock.timestamp_ms();

        // Emit events
        let policy_passed = vector[
            true,  // per-tx check
            true,  // min balance check
            true,  // monthly check
            true,  // frequency check
        ];

        emit(Withdrawal {
            account_id: object::id(account),
            platform_id,
            platform_address: _recipient,
            amount,
            remaining_balance: account.balance.value(),
            monthly_total: account.monthly_withdrawn,
            policy_passed,
            timestamp: _ctx.epoch_timestamp_ms(),
        });

        withdrawn
    }

    /// Updates the account's withdrawal policy configuration.
    /// Requires a valid AccountCap.
    public fun update_policy<T>(
        cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        new_policies: PolicyConfig,
        ctx: &mut TxContext
    ) {
        assert!(object::id(account) == cap.account_id, E_INVALID_CAP);

        // Validate new policy
        assert!(new_policies.max_monthly_withdrawal > 0, E_INVALID_POLICY);
        assert!(new_policies.max_per_transaction > 0, E_INVALID_POLICY);
        assert!(new_policies.max_per_transaction <= new_policies.max_monthly_withdrawal, E_INVALID_POLICY);
        assert!(new_policies.min_balance > 0, E_INVALID_POLICY);
        assert!(new_policies.min_frequency_days < 32, E_INVALID_POLICY);

        let old_policies = &account.policies;
        let now = ctx.epoch_timestamp_ms();

        emit(PolicyUpdated {
            account_id: object::id(account),
            old_max_monthly: old_policies.max_monthly_withdrawal,
            new_max_monthly: new_policies.max_monthly_withdrawal,
            old_max_per_tx: old_policies.max_per_transaction,
            new_max_per_tx: new_policies.max_per_transaction,
            old_min_balance: old_policies.min_balance,
            new_min_balance: new_policies.min_balance,
            timestamp: now,
        });

        account.policies = new_policies;
    }

    // === Helper functions ===

    fun get_month_start(timestamp_ms: u64): u64 {
        // Approximate month start — in production use proper calendar math
        let days = timestamp_ms / 86400000;
        let month_start_days = (days / 30) * 30;
        month_start_days * 86400000
    }

    fun check_and_reset_month<T>(account: &mut SubscriptionAccount<T>, _clock: &Clock) {
        let now = _clock.timestamp_ms();
        let current_month = get_month_start(now);
        if (account.current_month_start < current_month) {
            account.monthly_withdrawn = 0;
            account.current_month_start = current_month;
        }
    }

    // === Subscription helpers ===

    public fun get_subscriptions<T>(account: &SubscriptionAccount<T>): &VecMap<ID, Subscription> {
        &account.subscriptions
    }

    public fun get_subscription<T>(account: &SubscriptionAccount<T>, platform_id: &ID): &Subscription {
        vec_map::get(&account.subscriptions, platform_id)
    }

    public fun has_subscription<T>(account: &SubscriptionAccount<T>, platform_id: &ID): bool {
        vec_map::contains(&account.subscriptions, platform_id)
    }

    /// Internal: adds a subscription to the account's VecMap.
    public fun add_subscription<T>(
        account: &mut SubscriptionAccount<T>,
        platform_id: ID,
        subscription: Subscription
    ) {
        vec_map::insert(&mut account.subscriptions, platform_id, subscription);
    }

    /// Internal: gets a mutable reference to a subscription.
    public fun get_subscription_mut<T>(account: &mut SubscriptionAccount<T>, platform_id: &ID): &mut Subscription {
        vec_map::get_mut(&mut account.subscriptions, platform_id)
    }

    // === Subscription accessors ===

    public fun subscription_platform_id(sub: &Subscription): ID {
        sub.platform_id
    }

    public fun subscription_tier_index(sub: &Subscription): u64 {
        sub.tier_index
    }

    public fun subscription_status(sub: &Subscription): &SubscriptionStatus {
        &sub.status
    }

    public fun subscription_total_paid(sub: &Subscription): u64 {
        sub.total_paid
    }

    public fun subscription_payment_count(sub: &Subscription): u64 {
        sub.payment_count
    }

    public fun subscription_schedule(sub: &Subscription): &BillingSchedule {
        &sub.schedule
    }

    public fun billing_schedule_frequency_days(s: &BillingSchedule): u64 {
        s.frequency_days
    }

    public fun billing_schedule_next_billing_time(s: &BillingSchedule): u64 {
        s.next_billing_time
    }

    // === Subscription mutators ===

    public fun subscription_set_tier_index(sub: &mut Subscription, tier_index: u64) {
        sub.tier_index = tier_index;
    }

    public fun subscription_set_status(sub: &mut Subscription, status: SubscriptionStatus) {
        sub.status = status;
    }

    public fun subscription_inc_total_paid(sub: &mut Subscription, amount: u64) {
        sub.total_paid = sub.total_paid + amount;
    }

    public fun subscription_inc_payment_count(sub: &mut Subscription) {
        sub.payment_count = sub.payment_count + 1;
    }

    public fun subscription_update_schedule(sub: &mut Subscription, last_billing_time: u64, next_billing_time: u64) {
        sub.schedule.last_billing_time = last_billing_time;
        sub.schedule.next_billing_time = next_billing_time;
    }

    public fun subscription_set_updated_at(sub: &mut Subscription, timestamp: u64) {
        sub.updated_at = timestamp;
    }

    // === Subscription constructors (called by subscription_manager) ===

    public fun new_billing_schedule(frequency_days: u64, next_billing_time: u64, last_billing_time: u64): BillingSchedule {
        BillingSchedule {
            frequency_days,
            next_billing_time,
            last_billing_time,
        }
    }

    public fun new_subscription(
        platform_id: ID,
        tier_index: u64,
        tier_amount: u64,
        tier_frequency_days: u64,
        status: SubscriptionStatus,
        schedule: BillingSchedule,
        total_paid: u64,
        payment_count: u64,
        created_at: u64,
        updated_at: u64,
    ): Subscription {
        Subscription {
            platform_id,
            tier_index,
            tier_amount,
            tier_frequency_days,
            status,
            schedule,
            total_paid,
            payment_count,
            created_at,
            updated_at,
        }
    }

    // === Policy helpers ===

    public fun new_policy_config(
        max_monthly_withdrawal: u64,
        max_per_transaction: u64,
        min_balance: u64,
        min_frequency_days: u64,
    ): PolicyConfig {
        PolicyConfig {
            max_monthly_withdrawal,
            max_per_transaction,
            min_balance,
            min_frequency_days,
            last_withdrawal_time: 0,
        }
    }

    // === Payment recording (called by platform_registry) ===

    /// Records a successful payment and advances the billing schedule.
    /// Called by platform after withdrawal. No capability needed since
    /// withdraw already verified platform authorization.
    public fun record_payment<T>(
        account: &mut SubscriptionAccount<T>,
        platform_id: ID,
        amount: u64,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let sub = get_subscription_mut(account, &platform_id);
        assert!(sub.status.variant == 0, E_SUBSCRIPTION_PAUSED);

        let new_total = sub.total_paid;
        let freq_days = sub.schedule.frequency_days;

        sub.total_paid = sub.total_paid + amount;
        sub.payment_count = sub.payment_count + 1;
        let now = clock.timestamp_ms();
        sub.schedule.last_billing_time = now;
        sub.schedule.next_billing_time = now + (freq_days * 86400000);
        sub.updated_at = now;

        emit(PaymentRecorded {
            account_id: object::id(account),
            platform_id,
            amount,
            new_total_paid: new_total,
            timestamp: now,
        });
    }

    // === View functions ===

    public fun get_balance<T>(account: &SubscriptionAccount<T>): u64 {
        account.balance.value()
    }

    public fun get_policies<T>(account: &SubscriptionAccount<T>): &PolicyConfig {
        &account.policies
    }

    public fun get_account_info<T>(account: &SubscriptionAccount<T>): (u8, u64, u64) {
        (account.status.variant, account.created_at, account.balance.value())
    }

    public fun check_withdrawal<T>(
        account: &SubscriptionAccount<T>,
        amount: u64
    ): (bool, vector<u64>) {
        let mut errors = vector[];
        let policy = &account.policies;

        if (amount > policy.max_per_transaction) vector::push_back(&mut errors, E_POLICY_EXCEEDED_TRANSACTION);
        if (account.balance.value() - amount < policy.min_balance) vector::push_back(&mut errors, E_POLICY_MIN_BALANCE_VIOLATION);
        if (account.monthly_withdrawn + amount > policy.max_monthly_withdrawal) vector::push_back(&mut errors, E_POLICY_EXCEEDED_MONTHLY);

        let allowed = vector::length(&errors) == 0;
        (allowed, errors)
    }
}