#[test_only]
module subscriptions::payment_tests {
    use subscriptions::account;
    use subscriptions::registry;
    
    
    use subscriptions::payment;
    use subscriptions::platform;
    use subscriptions::policies;

    use sui::coin;
    use std::string;
    use sui::object;
    use sui::test_scenario as ts;
    use sui::test_scenario;
    use sui::clock;

    public struct TEST_USDC has drop {}


    fun fresh_clock(scenario: &mut ts::Scenario): clock::Clock {
        let mut c = clock::create_for_testing(ts::ctx(scenario));
        clock::set_for_testing(&mut c, 1_000);
        c
    }

    fun fresh_initialized_limiters(
        account: &account::SubscriptionAccount<TEST_USDC>,
        clock: &clock::Clock,
    ): policies::PolicyLimiters {
        let mut limiters = policies::empty_limiters(clock);
        policies::ensure_initialized<TEST_USDC>(account, &mut limiters, clock);
        limiters
    }

    fun setup_account_with_subscription(
        clock: &clock::Clock,
        scenario: &mut ts::Scenario,
        tier_amount: u64,
        frequency_ms: u64,
    ): (object::ID, object::ID) {
        let (platform, receipt) = platform::create_platform(
            string::utf8(b"TestPlatform"),
            string::utf8(b"d"),
            string::utf8(b"Test"),
            std::option::none(),
            clock,
            ts::ctx(scenario),
        );
        let platform_id = sui::object::id(&platform);
        platform::register_platform(platform, receipt);

        let (mut account, cap) = account::create_account<TEST_USDC>(
            account::empty_policy_set(),
            clock,
            ts::ctx(scenario),
        );

        account::create_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            0,
            tier_amount,
            frequency_ms,
            3,
            clock);

        let account_id = object::id(&account);
        account::share_account<TEST_USDC>(account, cap, ts::ctx(scenario));
        (account_id, platform_id)
    }

    #[test]
    fun test_process_due_payment_succeeds() {
        let owner = @0xA;
        let mut sc = ts::begin(owner);
        registry::init_for_testing(ts::ctx(&mut sc));
        let clock = fresh_clock(&mut sc);
        let (account_id, platform_id) = setup_account_with_subscription(
            &clock,
            &mut sc,
            100,
            0,
        );

        ts::next_tx(&mut sc, owner);

        let mut registry = ts::take_shared<registry::Registry>(&sc);

        let mut account = ts::take_shared_by_id<account::SubscriptionAccount<TEST_USDC>>(
            &sc, account_id,
        );
        let mut p = ts::take_shared_by_id<platform::Platform>(&mut sc, platform_id);
        let mut limiters = fresh_initialized_limiters(&account, &clock);

        let cap = ts::take_from_address<account::AccountCap>(&sc, owner);
        let coin = coin::mint_for_testing<TEST_USDC>(100, ts::ctx(&mut sc));
        account::deposit(&mut account, coin, ts::ctx(&mut sc));
        ts::return_to_address(owner, cap);

        payment::process_due_payment<TEST_USDC>(
            &registry,
            &mut p,
            &mut account,
            &mut limiters,
            &clock,
            ts::ctx(&mut sc),
        );

        assert!(account::nonce(&account) == 1, 0);
        assert!(account::subscription_total_paid(&account, platform_id) == 100, 2);
        assert!(account::subscription_payment_count(&account, platform_id) == 1, 3);

        policies::destroy_limiters_for_testing(limiters);
        ts::return_shared(p);
        account::destroy_account_for_testing(account);


        clock::destroy_for_testing(clock);
        ts::return_shared(registry);
        sc.end();
    }

    #[test]
    #[expected_failure(abort_code = 0x09001)]
    fun test_process_due_payment_not_due_fails() {
        let owner = @0xA;
        let mut sc = ts::begin(owner);
        registry::init_for_testing(ts::ctx(&mut sc));
        let clock = fresh_clock(&mut sc);
        let (account_id, platform_id) = setup_account_with_subscription(
            &clock,
            &mut sc,
            100,
            86_400_000,
        );

        ts::next_tx(&mut sc, owner);

        let mut registry = ts::take_shared<registry::Registry>(&sc);

        let mut account = ts::take_shared_by_id<account::SubscriptionAccount<TEST_USDC>>(
            &sc, account_id,
        );
        let mut p = ts::take_shared_by_id<platform::Platform>(&mut sc, platform_id);
        let mut limiters = fresh_initialized_limiters(&account, &clock);

        payment::process_due_payment<TEST_USDC>(
            &registry,
            &mut p,
            &mut account,
            &mut limiters,
            &clock,
            ts::ctx(&mut sc),
        );

        policies::destroy_limiters_for_testing(limiters);
        ts::return_shared(p);
        account::destroy_account_for_testing(account);

        clock::destroy_for_testing(clock);
        ts::return_shared(registry);
        sc.end();
    }

    #[test]
    fun test_process_due_payment_emits_payment_processed() {
        let owner = @0xA;
        let mut sc = ts::begin(owner);
        registry::init_for_testing(ts::ctx(&mut sc));
        let clock = fresh_clock(&mut sc);
        let (account_id, platform_id) = setup_account_with_subscription(
            &clock,
            &mut sc,
            100,
            0,
        );

        let _setup_effects = ts::next_tx(&mut sc, owner);

        let mut registry = ts::take_shared<registry::Registry>(&sc);

        let mut account = ts::take_shared_by_id<account::SubscriptionAccount<TEST_USDC>>(
            &sc, account_id,
        );
        let mut p = ts::take_shared_by_id<platform::Platform>(&mut sc, platform_id);
        let mut limiters = fresh_initialized_limiters(&account, &clock);

        let cap = ts::take_from_address<account::AccountCap>(&sc, owner);
        let coin = coin::mint_for_testing<TEST_USDC>(100, ts::ctx(&mut sc));
        account::deposit(&mut account, coin, ts::ctx(&mut sc));
        ts::return_to_address(owner, cap);

        payment::process_due_payment<TEST_USDC>(
            &registry,
            &mut p,
            &mut account,
            &mut limiters,
            &clock,
            ts::ctx(&mut sc),
        );

        assert!(account::nonce(&account) == 1, 1);

        let payment_effects = ts::next_tx(&mut sc, owner);
        let event_count = test_scenario::num_user_events(&payment_effects);
        assert!(event_count >= 1, 2);

        policies::destroy_limiters_for_testing(limiters);
        ts::return_shared(p);
        account::destroy_account_for_testing(account);


        clock::destroy_for_testing(clock);
        ts::return_shared(registry);
        sc.end();
    }

    public struct TEST_WAL has drop {}

    #[test]
    fun test_process_routed_payment_succeeds() {
        let owner = @0xA;
        let mut sc = ts::begin(owner);
        registry::init_for_testing(ts::ctx(&mut sc));
        let clock = fresh_clock(&mut sc);
        
        let (account_id, platform_id) = setup_account_with_subscription(
            &clock,
            &mut sc,
            100, // tier_amount (needs 100 WAL)
            0,
        );

        let _setup_effects = ts::next_tx(&mut sc, owner);

        let registry = ts::take_shared<registry::Registry>(&sc);

        let mut account = ts::take_shared_by_id<account::SubscriptionAccount<TEST_USDC>>(
            &sc, account_id,
        );
        let mut p = ts::take_shared_by_id<platform::Platform>(&mut sc, platform_id);
        let mut limiters = fresh_initialized_limiters(&account, &clock);

        let cap = ts::take_from_address<account::AccountCap>(&sc, owner);
        // Deposit 200 USDC into the account
        let coin_usdc = coin::mint_for_testing<TEST_USDC>(200, ts::ctx(&mut sc));
        account::deposit(&mut account, coin_usdc, ts::ctx(&mut sc));
        ts::return_to_address(owner, cap);

        // Max spend allowed is 150 USDC (assuming policies pass because they are unlimited)
        let (mut withdrawn_usdc, potato) = payment::withdraw_for_route<TEST_USDC, TEST_WAL>(
            &p,
            &mut account,
            &mut limiters,
            &clock,
            150,
            ts::ctx(&mut sc),
        );

        // Verify we withdrew 150 USDC
        assert!(withdrawn_usdc.value() == 150, 0);

        // "Swap" 100 USDC for 100 WAL, so change is 50 USDC
        let swap_payment = coin::mint_for_testing<TEST_WAL>(100, ts::ctx(&mut sc));
        
        let change_usdc = coin::split(&mut withdrawn_usdc, 50, ts::ctx(&mut sc));
        // The swap consumes the rest (100 USDC) - we just burn it for the test
        withdrawn_usdc.burn_for_testing();

        payment::process_routed_payment<TEST_USDC, TEST_WAL>(
            potato,
            &registry,
            &mut p,
            &mut account,
            swap_payment,
            change_usdc,
            &clock,
            ts::ctx(&mut sc),
        );
        
        // Verify change was deposited (200 - 150 + 50 = 100 USDC remaining)
        // Verify nonce bumped
        assert!(account::nonce(&account) == 1, 2);

        policies::destroy_limiters_for_testing(limiters);
        ts::return_shared(p);
        
        // Empty the account balance before destruction
        let remaining_coin = account::internal_withdraw<TEST_USDC>(&mut account, 100, ts::ctx(&mut sc));
        remaining_coin.burn_for_testing();
        
        account::destroy_account_for_testing(account);
        clock::destroy_for_testing(clock);
        ts::return_shared(registry);
        sc.end();
    }

    #[test]
    fun test_process_due_payment_insufficient_balance() {
        let owner = @0xA;
        let mut sc = ts::begin(owner);
        registry::init_for_testing(ts::ctx(&mut sc));
        let clock = fresh_clock(&mut sc);
        let (account_id, platform_id) = setup_account_with_subscription(
            &clock,
            &mut sc,
            100,
            0,
        );

        ts::next_tx(&mut sc, owner);

        let registry = ts::take_shared<registry::Registry>(&sc);

        let mut account = ts::take_shared_by_id<account::SubscriptionAccount<TEST_USDC>>(
            &sc, account_id,
        );
        let mut p = ts::take_shared_by_id<platform::Platform>(&mut sc, platform_id);
        let mut limiters = fresh_initialized_limiters(&account, &clock);

        // Intentionally DO NOT deposit funds, so balance is 0.

        // Call process_due_payment 3 times to trigger the auto-pause
        payment::process_due_payment<TEST_USDC>(
            &registry,
            &mut p,
            &mut account,
            &mut limiters,
            &clock,
            ts::ctx(&mut sc),
        );
        
        // Assert attempt count is 1
        assert!(account::subscription_status(&account, platform_id) == 0, 1); // Still active

        payment::process_due_payment<TEST_USDC>(
            &registry,
            &mut p,
            &mut account,
            &mut limiters,
            &clock,
            ts::ctx(&mut sc),
        );
        
        payment::process_due_payment<TEST_USDC>(
            &registry,
            &mut p,
            &mut account,
            &mut limiters,
            &clock,
            ts::ctx(&mut sc),
        );

        // After 3 failures, status should be paused (1)
        assert!(account::subscription_status(&account, platform_id) == 1, 2); 
        // has_active_subscription should return false!
        assert!(!account::has_active_subscription(&account, platform_id), 3);

        policies::destroy_limiters_for_testing(limiters);
        ts::return_shared(p);
        account::destroy_account_for_testing(account);
        clock::destroy_for_testing(clock);
        ts::return_shared(registry);
        sc.end();
    }
}
