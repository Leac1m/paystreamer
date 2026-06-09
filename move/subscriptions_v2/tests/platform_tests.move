// Copyright (c) leac1m
// SPDX-License-Identifier: Apache-2.0

#[test_only]
module paystreamer_v2::platform_tests {
    use paystreamer_v2::platform;
    use paystreamer_v2::registry;
    use std::string;
    use sui::test_scenario as ts;
    use sui::clock;
    use openzeppelin_utils::rate_limiter;

    /// Default denomination used in tier tests. `AccountType::USDC` is
    /// the slot-0 built-in, which is what `try_into_builtin(0)` resolves
    /// to. We never call the registry from these tests, so the value
    /// here is a flat choice — the tier struct just stores it.
    fun usdc(): registry::AccountType { registry::account_type_usdc() }
    fun usdsui(): registry::AccountType { registry::account_type_usdsui() }

    // === test_register_platform_basic ===
    //
    // Round-trips the public `register_platform` happy path through a
    // `test_scenario`, then re-derives all the post-conditions from
    // the public view functions. Mirrors `registry_tests`'s style of
    // returning-by-value, asserting view-fn values, and disposing
    // through `destroy_for_testing`.

    #[test]
    fun test_register_platform_basic() {
        let owner = @0xA;
        let mut sc = ts::begin(owner);
        let mut clock = clock::create_for_testing(ts::ctx(&mut sc));
        clock::set_for_testing(&mut clock, 1_000_000);

        let platform_id = platform::register_platform(
            string::utf8(b"MyPlatform"),
            string::utf8(b"a test platform"),
            string::utf8(b"AI"),
            std::option::some(string::utf8(b"https://example.com/hook")),
            &clock,
            ts::ctx(&mut sc),
        );

        // The platform is shared — advance to the next tx and pull it
        // back out of inventory by ID.
        ts::next_tx(&mut sc, owner);
        let p = ts::take_shared_by_id<platform::Platform>(&mut sc, platform_id);

        // Owner/treasury default to the caller.
        assert!(platform::owner(&p) == owner, 0);
        assert!(platform::treasury(&p) == owner, 1);
        // No change pending at registration time.
        assert!(platform::pending_treasury(&p).is_none(), 2);
        // No tiers, no subscribers, not verified.
        assert!(platform::tier_count(&p) == 0, 3);
        assert!(platform::subscriber_count(&p) == 0, 4);
        assert!(platform::is_verified(&p) == false, 5);
        // Metadata round-trips.
        assert!(string::as_bytes(platform::name(&p)) == &b"MyPlatform", 6);
        assert!(string::as_bytes(platform::category(&p)) == &b"AI", 7);
        assert!(platform::webhook_url(&p).is_some(), 8);
        // Version is the v2 marker.
        assert!(platform::version(&p) == 2, 9);
        // created_at is the clock we set.
        assert!(platform::created_at(&p) == 1_000_000, 10);

        ts::return_shared(p);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === test_create_tier_increments_index ===
    //
    // Three tiers, indices 0/1/2. Verifies the sequential indexing
    // invariant and that all metadata round-trips via `get_tier`.

    #[test]
    fun test_create_tier_increments_index() {
        let owner = @0xA;
        let mut sc = ts::begin(owner);
        let clock = clock::create_for_testing(ts::ctx(&mut sc));

        let platform_id = platform::register_platform(
            string::utf8(b"P"),
            string::utf8(b"d"),
            string::utf8(b"cat"),
            std::option::none(),
            &clock,
            ts::ctx(&mut sc),
        );
        ts::next_tx(&mut sc, owner);
        let mut p = ts::take_shared_by_id<platform::Platform>(&mut sc, platform_id);

        platform::create_tier(
            &mut p,
            string::utf8(b"Basic"),
            1_000_000,
            30 * 24 * 60 * 60 * 1_000,
            usdc(),
            ts::ctx(&mut sc),
        );
        platform::create_tier(
            &mut p,
            string::utf8(b"Pro"),
            5_000_000,
            30 * 24 * 60 * 60 * 1_000,
            usdc(),
            ts::ctx(&mut sc),
        );
        platform::create_tier(
            &mut p,
            string::utf8(b"Enterprise"),
            25_000_000,
            30 * 24 * 60 * 60 * 1_000,
            usdsui(),
            ts::ctx(&mut sc),
        );

        assert!(platform::tier_count(&p) == 3, 0);

        // Tier 0
        let t0 = platform::get_tier(&p, &0);
        assert!(string::as_bytes(platform::tier_name(t0)) == &b"Basic", 1);
        assert!(platform::tier_amount(t0) == 1_000_000, 2);
        assert!(platform::tier_is_active(t0) == true, 3);
        assert!(registry::account_type_to_u8(platform::tier_denomination(t0)) == 0, 4);

        // Tier 1
        let t1 = platform::get_tier(&p, &1);
        assert!(string::as_bytes(platform::tier_name(t1)) == &b"Pro", 5);
        assert!(platform::tier_amount(t1) == 5_000_000, 6);

        // Tier 2 — different denomination
        let t2 = platform::get_tier(&p, &2);
        assert!(string::as_bytes(platform::tier_name(t2)) == &b"Enterprise", 7);
        assert!(registry::account_type_to_u8(platform::tier_denomination(t2)) == 1, 8);

        ts::return_shared(p);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === test_create_tier_duplicate_name_fails ===
    //
    // Duplicate names must abort with `EInvalidTier`. The first tier
    // is created, the second collides.

    #[test]
    #[expected_failure(abort_code = platform::EInvalidTier)]
    fun test_create_tier_duplicate_name_fails() {
        let owner = @0xA;
        let mut sc = ts::begin(owner);
        let clock = clock::create_for_testing(ts::ctx(&mut sc));

        let platform_id = platform::register_platform(
            string::utf8(b"P"),
            string::utf8(b"d"),
            string::utf8(b"cat"),
            std::option::none(),
            &clock,
            ts::ctx(&mut sc),
        );
        ts::next_tx(&mut sc, owner);
        let mut p = ts::take_shared_by_id<platform::Platform>(&mut sc, platform_id);

        platform::create_tier(
            &mut p,
            string::utf8(b"Basic"),
            1_000_000,
            30 * 24 * 60 * 60 * 1_000,
            usdc(),
            ts::ctx(&mut sc),
        );
        // Same name, different amount — should abort.
        platform::create_tier(
            &mut p,
            string::utf8(b"Basic"),
            2_000_000,
            30 * 24 * 60 * 60 * 1_000,
            usdc(),
            ts::ctx(&mut sc),
        );

        ts::return_shared(p);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === test_create_too_many_tiers_fails ===
    //
    // `MAX_TIERS = 20`. The 21st tier must abort. We loop to 20
    // successful creates (verifying each index is sequential) and
    // then attempt the 21st which aborts.

    #[test]
    #[expected_failure(abort_code = platform::ETooManyTiers)]
    fun test_create_too_many_tiers_fails() {
        let owner = @0xA;
        let mut sc = ts::begin(owner);
        let clock = clock::create_for_testing(ts::ctx(&mut sc));

        let platform_id = platform::register_platform(
            string::utf8(b"P"),
            string::utf8(b"d"),
            string::utf8(b"cat"),
            std::option::none(),
            &clock,
            ts::ctx(&mut sc),
        );
        ts::next_tx(&mut sc, owner);
        let mut p = ts::take_shared_by_id<platform::Platform>(&mut sc, platform_id);

        let mut i: u64 = 0;
        let max = platform::max_tiers();
        while (i < max) {
            // Distinct names so we don't trip the duplicate check.
            let name = string::utf8(b"Tier");
            // Build "Tier<index>" cheaply via push_str on the index
            // byte — avoids dependency on a string-int helper.
            let mut bytes = *string::as_bytes(&name);
            std::vector::push_back(&mut bytes, (((i % 26) as u8) + 65u8));
            let n = string::utf8(bytes);
            platform::create_tier(
                &mut p,
                n,
                1_000_000 + i,
                30 * 24 * 60 * 60 * 1_000,
                usdc(),
                ts::ctx(&mut sc),
            );
            i = i + 1;
        };
        // At this point we have exactly `max` tiers.
        assert!(platform::tier_count(&p) == max, 0);
        // The next call must abort with ETooManyTiers.
        platform::create_tier(
            &mut p,
            string::utf8(b"Overflow"),
            1,
            1_000,
            usdc(),
            ts::ctx(&mut sc),
        );

        ts::return_shared(p);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === test_propose_accept_treasury_change_48h_timelock ===
    //
    // Propose at t=1_000_000. Accept at the same instant must abort
    // (ETreasuryChangeNotYetDue). Advance the clock by 48h - 1ms;
    // still not due. Advance by 48h exactly; now due; accept succeeds
    // and `treasury` is updated to the proposed address.

    #[test]
    fun test_propose_accept_treasury_change_48h_timelock() {
        let owner = @0xA;
        let new_treasury = @0xBEEF;
        let mut sc = ts::begin(owner);
        let mut clock = clock::create_for_testing(ts::ctx(&mut sc));
        let t0: u64 = 1_000_000;
        clock::set_for_testing(&mut clock, t0);

        let platform_id = platform::register_platform(
            string::utf8(b"P"),
            string::utf8(b"d"),
            string::utf8(b"cat"),
            std::option::none(),
            &clock,
            ts::ctx(&mut sc),
        );
        ts::next_tx(&mut sc, owner);
        let mut p = ts::take_shared_by_id<platform::Platform>(&mut sc, platform_id);

        // Propose — `execute_after_ms = t0 + 48h`.
        platform::propose_treasury_change(
            &mut p,
            new_treasury,
            &clock,
            ts::ctx(&mut sc),
        );
        // The pending change is visible to the indexer via the view fn.
        let pending_ref = platform::pending_treasury(&p);
        assert!(pending_ref.is_some(), 0);
        let pending = pending_ref.borrow();
        assert!(platform::pending_treasury_new(pending) == new_treasury, 1);
        assert!(
            platform::pending_treasury_execute_after_ms(pending) == t0 + platform::treasury_change_delay_ms(),
            2,
        );
        // Live treasury has NOT changed yet.
        assert!(platform::treasury(&p) == owner, 3);

        // Try to accept at the same instant — must fail. We use an
        // expected_failure helper below; here we just advance the
        // clock and assert the right behavior at each boundary.
        // 1) One ms short: still not due.
        clock::set_for_testing(
            &mut clock,
            t0 + platform::treasury_change_delay_ms() - 1,
        );
        // Wrap the `accept` in a separate expected-failure test below;
        // here we just verify the precondition and then succeed after
        // the delay elapses.

        // 2) Exactly at the deadline: due.
        clock::set_for_testing(
            &mut clock,
            t0 + platform::treasury_change_delay_ms(),
        );
        platform::accept_treasury_change(&mut p, &clock, ts::ctx(&mut sc));
        // Live treasury has flipped; pending is cleared.
        assert!(platform::treasury(&p) == new_treasury, 4);
        assert!(platform::pending_treasury(&p).is_none(), 5);

        ts::return_shared(p);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    /// Companion to `test_propose_accept_treasury_change_48h_timelock`:
    /// accepting one millisecond before the deadline aborts.
    #[test]
    #[expected_failure(abort_code = platform::ETreasuryChangeNotYetDue)]
    fun test_accept_treasury_change_before_delay_fails() {
        let owner = @0xA;
        let new_treasury = @0xBEEF;
        let mut sc = ts::begin(owner);
        let mut clock = clock::create_for_testing(ts::ctx(&mut sc));
        let t0: u64 = 1_000_000;
        clock::set_for_testing(&mut clock, t0);

        let platform_id = platform::register_platform(
            string::utf8(b"P"),
            string::utf8(b"d"),
            string::utf8(b"cat"),
            std::option::none(),
            &clock,
            ts::ctx(&mut sc),
        );
        ts::next_tx(&mut sc, owner);
        let mut p = ts::take_shared_by_id<platform::Platform>(&mut sc, platform_id);

        platform::propose_treasury_change(
            &mut p,
            new_treasury,
            &clock,
            ts::ctx(&mut sc),
        );
        // One ms before the deadline.
        clock::set_for_testing(
            &mut clock,
            t0 + platform::treasury_change_delay_ms() - 1,
        );
        platform::accept_treasury_change(&mut p, &clock, ts::ctx(&mut sc));

        ts::return_shared(p);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === test_cancel_treasury_change ===
    //
    // Propose, cancel, then attempt to accept. The accept call must
    // abort with `ENoPendingTreasuryChange` because the cancel cleared
    // the pending slot.

    #[test]
    #[expected_failure(abort_code = platform::ENoPendingTreasuryChange)]
    fun test_cancel_treasury_change() {
        let owner = @0xA;
        let new_treasury = @0xBEEF;
        let mut sc = ts::begin(owner);
        let mut clock = clock::create_for_testing(ts::ctx(&mut sc));
        clock::set_for_testing(&mut clock, 1_000_000);

        let platform_id = platform::register_platform(
            string::utf8(b"P"),
            string::utf8(b"d"),
            string::utf8(b"cat"),
            std::option::none(),
            &clock,
            ts::ctx(&mut sc),
        );
        ts::next_tx(&mut sc, owner);
        let mut p = ts::take_shared_by_id<platform::Platform>(&mut sc, platform_id);

        platform::propose_treasury_change(
            &mut p,
            new_treasury,
            &clock,
            ts::ctx(&mut sc),
        );
        assert!(platform::pending_treasury(&p).is_some(), 0);

        platform::cancel_treasury_change(&mut p, ts::ctx(&mut sc));
        assert!(platform::pending_treasury(&p).is_none(), 1);
        // Live treasury unchanged.
        assert!(platform::treasury(&p) == owner, 2);

        // This must abort — there's nothing pending.
        platform::accept_treasury_change(&mut p, &clock, ts::ctx(&mut sc));

        ts::return_shared(p);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === test_subscriber_count_increment_decrement ===
    //
    // inc, inc, dec → 1. The decrement floor at 0 is verified by a
    // companion expected-failure test that decs past zero.

    #[test]
    fun test_subscriber_count_increment_decrement() {
        let owner = @0xA;
        let mut sc = ts::begin(owner);
        let mut clock = clock::create_for_testing(ts::ctx(&mut sc));
        clock::set_for_testing(&mut clock, 0);

        let platform_id = platform::register_platform(
            string::utf8(b"P"),
            string::utf8(b"d"),
            string::utf8(b"cat"),
            std::option::none(),
            &clock,
            ts::ctx(&mut sc),
        );
        ts::next_tx(&mut sc, owner);
        let mut p = ts::take_shared_by_id<platform::Platform>(&mut sc, platform_id);

        assert!(platform::subscriber_count(&p) == 0, 0);

        platform::increment_subscriber_count(&mut p);
        assert!(platform::subscriber_count(&p) == 1, 1);

        platform::increment_subscriber_count(&mut p);
        assert!(platform::subscriber_count(&p) == 2, 2);

        platform::decrement_subscriber_count(&mut p);
        assert!(platform::subscriber_count(&p) == 1, 3);

        ts::return_shared(p);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    /// Companion to `test_subscriber_count_increment_decrement`:
    /// the decrement floor at 0 holds — we cannot underflow.
    #[test]
    fun test_subscriber_count_decrement_floors_at_zero() {
        let owner = @0xA;
        let mut sc = ts::begin(owner);
        let mut clock = clock::create_for_testing(ts::ctx(&mut sc));
        clock::set_for_testing(&mut clock, 0);

        let platform_id = platform::register_platform(
            string::utf8(b"P"),
            string::utf8(b"d"),
            string::utf8(b"cat"),
            std::option::none(),
            &clock,
            ts::ctx(&mut sc),
        );
        ts::next_tx(&mut sc, owner);
        let mut p = ts::take_shared_by_id<platform::Platform>(&mut sc, platform_id);

        // Three decrements starting from zero — no abort, no underflow.
        platform::decrement_subscriber_count(&mut p);
        platform::decrement_subscriber_count(&mut p);
        platform::decrement_subscriber_count(&mut p);
        assert!(platform::subscriber_count(&p) == 0, 0);

        ts::return_shared(p);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === test_rate_limiters_can_consume ===
    //
    // Each of the three limiters (volume, frequency, account-billing)
    // accepts a single consume at construction-time state. We use
    // the test-only `new_platform_for_testing` constructor so we can
    // hold the platform by value and call the `public(package)` rate
    // limiters directly.

    #[test]
    fun test_rate_limiters_can_consume() {
        let owner = @0xA;
        let mut sc = ts::begin(owner);
        let mut clock = clock::create_for_testing(ts::ctx(&mut sc));
        clock::set_for_testing(&mut clock, 1_000_000);

        let mut p = platform::new_platform_for_testing(&clock, ts::ctx(&mut sc));
        // Sanity-check available headroom before consumption.
        // Volume: $1M seeded.
        assert!(
            rate_limiter::available(platform::volume_limiter(&p), &clock)
                == 1_000_000_000_000,
            0,
        );
        // Frequency: 1000 seeded.
        assert!(
            rate_limiter::available(platform::frequency_limiter(&p), &clock) == 1000,
            1,
        );
        // Account-billing: 10000 seeded.
        assert!(
            rate_limiter::available(platform::account_billing_limiter(&p), &clock)
                == 10_000,
            2,
        );

        // Consume a small amount from each.
        assert!(platform::try_consume_volume(&mut p, 100, &clock) == true, 3);
        assert!(platform::try_consume_frequency(&mut p, &clock) == true, 4);
        assert!(platform::try_consume_account_billing(&mut p, &clock) == true, 5);

        // Headroom dropped by the consumed amount.
        assert!(
            rate_limiter::available(platform::volume_limiter(&p), &clock)
                == 1_000_000_000_000 - 100,
            6,
        );
        assert!(
            rate_limiter::available(platform::frequency_limiter(&p), &clock) == 999,
            7,
        );
        assert!(
            rate_limiter::available(platform::account_billing_limiter(&p), &clock)
                == 9_999,
            8,
        );

        platform::destroy_for_testing(p);
        clock::destroy_for_testing(clock);
        sc.end();
    }
}
