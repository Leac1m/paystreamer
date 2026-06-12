// Copyright (c) leac1m
// SPDX-License-Identifier: Apache-2.0

/// `subscriptions::scheduler` — the on-chain, permissionless payment
/// scheduler.
///
/// Per architecture §5.6, §6.9, §7.3: the scheduler is the single
/// entry point that lets **anyone** trigger a due payment. The
/// off-chain indexer that previously signed payments with
/// `SCHEDULER_SECRET` (v1) is gone; v2's indexer is read-only.
///
/// ## Authority model
///
/// `process_due_payment` is **permissionless**: any caller can submit.
/// The function is gated by:
///
/// 1. The global pause flag (a kill switch flipped by `pause` /
///    `unpause`; production hardening will gate these behind
///    `Auth<PLATFORM_GLOBAL_ADMIN_ROLE>`).
/// 2. The platform's `PLATFORM_SCHEDULER_ROLE` grant and the
///    per-subscription schedule — both enforced downstream in
///    `payment::process_due_payment`.
///
/// The platform's role check is **deferred to a future hardening
/// pass** (the role is declared in `access_control.move` but the
/// per-Platform `AccessControl<AC>` is not yet wired in;
/// see `account.move` and `platform.move` for the bootstrap admin
/// pattern).
///
/// ## `pause` / `unpause`
///
/// v2 ships `pause` and `unpause` **without an auth check** so any
/// caller can flip the kill switch in an emergency. This is
/// intentional: a v2.1 hardening pass will replace the
/// `_ctx:&mut TxContext` placeholder with a multisig / OZ
/// `Auth<PLATFORM_GLOBAL_ADMIN_ROLE>` check, matching the role
/// declared in `access_control.move` §6.2.
///
/// ## Error code range
///
/// 0x0A__ per the project convention; see `account.move`,
/// `payment.move`, and `platform.move` for sibling ranges.
#[allow(lint(share_owned))]
module subscriptions::scheduler {
    use sui::object;
    use sui::transfer;
    use sui::event;
    use sui::tx_context::TxContext;
    use sui::clock::Clock;
    use subscriptions::account::{Self, SubscriptionAccount};
    use subscriptions::platform::{Self, Platform};
    use subscriptions::policies::{Self, PolicyLimiters};
    use subscriptions::payment;

    // === Errors ===

    /// `process_due_payment` was called while `pause_flag == true`.
    /// A multisig (or, in v2, any caller) can flip it to halt all
    /// payments across the protocol in an emergency.
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
    /// `pause_flag` is the kill switch. When `true`,
    /// `process_due_payment` aborts with `ESchedulerPaused`.
    public struct PaymentScheduler has key {
        id: object::UID,
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
            pause_flag: false,
            last_processed_at: 0,
            version: 2,
        };
        transfer::share_object(scheduler);
    }

    // === process_due_payment (permissionless entry point) ===

    /// Permissionless entry point. Anyone can call this; the
    /// function is gated by the global pause flag and the
    /// downstream checks in `payment::process_due_payment`
    /// (schedule, denomination, amount, per-platform rate limiters,
    /// per-account policy eval).
    ///
    /// Steps (architecture §6.9):
    ///  1. `!pause_flag` (else `ESchedulerPaused`).
    ///  2. Delegate to `payment::process_due_payment` (which runs the
    ///     12-step billing flow per architecture §6.8).
    ///  3. Stamp `last_processed_at = clock.timestamp_ms()`.
    ///  4. Emit `DuePaymentSubmitted` with the post-state ids and
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
    /// `process_due_payment` aborts with `ESchedulerPaused`.
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
    public fun unpause(scheduler:&mut PaymentScheduler, ctx: &mut TxContext) {
        scheduler.pause_flag = false;
        event::emit(SchedulerResumed {
            resumed_by: ctx.sender(),
            v: 2,
        });
    }

    // === Accessors (view) ===

    /// `true` iff the scheduler is currently paused. Read-only view;
    /// safe to call from any context.
    public fun is_paused(scheduler:&PaymentScheduler): bool {
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

    /// Test-only constructor. Mirrors `init` but returns the
    /// `PaymentScheduler` by value without going through the
    /// shared-object protocol.
    ///
    /// `PaymentScheduler` is `key`-only (no `drop`), so unit tests
    /// need an explicit way to construct one. The companion
    /// `destroy_for_testing` handles disposal.
    #[test_only]
    public fun new_scheduler_for_testing(ctx: &mut TxContext): PaymentScheduler {
        PaymentScheduler {
            id: object::new(ctx),
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
    /// schedulers they constructed.
    #[test_only]
    public fun destroy_for_testing(scheduler: PaymentScheduler) {
        let PaymentScheduler {
            id,
            pause_flag: _,
            last_processed_at: _,
            version: _,
        } = scheduler;
        object::delete(id);
    }
}
