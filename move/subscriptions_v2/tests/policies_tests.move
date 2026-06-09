// Copyright (c) leac1m
// SPDX-License-Identifier: Apache-2.0

#[test_only]
module paystreamer_v2::policies_tests {
    use paystreamer_v2::account::{Self, PolicySet};
    use paystreamer_v2::access_control;
    use paystreamer_v2::policies::{Self, PolicyLimiters, PolicyFailure};
    use paystreamer_v2::registry;
    use std::string;
    use sui::test_scenario as ts;
    use sui::clock;

    /// One-off witness used as a phantom denomination in tests. Has
    /// `drop` so we can construct it freely.
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

    /// `policies::evaluate` is timestamp-sensitive; we anchor tests to a
    /// 1_000 ms base. The tests that need to advance time use
    /// `clock::set_for_testing`.
    fun fresh_clock(scenario: &mut ts::Scenario): clock::Clock {
        let mut c = clock::create_for_testing(ts::ctx(scenario));
        clock::set_for_testing(&mut c, 1_000);
        c
    }

    // === test_evaluate_passes_when_no_policies_set ===

    /// A `PolicySet` with all-zero caps is a "no-cap" set: the
    /// `empty_policy_set` defaults. `evaluate` must return
    /// `(true, vector::empty())` for any amount. The limiter state
    /// is untouched because every guard is `ps.X > 0` and false.
    #[test]
    fun test_evaluate_passes_when_no_policies_set() {
        let mut sc = ts::begin(@0xA);
        let clock = fresh_clock(&mut sc);
        let r = registry_with_test_usdc(&mut sc);

        let (account, _cap) = account::create_account<TEST_USDC>(
            &r,
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );

        let mut limiters = policies::empty_limiters(&clock);
        policies::ensure_initialized<TEST_USDC>(&account, &mut limiters, &clock);

        // 1 unit, 0 balance, no caps -> always allowed.
        let (allowed, failures) = policies::evaluate<TEST_USDC>(
            &account, &mut limiters, 1, 0, &clock,
        );
        assert!(allowed, 0);
        assert!(vector::length(&failures) == 0, 1);

        // A large amount, no balance, no caps -> still allowed.
        let (allowed2, failures2) = policies::evaluate<TEST_USDC>(
            &account, &mut limiters, 1_000_000_000, 0, &clock,
        );
        assert!(allowed2, 2);
        assert!(vector::length(&failures2) == 0, 3);

        // Cleanup.
        access_control::destroy_account_cap_for_testing(_cap);
        account::destroy_account_for_testing(account);
        policies::destroy_limiters_for_testing(limiters);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === test_evaluate_blocks_per_tx ===

    /// `per_tx_max = 100` and `amount = 200` produces a single
    /// per-tx failure with the typed code `0x07001`. The monthly,
    /// min-balance, and frequency checks are skipped (caps are 0).
    #[test]
    fun test_evaluate_blocks_per_tx() {
        let mut sc = ts::begin(@0xA);
        let clock = fresh_clock(&mut sc);
        let r = registry_with_test_usdc(&mut sc);

        let ps: PolicySet = account::new_policy_set(
            100,        // per_tx_max
            0,          // monthly_max (no cap)
            0,          // min_balance (no floor)
            0,          // frequency_min_ms (no cooldown)
        );
        let (account, _cap) = account::create_account<TEST_USDC>(
            &r, ps, &clock, ts::ctx(&mut sc),
        );

        let mut limiters = policies::empty_limiters(&clock);
        policies::ensure_initialized<TEST_USDC>(&account, &mut limiters, &clock);

        // 200 > 100 -> per_tx failure.
        let (allowed, failures) = policies::evaluate<TEST_USDC>(
            &account, &mut limiters, 200, 0, &clock,
        );
        assert!(!allowed, 0);
        assert!(vector::length(&failures) == 1, 1);
        let f: &PolicyFailure = vector::borrow(&failures, 0);
        assert!(policies::failure_code(f) == 0x07001, 2);
        assert!(policies::failure_amount_required(f) == 200, 3);
        assert!(policies::failure_amount_available(f) == 100, 4);

        // 100 fits -> allowed.
        let (allowed2, failures2) = policies::evaluate<TEST_USDC>(
            &account, &mut limiters, 100, 0, &clock,
        );
        assert!(allowed2, 5);
        assert!(vector::length(&failures2) == 0, 6);

        access_control::destroy_account_cap_for_testing(_cap);
        account::destroy_account_for_testing(account);
        policies::destroy_limiters_for_testing(limiters);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === test_evaluate_blocks_monthly_after_capacity ===

    /// `monthly_max = 1000`. A first call of 1000 succeeds and
    /// drains the `FixedWindow` headroom. The second call (amount=1)
    /// fails because the projected headroom is 0. The failure is
    /// the monthly one (`0x07002`).
    ///
    /// Note: the `FixedWindow` is a "bucket with refill_amount = capacity,
    /// interval = window_ms", so within a single 30-day window the
    /// headroom is non-increasing until the window rolls over.
    #[test]
    fun test_evaluate_blocks_monthly_after_capacity() {
        let mut sc = ts::begin(@0xA);
        let clock = fresh_clock(&mut sc);
        let r = registry_with_test_usdc(&mut sc);

        let ps: PolicySet = account::new_policy_set(
            0,       // per_tx_max (no cap)
            1_000,   // monthly_max
            0,       // min_balance
            0,       // frequency_min_ms
        );
        let (account, _cap) = account::create_account<TEST_USDC>(
            &r, ps, &clock, ts::ctx(&mut sc),
        );

        let mut limiters = policies::empty_limiters(&clock);
        policies::ensure_initialized<TEST_USDC>(&account, &mut limiters, &clock);

        // First call: 1000 fits the monthly cap.
        let (allowed1, failures1) = policies::evaluate<TEST_USDC>(
            &account, &mut limiters, 1_000, 0, &clock,
        );
        assert!(allowed1, 0);
        assert!(vector::length(&failures1) == 0, 1);

        // Second call: 1 unit. Monthly headroom is 0 -> failure.
        let (allowed2, failures2) = policies::evaluate<TEST_USDC>(
            &account, &mut limiters, 1, 0, &clock,
        );
        assert!(!allowed2, 2);
        assert!(vector::length(&failures2) == 1, 3);
        let f: &PolicyFailure = vector::borrow(&failures2, 0);
        assert!(policies::failure_code(f) == 0x07002, 4);
        assert!(policies::failure_amount_required(f) == 1, 5);
        assert!(policies::failure_amount_available(f) == 0, 6);

        access_control::destroy_account_cap_for_testing(_cap);
        account::destroy_account_for_testing(account);
        policies::destroy_limiters_for_testing(limiters);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === test_evaluate_blocks_min_balance ===

    /// `min_balance = 100`, `current_balance = 150`, `amount = 60`.
    /// Post-withdraw would leave 90 < 100, so the check fails.
    /// The failure is the min-balance one (`0x07003`) with
    /// `amount_available = current_balance - min_balance = 50`
    /// (the max amount that could be withdrawn without violating).
    #[test]
    fun test_evaluate_blocks_min_balance() {
        let mut sc = ts::begin(@0xA);
        let clock = fresh_clock(&mut sc);
        let r = registry_with_test_usdc(&mut sc);

        let ps: PolicySet = account::new_policy_set(
            0,     // per_tx_max
            0,     // monthly_max
            100,   // min_balance
            0,     // frequency_min_ms
        );
        let (account, _cap) = account::create_account<TEST_USDC>(
            &r, ps, &clock, ts::ctx(&mut sc),
        );

        let mut limiters = policies::empty_limiters(&clock);
        policies::ensure_initialized<TEST_USDC>(&account, &mut limiters, &clock);

        // 60 against balance 150 with min 100 -> 150 - 60 = 90 < 100.
        let (allowed, failures) = policies::evaluate<TEST_USDC>(
            &account, &mut limiters, 60, 150, &clock,
        );
        assert!(!allowed, 0);
        assert!(vector::length(&failures) == 1, 1);
        let f: &PolicyFailure = vector::borrow(&failures, 0);
        assert!(policies::failure_code(f) == 0x07003, 2);
        assert!(policies::failure_amount_required(f) == 60, 3);
        assert!(policies::failure_amount_available(f) == 50, 4);

        // 50 fits (post-withdraw 100 == min).
        let (allowed2, failures2) = policies::evaluate<TEST_USDC>(
            &account, &mut limiters, 50, 150, &clock,
        );
        assert!(allowed2, 5);
        assert!(vector::length(&failures2) == 0, 6);

        access_control::destroy_account_cap_for_testing(_cap);
        account::destroy_account_for_testing(account);
        policies::destroy_limiters_for_testing(limiters);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === test_evaluate_blocks_frequency_during_cooldown ===

    /// `frequency_min_ms = 1000`. The first call succeeds and
    /// arms the `Cooldown` gate at `cooldown_end_ms = now + 1000`.
    /// The second call within the cooldown window fails. The
    /// failure is the frequency one (`0x07004`).
    #[test]
    fun test_evaluate_blocks_frequency_during_cooldown() {
        let mut sc = ts::begin(@0xA);
        let mut clock = fresh_clock(&mut sc);
        let r = registry_with_test_usdc(&mut sc);

        let ps: PolicySet = account::new_policy_set(
            0,         // per_tx_max
            0,         // monthly_max
            0,         // min_balance
            1_000,     // frequency_min_ms (1s)
        );
        let (account, _cap) = account::create_account<TEST_USDC>(
            &r, ps, &clock, ts::ctx(&mut sc),
        );

        let mut limiters = policies::empty_limiters(&clock);
        policies::ensure_initialized<TEST_USDC>(&account, &mut limiters, &clock);

        // First call at t=1000ms: gate not armed, allowed.
        let (allowed1, failures1) = policies::evaluate<TEST_USDC>(
            &account, &mut limiters, 1, 0, &clock,
        );
        assert!(allowed1, 0);
        assert!(vector::length(&failures1) == 0, 1);

        // Advance time to 1500ms (within 1000ms cooldown window).
        clock::set_for_testing(&mut clock, 1_500);

        // Second call within cooldown -> frequency failure.
        let (allowed2, failures2) = policies::evaluate<TEST_USDC>(
            &account, &mut limiters, 1, 0, &clock,
        );
        assert!(!allowed2, 2);
        assert!(vector::length(&failures2) == 1, 3);
        let f: &PolicyFailure = vector::borrow(&failures2, 0);
        assert!(policies::failure_code(f) == 0x07004, 4);
        assert!(policies::failure_amount_required(f) == 1, 5);
        assert!(policies::failure_amount_available(f) == 0, 6);

        // Advance past the cooldown: t=2001ms (>= 1000 + 1000).
        clock::set_for_testing(&mut clock, 2_001);

        // Third call: cooldown elapsed, allowed.
        let (allowed3, failures3) = policies::evaluate<TEST_USDC>(
            &account, &mut limiters, 1, 0, &clock,
        );
        assert!(allowed3, 7);
        assert!(vector::length(&failures3) == 0, 8);

        access_control::destroy_account_cap_for_testing(_cap);
        account::destroy_account_for_testing(account);
        policies::destroy_limiters_for_testing(limiters);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === test_evaluate_failed_does_not_burn_tokens ===

    /// **The two-pass projection bug fix.** A failing call must NOT
    /// mutate the limiters. Specifically:
    ///
    /// 1. Build a monthly-max=1000 limit.
    /// 2. Call evaluate with amount=1500 (fails: 1500 > 1000).
    /// 3. Call evaluate with amount=500 (would pass IF the previous
    ///    call had not burned 1000 of headroom).
    ///
    /// In a buggy single-pass implementation, the first call would
    /// have decremented the `FixedWindow` to 0, and the second call
    /// would fail. With the two-pass projection, the first call's
    /// failure means the limiter is untouched, and the second call
    /// succeeds.
    #[test]
    fun test_evaluate_failed_does_not_burn_tokens() {
        let mut sc = ts::begin(@0xA);
        let clock = fresh_clock(&mut sc);
        let r = registry_with_test_usdc(&mut sc);

        let ps: PolicySet = account::new_policy_set(
            0,       // per_tx_max
            1_000,   // monthly_max
            0,       // min_balance
            0,       // frequency_min_ms
        );
        let (account, _cap) = account::create_account<TEST_USDC>(
            &r, ps, &clock, ts::ctx(&mut sc),
        );

        let mut limiters = policies::empty_limiters(&clock);
        policies::ensure_initialized<TEST_USDC>(&account, &mut limiters, &clock);

        // Step 1: failing call. monthly_avail = 1000; 1500 > 1000.
        let (allowed1, failures1) = policies::evaluate<TEST_USDC>(
            &account, &mut limiters, 1_500, 0, &clock,
        );
        assert!(!allowed1, 0);
        assert!(vector::length(&failures1) == 1, 1);

        // Step 2: passing call. monthly_avail should still be 1000
        // (NOT 1000 - 1500, which would underflow or abort; not
        // 0 from a buggy partial-deduct).
        let (allowed2, failures2) = policies::evaluate<TEST_USDC>(
            &account, &mut limiters, 500, 0, &clock,
        );
        assert!(allowed2, 2);
        assert!(vector::length(&failures2) == 0, 3);

        // Step 3: a second passing call of 500 brings monthly to
        // 0 headroom. A subsequent 1 fails — proving the limiter
        // has correctly counted the *successful* 500 only.
        let (allowed3, failures3) = policies::evaluate<TEST_USDC>(
            &account, &mut limiters, 500, 0, &clock,
        );
        assert!(allowed3, 4);
        assert!(vector::length(&failures3) == 0, 5);

        let (allowed4, failures4) = policies::evaluate<TEST_USDC>(
            &account, &mut limiters, 1, 0, &clock,
        );
        assert!(!allowed4, 6);
        assert!(vector::length(&failures4) == 1, 7);
        let f: &PolicyFailure = vector::borrow(&failures4, 0);
        assert!(policies::failure_code(f) == 0x07002, 8);

        access_control::destroy_account_cap_for_testing(_cap);
        account::destroy_account_for_testing(account);
        policies::destroy_limiters_for_testing(limiters);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === test_evaluate_multiple_failures_collected ===

    /// A single call can fail on multiple dimensions simultaneously.
    /// `per_tx_max = 100`, `monthly_max = 200`, `min_balance = 50`,
    /// `current_balance = 100`, `amount = 500`:
    /// - 500 > 100 (per_tx)
    /// - 500 > 200 (monthly; if monthly were the only check this
    ///   would be the only failure, but per_tx fires first)
    /// - 100 - 500 underflows but the guard is `current_balance <
    ///   amount + min_balance` = `100 < 550` = true (min_balance)
    ///
    /// Expect 3 entries: 0x07001, 0x07002, 0x07003 in that order
    /// (the order is fixed by the implementation). Frequency check
    /// is skipped (`frequency_min_ms == 0`).
    #[test]
    fun test_evaluate_multiple_failures_collected() {
        let mut sc = ts::begin(@0xA);
        let clock = fresh_clock(&mut sc);
        let r = registry_with_test_usdc(&mut sc);

        let ps: PolicySet = account::new_policy_set(
            100,   // per_tx_max
            200,   // monthly_max
            50,    // min_balance
            0,     // frequency_min_ms
        );
        let (account, _cap) = account::create_account<TEST_USDC>(
            &r, ps, &clock, ts::ctx(&mut sc),
        );

        let mut limiters = policies::empty_limiters(&clock);
        policies::ensure_initialized<TEST_USDC>(&account, &mut limiters, &clock);

        let (allowed, failures) = policies::evaluate<TEST_USDC>(
            &account, &mut limiters, 500, 100, &clock,
        );
        assert!(!allowed, 0);
        assert!(vector::length(&failures) == 3, 1);

        // Order: per_tx (0x07001), monthly (0x07002), min_balance (0x07003).
        let f0: &PolicyFailure = vector::borrow(&failures, 0);
        let f1: &PolicyFailure = vector::borrow(&failures, 1);
        let f2: &PolicyFailure = vector::borrow(&failures, 2);
        assert!(policies::failure_code(f0) == 0x07001, 2);
        assert!(policies::failure_code(f1) == 0x07002, 3);
        assert!(policies::failure_code(f2) == 0x07003, 4);

        // Per-tx: required 500, available 100.
        assert!(policies::failure_amount_required(f0) == 500, 5);
        assert!(policies::failure_amount_available(f0) == 100, 6);

        // Monthly: required 500, available 200.
        assert!(policies::failure_amount_required(f1) == 500, 7);
        assert!(policies::failure_amount_available(f1) == 200, 8);

        // Min-balance: required 500, available (100 - 50) = 50.
        assert!(policies::failure_amount_required(f2) == 500, 9);
        assert!(policies::failure_amount_available(f2) == 50, 10);

        // The limiters are untouched (failure -> no consume).
        // A follow-up call with amount 50 should succeed (within
        // per_tx_max=100, within monthly_max=200, leaves balance at
        // 50 == min_balance, exactly meeting the floor).
        let (allowed2, failures2) = policies::evaluate<TEST_USDC>(
            &account, &mut limiters, 50, 100, &clock,
        );
        assert!(allowed2, 11);
        assert!(vector::length(&failures2) == 0, 12);

        access_control::destroy_account_cap_for_testing(_cap);
        account::destroy_account_for_testing(account);
        policies::destroy_limiters_for_testing(limiters);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === test_min_balance_saturating_sub ===

    /// The min-balance check uses saturating subtraction for the
    /// failure's `amount_available`: when `current_balance <
    /// min_balance`, the slack is 0 (not underflow). This pins the
    /// behavior so a future refactor doesn't break the no-panic
    /// guarantee.
    #[test]
    fun test_min_balance_saturating_sub() {
        let mut sc = ts::begin(@0xA);
        let clock = fresh_clock(&mut sc);
        let r = registry_with_test_usdc(&mut sc);

        let ps: PolicySet = account::new_policy_set(
            0,     // per_tx_max
            0,     // monthly_max
            100,   // min_balance
            0,     // frequency_min_ms
        );
        let (account, _cap) = account::create_account<TEST_USDC>(
            &r, ps, &clock, ts::ctx(&mut sc),
        );

        let mut limiters: PolicyLimiters = policies::empty_limiters(&clock);
        policies::ensure_initialized<TEST_USDC>(&account, &mut limiters, &clock);

        // current_balance (50) < min_balance (100). Request 10.
        // The min-balance check fires (50 < 10 + 100).
        // amount_available saturates: max(0, 50 - 100) = 0.
        let (allowed, failures) = policies::evaluate<TEST_USDC>(
            &account, &mut limiters, 10, 50, &clock,
        );
        assert!(!allowed, 0);
        assert!(vector::length(&failures) == 1, 1);
        let f: &PolicyFailure = vector::borrow(&failures, 0);
        assert!(policies::failure_code(f) == 0x07003, 2);
        assert!(policies::failure_amount_required(f) == 10, 3);
        // Saturating sub: 0, not an underflow abort.
        assert!(policies::failure_amount_available(f) == 0, 4);

        access_control::destroy_account_cap_for_testing(_cap);
        account::destroy_account_for_testing(account);
        policies::destroy_limiters_for_testing(limiters);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }
}
