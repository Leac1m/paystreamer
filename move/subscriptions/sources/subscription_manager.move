// Copyright (c) leac1m
// SPDX-License-Identifier: Apache-2.0

/// Subscription manager module: subscription lifecycle management,
/// child object creation, and billing operations.
module subscriptions::subscription_manager {
    use sui::object::{Self, UID, ID};
    use sui::clock::Clock;
    use sui::tx_context::TxContext;
    use sui::event::emit;
    use sui::vec_map;
    use sui::transfer;
    use std::vector;

    // Import from subscription_account module
    use subscriptions::subscription_account::{
        SubscriptionAccount,
        AccountCap,
        PlatformCap,
        cap_account_id,
        add_subscription,
        has_subscription,
    };

    // Import from platform_registry module
    use subscriptions::platform_registry::{
        Platform,
        PlatformOwnerCap,
        get_tier,
        get_platform_tiers,
        tier_is_active,
        tier_frequency_variant,
        tier_amount,
        platform_owner_address,
    };

    // === Error constants ===
    const E_INVALID_TIER: u64 = 0x30003;
    const E_SUBSCRIPTION_PAUSED: u64 = 0x30006;
    const E_SUBSCRIPTION_NOT_PAUSED: u64 = 0x30007;
    const E_SUBSCRIPTION_ALREADY_EXISTS: u64 = 0x30008;

    // === Enums ===

    /// Subscription lifecycle status
    public struct SubscriptionStatus has store, drop {
        variant: u8,
    }

    public fun subscription_status_active(): SubscriptionStatus { SubscriptionStatus { variant: 0 } }
    public fun subscription_status_paused(): SubscriptionStatus { SubscriptionStatus { variant: 1 } }
    public fun subscription_status_cancelled(): SubscriptionStatus { SubscriptionStatus { variant: 2 } }
    public fun subscription_status_variant(s: &SubscriptionStatus): u8 { s.variant }

    // === Data structures ===

    /// Billing schedule for a subscription
    public struct BillingSchedule has store, drop {
        frequency_days: u64,
        next_billing_time: u64,
        last_billing_time: u64,
    }

    /// Individual subscription child object attached to a SubscriptionAccount.
    /// Tracks lifecycle, billing schedule, and payment history.
    public struct Subscription has key, store {
        id: UID,
        platform_id: ID,
        platform_address: address,
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

    // === Events ===

    public struct SubscriptionCreated has copy, drop {
        subscription_id: ID,
        account_id: ID,
        platform_id: ID,
        tier_index: u64,
        timestamp: u64,
    }

    public struct SubscriptionUpdated has copy, drop {
        subscription_id: ID,
        account_id: ID,
        changes: u8, // 0=tier, 1=resumed, 2=cancelled
        timestamp: u64,
    }

    public struct SubscriptionPaused has copy, drop {
        subscription_id: ID,
        account_id: ID,
        timestamp: u64,
    }

    public struct SubscriptionResumed has copy, drop {
        subscription_id: ID,
        account_id: ID,
        timestamp: u64,
    }

    public struct SubscriptionCancelled has copy, drop {
        subscription_id: ID,
        account_id: ID,
        timestamp: u64,
    }

    public struct PaymentRecorded has copy, drop {
        subscription_id: ID,
        account_id: ID,
        platform_id: ID,
        amount: u64,
        new_total_paid: u64,
        timestamp: u64,
    }

    public struct FailedPaymentRecorded has copy, drop {
        subscription_id: ID,
        account_id: ID,
        platform_id: ID,
        amount: u64,
        reason: u64,
        timestamp: u64,
    }

    // === Accessors ===

    public fun subscription_id(sub: &Subscription): ID {
        object::id(sub)
    }

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

    // === Entry points ===

    /// Creates a new subscription for the account-cap holder.
    /// Stores the Subscription object and adds entry to SubscriptionAccount's VecMap.
    /// Does NOT perform payment — payment is a separate PTB step.
    public fun create_subscription<T>(
        account_cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        platform: &Platform,
        tier_index: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let account_id = object::id(account);
        assert!(account_id == cap_account_id(account_cap), 0x10001); // E_INVALID_CAP

        let platform_address = platform_owner_address(platform);

        // Idempotency check
        assert!(!has_subscription<T>(account, &platform_address), E_SUBSCRIPTION_ALREADY_EXISTS);

        let tiers = get_platform_tiers(platform);
        assert!(tier_index < vector::length(tiers), E_INVALID_TIER);

        let tier = get_tier(platform, tier_index);
        assert!(tier_is_active(tier), E_INVALID_TIER);

        let now = clock.timestamp_ms();
        let freq_variant = tier_frequency_variant(tier);
        let freq_days = (freq_variant as u64 + 1) * 30;
        let frequency_ms = freq_days * 86400000u64;

        let schedule = BillingSchedule {
            frequency_days: freq_days,
            next_billing_time: now + frequency_ms,
            last_billing_time: 0,
        };

        let subscription = Subscription {
            id: object::new(ctx),
            platform_id: object::id(platform),
            platform_address,
            tier_index,
            tier_amount: tier_amount(tier),
            tier_frequency_days: freq_days,
            status: subscription_status_active(),
            schedule,
            total_paid: 0,
            payment_count: 0,
            created_at: now,
            updated_at: now,
        };

        let sub_id = object::id(&subscription);

        // Publish Subscription object to the user (account owner)
        transfer::transfer(subscription, ctx.sender());

        // Add to VecMap for authorization lookup
        add_subscription<T>(account, platform_address, sub_id);

        emit(SubscriptionCreated {
            subscription_id: sub_id,
            account_id,
            platform_id: object::id(platform),
            tier_index,
            timestamp: now,
        });
    }
    /// Updates subscription tier.
    public fun update_subscription_tier<T>(
        account_cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        subscription: &mut Subscription,
        new_tier_index: u64,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(object::id(account) == cap_account_id(account_cap), 0x10001);
        assert!(subscription.status.variant == 0, E_SUBSCRIPTION_PAUSED);

        subscription.tier_index = new_tier_index;
        subscription.updated_at = clock.timestamp_ms();

        emit(SubscriptionUpdated {
            subscription_id: object::id(subscription),
            account_id: object::id(account),
            changes: 0, // tier change
            timestamp: clock.timestamp_ms(),
        });
    }

    /// Pauses an active subscription.
    public fun pause_subscription<T>(
        account_cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        subscription: &mut Subscription,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(object::id(account) == cap_account_id(account_cap), 0x10001);
        assert!(subscription.status.variant == 0, E_SUBSCRIPTION_NOT_PAUSED);

        subscription.status = subscription_status_paused();
        subscription.updated_at = clock.timestamp_ms();

        emit(SubscriptionPaused {
            subscription_id: object::id(subscription),
            account_id: object::id(account),
            timestamp: clock.timestamp_ms(),
        });
    }

    /// Resumes a paused subscription.
    public fun resume_subscription<T>(
        account_cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        subscription: &mut Subscription,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(object::id(account) == cap_account_id(account_cap), 0x10001);
        assert!(subscription.status.variant == 1, E_SUBSCRIPTION_PAUSED);

        subscription.status = subscription_status_active();
        subscription.updated_at = clock.timestamp_ms();

        emit(SubscriptionResumed {
            subscription_id: object::id(subscription),
            account_id: object::id(account),
            timestamp: clock.timestamp_ms(),
        });
    }

    /// Cancels a subscription immediately.
    public fun cancel_subscription<T>(
        account_cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        subscription: &mut Subscription,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(object::id(account) == cap_account_id(account_cap), 0x10001);

        subscription.status = subscription_status_cancelled();
        subscription.updated_at = clock.timestamp_ms();

        emit(SubscriptionCancelled {
            subscription_id: object::id(subscription),
            account_id: object::id(account),
            timestamp: clock.timestamp_ms(),
        });
    }

    /// Records a successful payment (called by platform after withdraw).
    public fun record_payment<T>(
        account_cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        subscription: &mut Subscription,
        amount: u64,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(object::id(account) == cap_account_id(account_cap), 0x10001);
        assert!(subscription.status.variant == 0, E_SUBSCRIPTION_PAUSED);

        subscription.total_paid = subscription.total_paid + amount;
        subscription.payment_count = subscription.payment_count + 1;
        subscription.schedule.last_billing_time = clock.timestamp_ms();
        subscription.schedule.next_billing_time = clock.timestamp_ms() + (subscription.schedule.frequency_days * 86400000);
        subscription.updated_at = clock.timestamp_ms();

        emit(PaymentRecorded {
            subscription_id: object::id(subscription),
            account_id: object::id(account),
            platform_id: subscription.platform_id,
            amount,
            new_total_paid: subscription.total_paid,
            timestamp: clock.timestamp_ms(),
        });
    }

    /// Records a failed payment attempt (called by platform on failure).
    public fun record_failed_payment<T>(
        account_cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        subscription: &mut Subscription,
        amount: u64,
        reason: u64,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(object::id(account) == cap_account_id(account_cap), 0x10001);

        emit(FailedPaymentRecorded {
            subscription_id: object::id(subscription),
            account_id: object::id(account),
            platform_id: subscription.platform_id,
            amount,
            reason,
            timestamp: clock.timestamp_ms(),
        });
    }

    // === View functions ===

    public fun get_schedule(sub: &Subscription): &BillingSchedule {
        &sub.schedule
    }

    public fun get_subscription_info(sub: &Subscription): (ID, u64, u8, u64, u64) {
        (
            sub.platform_id,
            sub.tier_index,
            sub.status.variant,
            sub.total_paid,
            sub.payment_count,
        )
    }

    public fun is_active(sub: &Subscription): bool {
        sub.status.variant == 0
    }

    public fun can_bill(sub: &Subscription, clock: &Clock): bool {
        if (sub.status.variant != 0) return false;
        clock.timestamp_ms() >= sub.schedule.next_billing_time
    }
}