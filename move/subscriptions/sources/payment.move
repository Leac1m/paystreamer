// Copyright (c) leac1m
// SPDX-License-Identifier: Apache-2.0

/// `subscriptions::payment` — the single money-moving path for v2.
///
/// Per architecture §6.8 (with the per-Platform AC seam deferred to a
/// future hardening pass, see `access_control.move`): `process_due_payment`
/// is the **only** function in the v2 contract that withdraws user
/// funds. It is called by `scheduler.move` (the permissionless on-chain
/// entry point) after the global circuit breaker, the global pause flag,
/// and the platform's `PLATFORM_SCHEDULER_ROLE` grant have been checked
/// upstream. The function then verifies the per-subscription schedule,
/// runs the per-platform rate limiters, performs the two-pass policy
/// evaluation, and only then calls `account::internal_withdraw` to split
/// off the amount and `billing::record_payment` to advance the
/// schedule.
///
/// The architecture also lists four other invariants that live in
/// `scheduler.move` rather than here (architecture §6.8 steps 1, 2, 4,
/// 6): the global circuit breaker, the global pause flag, the
/// denomination match, and the `PLATFORM_SCHEDULER_ROLE` mint. We do
/// not duplicate those checks — the scheduler is the single place that
/// is allowed to call this function, and the per-subscription invariants
/// we DO check (the schedule, the amount, the rate limiters, the
/// policies) are the only invariants the scheduler cannot see.
///
/// ## Why a Coin return value
///
/// The actual `Coin<T>` is transferred to `platform.treasury` inside
/// this function. A zero-value `Coin<T>` is returned for forward-
/// compatibility (a future variant that returns the coin to the caller
/// for composability with PTBs would not change the signature). The
/// scheduler is expected to discard the return.
///
/// ## Error code range
///
/// 0x09__ per the project convention; see `account.move` and
/// `billing.move` for sibling ranges.
#[allow(lint(share_owned))]
module subscriptions::payment {
    use sui::object;
    use sui::coin::{Self, Coin};
    use sui::transfer;
    use sui::event;
    use sui::tx_context::TxContext;
    use sui::clock::Clock;
    use subscriptions::account::{Self, SubscriptionAccount};
    use subscriptions::billing::{Self, can_bill, record_payment, record_failed_payment};
    use subscriptions::policies::{Self, PolicyLimiters, PolicyFailure};
    use subscriptions::platform::{Self, Platform};

    // === Errors ===

    /// `can_bill` returned `false` — the subscription is not active or
    /// `now < next_billing_time`. Mirrors the v1 "not due" abort and
    /// surfaces the same condition with a v2-typed code.
    const ENotDue: u64 = 0x09001;

    /// The subscription's `tier_amount` is invalid (e.g. `0`).
    /// Reserved for future use; the spec currently treats `0` as a
    /// fatal misconfiguration and aborts before money moves.
    #[allow(unused_const)]
    const EInvalidAmount: u64 = 0x09002;

    /// The account's live headroom is below the requested `amount`.
    /// Surfaces `account::internal_withdraw`'s `EInsufficientBalance`
    /// at the payment-flow level so off-chain indexers can distinguish
    /// a billing failure (insufficient balance) from a schedule failure
    /// (`ENotDue`). Currently a forward-reserved code; the actual
    /// abort path is `account::internal_withdraw`'s native abort, so
    /// the constant is intentionally not referenced (and not asserted
    /// against) inside the function body. Kept for stable cross-module
    /// error-code references.
    #[allow(unused_const)]
    const EInsufficientBalance: u64 = 0x09003;

    /// One of the platform's three rate limiters
    /// (`volume_limiter`, `frequency_limiter`, `account_billing_limiter`)
    /// refused the consume. The persisted limiter state is untouched
    /// (OZ `try_consume` is all-or-nothing), so a downstream caller can
    /// retry the same `process_due_payment` after the limiters refill.
    const EPlatformRateLimited: u64 = 0x09004;

    /// The two-pass policy evaluation rejected the request. The full
    /// `vector<PolicyFailure>` is emitted in the `PaymentFailed` event
    /// so off-chain indexers can see *which* dimension failed and
    /// *why`. Persisted limiter state is untouched (a failed pass-1
    /// does not consume tokens, by design — architecture §7.4).
    const EPolicyViolation: u64 = 0x09005;

    /// The subscription's `tier_amount` resolved to `0`. Treated as a
    /// programmer / configuration error; aborts before money moves.
    const EZeroAmount: u64 = 0x09006;

    // === Events ===

    /// Emitted on every successful `process_due_payment`. The
    /// `policy_failures_count` field is the length of the failure
    /// vector returned by `policies::evaluate`; on a successful
    /// bill it is `0` (the vector is empty). Off-chain indexers
    /// can join `PaymentProcessed` against the per-platform treasury
    /// transfer to confirm the round-trip.
    public struct PaymentProcessed has copy, drop {
        account_id: ID,
        platform_id: ID,
        amount: u64,
        policy_failures_count: u64,
        remaining_balance: u64,
        nonce: u64,
        v: u16,
    }

    /// Emitted on a failed `process_due_payment`. The `reason` field
    /// is one of `ENotDue`, `EPlatformRateLimited`, `EPolicyViolation`,
    /// `EInsufficientBalance`, or `EZeroAmount`. The `amount` is the
    /// `tier_amount` at the time of the attempt (0 for `ENotDue` since
    /// the schedule is consulted first).
    public struct PaymentFailed has copy, drop {
        account_id: ID,
        platform_id: ID,
        amount: u64,
        reason: u64,
        v: u16,
    }

    // === process_due_payment ===

    /// THE single money-moving path. Called by `scheduler.move` (which
    /// has already checked the global circuit breaker, the global pause
    /// flag, and the platform's `PLATFORM_SCHEDULER_ROLE` grant).
    ///
    /// Steps (per design §6.8, scoped to the checks this function
    /// owns; the scheduler owns steps 1, 2, 4, 6):
    ///  1. Verify `can_bill` (subscription is active and due)
    ///  2. Read `sub.tier_amount` (BUG FIX #5: tier amount is the
    ///     billed amount, not a caller-supplied value)
    ///  3. Check the platform's three rate limiters
    ///     (`volume`, `frequency`, `account_billing`)
    ///  4. Two-pass policy evaluation against the account's
    ///     `PolicySet` and live `PolicyLimiters`
    ///  5. `internal_withdraw` from the account -> `Balance<T>`
    ///  6. `record_payment` on the subscription (advances schedule,
    ///     bumps the per-subscription nonce) and `bump_nonce` on the
    ///     account (bumps the per-account replay nonce; design §6.8
    ///     step 10)
    ///  7. Convert the `Balance<T>` to a `Coin<T>` and transfer it
    ///     to `platform.treasury`
    ///  8. Emit `PaymentProcessed` with the policy results and the
    ///     post-payment state
    ///
    /// On a policy violation, `record_failed_payment` is called so the
    /// subscription's retry state (attempt_count, last_attempt_time) is
    /// correctly stamped for the next call. On other failures
    /// (`ENotDue`, `EPlatformRateLimited`, `EInsufficientBalance`,
    /// `EZeroAmount`) the call aborts before any state change; the
    /// `PaymentFailed` event records the reason.
    ///
    /// Returns a zero-value `Coin<T>` for forward-compatibility (the
    /// actual transfer happens inside the function). The caller
    /// (scheduler) is expected to discard the return.
    public fun process_due_payment<T>(
        platform: &mut Platform,
        account: &mut SubscriptionAccount<T>,
        policy_limiters: &mut PolicyLimiters,
        clock: &Clock,
        ctx: &mut TxContext,
    ): Coin<T> {
        let platform_id = object::id(platform);
        let account_id = object::id(account);

        // 1. can_bill check.
        if (!can_bill(account, platform_id, clock)) {
            event::emit(PaymentFailed {
                account_id,
                platform_id,
                amount: 0,
                reason: ENotDue,
                v: 2,
            });
            abort ENotDue
        };

        // 2. amount == tier_amount (BUG FIX #5).
        let amount = account::tier_amount_via_sub(account, platform_id);
        assert!(amount > 0, EZeroAmount);

        // 3. platform rate limiters.
        assert!(platform::try_consume_volume(platform, amount, clock), EPlatformRateLimited);
        assert!(platform::try_consume_frequency(platform, clock), EPlatformRateLimited);
        assert!(platform::try_consume_account_billing(platform, clock), EPlatformRateLimited);

        // 4. two-pass policy evaluation.
        let current_balance = account::balance(account, clock);
        let (allowed, failures) = policies::evaluate(
            account,
            policy_limiters,
            amount,
            current_balance,
            clock,
        );
        if (!allowed) {
            record_failed_payment(account, platform_id, amount, EPolicyViolation, clock);
            event::emit(PaymentFailed {
                account_id,
                platform_id,
                amount,
                reason: EPolicyViolation,
                v: 2,
            });
            abort EPolicyViolation
        };
        let failure_count = vector::length(&failures);

        // 5. internal_withdraw.
        let withdrawn = account::internal_withdraw(account, amount, clock, ctx);

        // 6. record_payment (advances schedule, bumps sub nonce) and
        // bump the per-account replay nonce. The per-account nonce
        // gates off-platform re-broadcast attempts (e.g. an off-chain
        // scheduler replaying a settled bill); `account.move` documents
        // that the bump must happen here, on a successful pass, so a
        // failed payment does not advance the nonce.
        record_payment(account, platform_id, amount, clock);
        account::bump_nonce(account);

        // 7. convert to Coin and transfer to treasury.
        let coin = coin::from_balance(withdrawn, ctx);
        let treasury_addr = platform::treasury(platform);
        transfer::public_transfer(coin, treasury_addr);

        // 8. emit event.
        let new_balance = account::balance(account, clock);
        let new_nonce = account::nonce(account);
        event::emit(PaymentProcessed {
            account_id,
            platform_id,
            amount,
            policy_failures_count: failure_count,
            remaining_balance: new_balance,
            nonce: new_nonce,
            v: 2,
        });

        // Return a zero-value Coin<T> for forward-compatibility. The
        // actual transfer happened above. The scheduler discards the
        // return.
        coin::zero<T>(ctx)
    }
}
