/// `subscriptions::subscription` — Subscription lifecycle and record keeping.
///
/// Manages the `Subscription` struct which is embedded in the `SubscriptionAccount`.
/// Keeps track of the billing schedule, failures, and active/paused/cancelled status.
module subscriptions::subscription {
    use sui::object::ID;
    use sui::clock::Clock;
    use sui::event;

    // === Errors ===

    /// The operation requires `status == 0` (active) but the
    /// subscription is paused or cancelled.
    const ESubscriptionNotActive: u64 = 0x06004;

    /// The operation requires `status == 1` (paused).
    const ESubscriptionNotPaused: u64 = 0x06005;

    // === Events ===

    /// Emitted on every successful `create`.
    public struct SubscriptionCreated has copy, drop {
        account_id: ID,
        platform_id: ID,
        tier_index: u64,
        tier_amount: u64,
        tier_frequency_ms: u64,
        v: u16,
    }

    /// Emitted on pause / resume / cancel / tier change.
    /// `change_kind` mapping: 0 = tier change, 1 = resumed, 2 = cancelled,
    /// 3 = paused, 4 = max_attempts change, 5 = schedule_frequency change.
    public struct SubscriptionUpdated has copy, drop {
        account_id: ID,
        platform_id: ID,
        change_kind: u8,
        v: u16,
    }

    /// Emitted on every successful billing pass.
    public struct PaymentRecorded has copy, drop {
        account_id: ID,
        platform_id: ID,
        amount: u64,
        new_total_paid: u64,
        new_payment_count: u64,
        nonce: u64,
        v: u16,
    }

    /// Emitted on a failed billing attempt.
    public struct FailedPaymentRecorded has copy, drop {
        account_id: ID,
        platform_id: ID,
        amount: u64,
        reason: u64,
        v: u16,
    }

    // === Subscription ===

    /// Per-platform subscription struct.
    public struct Subscription has store, drop {
        platform_id: ID,
        tier_index: u64,
        tier_amount: u64,
        tier_frequency_ms: u64,
        status: u8, // 0 = active, 1 = paused, 2 = cancelled
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

    // === Lifecycle Mutators ===

    /// Creates a new subscription and emits `SubscriptionCreated`.
    /// `public(package)` because it should only be called by `billing.move`
    /// which enforces the account-level deduplication.
    public(package) fun create(
        account_id: ID,
        platform_id: ID,
        tier_index: u64,
        tier_amount: u64,
        tier_frequency_ms: u64,
        max_attempts: u8,
        clock: &Clock,
    ): Subscription {
        let now = clock.timestamp_ms();
        event::emit(SubscriptionCreated {
            account_id,
            platform_id,
            tier_index,
            tier_amount,
            tier_frequency_ms,
            v: 2,
        });

        Subscription {
            platform_id,
            tier_index,
            tier_amount,
            tier_frequency_ms,
            status: 0,
            schedule_frequency_ms: tier_frequency_ms,
            next_billing_time: now + tier_frequency_ms,
            last_billing_time: 0,
            total_paid: 0,
            payment_count: 0,
            last_attempt_time: 0,
            attempt_count: 0,
            max_attempts,
            nonce: 0,
            created_at: now,
            updated_at: now,
        }
    }

    /// Pause an active subscription.
    public(package) fun pause(s: &mut Subscription, account_id: ID, clock: &Clock) {
        assert!(s.status == 0, ESubscriptionNotActive);
        s.status = 1;
        s.updated_at = clock.timestamp_ms();
        event::emit(SubscriptionUpdated {
            account_id,
            platform_id: s.platform_id,
            change_kind: 3,
            v: 2,
        });
    }

    /// Resume a paused subscription.
    public(package) fun resume(s: &mut Subscription, account_id: ID, clock: &Clock) {
        assert!(s.status == 1, ESubscriptionNotPaused);
        s.status = 0;
        s.updated_at = clock.timestamp_ms();
        event::emit(SubscriptionUpdated {
            account_id,
            platform_id: s.platform_id,
            change_kind: 1,
            v: 2,
        });
    }

    /// Cancel a subscription. Terminal: status flips to 2 and stays there.
    /// Returns `true` if the subscription was active or paused prior to cancellation,
    /// so the orchestrator can remove it from its map.
    public(package) fun cancel(s: &mut Subscription, account_id: ID, clock: &Clock): bool {
        let was_active_or_paused = s.status == 0 || s.status == 1;
        s.status = 2;
        s.updated_at = clock.timestamp_ms();
        if (was_active_or_paused) {
            event::emit(SubscriptionUpdated {
                account_id,
                platform_id: s.platform_id,
                change_kind: 2,
                v: 2,
            });
        };
        was_active_or_paused
    }

    /// Update a subscription's maximum billing attempts per cycle.
    public(package) fun update_max_attempts(s: &mut Subscription, account_id: ID, max_attempts: u8, clock: &Clock) {
        s.max_attempts = max_attempts;
        s.updated_at = clock.timestamp_ms();
        event::emit(SubscriptionUpdated {
            account_id,
            platform_id: s.platform_id,
            change_kind: 4,
            v: 2,
        });
    }

    /// Update a subscription's tier information.
    public(package) fun update_tier(
        s: &mut Subscription,
        account_id: ID,
        tier_index: u64,
        tier_amount: u64,
        tier_frequency_ms: u64,
        clock: &Clock,
    ) {
        s.tier_index = tier_index;
        s.tier_amount = tier_amount;
        s.tier_frequency_ms = tier_frequency_ms;
        s.updated_at = clock.timestamp_ms();
        event::emit(SubscriptionUpdated {
            account_id,
            platform_id: s.platform_id,
            change_kind: 0,
            v: 2,
        });
    }

    /// Update a subscription's schedule frequency.
    public(package) fun update_schedule_frequency(
        s: &mut Subscription,
        account_id: ID,
        schedule_frequency_ms: u64,
        clock: &Clock,
    ) {
        s.schedule_frequency_ms = schedule_frequency_ms;
        s.updated_at = clock.timestamp_ms();
        event::emit(SubscriptionUpdated {
            account_id,
            platform_id: s.platform_id,
            change_kind: 5,
            v: 2,
        });
    }

    /// Advance the subscription's billing state on a successful charge.
    public(package) fun record_payment(
        s: &mut Subscription,
        account_id: ID,
        amount: u64,
        clock: &Clock,
    ) {
        assert!(s.status == 0, ESubscriptionNotActive);
        let now = clock.timestamp_ms();
        s.total_paid = s.total_paid + amount;
        s.payment_count = s.payment_count + 1;
        s.last_billing_time = now;
        s.next_billing_time = now + s.schedule_frequency_ms;
        s.last_attempt_time = now;
        s.attempt_count = 0;
        s.nonce = s.nonce + 1;
        s.updated_at = now;

        event::emit(PaymentRecorded {
            account_id,
            platform_id: s.platform_id,
            amount,
            new_total_paid: s.total_paid,
            new_payment_count: s.payment_count,
            nonce: s.nonce,
            v: 2,
        });
    }

    /// Stamp a failed-attempt on the subscription.
    public(package) fun record_failed_payment(
        s: &mut Subscription,
        account_id: ID,
        amount: u64,
        reason: u64,
        clock: &Clock,
    ) {
        let now = clock.timestamp_ms();
        s.attempt_count = s.attempt_count + 1;
        s.last_attempt_time = now;
        
        if (s.attempt_count >= 3) {
            s.status = 1; // PAUSED
        };

        s.updated_at = now;
        event::emit(FailedPaymentRecorded {
            account_id,
            platform_id: s.platform_id,
            amount,
            reason,
            v: 2,
        });
    }

    /// Called when the account-level state changes to pause.
    /// This is an internal cascade and doesn't emit a separate `SubscriptionUpdated` event.
    public(package) fun cascade_pause(s: &mut Subscription, clock: &Clock) {
        if (s.status == 0) {
            s.status = 1;
            s.updated_at = clock.timestamp_ms();
        };
    }

    // === Public Queries ===

    /// `true` iff the subscription exists, is active (`status == 0`),
    /// and `now >= next_billing_time`.
    public fun can_bill(s: &Subscription, clock: &Clock): bool {
        if (s.status != 0) {
            return false
        };
        clock.timestamp_ms() >= s.next_billing_time
    }

    // === Accessors ===

    public fun platform_id(s: &Subscription): ID { s.platform_id }
    public fun tier_index(s: &Subscription): u64 { s.tier_index }
    public fun tier_amount(s: &Subscription): u64 { s.tier_amount }
    public fun tier_frequency_ms(s: &Subscription): u64 { s.tier_frequency_ms }
    public fun status(s: &Subscription): u8 { s.status }
    public fun is_active(s: &Subscription): bool { s.status == 0 }
    public fun is_paused(s: &Subscription): bool { s.status == 1 }
    public fun is_cancelled(s: &Subscription): bool { s.status == 2 }
    public fun schedule_frequency_ms(s: &Subscription): u64 { s.schedule_frequency_ms }
    public fun next_billing_time(s: &Subscription): u64 { s.next_billing_time }
    public fun last_billing_time(s: &Subscription): u64 { s.last_billing_time }
    public fun total_paid(s: &Subscription): u64 { s.total_paid }
    public fun payment_count(s: &Subscription): u64 { s.payment_count }
    public fun last_attempt_time(s: &Subscription): u64 { s.last_attempt_time }
    public fun attempt_count(s: &Subscription): u8 { s.attempt_count }
    public fun max_attempts(s: &Subscription): u8 { s.max_attempts }
    public fun nonce(s: &Subscription): u64 { s.nonce }
    public fun created_at(s: &Subscription): u64 { s.created_at }
    public fun updated_at(s: &Subscription): u64 { s.updated_at }

    // === Test-only Helpers ===

    #[test_only]
    public fun new_for_testing(
        platform_id: ID,
        tier_index: u64,
        tier_amount: u64,
        tier_frequency_ms: u64,
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
    ): Subscription {
        Subscription {
            platform_id,
            tier_index,
            tier_amount,
            tier_frequency_ms,
            schedule_frequency_ms,
            next_billing_time,
            last_billing_time,
            total_paid,
            payment_count,
            last_attempt_time,
            attempt_count,
            max_attempts,
            nonce,
            status,
            created_at,
            updated_at,
        }
    }
}
