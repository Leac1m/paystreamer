// Copyright (c) leac1m
// SPDX-License-Identifier: Apache-2.0

/// Subscription manager module: subscription lifecycle management,
/// child object creation, and billing operations.
module subscriptions::subscription_manager {
    use sui::clock::Clock;
    use sui::event::emit;
    use sui::vec_map;

    // Import from subscription_account module
    use subscriptions::subscription_account::{
        SubscriptionAccount,
        Subscription,
        SubscriptionStatus,
        BillingSchedule,
        AccountCap,
        cap_account_id,
        add_subscription,
        has_subscription,
        get_subscription,
        get_subscription_mut,
        new_billing_schedule,
        new_subscription,
        subscription_status_active,
        subscription_status_paused,
        subscription_status_cancelled,
        subscription_status,
        subscription_status_variant,
        subscription_status_is_active,
        subscription_status_is_paused,
        subscription_tier_index,
        subscription_total_paid,
        subscription_payment_count,
        subscription_schedule,
        subscription_platform_id,
        billing_schedule_next_billing_time,
        subscription_set_tier_index,
        subscription_set_status,
        subscription_set_updated_at,
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
    };

    // === Error constants ===
    const E_INVALID_TIER: u64 = 0x30003;
    const E_SUBSCRIPTION_PAUSED: u64 = 0x30006;
    const E_SUBSCRIPTION_NOT_PAUSED: u64 = 0x30007;
    const E_SUBSCRIPTION_ALREADY_EXISTS: u64 = 0x30008;

    // === Data structures ===

    // (BillingSchedule and Subscription imported from subscription_account)

    // === Events ===

    public struct SubscriptionCreated has copy, drop {
        account_id: ID,
        platform_id: ID,
        tier_index: u64,
        timestamp: u64,
    }

    public struct SubscriptionUpdated has copy, drop {
        account_id: ID,
        platform_id: ID,
        changes: u8, // 0=tier, 1=resumed, 2=cancelled
        timestamp: u64,
    }

    public struct SubscriptionPaused has copy, drop {
        account_id: ID,
        platform_id: ID,
        timestamp: u64,
    }

    public struct SubscriptionResumed has copy, drop {
        account_id: ID,
        platform_id: ID,
        timestamp: u64,
    }

    public struct SubscriptionCancelled has copy, drop {
        account_id: ID,
        platform_id: ID,
        timestamp: u64,
    }

    public struct FailedPaymentRecorded has copy, drop {
        account_id: ID,
        platform_id: ID,
        amount: u64,
        reason: u64,
        timestamp: u64,
    }

    // === Accessors (imported from subscription_account) ===

    // === Entry points ===

    /// Creates and authorizes a subscription in one step.
    /// Subscription is embedded directly in the account's VecMap.
    public fun create_subscription<T>(
        account_cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        platform: &Platform,
        tier_index: u64,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let account_id = object::id(account);
        assert!(account_id == cap_account_id(account_cap), 0x10001);

        let platform_id = object::id(platform);

        // Idempotency check
        assert!(!has_subscription<T>(account, &platform_id), E_SUBSCRIPTION_ALREADY_EXISTS);

        let tiers = get_platform_tiers(platform);
        assert!(tier_index < vector::length(tiers), E_INVALID_TIER);

        let tier = get_tier(platform, tier_index);
        assert!(tier_is_active(tier), E_INVALID_TIER);

        let now = clock.timestamp_ms();
        let freq_variant = tier_frequency_variant(tier);
        let freq_days = (freq_variant as u64 + 1) * 30;
        let frequency_ms = freq_days * 86400000u64;

        let schedule = new_billing_schedule(freq_days, now + frequency_ms, 0);

        let subscription = new_subscription(
            platform_id,
            tier_index,
            tier_amount(tier),
            freq_days,
            subscription_status_active(),
            schedule,
            0,
            0,
            now,
            now,
        );

        add_subscription<T>(account, platform_id, subscription);

        emit(SubscriptionCreated {
            account_id,
            platform_id,
            tier_index,
            timestamp: now,
        });
    }

    /// Updates subscription tier.
    public fun update_subscription_tier<T>(
        account_cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        platform_id: ID,
        new_tier_index: u64,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(object::id(account) == cap_account_id(account_cap), 0x10001);
        let sub = get_subscription_mut(account, &platform_id);
        assert!(subscription_status_is_active(subscription_status(sub)), E_SUBSCRIPTION_PAUSED);

        subscription_set_tier_index(sub, new_tier_index);
        subscription_set_updated_at(sub, clock.timestamp_ms());

        emit(SubscriptionUpdated {
            account_id: object::id(account),
            platform_id,
            changes: 0, // tier change
            timestamp: clock.timestamp_ms(),
        });
    }

    /// Pauses an active subscription.
    public fun pause_subscription<T>(
        account_cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        platform_id: ID,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(object::id(account) == cap_account_id(account_cap), 0x10001);
        let sub = get_subscription_mut(account, &platform_id);
        assert!(subscription_status_is_active(subscription_status(sub)), E_SUBSCRIPTION_NOT_PAUSED);

        subscription_set_status(sub, subscription_status_paused());
        subscription_set_updated_at(sub, clock.timestamp_ms());

        emit(SubscriptionPaused {
            account_id: object::id(account),
            platform_id,
            timestamp: clock.timestamp_ms(),
        });
    }

    /// Resumes a paused subscription.
    public fun resume_subscription<T>(
        account_cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        platform_id: ID,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(object::id(account) == cap_account_id(account_cap), 0x10001);
        let sub = get_subscription_mut(account, &platform_id);
        assert!(subscription_status_is_paused(subscription_status(sub)), E_SUBSCRIPTION_PAUSED);

        subscription_set_status(sub, subscription_status_active());
        subscription_set_updated_at(sub, clock.timestamp_ms());

        emit(SubscriptionResumed {
            account_id: object::id(account),
            platform_id,
            timestamp: clock.timestamp_ms(),
        });
    }

    /// Cancels a subscription immediately.
    public fun cancel_subscription<T>(
        account_cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        platform_id: ID,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(object::id(account) == cap_account_id(account_cap), 0x10001);
        let sub = get_subscription_mut(account, &platform_id);

        subscription_set_status(sub, subscription_status_cancelled());
        subscription_set_updated_at(sub, clock.timestamp_ms());

        emit(SubscriptionCancelled {
            account_id: object::id(account),
            platform_id,
            timestamp: clock.timestamp_ms(),
        });
    }

    /// Records a failed payment attempt (called by platform on failure).
    public fun record_failed_payment<T>(
        account_cap: &AccountCap,
        account: &mut SubscriptionAccount<T>,
        platform_id: ID,
        amount: u64,
        reason: u64,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(object::id(account) == cap_account_id(account_cap), 0x10001);

        emit(FailedPaymentRecorded {
            account_id: object::id(account),
            platform_id,
            amount,
            reason,
            timestamp: clock.timestamp_ms(),
        });
    }

    // === View functions ===

    public fun get_schedule<T>(account: &SubscriptionAccount<T>, platform_id: &ID): &BillingSchedule {
        let sub = get_subscription(account, platform_id);
        subscription_schedule(sub)
    }

    public fun get_subscription_info<T>(account: &SubscriptionAccount<T>, platform_id: &ID): (ID, u64, u8, u64, u64) {
        let sub = get_subscription(account, platform_id);
        (
            subscription_platform_id(sub),
            subscription_tier_index(sub),
            subscription_status_variant(subscription_status(sub)),
            subscription_total_paid(sub),
            subscription_payment_count(sub),
        )
    }

    public fun is_active<T>(account: &SubscriptionAccount<T>, platform_id: &ID): bool {
        let sub = get_subscription(account, platform_id);
        subscription_status_is_active(subscription_status(sub))
    }

    public fun can_bill<T>(account: &SubscriptionAccount<T>, platform_id: &ID, clock: &Clock): bool {
        let sub = get_subscription(account, platform_id);
        if (!subscription_status_is_active(subscription_status(sub))) return false;
        clock.timestamp_ms() >= billing_schedule_next_billing_time(subscription_schedule(sub))
    }
}