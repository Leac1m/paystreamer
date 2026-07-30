/// `subscriptions::payment` — Core payment processing module.
///
/// Handles both standard and cross-currency routed payments.
/// These functions are `public(package)` and must be called through
/// the `scheduler.move` entry points to ensure circuit breakers
/// and platform permissions are enforced.
///
/// ## Address-balance payment flow
///
/// Payments use Sui's address balance model via the `SubscriptionAccount`:
/// 1. Withdraw from the subscriber's account balance
/// 2. Split fees for scheduler (1%) and protocol (2%)
/// 3. Send the remainder to the platform treasury
///
/// ## Routed Payments
///
/// Schedulers can execute cross-currency payments via atomic PTB swaps
/// using the `RoutingPotato` pattern, allowing users to fund subscriptions
/// with a single coin type while paying platforms in their requested token.
#[allow(lint(share_owned))]
module subscriptions::payment {
    use sui::object;
    use sui::balance;
    use sui::event;
    use sui::tx_context::TxContext;
    use sui::clock::Clock;
    use sui::coin::{Self, Coin};
    use subscriptions::account::{Self, SubscriptionAccount, can_bill, record_payment, record_failed_payment};
    
    use subscriptions::policies::{Self, PolicyLimiters, PolicyFailure};
    use subscriptions::platform::{Self, Platform};

    // === Errors ===

    /// `can_bill` returned `false` — the subscription is not active or
    const ENotDue: u64 = 0x09001;

    /// The subscription's `tier_amount` is invalid (e.g. `0`).
    /// fatal misconfiguration and aborts before money moves.
    #[allow(unused_const)]
    const EInvalidAmount: u64 = 0x09002;

    /// The account's live headroom is below the requested `amount`.
    /// Caught early to ensure `record_failed_payment` is called and
    /// the subscription's retry state advances, preventing users from
    /// avoiding suspension by emptying their wallets.
    const EInsufficientBalance: u64 = 0x09003;


    /// The two-pass policy evaluation rejected the request. The full
    /// `vector<PolicyFailure>` is emitted in the `PaymentFailed` event
    /// so off-chain indexers can see *which* dimension failed and
    /// *why*. Persisted limiter state is untouched.
    const EPolicyViolation: u64 = 0x09005;

    /// The subscription's `tier_amount` resolved to `0`. Treated as a
    /// programmer / configuration error; aborts before money moves.
    const EZeroAmount: u64 = 0x09006;

    /// The provided `RoutingPotato` is invalid for this payment settlement.
    const EInvalidPotato: u64 = 0x09007;

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
        platform_amount: u64,
        protocol_fee: u64,
        scheduler_fee: u64,
        policy_failures_count: u64,
        nonce: u64,
        v: u16,
    }

    /// Emitted on a failed `process_due_payment`. The `reason` field
    /// is one of `ENotDue`, `EPolicyViolation`,
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

    // === Routing Potato ===

    /// A Hot Potato ensuring a withdrawn routed payment is settled in the same transaction.
    public struct RoutingPotato<phantom FundingCoin, phantom PlatformCoin> {
        account_id: ID,
        platform_id: ID,
        amount_needed: u64,
    }

    // === process_due_payment ===

    /// THE single money-moving path. Called by `scheduler.move` (which
    /// has already checked the global circuit breaker and platform permissions).
    ///
    /// Note: Due to Sui framework limitations, this function requires the
    /// subscriber to have deposited a Coin<T> into the account first.
    /// The scheduler withdraws from the account's balance and routes it to the treasury.
    ///
    /// Payment execution steps:
    ///  1. Verify `can_bill` (subscription is active and due)
    ///  2. Fetch the required payment amount from the platform's tier
    ///  3. Perform a two-pass policy evaluation against the account's limiters
    ///  4. Withdraw the required amount from the account's balance
    ///  5. Distribute fees (1% scheduler, 2% protocol, 97% platform)
    ///  6. Record the payment on the subscription and advance the schedule
    ///  7. Emit a `PaymentProcessed` event detailing the fee breakdown
    ///
    /// On a policy violation, `record_failed_payment` is called so the
    /// subscription's retry state is correctly updated. On other failures
    /// (`ENotDue`, `EZeroAmount`) the transaction aborts safely.
    public(package) fun process_due_payment<T>(
        registry: &subscriptions::registry::Registry,
        platform: &mut Platform,
        account: &mut SubscriptionAccount<T>,
        policy_limiters: &mut PolicyLimiters,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
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

        let amount = account::tier_amount_via_sub(account, platform_id);
        assert!(amount > 0, EZeroAmount);

        // 3a. Check for sufficient balance gracefully to prevent users from
        // dodging payments by keeping their balance at 0.
        if (account::balance(account) < amount) {
            record_failed_payment(account, platform_id, amount, EInsufficientBalance, clock);
            event::emit(PaymentFailed {
                account_id,
                platform_id,
                amount,
                reason: EInsufficientBalance,
                v: 2,
            });
            return
        };

        // 4. two-pass policy evaluation.
        let (allowed, failures) = policies::evaluate(
            account,
            policy_limiters,
            amount,
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
        let failure_count = failures.length();

        // 5. Withdraw from account's balance and distribute to platform, protocol, and scheduler.
        let platform_treasury = platform::treasury(platform);
        let protocol_treasury = subscriptions::registry::protocol_treasury(registry);
        let scheduler_addr = ctx.sender();
        
        let scheduler_fee = (amount * 100) / 10000;
        let protocol_fee = (amount * 200) / 10000;
        let platform_amount = amount - scheduler_fee - protocol_fee;

        account::withdraw_and_distribute<T>(
            account, 
            amount, 
            platform_treasury, 
            protocol_treasury, 
            scheduler_addr, 
            ctx
        );

        // 6. record_payment (advances schedule, bumps sub nonce) and
        // bump the per-account replay nonce.
        record_payment(account, platform_id, amount, clock);
        account::bump_nonce(account);

        // 7. emit event.
        let new_nonce = account::nonce(account);
        event::emit(PaymentProcessed {
            account_id,
            platform_id,
            amount,
            platform_amount,
            protocol_fee,
            scheduler_fee,
            policy_failures_count: failure_count,
            nonce: new_nonce,
            v: 2,
        });
    }

    // === Routed Payments ===

    /// Withdraws a `max_spend` of `FundingCoin` from the user's account to swap it
    /// into `PlatformCoin` off-chain or via a DEX. The user's policies are evaluated
    /// against `max_spend` to protect them from bad exchange rates (slippage limits).
    /// Returns a Hot Potato that must be settled via `process_routed_payment`.
    public(package) fun withdraw_for_route<FundingCoin, PlatformCoin>(
        platform: &Platform,
        account: &mut SubscriptionAccount<FundingCoin>,
        policy_limiters: &mut PolicyLimiters,
        clock: &Clock,
        max_spend: u64,
        ctx: &mut TxContext,
    ): (Coin<FundingCoin>, RoutingPotato<FundingCoin, PlatformCoin>) {
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

        let amount_needed = account::tier_amount_via_sub(account, platform_id);
        assert!(amount_needed > 0, EZeroAmount);

        // 2. two-pass policy evaluation against `max_spend`.
        let (allowed, _failures) = policies::evaluate(
            account,
            policy_limiters,
            max_spend,
            clock,
        );
        if (!allowed) {
            record_failed_payment(account, platform_id, amount_needed, EPolicyViolation, clock);
            event::emit(PaymentFailed {
                account_id,
                platform_id,
                amount: amount_needed,
                reason: EPolicyViolation,
                v: 2,
            });
            abort EPolicyViolation
        };

        // 3. Withdraw the max_spend to allow the scheduler to perform the swap
        let withdrawn_coin = account::internal_withdraw<FundingCoin>(account, max_spend, ctx);

        let potato = RoutingPotato<FundingCoin, PlatformCoin> {
            account_id,
            platform_id,
            amount_needed,
        };

        (withdrawn_coin, potato)
    }

    /// Settles the routed payment by consuming the Hot Potato. Verifies the exact
    /// `amount_needed` in `PlatformCoin` was provided, processes the fee distribution,
    /// and refunds any unspent `FundingCoin` change back to the user's account.
    public(package) fun process_routed_payment<FundingCoin, PlatformCoin>(
        potato: RoutingPotato<FundingCoin, PlatformCoin>,
        registry: &subscriptions::registry::Registry,
        platform: &mut Platform,
        account: &mut SubscriptionAccount<FundingCoin>,
        coin: Coin<PlatformCoin>,
        mut change: Coin<FundingCoin>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let RoutingPotato { account_id, platform_id, amount_needed } = potato;
        
        assert!(account_id == object::id(account), EInvalidPotato);
        assert!(platform_id == object::id(platform), EInvalidPotato);
        
        let amount_provided = coin.value();
        assert!(amount_provided == amount_needed, EZeroAmount); // Require exact payment

        // 1. Refund the change
        if (change.value() > 0) {
            account::deposit(account, change, ctx);
        } else {
            change.destroy_zero();
        };

        // 2. Distribute fees
        let platform_treasury = platform::treasury(platform);
        let protocol_treasury = subscriptions::registry::protocol_treasury(registry);
        let scheduler_addr = ctx.sender();
        
        let scheduler_fee = (amount_needed * 100) / 10000;
        let protocol_fee = (amount_needed * 200) / 10000;
        let platform_amount = amount_needed - scheduler_fee - protocol_fee;

        let mut b = coin.into_balance();
        
        if (scheduler_fee > 0) {
            sui::transfer::public_transfer(
                coin::from_balance(b.split(scheduler_fee), ctx), 
                scheduler_addr
            );
        };
        
        if (protocol_fee > 0) {
            sui::transfer::public_transfer(
                coin::from_balance(b.split(protocol_fee), ctx), 
                protocol_treasury
            );
        };

        if (platform_amount > 0) {
            sui::transfer::public_transfer(
                coin::from_balance(b.split(platform_amount), ctx), 
                platform_treasury
            );
        };
        b.destroy_zero();

        // 3. record_payment (advances schedule, bumps sub nonce) and bump account replay nonce.
        record_payment(account, platform_id, amount_needed, clock);
        account::bump_nonce(account);

        // 4. emit event.
        let new_nonce = account::nonce(account);
        event::emit(PaymentProcessed {
            account_id,
            platform_id,
            amount: amount_needed,
            platform_amount,
            protocol_fee,
            scheduler_fee,
            policy_failures_count: 0,
            nonce: new_nonce,
            v: 2,
        });
    }
}
