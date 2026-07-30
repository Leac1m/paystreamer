#[test_only]
module subscriptions::subscription_tests {
    use subscriptions::account;
    
    

    use sui::object;
    use sui::test_scenario as ts;
    use sui::clock;

    public struct TEST_USDC has drop {}


    fun fresh_clock(scenario: &mut ts::Scenario): clock::Clock {
        let mut c = clock::create_for_testing(ts::ctx(scenario));
        clock::set_for_testing(&mut c, 1_000);
        c
    }

    #[test]
    fun test_create_subscription_basic() {
        let mut sc = ts::begin(@0xA);
        let clock = fresh_clock(&mut sc);
        let (mut account, cap) = account::create_account<TEST_USDC>(
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );

        let platform_id = object::id_from_address(@0xCAFEBABE);
        let now = clock.timestamp_ms();
        let frequency_ms: u64 = 86_400_000;

        account::create_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            2,
            1_000_000,
            frequency_ms,
            3,
            &clock,
            ts::ctx(&mut sc),
        );

        assert!(account::subscription_tier_amount(&account, platform_id) == 1_000_000, 0);
        assert!(account::subscription_tier_frequency_ms(&account, platform_id) == frequency_ms, 1);
        assert!(
            account::subscription_next_billing_time(&account, platform_id) == now + frequency_ms,
            2,
        );
        assert!(account::subscription_status(&account, platform_id) == 0, 3);
        assert!(account::subscription_total_paid(&account, platform_id) == 0, 4);
        assert!(account::subscription_payment_count(&account, platform_id) == 0, 5);
        assert!(account::subscription_nonce(&account, platform_id) == 0, 6);
        assert!(account::subscription_count(&account) == 1, 7);

        account::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);

        clock::destroy_for_testing(clock);
        sc.end();
    }

    #[test]
    #[expected_failure(abort_code = 0x06003)]
    fun test_create_subscription_duplicate_fails() {
        let mut sc = ts::begin(@0xA);
        let clock = fresh_clock(&mut sc);
        let (mut account, cap) = account::create_account<TEST_USDC>(
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );

        let platform_id = object::id_from_address(@0xCAFEBABE);
        account::create_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            0,
            1_000_000,
            86_400_000,
            3,
            &clock,
            ts::ctx(&mut sc),
        );
        account::create_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            0,
            1_000_000,
            86_400_000,
            3,
            &clock,
            ts::ctx(&mut sc),
        );

        account::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);

        clock::destroy_for_testing(clock);
        sc.end();
    }

    #[test]
    fun test_cancel_subscription() {
        let mut sc = ts::begin(@0xA);
        let clock = fresh_clock(&mut sc);
        let (mut account, cap) = account::create_account<TEST_USDC>(
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );

        let platform_id = object::id_from_address(@0xCAFEBABE);
        account::create_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            0,
            1_000_000,
            86_400_000,
            3,
            &clock,
            ts::ctx(&mut sc),
        );
        assert!(account::subscription_status(&account, platform_id) == 0, 0);

        account::cancel_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            &clock,
            ts::ctx(&mut sc),
        );
        assert!(!account::has_subscription(&account, &platform_id), 1);

        account::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);

        clock::destroy_for_testing(clock);
        sc.end();
    }

    #[test]
    fun test_cancel_subscription_idempotent() {
        let mut sc = ts::begin(@0xA);
        let clock = fresh_clock(&mut sc);
        let (mut account, cap) = account::create_account<TEST_USDC>(
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );

        let platform_id = object::id_from_address(@0xCAFEBABE);
        account::create_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            0,
            1_000_000,
            86_400_000,
            3,
            &clock,
            ts::ctx(&mut sc),
        );
        account::cancel_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            &clock,
            ts::ctx(&mut sc),
        );
        assert!(!account::has_subscription(&account, &platform_id), 0);

        account::create_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            0,
            2_000_000,
            86_400_000,
            3,
            &clock,
            ts::ctx(&mut sc),
        );
        assert!(account::subscription_status(&account, platform_id) == 0, 1);

        account::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);

        clock::destroy_for_testing(clock);
        sc.end();
    }

    #[test]
    fun test_resubscribe_after_cancel() {
        let mut sc = ts::begin(@0xA);
        let clock = fresh_clock(&mut sc);
        let (mut account, cap) = account::create_account<TEST_USDC>(
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );

        let platform_id = object::id_from_address(@0xCAFEBABE);
        account::create_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            0,
            1_000_000,
            86_400_000,
            3,
            &clock,
            ts::ctx(&mut sc),
        );
        assert!(account::subscription_status(&account, platform_id) == 0, 0);

        account::cancel_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            &clock,
            ts::ctx(&mut sc),
        );
        assert!(!account::has_subscription(&account, &platform_id), 1);

        account::create_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            0,
            2_000_000,
            86_400_000,
            3,
            &clock,
            ts::ctx(&mut sc),
        );
        assert!(account::subscription_status(&account, platform_id) == 0, 2);

        account::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);

        clock::destroy_for_testing(clock);
        sc.end();
    }

    #[test]
    fun test_record_payment_advances_schedule() {
        let mut sc = ts::begin(@0xA);
        let mut clock = fresh_clock(&mut sc);
        let (mut account, cap) = account::create_account<TEST_USDC>(
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );

        let platform_id = object::id_from_address(@0xCAFEBABE);
        let frequency_ms: u64 = 86_400_000;
        account::create_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            0,
            1_000_000,
            frequency_ms,
            3,
            &clock,
            ts::ctx(&mut sc),
        );

        clock::set_for_testing(&mut clock, 1_000_000);
        account::record_payment<TEST_USDC>(&mut account, platform_id, 1_000_000, &clock);
        assert!(account::subscription_total_paid(&account, platform_id) == 1_000_000, 0);
        assert!(account::subscription_payment_count(&account, platform_id) == 1, 1);
        assert!(account::subscription_nonce(&account, platform_id) == 1, 2);
        assert!(
            account::subscription_next_billing_time(&account, platform_id)
                == 1_000_000 + frequency_ms,
            3,
        );

        clock::set_for_testing(&mut clock, 1_000_000 + frequency_ms);
        account::record_payment<TEST_USDC>(&mut account, platform_id, 1_000_000, &clock);
        assert!(account::subscription_total_paid(&account, platform_id) == 2_000_000, 4);
        assert!(account::subscription_payment_count(&account, platform_id) == 2, 5);
        assert!(account::subscription_nonce(&account, platform_id) == 2, 6);
        assert!(
            account::subscription_next_billing_time(&account, platform_id)
                == 1_000_000 + 2 * frequency_ms,
            7,
        );

        account::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);

        clock::destroy_for_testing(clock);
        sc.end();
    }

    #[test]
    #[expected_failure(abort_code = 0x06004)]
    fun test_record_payment_on_paused_fails() {
        let mut sc = ts::begin(@0xA);
        let clock = fresh_clock(&mut sc);
        let (mut account, cap) = account::create_account<TEST_USDC>(
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );

        let platform_id = object::id_from_address(@0xCAFEBABE);
        account::create_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            0,
            1_000_000,
            86_400_000,
            3,
            &clock,
            ts::ctx(&mut sc),
        );
        account::pause_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            &clock,
            ts::ctx(&mut sc),
        );
        account::record_payment<TEST_USDC>(&mut account, platform_id, 1_000_000, &clock);

        account::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);

        clock::destroy_for_testing(clock);
        sc.end();
    }

    #[test]
    fun test_can_bill_after_time() {
        let mut sc = ts::begin(@0xA);
        let mut clock = fresh_clock(&mut sc);
        let (mut account, cap) = account::create_account<TEST_USDC>(
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );

        let platform_id = object::id_from_address(@0xCAFEBABE);
        account::create_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            0,
            1_000_000,
            0,
            3,
            &clock,
            ts::ctx(&mut sc),
        );
        let now = clock.timestamp_ms();
        assert!(account::subscription_next_billing_time(&account, platform_id) == now, 0);
        assert!(account::can_bill(&account, platform_id, &clock), 1);

        account::pause_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            &clock,
            ts::ctx(&mut sc),
        );
        assert!(!account::can_bill(&account, platform_id, &clock), 2);

        account::resume_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            &clock,
            ts::ctx(&mut sc),
        );
        clock::set_for_testing(&mut clock, now + 1);
        assert!(account::can_bill(&account, platform_id, &clock), 3);

        let other_platform = object::id_from_address(@0xDEADBEEF);
        assert!(!account::can_bill(&account, other_platform, &clock), 4);

        account::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);

        clock::destroy_for_testing(clock);
        sc.end();
    }

    #[test]
    fun test_can_bill_false_before_time() {
        let mut sc = ts::begin(@0xA);
        let clock = fresh_clock(&mut sc);
        let (mut account, cap) = account::create_account<TEST_USDC>(
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );

        let platform_id = object::id_from_address(@0xCAFEBABE);
        account::create_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            0,
            1_000_000,
            86_400_000,
            3,
            &clock,
            ts::ctx(&mut sc),
        );
        assert!(!account::can_bill(&account, platform_id, &clock), 0);

        account::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);

        clock::destroy_for_testing(clock);
        sc.end();
    }
}
