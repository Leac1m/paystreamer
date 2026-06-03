// Copyright (c) leac1m
// SPDX-License-Identifier: Apache-2.0

/// Platform registry module: platform registration, tier management,
/// and withdrawal operations for the subscription system.
module subscriptions::platform_registry {
    use sui::coin::Coin;
    use sui::balance::Balance;
    use sui::clock::Clock;
    use sui::event::emit;
    use sui::transfer;

    // Import from subscription_account module
    use subscriptions::subscription_account::{
        SubscriptionAccount,
        withdraw,
        record_payment,
    };

    // === Error constants ===
    const E_UNAUTHORIZED_OWNER: u64 = 0x20002;
    const E_TIER_NOT_FOUND: u64 = 0x20003;
    const E_TOO_MANY_TIERS: u64 = 0x20004;
    const E_DUPLICATE_TIER_NAME: u64 = 0x20005;
    const E_BATCH_LENGTH_MISMATCH: u64 = 0x20007;

    // === Enums ===

    /// Platform lifecycle status
    public struct PlatformStatus has store, drop {
        variant: u8,
    }

    public fun platform_status_active(): PlatformStatus { PlatformStatus { variant: 0 } }
    public fun platform_status_suspended(): PlatformStatus { PlatformStatus { variant: 1 } }
    public fun platform_status_deprecated(): PlatformStatus { PlatformStatus { variant: 2 } }
    public fun platform_status_variant(s: &PlatformStatus): u8 { s.variant }

    /// Billing frequency options
    public struct BillingFrequency has store, drop {
        variant: u8,
    }

    public fun billing_frequency_daily(): BillingFrequency { BillingFrequency { variant: 0 } }
    public fun billing_frequency_weekly(): BillingFrequency { BillingFrequency { variant: 1 } }
    public fun billing_frequency_monthly(): BillingFrequency { BillingFrequency { variant: 2 } }
    public fun billing_frequency_yearly(): BillingFrequency { BillingFrequency { variant: 3 } }
    public fun billing_frequency_variant(f: &BillingFrequency): u8 { f.variant }

    // === Data structures ===

    /// Platform subscription tier definition
    public struct SubscriptionTier has store, drop {
        name: std::string::String,
        amount: u64,
        frequency: BillingFrequency,
        is_active: bool,
    }

    /// Represents a platform that accepts subscription payments.
    /// Stored as a shared object to enable lookups by users.
    public struct Platform has key, store {
        id: UID,
        owner: address,
        name: std::string::String,
        description: std::string::String,
        category: std::string::String,
        webhook_url: std::option::Option<std::string::String>,
        is_verified: bool,
        subscriber_count: u64,
        created_at: u64,
        status: PlatformStatus,
        tiers: vector<SubscriptionTier>,
    }

    /// Capability granting platform management authority.
    public struct PlatformOwnerCap has key, store {
        id: UID,
        platform_id: ID,
        created_at: u64,
    }

    // === Events ===

    public struct PlatformRegistered has copy, drop {
        platform_id: ID,
        owner: address,
        name: std::string::String,
        category: std::string::String,
        timestamp: u64,
    }

    public struct PlatformUpdated has copy, drop {
        platform_id: ID,
        updated_by: address,
        timestamp: u64,
    }

    public struct TierCreated has copy, drop {
        platform_id: ID,
        tier_index: u64,
        tier_name: std::string::String,
        amount: u64,
        frequency: u8,
        timestamp: u64,
    }

    public struct TierUpdated has copy, drop {
        platform_id: ID,
        tier_index: u64,
        changes: std::string::String,
        timestamp: u64,
    }

    public struct TierRemoved has copy, drop {
        platform_id: ID,
        tier_index: u64,
        timestamp: u64,
    }

    public struct WithdrawalProcessed has copy, drop {
        platform_id: ID,
        account_id: ID,
        amount: u64,
        success: bool,
        timestamp: u64,
    }

    // === Platform registration ===

    /// Registers a new platform with the subscription system.
    /// The registering address becomes the platform owner.
    public fun register_platform(
        name: std::string::String,
        description: std::string::String,
        category: std::string::String,
        webhook_url: std::option::Option<std::string::String>,
        ctx: &mut TxContext
    ): PlatformOwnerCap {
        let id = object::new(ctx);
        let platform_id = object::id_from_address(object::uid_to_address(&id));
        let now = ctx.epoch_timestamp_ms();

        let platform = Platform {
            id,
            owner: ctx.sender(),
            name,
            description,
            category,
            webhook_url,
            is_verified: false,
            subscriber_count: 0,
            created_at: now,
            status: platform_status_active(),
            tiers: vector[],
        };

        let platform_name = *&platform.name;
        let platform_category = *&platform.category;

        emit(PlatformRegistered {
            platform_id,
            owner: ctx.sender(),
            name: platform_name,
            category: platform_category,
            timestamp: now,
        });

        transfer::share_object(platform);

        let owner_cap = PlatformOwnerCap {
            id: object::new(ctx),
            platform_id,
            created_at: now,
        };

        (owner_cap)
    }

    /// Updates platform metadata (owner only).
    public fun update_platform(
        owner_cap: &PlatformOwnerCap,
        platform: &mut Platform,
        name: std::option::Option<std::string::String>,
        description: std::option::Option<std::string::String>,
        webhook_url: std::option::Option<std::string::String>,
        ctx: &mut TxContext
    ) {
        assert!(object::id(platform) == owner_cap.platform_id, E_UNAUTHORIZED_OWNER);
        assert!(platform.owner == ctx.sender(), E_UNAUTHORIZED_OWNER);

        if (name.is_some()) {
            platform.name = *name.borrow();
        };
        if (description.is_some()) {
            platform.description = *description.borrow();
        };
        if (webhook_url.is_some()) {
            platform.webhook_url = webhook_url;
        };

        emit(PlatformUpdated {
            platform_id: object::id(platform),
            updated_by: ctx.sender(),
            timestamp: ctx.epoch_timestamp_ms(),
        });
    }

    /// Updates platform verification status (owner only).
    public fun set_verified(
        owner_cap: &PlatformOwnerCap,
        platform: &mut Platform,
        verified: bool,
        _ctx: &mut TxContext
    ) {
        assert!(object::id(platform) == owner_cap.platform_id, E_UNAUTHORIZED_OWNER);
        platform.is_verified = verified;
    }

    // === Tier management ===

    /// Creates a subscription tier for this platform.
    const MAX_TIERS: u64 = 10;

    public fun create_tier(
        owner_cap: &PlatformOwnerCap,
        platform: &mut Platform,
        name: std::string::String,
        amount: u64,
        frequency: BillingFrequency,
        ctx: &mut TxContext
    ) {
        assert!(object::id(platform) == owner_cap.platform_id, E_UNAUTHORIZED_OWNER);
        assert!(platform.status.variant == 0, E_UNAUTHORIZED_OWNER); // not suspended/deprecated
        assert!(vector::length(&platform.tiers) < MAX_TIERS, E_TOO_MANY_TIERS);

        // Check for duplicate tier name
        let mut i = 0;
        while (i < vector::length(&platform.tiers)) {
            let tier = vector::borrow(&platform.tiers, i);
            assert!(&tier.name != &name, E_DUPLICATE_TIER_NAME);
            i = i + 1;
        };

        let tier_index = vector::length(&platform.tiers);
        let freq_variant = frequency.variant;
        vector::push_back(&mut platform.tiers, SubscriptionTier {
            name,
            amount,
            frequency,
            is_active: true,
        });

        emit(TierCreated {
            platform_id: object::id(platform),
            tier_index,
            tier_name: name,
            amount,
            frequency: freq_variant,
            timestamp: ctx.epoch_timestamp_ms(),
        });
    }

    /// Updates an existing subscription tier.
    public fun update_tier(
        owner_cap: &PlatformOwnerCap,
        platform: &mut Platform,
        tier_index: u64,
        name: std::option::Option<std::string::String>,
        amount: std::option::Option<u64>,
        is_active: std::option::Option<bool>,
        ctx: &mut TxContext
    ) {
        assert!(object::id(platform) == owner_cap.platform_id, E_UNAUTHORIZED_OWNER);
        assert!(tier_index < vector::length(&platform.tiers), E_TIER_NOT_FOUND);

        let tier = vector::borrow_mut(&mut platform.tiers, tier_index);

        if (name.is_some()) {
            tier.name = *name.borrow();
        };
        if (amount.is_some()) {
            tier.amount = *amount.borrow();
        };
        if (is_active.is_some()) {
            tier.is_active = *is_active.borrow();
        };

        emit(TierUpdated {
            platform_id: object::id(platform),
            tier_index,
            changes: "tier_updated",
            timestamp: ctx.epoch_timestamp_ms(),
        });
    }

    /// Removes a subscription tier.
    public fun remove_tier(
        owner_cap: &PlatformOwnerCap,
        platform: &mut Platform,
        tier_index: u64,
        ctx: &mut TxContext
    ) {
        assert!(object::id(platform) == owner_cap.platform_id, E_UNAUTHORIZED_OWNER);
        assert!(tier_index < vector::length(&platform.tiers), E_TIER_NOT_FOUND);

        // Note: In production, check that tier has no active subscriptions
        // For MVP, we allow removal without this check
        vector::remove(&mut platform.tiers, tier_index);

        emit(TierRemoved {
            platform_id: object::id(platform),
            tier_index,
            timestamp: ctx.epoch_timestamp_ms(),
        });
    }

    // === Platform withdrawal operations ===

    /// Processes a withdrawal from a user account.
    /// Requires a valid PlatformOwnerCap for the platform.
    /// Calls subscription_account::withdraw to process the actual transfer,
    /// then subscription_manager::record_payment to update billing schedule.
    #[allow(lint(self_transfer))]
    public fun process_withdrawal<T>(
        owner_cap: &PlatformOwnerCap,
        account: &mut SubscriptionAccount<T>,
        amount: u64,
        _clock: &Clock,
        ctx: &mut TxContext
    ) {
        let platform_id = owner_cap_platform_id(owner_cap);
        let recipient = ctx.sender();

        // Withdraw funds from account
        let withdrawn: Balance<T> = withdraw<T>(
            platform_id,
            account,
            amount,
            recipient,
            _clock,
            ctx,
        );

        // Convert Balance to Coin and transfer to platform owner
        let coin: Coin<T> = sui::coin::from_balance(withdrawn, ctx);
        transfer::public_transfer(coin, recipient);

        // Record payment to advance billing schedule
        record_payment<T>(account, platform_id, amount, _clock, ctx);

        emit(WithdrawalProcessed {
            platform_id,
            account_id: object::id(account),
            amount,
            success: true,
            timestamp: ctx.epoch_timestamp_ms(),
        });
    }

    /// Batch withdrawal processing for multiple accounts.
    /// Optimized for platform server efficiency.
    public fun batch_withdraw<T>(
        owner_cap: &PlatformOwnerCap,
        accounts: &mut vector<SubscriptionAccount<T>>,
        amounts: &vector<u64>,
        clock: &sui::clock::Clock,
        ctx: &mut TxContext
    ) {
        let num_accounts = vector::length(accounts);
        assert!(vector::length(amounts) == num_accounts, E_BATCH_LENGTH_MISMATCH);

        let mut i = 0;
        while (i < num_accounts) {
            let account = vector::borrow_mut(accounts, i);
            let amount = *vector::borrow(amounts, i);

            // Process withdrawal for this account
            // We use a simple loop; in production this could be optimized
            process_withdrawal<T>(owner_cap, account, amount, clock, ctx);

            i = i + 1;
        };
    }

    // === View functions ===

    public fun get_platform_info(
        platform: &Platform
    ): (std::string::String, std::string::String, std::string::String, bool, u64) {
        (
            platform.name,
            platform.description,
            platform.category,
            platform.is_verified,
            platform.subscriber_count,
        )
    }

    public fun get_platform_tiers(
        platform: &Platform
    ): &vector<SubscriptionTier> {
        &platform.tiers
    }

    public fun get_tier(
        platform: &Platform,
        tier_index: u64
    ): &SubscriptionTier {
        vector::borrow(&platform.tiers, tier_index)
    }

    public fun tier_name(tier: &SubscriptionTier): &std::string::String {
        &tier.name
    }

    public fun tier_amount(tier: &SubscriptionTier): u64 {
        tier.amount
    }

    public fun tier_frequency(tier: &SubscriptionTier): &BillingFrequency {
        &tier.frequency
    }

    public fun tier_is_active(tier: &SubscriptionTier): bool {
        tier.is_active
    }

    public fun tier_frequency_variant(tier: &SubscriptionTier): u8 {
        tier.frequency.variant
    }

    public fun get_subscriber_count(platform: &Platform): u64 {
        platform.subscriber_count
    }

    public fun get_platform_status(platform: &Platform): &PlatformStatus {
        &platform.status
    }

    public fun platform_id(platform: &Platform): ID {
        object::id(platform)
    }

    public fun platform_owner_address(platform: &Platform): address {
        platform.owner
    }

    public fun owner_cap_platform_id(cap: &PlatformOwnerCap): ID {
        cap.platform_id
    }
}