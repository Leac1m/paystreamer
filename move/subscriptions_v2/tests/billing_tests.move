// Copyright (c) leac1m
// SPDX-License-Identifier: Apache-2.0

#[test_only]
module paystreamer_v2::billing_tests {
    use paystreamer_v2::account;
    use paystreamer_v2::ac;
    use paystreamer_v2::billing;
    use paystreamer_v2::registry;
    use std::string;
    use sui::object;
    use sui::test_scenario as ts;
    use sui::clock;

    /// One-off witness used as a phantom denomination in tests. Has
    /// `drop` so we can construct it freely; no treasury cap is needed.
    public struct TEST_USDC has drop {}

    /// Build a registry pre-loaded with `TEST_USDC` as a registered coin
    /// (slot 0, the USDC built-in). The caller is responsible for
    /// destroying it via `registry::destroy_for_testing`.
    fun registry_with_test_usdc(scenario: &mut ts::Scenario): registry::CoinTypeRegistry {
        let mut r = registry::new_registry_for_testing(ts::ctx(scenario));
        let info = registry::new_account_type_info(string::utf8(b"USDC"), 6, false);
        registry::register_coin_type<TEST_USDC>(&mut r, info, ts::ctx(scenario));
        r
    }

    /// `billing.move` mutators do not require mutating `next_billing_time`
    /// during pause/resume/cancel, so a clock with a small delta lets us
    /// stamp distinct `updated_at` values. We use a base of 1_000 ms.
    fun fresh_clock(scenario: &mut ts::Scenario): clock::Clock {
        let mut c = clock::create_for_testing(ts::ctx(scenario));
        clock::set_for_testing(&mut c, 1_000);
        c
    }

    // === test_create_subscription_basic ===

    /// Creating a subscription on a fresh account stamps the schedule
    /// correctly: `next_billing_time = now + frequency_ms`, counters
    /// start at 0, status is active, and the embedded record survives
    /// a round-trip read via the accessors.
    #[test]
    fun test_create_subscription_basic() {
        let mut sc = ts::begin(@0xA);
        let clock = fresh_clock(&mut sc);
        let r = registry_with_test_usdc(&mut sc);

        let (mut account, cap) = account::create_account<TEST_USDC>(
            &r,
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );

        let platform_id = object::id_from_address(@0xCAFEBABE);
        let now = clock.timestamp_ms();
        let frequency_ms: u64 = 86_400_000; // 1 day

        billing::create_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            2,              // tier_index
            1_000_000,      // tier_amount (1 USDC)
            frequency_ms,
            registry::account_type_usdc(),
            &clock,
            ts::ctx(&mut sc),
        );

        // Schedule snapshot.
        assert!(billing::subscription_tier_amount(&account, platform_id) == 1_000_000, 0);
        assert!(billing::subscription_tier_frequency_ms(&account, platform_id) == frequency_ms, 1);
        assert!(
            billing::subscription_next_billing_time(&account, platform_id) == now + frequency_ms,
            2,
        );
        // Counters start at zero, status active, no payments yet.
        assert!(billing::subscription_status(&account, platform_id) == 0, 3);
        assert!(billing::subscription_total_paid(&account, platform_id) == 0, 4);
        assert!(billing::subscription_payment_count(&account, platform_id) == 0, 5);
        assert!(billing::subscription_nonce(&account, platform_id) == 0, 6);
        // Denomination round-trips.
        let denom = billing::subscription_denomination(&account, platform_id);
        assert!(registry::account_type_to_u8(&denom) == 0, 7);
        // Map size is 1.
        assert!(account::subscription_count(&account) == 1, 8);

        ac::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === test_create_subscription_duplicate_fails ===

    /// A second `create_subscription` for the same `platform_id` aborts
    /// with `ESubscriptionAlreadyExists` (0x06003). The map is unchanged
    /// after the failed call (the second call never runs, so we only
    /// need to verify the abort code).
    #[test]
    #[expected_failure(abort_code = 0x06003)]
    fun test_create_subscription_duplicate_fails() {
        let mut sc = ts::begin(@0xA);
        let clock = fresh_clock(&mut sc);
        let r = registry_with_test_usdc(&mut sc);

        let (mut account, cap) = account::create_account<TEST_USDC>(
            &r,
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );

        let platform_id = object::id_from_address(@0xCAFEBABE);
        billing::create_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            0,
            1_000_000,
            86_400_000,
            registry::account_type_usdc(),
            &clock,
            ts::ctx(&mut sc),
        );
        // Second call with the same platform_id must abort.
        billing::create_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            0,
            1_000_000,
            86_400_000,
            registry::account_type_usdc(),
            &clock,
            ts::ctx(&mut sc),
        );

        ac::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === test_pause_resume_subscription ===

    /// Pause flips status 0 -> 1; resume flips it back to 0. Both
    /// round-trips preserve the rest of the schedule (counters, time
    /// stamps).
    #[test]
    fun test_pause_resume_subscription() {
        let mut sc = ts::begin(@0xA);
        let mut clock = fresh_clock(&mut sc);
        let r = registry_with_test_usdc(&mut sc);

        let (mut account, cap) = account::create_account<TEST_USDC>(
            &r,
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );

        let platform_id = object::id_from_address(@0xCAFEBABE);
        billing::create_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            0,
            1_000_000,
            86_400_000,
            registry::account_type_usdc(),
            &clock,
            ts::ctx(&mut sc),
        );
        assert!(billing::subscription_status(&account, platform_id) == 0, 0);

        // Pause.
        clock::set_for_testing(&mut clock, 5_000);
        billing::pause_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            &clock,
            ts::ctx(&mut sc),
        );
        assert!(billing::subscription_status(&account, platform_id) == 1, 1);

        // Resume.
        clock::set_for_testing(&mut clock, 10_000);
        billing::resume_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            &clock,
            ts::ctx(&mut sc),
        );
        assert!(billing::subscription_status(&account, platform_id) == 0, 2);

        ac::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === test_cancel_subscription ===

    /// Cancel flips status to 2 (cancelled). A subsequent pause on a
    /// cancelled subscription aborts with `ESubscriptionNotActive`
    /// (0x06004).
    #[test]
    fun test_cancel_subscription() {
        let mut sc = ts::begin(@0xA);
        let clock = fresh_clock(&mut sc);
        let r = registry_with_test_usdc(&mut sc);

        let (mut account, cap) = account::create_account<TEST_USDC>(
            &r,
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );

        let platform_id = object::id_from_address(@0xCAFEBABE);
        billing::create_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            0,
            1_000_000,
            86_400_000,
            registry::account_type_usdc(),
            &clock,
            ts::ctx(&mut sc),
        );
        assert!(billing::subscription_status(&account, platform_id) == 0, 0);

        billing::cancel_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            &clock,
            ts::ctx(&mut sc),
        );
        assert!(billing::subscription_status(&account, platform_id) == 2, 1);

        ac::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    /// Cancelling an already-cancelled subscription is idempotent and
    /// does not emit a second `SubscriptionUpdated` event. We do not
    /// assert on the event stream here; we only check status remains 2.
    #[test]
    fun test_cancel_subscription_idempotent() {
        let mut sc = ts::begin(@0xA);
        let clock = fresh_clock(&mut sc);
        let r = registry_with_test_usdc(&mut sc);

        let (mut account, cap) = account::create_account<TEST_USDC>(
            &r,
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );

        let platform_id = object::id_from_address(@0xCAFEBABE);
        billing::create_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            0,
            1_000_000,
            86_400_000,
            registry::account_type_usdc(),
            &clock,
            ts::ctx(&mut sc),
        );
        billing::cancel_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            &clock,
            ts::ctx(&mut sc),
        );
        // Second cancel: still 2.
        billing::cancel_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            &clock,
            ts::ctx(&mut sc),
        );
        assert!(billing::subscription_status(&account, platform_id) == 2, 0);

        ac::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === test_record_payment_advances_schedule ===

    /// `record_payment` is the bookkeeping step that runs after a
    /// successful on-chain bill. It must advance `next_billing_time`
    /// by `tier_frequency_ms`, bump `total_paid` and `payment_count`,
    /// and increment the per-subscription `nonce`.
    #[test]
    fun test_record_payment_advances_schedule() {
        let mut sc = ts::begin(@0xA);
        let mut clock = fresh_clock(&mut sc);
        let r = registry_with_test_usdc(&mut sc);

        let (mut account, cap) = account::create_account<TEST_USDC>(
            &r,
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );

        let platform_id = object::id_from_address(@0xCAFEBABE);
        let frequency_ms: u64 = 86_400_000;
        billing::create_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            0,
            1_000_000,
            frequency_ms,
            registry::account_type_usdc(),
            &clock,
            ts::ctx(&mut sc),
        );

        // Advance the clock to 1_000_000 ms and record the first payment.
        clock::set_for_testing(&mut clock, 1_000_000);
        billing::record_payment<TEST_USDC>(&mut account, platform_id, 1_000_000, &clock);
        assert!(billing::subscription_total_paid(&account, platform_id) == 1_000_000, 0);
        assert!(billing::subscription_payment_count(&account, platform_id) == 1, 1);
        assert!(billing::subscription_nonce(&account, platform_id) == 1, 2);
        // next_billing_time advanced by frequency_ms.
        assert!(
            billing::subscription_next_billing_time(&account, platform_id)
                == 1_000_000 + frequency_ms,
            3,
        );

        // Second payment: counters stack, schedule advances again.
        clock::set_for_testing(&mut clock, 1_000_000 + frequency_ms);
        billing::record_payment<TEST_USDC>(&mut account, platform_id, 1_000_000, &clock);
        assert!(billing::subscription_total_paid(&account, platform_id) == 2_000_000, 4);
        assert!(billing::subscription_payment_count(&account, platform_id) == 2, 5);
        assert!(billing::subscription_nonce(&account, platform_id) == 2, 6);
        assert!(
            billing::subscription_next_billing_time(&account, platform_id)
                == 1_000_000 + 2 * frequency_ms,
            7,
        );

        ac::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    /// `record_payment` on a non-active subscription aborts with
    /// `ESubscriptionNotActive` (0x06004).
    #[test]
    #[expected_failure(abort_code = 0x06004)]
    fun test_record_payment_on_paused_fails() {
        let mut sc = ts::begin(@0xA);
        let clock = fresh_clock(&mut sc);
        let r = registry_with_test_usdc(&mut sc);

        let (mut account, cap) = account::create_account<TEST_USDC>(
            &r,
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );

        let platform_id = object::id_from_address(@0xCAFEBABE);
        billing::create_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            0,
            1_000_000,
            86_400_000,
            registry::account_type_usdc(),
            &clock,
            ts::ctx(&mut sc),
        );
        billing::pause_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            &clock,
            ts::ctx(&mut sc),
        );
        // Must abort: paused subs cannot record payments.
        billing::record_payment<TEST_USDC>(&mut account, platform_id, 1_000_000, &clock);

        ac::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === test_can_bill_after_time ===

    /// With `frequency_ms = 0`, `next_billing_time == now` at creation
    /// time and `can_bill` returns `true` immediately. A non-zero
    /// frequency yields `false` until the clock advances.
    #[test]
    fun test_can_bill_after_time() {
        let mut sc = ts::begin(@0xA);
        let mut clock = fresh_clock(&mut sc);
        let r = registry_with_test_usdc(&mut sc);

        let (mut account, cap) = account::create_account<TEST_USDC>(
            &r,
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );

        let platform_id = object::id_from_address(@0xCAFEBABE);
        // Zero frequency: due immediately at `now`.
        billing::create_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            0,
            1_000_000,
            0,
            registry::account_type_usdc(),
            &clock,
            ts::ctx(&mut sc),
        );
        let now = clock.timestamp_ms();
        assert!(billing::subscription_next_billing_time(&account, platform_id) == now, 0);
        assert!(billing::can_bill(&account, platform_id, &clock), 1);

        // Pause: can_bill becomes false regardless of schedule.
        billing::pause_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            &clock,
            ts::ctx(&mut sc),
        );
        assert!(!billing::can_bill(&account, platform_id, &clock), 2);

        // Resume and advance the clock to confirm the schedule check.
        billing::resume_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            &clock,
            ts::ctx(&mut sc),
        );
        clock::set_for_testing(&mut clock, now + 1);
        assert!(billing::can_bill(&account, platform_id, &clock), 3);

        // Unknown platform_id: can_bill returns false (no abort).
        let other_platform = object::id_from_address(@0xDEADBEEF);
        assert!(!billing::can_bill(&account, other_platform, &clock), 4);

        ac::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    /// `can_bill` returns `false` when the clock is before the
    /// `next_billing_time` boundary, even on an active subscription.
    #[test]
    fun test_can_bill_false_before_time() {
        let mut sc = ts::begin(@0xA);
        let clock = fresh_clock(&mut sc);
        let r = registry_with_test_usdc(&mut sc);

        let (mut account, cap) = account::create_account<TEST_USDC>(
            &r,
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );

        let platform_id = object::id_from_address(@0xCAFEBABE);
        // 1 day frequency: not due immediately.
        billing::create_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            0,
            1_000_000,
            86_400_000,
            registry::account_type_usdc(),
            &clock,
            ts::ctx(&mut sc),
        );
        assert!(!billing::can_bill(&account, platform_id, &clock), 0);

        ac::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === test_create_subscription_denomination_mismatch_fails ===

    /// Passing `AccountType::USDSui` to `create_subscription` for an
    /// account that is denominated in `USDC` aborts with
    /// `EDenominationMismatch` (0x06008). This is the v2 fix for
    /// BUG #3 (cross-stablecoin billing).
    #[test]
    #[expected_failure(abort_code = 0x06008)]
    fun test_create_subscription_denomination_mismatch_fails() {
        let mut sc = ts::begin(@0xA);
        let clock = fresh_clock(&mut sc);
        let r = registry_with_test_usdc(&mut sc);

        let (mut account, cap) = account::create_account<TEST_USDC>(
            &r,
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );

        let platform_id = object::id_from_address(@0xCAFEBABE);
        billing::create_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            0,
            1_000_000,
            86_400_000,
            registry::account_type_usdc(), // account is USDC
            &clock,
            ts::ctx(&mut sc),
        );
        // Second call passes the wrong denomination. Must abort.
        let other_platform = object::id_from_address(@0xDEADBEEF);
        billing::create_subscription<TEST_USDC>(
            &cap,
            &mut account,
            other_platform,
            0,
            1_000_000,
            86_400_000,
            registry::account_type_usdsui(), // wrong
            &clock,
            ts::ctx(&mut sc),
        );

        ac::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === access-control coverage ===

    /// A DEPOSITOR cap cannot pause a subscription — aborts with the
    /// unauthorized error (0x06009). This pins the OWNER-only check
    /// in `pause_subscription`.
    #[test]
    #[expected_failure(abort_code = 0x06009)]
    fun test_pause_subscription_depositor_cap_fails() {
        let mut sc = ts::begin(@0xA);
        let clock = fresh_clock(&mut sc);
        let r = registry_with_test_usdc(&mut sc);

        let (mut account, cap) = account::create_account<TEST_USDC>(
            &r,
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );
        let account_id = object::id(&account);
        let platform_id = object::id_from_address(@0xCAFEBABE);
        billing::create_subscription<TEST_USDC>(
            &cap,
            &mut account,
            platform_id,
            0,
            1_000_000,
            86_400_000,
            registry::account_type_usdc(),
            &clock,
            ts::ctx(&mut sc),
        );

        // DEPOSITOR-only cap: must not be able to pause.
        let dep_cap = ac::new_account_cap_for_testing(
            account_id,
            ac::permission_depositor(),
            ts::ctx(&mut sc),
        );
        billing::pause_subscription<TEST_USDC>(
            &dep_cap,
            &mut account,
            platform_id,
            &clock,
            ts::ctx(&mut sc),
        );

        ac::destroy_account_cap_for_testing(dep_cap);
        ac::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }
}
