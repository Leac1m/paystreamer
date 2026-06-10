// Copyright (c) leac1m
// SPDX-License-Identifier: Apache-2.0

/// `paystreamer_v2::scheduler` — the on-chain, permissionless payment
/// scheduler.
///
/// Per architecture §5.6, §6.9, §7.3: the scheduler is the single
/// entry point that lets **anyone** trigger a due payment. It owns
/// the global `RateLimiter::Bucket` that acts as a circuit breaker
/// (architecture §5.6) — 10k payments per refill interval, 1k
/// refilled per hour. The off-chain indexer that previously signed
/// payments with `SCHEDULER_SECRET` (v1, BUG FIX #2) is gone; v2's
/// indexer is read-only.
///
/// ## Authority model
///
/// `process_due_payment` is **permissionless**: any caller can submit.
/// The function is gated by:
///
/// 1. The global circuit breaker (a `RateLimiter::Bucket` that
///    bounds worst-case gas burn from a malicious bot).
/// 2. The global pause flag (a kill switch flipped by `pause` /
///    `unpause`; production hardening will gate these behind
///    `Auth<PLATFORM_GLOBAL_ADMIN_ROLE>`).
/// 3. The platform's `PLATFORM_SCHEDULER_ROLE` grant and the
///    per-subscription schedule — both enforced downstream in
///    `payment::process_due_payment`.
///
/// The platform's role check is **deferred to a future hardening
/// pass** (the role is declared in `access_control.move` but the
/// per-Platform `AccessControl<AC>` is not yet wired in;
/// see `account.move` and `platform.move` for the bootstrap admin
/// pattern). v2 ships the "permissionless but rate-limited" property
/// (BUG FIX #2, BUG FIX #14); v2.1 will add the role-based check.
///
/// ## `pause` / `unpause`
///
/// v2 ships `pause` and `unpause` **without an auth check** so any
/// caller can flip the kill switch in an emergency. This is
/// intentional: a v2.1 hardening pass will replace the
/// `_ctx: &mut TxContext` placeholder with a multisig / OZ
/// `Auth<PLATFORM_GLOBAL_ADMIN_ROLE>` check, matching the role
/// declared in `access_control.move` §6.2.
///
/// ## Deferred limiter initialization (deviation from spec)
///
/// The original design had `init(clock: &Clock, ctx: &mut TxContext)`
/// construct the global limiter at publish time. **Sui 1.73.1's
/// framework does not allow `&Clock` as a parameter to `init`**: the
/// first parameter of `init` must be the module's one-time witness
/// (per the Sui framework's strict E02003 validation). The OZ
/// `rate_limiter::new_bucket` constructor, in turn, *requires* a
/// `&Clock` for anchor validation. The two constraints are
/// incompatible at `init` time.
///
/// The v2 solution is **deferred initialization**: the
/// `PaymentScheduler` holds the limiter as `Option<RateLimiter>`,
/// seeded to `None` at `init` (consuming the `SCHEDULER` OTW), and
/// lazily initialized on the first call to `process_due_payment`,
/// which has a real `&Clock` from the PTB. The first call therefore
/// observes a one-time init cost; subsequent calls hit the hot path
/// unchanged. The on-chain schema version is still `2`; the
/// deferred-init discipline is an internal implementation detail.
///
/// ## Error code range
///
/// 0x0A__ per the project convention; see `account.move`,
/// `payment.move`, and `platform.move` for sibling ranges.
#[allow(lint(share_owned))]
module paystreamer_v2::scheduler {
    use std::option::{Self, Option};
    use sui::object;
    use sui::transfer;
    use sui::event;
    use sui::tx_context::TxContext;
    use sui::clock::Clock;
    use openzeppelin_utils::rate_limiter::{Self, RateLimiter};
    use paystreamer_v2::account::{Self, SubscriptionAccount};
    use paystreamer_v2::platform::{Self, Platform};
    use paystreamer_v2::policies::{Self, PolicyLimiters};
    use paystreamer_v2::payment;

    // === Errors ===

    /// The global circuit breaker (`global_limiter`) refused the
    /// `try_consume(1, clock)` call — the bucket is empty. Mirrors
    /// the architecture's "global limiter bounds total throughput"
    /// property: a malicious bot that drives the bucket to zero
    /// cannot burn additional gas until the next refill interval
    /// elapses.
    const EGlobalRateLimited: u64 = 0x0A001;

    /// `process_due_payment` was called while `pause_flag == true`.
    /// The kill switch is the secondary line of defense behind the
    /// global limiter: a multisig (or, in v2, any caller) can flip
    /// it to halt all payments across the protocol in an emergency.
    const ESchedulerPaused: u64 = 0x0A002;

    // === Events ===
    //
    // All events carry a `v: u16 = 2` field for indexer discrimination
    // (architecture §8). The `v` field is bumped when the event *shape*
    // changes.

    /// Emitted on every successful `pause`. `paused_by` is the
    /// `ctx.sender()` of the caller that flipped the flag; in v2 this
    /// is intentionally unconstrained, but the field is recorded so
    /// off-chain indexers can attribute the action. Production
    /// deployments will additionally gate the call behind the
    /// multisig's `PLATFORM_GLOBAL_ADMIN_ROLE` grant.
    public struct SchedulerPaused has copy, drop {
        paused_by: address,
        v: u16,
    }

    /// Emitted on every successful `unpause`. Mirror of
    /// `SchedulerPaused` for the resume action.
    public struct SchedulerResumed has copy, drop {
        resumed_by: address,
        v: u16,
    }

    /// Emitted on every successful `process_due_payment`. The
    /// `account_id` and `platform_id` are the canonical handles; the
    /// `submitted_by` field is the gas-paying address (any caller
    /// is allowed, per architecture §7.3). Off-chain indexers
    /// pair this event with the `PaymentProcessed` event emitted
    /// by `payment.move` for the full state transition.
    public struct DuePaymentSubmitted has copy, drop {
        account_id: object::ID,
        platform_id: object::ID,
        submitted_by: address,
        v: u16,
    }

    // === PaymentScheduler ===

    /// The shared on-chain scheduler. Mints exactly once at
    /// `init`; thereafter every due payment is submitted through it.
    /// The object is `key`-only — its `id` is the canonical handle
    /// off-chain indexers observe.
    ///
    /// `global_limiter` is the circuit breaker (architecture §5.6):
    /// a `RateLimiter::Bucket` configured for 10k payments per
    /// refill interval, refilling 1k per hour. It is held as an
    /// `Option` and initialized lazily on the first
    /// `process_due_payment` call (see the "Deferred limiter
    /// initialization" section in the module doc). The actual
    /// money movement lives in `payment.move`; the scheduler's
    /// job is to gate the call, project the limiter state, and
    /// emit observability events.
    ///
    /// `pause_flag` is the secondary kill switch. When `true`,
    /// `process_due_payment` aborts before the limiter call so a
    /// paused scheduler cannot accidentally consume tokens.
    public struct PaymentScheduler has key {
        id: object::UID,
        /// Global circuit breaker (Bucket, 10k cap, 1k/hr refill).
        /// `None` until the first `process_due_payment` call (see
        /// the deferred-init section in the module doc).
        /// Bounds the worst case of a malicious scheduler bot
        /// burning gas (architecture §5.6).
        global_limiter: Option<RateLimiter>,
        /// Emergency kill switch. Flipped by `pause` / `unpause`.
        /// v2: any caller; v2.1: `Auth<PLATFORM_GLOBAL_ADMIN_ROLE>`.
        pause_flag: bool,
        /// Timestamp (ms) of the most recent successful
        /// `process_due_payment`. Useful for off-chain indexers
        /// that want to detect a stalled scheduler.
        last_processed_at: u64,
        /// Schema version (currently `2`).
        version: u16,
    }

    /// One-time witness required by the Sui VM's `init` signature
    /// (per E02003). The VM requires the first parameter of `init`
    /// to be a struct named after the module with the OTW shape
    /// (upper-case of the module name, no fields, `drop`). We do
    /// not use the witness for anything beyond satisfying the
    /// signature; the actual scheduler is built by value.
    public struct SCHEDULER has drop {}

    // === init ===

    /// One-time init. The Sui VM injects the `SCHEDULER` one-time
    /// witness exactly once at first publish; that witness is the
    /// signal that this is the genuine init call. We use it to
    /// satisfy the framework's strict `init` signature
    /// (E02003 forbids parameters other than the OTW + `&mut
    /// TxContext`).
    ///
    /// The global limiter is initialized to `None` here and rebuilt
    /// on the first `process_due_payment` call (deferred init,
    /// see module doc).
    ///
    /// The deployer (`ctx.sender()`) becomes the implicit owner of
    /// the pause flag; production deployments must rotate pause
    /// authority to the multisig by hardening `pause` /
    /// `unpause` with `Auth<PLATFORM_GLOBAL_ADMIN_ROLE>` (deferred
    /// to v2.1, see module docs).
    ///
    /// The scheduler is shared so any PTB can take `&mut` on it
    /// (the same model as the protocol-wide `AccessControl` in
    /// `access_control.move` and the `CoinTypeRegistry` in
    /// `registry.move`).
    fun init(_otw: SCHEDULER, ctx: &mut TxContext) {
        let scheduler = PaymentScheduler {
            id: object::new(ctx),
            global_limiter: option::none(),
            pause_flag: false,
            last_processed_at: 0,
            version: 2,
        };
        transfer::share_object(scheduler);
    }

    // === process_due_payment (permissionless entry point) ===

    /// Permissionless entry point. Anyone can call this; the
    /// function is gated by the global circuit breaker, the global
    /// pause flag, and the downstream checks in
    /// `payment::process_due_payment` (schedule, denomination, amount,
    /// per-platform rate limiters, per-account policy eval).
    ///
    /// Steps (architecture §6.9):
    ///  1. `!pause_flag` (else `ESchedulerPaused`).
    ///  2. Lazily initialize the global limiter on first call (if
    ///     `global_limiter` is `None`, build a fresh
    ///     `RateLimiter::Bucket` anchored at `clock.timestamp_ms()`).
    ///  3. `rate_limiter::try_consume(&mut global_limiter, 1, clock)`
    ///     (else `EGlobalRateLimited`).
    ///  4. Delegate to `payment::process_due_payment` (which runs the
    ///     12-step billing flow per architecture §6.8).
    ///  5. Stamp `last_processed_at = clock.timestamp_ms()`.
    ///  6. Emit `DuePaymentSubmitted` with the post-state ids and
    ///     the gas-paying sender.
    ///
    /// The returned `Coin<T>` is a zero-value coin (see
    /// `payment.move` for the forward-compat rationale); the caller
    /// discards it. The scheduler is shared, so PTBs can compose
    /// `process_due_payment` with downstream transfer / split steps
    /// (a future variant) by binding the return.
    ///
    /// #### Aborts
    /// - `ESchedulerPaused` if `pause_flag == true`.
    /// - `EGlobalRateLimited` if the global bucket is empty.
    /// - Any abort from `payment::process_due_payment` (e.g.
    ///   `ENotDue`, `EPolicyViolation`, `EInsufficientBalance`).
    public fun process_due_payment<T>(
        scheduler: &mut PaymentScheduler,
        platform: &mut Platform,
        account: &mut SubscriptionAccount<T>,
        policy_limiters: &mut PolicyLimiters,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(!scheduler.pause_flag, ESchedulerPaused);

        // Deferred init: rebuild the limiter on the first call. The
        // anchor is `now` (the runtime clock), so the first refill
        // is computed from this moment onwards. After this branch
        // the limiter is `Some` and the hot path is unchanged.
        if (scheduler.global_limiter.is_none()) {
            scheduler.global_limiter = option::some(build_global_limiter(clock));
        };

        assert!(
            rate_limiter::try_consume(
                scheduler.global_limiter.borrow_mut(),
                1,
                clock,
            ),
            EGlobalRateLimited
        );

        let account_id = object::id(account);
        let platform_id = object::id(platform);

        // Delegate to payment.move. The returned coin is a zero-value
        // `Coin<T>` (forward-compat hook); the actual `tier_amount`
        // transfer to the platform treasury already happened inside
        // the function. We destroy the zero coin.
        let zero_coin = payment::process_due_payment(
            platform,
            account,
            policy_limiters,
            clock,
            ctx,
        );
        sui::coin::destroy_zero(zero_coin);

        scheduler.last_processed_at = clock.timestamp_ms();
        event::emit(DuePaymentSubmitted {
            account_id,
            platform_id,
            submitted_by: ctx.sender(),
            v: 2,
        });
    }

    // === pause / unpause (kill switch) ===

    /// Flip the kill switch to `true`. While paused, every
    /// `process_due_payment` aborts with `ESchedulerPaused` before
    /// consuming a limiter token, so the global bucket is preserved
    /// for a clean resume.
    ///
    /// v2: any caller can pause — this is the emergency kill switch
    /// and is intentionally open. v2.1 will replace `_ctx` with an
    /// `Auth<PLATFORM_GLOBAL_ADMIN_ROLE>` check, matching the role
    /// declared in `access_control.move` §6.2.
    ///
    /// Emits `SchedulerPaused`. Idempotent: pausing an already-paused
    /// scheduler re-emits the event (the on-chain record is
    /// append-only, which is the right shape for audit trails).
    public fun pause(scheduler: &mut PaymentScheduler, ctx: &mut TxContext) {
        scheduler.pause_flag = true;
        event::emit(SchedulerPaused {
            paused_by: ctx.sender(),
            v: 2,
        });
    }

    /// Flip the kill switch back to `false`. Idempotent: resuming an
    /// already-resumed scheduler re-emits the event (same audit
    /// rationale as `pause`).
    ///
    /// v2: any caller. v2.1: multisig-only, see `pause` doc.
    public fun unpause(scheduler: &mut PaymentScheduler, ctx: &mut TxContext) {
        scheduler.pause_flag = false;
        event::emit(SchedulerResumed {
            resumed_by: ctx.sender(),
            v: 2,
        });
    }

    // === Accessors (view) ===

    /// `true` iff the scheduler is currently paused. Read-only view;
    /// safe to call from any context.
    public fun is_paused(scheduler: &PaymentScheduler): bool {
        scheduler.pause_flag
    }

    /// Timestamp (ms) of the most recent successful
    /// `process_due_payment`. `0` if no payment has ever been
    /// processed by this scheduler. Off-chain indexers use this to
    /// detect a stalled scheduler (e.g. a missing automated submitter).
    public fun last_processed_at(scheduler: &PaymentScheduler): u64 {
        scheduler.last_processed_at
    }

    /// Schema version. Currently `2`.
    public fun version(scheduler: &PaymentScheduler): u16 {
        scheduler.version
    }

    /// `true` iff the global limiter has been initialized
    /// (i.e. at least one `process_due_payment` call has happened).
    /// Read-only view; lets off-chain tooling distinguish a fresh
    /// scheduler from a hot one.
    public fun is_initialized(scheduler: &PaymentScheduler): bool {
        scheduler.global_limiter.is_some()
    }

    /// Read-only handle to the global circuit breaker. Aborts with
    /// the OZ `EWrongVariant` / per-variant aborts if the limiter has
    /// not yet been initialized (no variant to read). Off-chain
    /// tooling should pair this with `is_initialized` (or branch on
    /// `is_bucket` / `capacity` after the limiter is built) to
    /// avoid the abort path.
    public fun global_limiter(scheduler: &PaymentScheduler): &RateLimiter {
        scheduler.global_limiter.borrow()
    }

    // === Internal ===

    /// Build the canonical global limiter. Capacity 10k, refill 1k
    /// per hour, anchored at `now`, initial available = 10k (full
    /// bucket). The constructor asserts
    /// `last_refill_ms <= clock.timestamp_ms()`, which is satisfied
    /// by passing `now`.
    fun build_global_limiter(clock: &Clock): RateLimiter {
        let now = clock.timestamp_ms();
        rate_limiter::new_bucket(
            10_000,             // capacity: 10k payments per window
            1_000,              // refill amount: 1k per refill
            60 * 60 * 1_000,    // refill interval: 1 hour
            now,                // anchor: now
            10_000,             // initial available: full bucket
            clock,
        )
    }

    // === Test-only ===

    /// Test-only mutable handle to the global circuit breaker.
    /// `rate_limiter::try_consume` requires `&mut RateLimiter`; this
    /// helper exposes the `&mut` view only to test code so
    /// production callers cannot reach in and consume the bucket
    /// outside the scheduler's own gated
    /// `process_due_payment` path. The accessor
    /// initializes the limiter on first call (mirroring the
    /// deferred-init in `process_due_payment`) so tests can drive
    /// the bucket without first routing a payment through.
    #[test_only]
    public fun global_limiter_mut_for_testing(
        scheduler: &mut PaymentScheduler,
        clock: &Clock,
    ): &mut RateLimiter {
        if (scheduler.global_limiter.is_none()) {
            scheduler.global_limiter = option::some(build_global_limiter(clock));
        };
        scheduler.global_limiter.borrow_mut()
    }

    /// Test-only constructor. Mirrors `init` but returns the
    /// `PaymentScheduler` by value without going through the
    /// shared-object protocol. The limiter is seeded to `None`
    /// (deferred init, same as production); callers that need a
    /// hot bucket should route it through
    /// `global_limiter_mut_for_testing` first.
    ///
    /// `PaymentScheduler` is `key`-only (no `drop`), so unit tests
    /// need an explicit way to construct one. The companion
    /// `destroy_for_testing` handles disposal.
    #[test_only]
    public fun new_scheduler_for_testing(ctx: &mut TxContext): PaymentScheduler {
        PaymentScheduler {
            id: object::new(ctx),
            global_limiter: option::none(),
            pause_flag: false,
            last_processed_at: 0,
            version: 2,
        }
    }

    /// Test-only helper to share a `PaymentScheduler` produced by
    /// `new_scheduler_for_testing`. Required because Sui's
    /// E02009 rule restricts `share_object` to the module that
    /// declares the object. Tests share so subsequent txs can
    /// take the scheduler by ID.
    #[test_only]
    public fun share_for_testing(scheduler: PaymentScheduler) {
        transfer::share_object(scheduler);
    }

    /// Test-only destructor. `PaymentScheduler` has `key` but not
    /// `drop`, so unit tests need an explicit way to dispose of
    /// schedulers they constructed. The `Option<RateLimiter>` is
    /// drained (or dropped if empty); the `RateLimiter` is OZ-owned
    /// and has `drop`, so destructuring with `_` is sufficient.
    #[test_only]
    public fun destroy_for_testing(scheduler: PaymentScheduler) {
        let PaymentScheduler {
            id,
            mut global_limiter,
            pause_flag: _,
            last_processed_at: _,
            version: _,
        } = scheduler;
        object::delete(id);
        // Drain the optional limiter if it was lazily initialized
        // during a test. The inner `RateLimiter` is OZ-owned and
        // has `drop`, so `option::destroy_some` with `_` is
        // sufficient.
        if (global_limiter.is_some()) {
            let _ = global_limiter.extract();
        };
        option::destroy_none(global_limiter);
    }
}
