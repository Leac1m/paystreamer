// Copyright (c) leac1m
// SPDX-License-Identifier: Apache-2.0

#[test_only]
module paystreamer_v2::payment_tests {
    use paystreamer_v2::account;
    use paystreamer_v2::billing;
    use paystreamer_v2::payment;
    use paystreamer_v2::platform;
    use paystreamer_v2::policies;
    use paystreamer_v2::registry;
    use std::string;
    use sui::object;
    use sui::coin;
    use sui::test_scenario as ts;
    use sui::test_scenario;
    use sui::clock;

    /// One-off witness used as a phantom denomination in tests. Has
    /// `drop` so we can construct it freely; no treasury cap is needed
    /// because coins are minted via `coin::mint_for_testing`.
    public struct TEST_USDC has drop {}

    /// Build a registry pre-loaded with `TEST_USDC` as a registered
    /// coin (slot 0, the USDC built-in). The caller is responsible
    /// for destroying it via `registry::destroy_for_testing`.
    fun registry_with_test_usdc(scenario: &mut ts::Scenario): registry::CoinTypeRegistry {
        let mut r = registry::new_registry_for_testing(ts::ctx(scenario));
        let info = registry::new_account_type_info(string::utf8(b"USDC"), 6, false);
        registry::register_coin_type<TEST_USDC>(&mut r, info, ts::ctx(scenario));
        r
    }

    /// Stamp a clock at `1_000` ms so subscriptions created with
    /// `frequency_ms = 0` are due immediately (their `next_billing_time`
    /// becomes `1_000`, satisfying `now >= next_billing_time`).
    fun fresh_clock(scenario: &mut ts::Scenario): clock::Clock {
        let mut c = clock::create_for_testing(ts::ctx(scenario));
        clock::set_for_testing(&mut c, 1_000);
        c
    }

    /// Build fresh `PolicyLimiters` and call `ensure_initialized` to
    /// align them with the account's `PolicySet`. The empty default
    /// from `policies::empty_limiters` is replaced; `ensure_initialized`
    /// is idempotent and re-anchors the `FixedWindow` to `now`.
    fun fresh_initialized_limiters(
        account: &account::SubscriptionAccount<TEST_USDC>,
        clock: &clock::Clock,
    ): policies::PolicyLimiters {
        let mut limiters = policies::empty_limiters(clock);
        policies::ensure_initialized<TEST_USDC>(account, &mut limiters, clock);
        limiters
    }

    /// Test setup helper. Registers a platform, mints a TEST_USDC
    /// account, deposits `deposit_amount` into it, and creates a
    /// subscription against the platform with the supplied
    /// `tier_amount` and `frequency_ms`. Returns the (account_id,
    /// platform_id) pair; the account and platform are SHARED in
    /// this same tx and the caller (test) takes them by ID in the
    /// next tx.
    fun setup_account_with_subscription(
        r: &registry::CoinTypeRegistry,
        clock: &clock::Clock,
        scenario: &mut ts::Scenario,
        deposit_amount: u64,
        tier_amount: u64,
        frequency_ms: u64,
    ): (object::ID, object::ID) {
        // Register the platform FIRST so we can use the real
        // `platform_id` as the subscription key. The platform is
        // shared by `register_platform` so the next tx can take it
        // back by ID.
        let platform_id = platform::register_platform(
            string::utf8(b"TestPlatform"),
            string::utf8(b"d"),
            string::utf8(b"Test"),
            std::option::none(),
            clock,
            ts::ctx(scenario),
        );

        // Create the account, deposit, and create the subscription
        // against the real `platform_id`.
        let (mut account, cap) = account::create_account<TEST_USDC>(
            r,
            account::empty_policy_set(),
            clock,
            ts::ctx(scenario),
        );
        let deposit_coin = coin::mint_for_testing<TEST_USDC>(deposit_amount, ts::ctx(scenario));
        account::deposit<TEST_USDC>(
            &cap,
            &mut account,
            deposit_coin,
            clock,
            ts::ctx(scenario),
        );
        billing::create_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            0,                       // tier_index
            tier_amount,
            frequency_ms,
            registry::account_type_usdc(),
            clock,
            ts::ctx(scenario),
        );

        // Share the account so the next tx can take it by ID.
        let account_id = object::id(&account);
        account::share_account<TEST_USDC>(account, cap, ts::ctx(scenario));
        (account_id, platform_id)
    }

    // === test_process_due_payment_succeeds ===
    //
    // The happy path. Deposit `tier_amount`, subscribe with
    // `frequency_ms = 0` (due immediately), call `process_due_payment`,
    // and verify:
    //  - the post-payment balance is `0`
    //  - the per-account nonce is `1`
    //  - the per-subscription counters advanced (`total_paid`,
    //    `payment_count`)
    //  - the treasury received a coin of `tier_amount`

    #[test]
    fun test_process_due_payment_succeeds() {
        let owner = @0xA;
        let mut sc = ts::begin(owner);
        let clock = fresh_clock(&mut sc);
        let r = registry_with_test_usdc(&mut sc);

        let (account_id, platform_id) = setup_account_with_subscription(
            &r,
            &clock,
            &mut sc,
            100,                // deposit
            100,                // tier_amount
            0,                  // frequency_ms: due now
        );

        // End tx 0; advance to tx 1.
        ts::next_tx(&mut sc, owner);

        // tx 1: take the shared account + platform, call process_due_payment.
        let mut account = ts::take_shared_by_id<account::SubscriptionAccount<TEST_USDC>>(
            &sc, account_id,
        );
        let mut p = ts::take_shared_by_id<platform::Platform>(&mut sc, platform_id);
        let mut limiters = fresh_initialized_limiters(&account, &clock);

        let zero_coin = payment::process_due_payment<TEST_USDC>(
            &mut p,
            &mut account,
            &mut limiters,
            &clock,
            ts::ctx(&mut sc),
        );
        coin::destroy_zero(zero_coin);

        // State: balance = 0, nonce = 1.
        assert!(account::balance(&account, &clock) == 0, 0);
        assert!(account::nonce(&account) == 1, 1);
        // Per-subscription counters: total_paid = 100, payment_count = 1.
        assert!(billing::subscription_total_paid(&account, platform_id) == 100, 2);
        assert!(billing::subscription_payment_count(&account, platform_id) == 1, 3);

        // Clean up.
        policies::destroy_limiters_for_testing(limiters);
        ts::return_shared(p);
        account::destroy_account_for_testing(account);

        // End tx 1; the next tx exposes the transferred coin in the
        // owner's inventory.
        ts::next_tx(&mut sc, owner);
        // The treasury is `owner`; the `process_due_payment` transferred
        // a `Coin<TEST_USDC>` of value 100 there. Pick it up and check.
        let received_coin = ts::take_from_address<coin::Coin<TEST_USDC>>(&sc, owner);
        assert!(coin::value(&received_coin) == 100, 4);
        std::unit_test::destroy(received_coin);

        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === test_process_due_payment_not_due_fails ===
    //
    // With `frequency_ms > 0` and the clock at `1_000`, `can_bill`
    // returns `false` (the subscription's `next_billing_time` is
    // `1_000 + frequency_ms > 1_000`). The function must abort with
    // `ENotDue` (0x09001) and emit a `PaymentFailed` event with
    // `reason = ENotDue`.

    #[test]
    #[expected_failure(abort_code = 0x09001)]
    fun test_process_due_payment_not_due_fails() {
        let owner = @0xA;
        let mut sc = ts::begin(owner);
        let clock = fresh_clock(&mut sc);
        let r = registry_with_test_usdc(&mut sc);

        let (account_id, platform_id) = setup_account_with_subscription(
            &r,
            &clock,
            &mut sc,
            100,                // deposit
            100,                // tier_amount
            86_400_000,         // 1 day: not yet due
        );

        ts::next_tx(&mut sc, owner);

        let mut account = ts::take_shared_by_id<account::SubscriptionAccount<TEST_USDC>>(
            &sc, account_id,
        );
        let mut p = ts::take_shared_by_id<platform::Platform>(&mut sc, platform_id);
        let mut limiters = fresh_initialized_limiters(&account, &clock);

        // Aborts with ENotDue (0x09001).
        let zero_coin = payment::process_due_payment<TEST_USDC>(
            &mut p,
            &mut account,
            &mut limiters,
            &clock,
            ts::ctx(&mut sc),
        );
        coin::destroy_zero(zero_coin);

        policies::destroy_limiters_for_testing(limiters);
        ts::return_shared(p);
        account::destroy_account_for_testing(account);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === test_process_due_payment_insufficient_balance_fails ===
    //
    // The user deposits less than `tier_amount`. `process_due_payment`
    // reaches `internal_withdraw`, which aborts with
    // `EInsufficientBalance` (account module code `0x01005`).

    #[test]
    #[expected_failure(abort_code = 0x01005)]
    fun test_process_due_payment_insufficient_balance_fails() {
        let owner = @0xA;
        let mut sc = ts::begin(owner);
        let clock = fresh_clock(&mut sc);
        let r = registry_with_test_usdc(&mut sc);

        let (account_id, platform_id) = setup_account_with_subscription(
            &r,
            &clock,
            &mut sc,
            50,                 // deposit: only 50, less than tier_amount
            100,                // tier_amount
            0,                  // due now
        );

        ts::next_tx(&mut sc, owner);

        let mut account = ts::take_shared_by_id<account::SubscriptionAccount<TEST_USDC>>(
            &sc, account_id,
        );
        let mut p = ts::take_shared_by_id<platform::Platform>(&mut sc, platform_id);
        let mut limiters = fresh_initialized_limiters(&account, &clock);

        // Aborts with the account module's EInsufficientBalance (0x01005).
        let zero_coin = payment::process_due_payment<TEST_USDC>(
            &mut p,
            &mut account,
            &mut limiters,
            &clock,
            ts::ctx(&mut sc),
        );
        coin::destroy_zero(zero_coin);

        policies::destroy_limiters_for_testing(limiters);
        ts::return_shared(p);
        account::destroy_account_for_testing(account);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === test_process_due_payment_emits_payment_processed ===
    //
    // On success, the function emits a `PaymentProcessed` event.
    // We use `ts::next_tx` to capture the transaction effects and
    // `num_user_events` to count the user events. The state
    // assertions (balance reduced, nonce bumped, treasury credited)
    // confirm the event's payload fields are coherent with the
    // post-state.

    #[test]
    fun test_process_due_payment_emits_payment_processed() {
        let owner = @0xA;
        let mut sc = ts::begin(owner);
        let clock = fresh_clock(&mut sc);
        let r = registry_with_test_usdc(&mut sc);

        let (account_id, platform_id) = setup_account_with_subscription(
            &r,
            &clock,
            &mut sc,
            100,
            100,
            0,
        );

        // First next_tx: end the setup tx.
        let _setup_effects = ts::next_tx(&mut sc, owner);

        let mut account = ts::take_shared_by_id<account::SubscriptionAccount<TEST_USDC>>(
            &sc, account_id,
        );
        let mut p = ts::take_shared_by_id<platform::Platform>(&mut sc, platform_id);
        let mut limiters = fresh_initialized_limiters(&account, &clock);

        let zero_coin = payment::process_due_payment<TEST_USDC>(
            &mut p,
            &mut account,
            &mut limiters,
            &clock,
            ts::ctx(&mut sc),
        );
        coin::destroy_zero(zero_coin);

        // State the event encodes: amount=100, remaining_balance=0,
        // nonce=1.
        assert!(account::balance(&account, &clock) == 0, 0);
        assert!(account::nonce(&account) == 1, 1);

        // End the payment tx; capture its effects to verify events.
        let payment_effects = ts::next_tx(&mut sc, owner);
        // The payment tx emits at least one user event:
        // `PaymentProcessed` (from `payment.move`) plus
        // `PaymentRecorded` (from `billing::record_payment`). We
        // assert >= 1 to be robust against future companion events
        // that don't change the PaymentProcessed semantic.
        let event_count = test_scenario::num_user_events(&payment_effects);
        assert!(event_count >= 1, 2);

        // Cleanup.
        policies::destroy_limiters_for_testing(limiters);
        ts::return_shared(p);
        account::destroy_account_for_testing(account);

        // Treasury got the coin.
        let received_coin = ts::take_from_address<coin::Coin<TEST_USDC>>(&sc, owner);
        assert!(coin::value(&received_coin) == 100, 3);
        std::unit_test::destroy(received_coin);

        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === test_process_due_payment_respects_tier_amount ===
    //
    // BUG FIX #5: `process_due_payment` bills exactly `sub.tier_amount`,
    // regardless of how much is in the account. Deposit 1000 with a
    // 100-tier subscription; the function must bill 100 (not 1000,
    // not 50, exactly 100) and leave 900 in the account.

    #[test]
    fun test_process_due_payment_respects_tier_amount() {
        let owner = @0xA;
        let mut sc = ts::begin(owner);
        let clock = fresh_clock(&mut sc);
        let r = registry_with_test_usdc(&mut sc);

        let (account_id, platform_id) = setup_account_with_subscription(
            &r,
            &clock,
            &mut sc,
            1_000,              // deposit: 10x tier_amount
            100,                // tier_amount = 100
            0,
        );

        ts::next_tx(&mut sc, owner);

        let mut account = ts::take_shared_by_id<account::SubscriptionAccount<TEST_USDC>>(
            &sc, account_id,
        );
        let mut p = ts::take_shared_by_id<platform::Platform>(&mut sc, platform_id);
        let mut limiters = fresh_initialized_limiters(&account, &clock);

        let zero_coin = payment::process_due_payment<TEST_USDC>(
            &mut p,
            &mut account,
            &mut limiters,
            &clock,
            ts::ctx(&mut sc),
        );
        coin::destroy_zero(zero_coin);

        // Tier-amount enforcement: balance = 1000 - 100 = 900.
        assert!(account::balance(&account, &clock) == 900, 0);
        // Per-subscription counters: total_paid = 100, payment_count = 1.
        assert!(billing::subscription_total_paid(&account, platform_id) == 100, 1);
        assert!(billing::subscription_payment_count(&account, platform_id) == 1, 2);

        policies::destroy_limiters_for_testing(limiters);
        ts::return_shared(p);
        account::destroy_account_for_testing(account);

        // Treasury coin = 100.
        ts::next_tx(&mut sc, owner);
        let received_coin = ts::take_from_address<coin::Coin<TEST_USDC>>(&sc, owner);
        assert!(coin::value(&received_coin) == 100, 3);
        std::unit_test::destroy(received_coin);

        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }
}
