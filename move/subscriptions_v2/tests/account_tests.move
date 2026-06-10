// Copyright (c) leac1m
// SPDX-License-Identifier: Apache-2.0

#[test_only]
module paystreamer_v2::account_tests {
    use paystreamer_v2::account::{Self, AccountStatus, PolicySet, SubscriptionV1};
    use paystreamer_v2::ac;
    use paystreamer_v2::registry;
    use std::string;
    use sui::object;
    use sui::coin;
    use sui::test_scenario as ts;
    use sui::clock;
    use sui::vec_map;

    /// One-off witness used as a phantom denomination in tests. Has
    /// `drop` so we can construct it freely; no treasury cap is needed
    /// because coins are minted via `coin::mint_for_testing`.
    public struct TEST_USDC has drop {}

    /// Build a registry pre-loaded with `TEST_USDC` as a registered coin
    /// (slot 0, the USDC built-in). Returns the registry; the caller is
    /// responsible for destroying it via `registry::destroy_for_testing`.
    fun registry_with_test_usdc(scenario: &mut ts::Scenario): registry::CoinTypeRegistry {
        let mut r = registry::new_registry_for_testing(ts::ctx(scenario));
        let info = registry::new_account_type_info(string::utf8(b"USDC"), 6, false);
        registry::register_coin_type<TEST_USDC>(&mut r, info, ts::ctx(scenario));
        r
    }

    /// Build a fresh depositor-only `AccountCap` for `account_id`.
    fun depositor_cap(account_id: object::ID, scenario: &mut ts::Scenario): ac::AccountCap {
        ac::new_account_cap_for_testing(
            account_id,
            ac::permission_depositor(),
            ts::ctx(scenario),
        )
    }

    /// Construct a fresh `SubscriptionV1` for use in cascade tests. All
    /// fields are zero-initialized except `platform_id`, `denomination`,
    /// and `status`.
    fun make_sub(
        platform_id: object::ID,
        status: u8,
        _scenario: &mut ts::Scenario,
    ): SubscriptionV1 {
        let now = 0;
        account::new_subscription_v1(
            platform_id,
            0,             // tier_index
            100,           // tier_amount
            86_400_000,    // tier_frequency_ms (1 day)
            registry::account_type_usdc(),
            status,
            86_400_000,    // schedule_frequency_ms
            0,             // next_billing_time
            0,             // last_billing_time
            0,             // total_paid
            0,             // payment_count
            0,             // last_attempt_time
            0,             // attempt_count
            0,             // max_attempts
            0,             // nonce
            now,           // created_at
            now,           // updated_at
        )
    }

    // === create_account ===

    /// A registered coin type creates an account with the correct
    /// initial state: status active, nonce 0, version 2, balance 0.
    #[test]
    fun test_create_account_with_registered_coin_succeeds() {
        let mut sc = ts::begin(@0xA);
        let clock = clock::create_for_testing(ts::ctx(&mut sc));
        let r = registry_with_test_usdc(&mut sc);

        let (account, cap) = account::create_account<TEST_USDC>(
            &r,
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );

        // Cap is bound to the account's id.
        assert!(ac::account_id(&cap) == object::id(&account), 0);
        // Cap has OWNER permission.
        assert!(ac::permissions(&cap) == 1, 1);
        // Account state.
        assert!(account::version(&account) == 2, 2);
        assert!(account::nonce(&account) == 0, 3);
        assert!(account::balance(&account, &clock) == 0, 4);
        assert!(account::subscription_count(&account) == 0, 5);
        assert!(account::is_active(account::status(&account)), 6);

        // Denomination resolved to USDC built-in.
        let acct_type = account::account_type(&account);
        assert!(registry::account_type_to_u8(acct_type) == 0, 7);

        // Cleanup.
        ac::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    /// A coin type that is not registered in the `CoinTypeRegistry` makes
    /// `create_account` abort with `ECoinTypeNotRegistered` (0x01006).
    #[test]
    #[expected_failure(abort_code = 0x01006)]
    fun test_create_account_with_unregistered_coin_fails() {
        let mut sc = ts::begin(@0xA);
        let clock = clock::create_for_testing(ts::ctx(&mut sc));
        // Empty registry — TEST_USDC is not registered.
        let r = registry::new_registry_for_testing(ts::ctx(&mut sc));

        let (account, cap) = account::create_account<TEST_USDC>(
            &r,
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );

        ac::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === deposit ===

    /// Depositing a 100-unit coin raises the account's `view_value` to
    /// 100. Multiple deposits accumulate.
    #[test]
    fun test_deposit_updates_balance() {
        let mut sc = ts::begin(@0xA);
        let clock = clock::create_for_testing(ts::ctx(&mut sc));
        let r = registry_with_test_usdc(&mut sc);

        let (mut account, cap) = account::create_account<TEST_USDC>(
            &r,
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );

        // First deposit: 100.
        let coin1 = coin::mint_for_testing<TEST_USDC>(100, ts::ctx(&mut sc));
        account::deposit<TEST_USDC>(&cap, &mut account, coin1, &clock, ts::ctx(&mut sc));
        assert!(account::balance(&account, &clock) == 100, 0);

        // Second deposit: 50, balance is 150.
        let coin2 = coin::mint_for_testing<TEST_USDC>(50, ts::ctx(&mut sc));
        account::deposit<TEST_USDC>(&cap, &mut account, coin2, &clock, ts::ctx(&mut sc));
        assert!(account::balance(&account, &clock) == 150, 1);

        ac::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === pause / resume ===

    /// Pausing the account flips `status` to paused and cascades to all
    /// active subscriptions (status 0 -> 1). Subscriptions that were
    /// already paused or cancelled are untouched.
    #[test]
    fun test_pause_cascades_to_subscriptions() {
        let mut sc = ts::begin(@0xA);
        let clock = clock::create_for_testing(ts::ctx(&mut sc));
        let r = registry_with_test_usdc(&mut sc);

        let (mut account, cap) = account::create_account<TEST_USDC>(
            &r,
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );

        // Insert three subs: active, already-paused, cancelled.
        let p_active = object::id_from_address(@0xA1);
        let p_paused = object::id_from_address(@0xA2);
        let p_cancelled = object::id_from_address(@0xA3);
        {
            let subs = account::subscriptions_mut(&mut account);
            vec_map::insert(subs, p_active, make_sub(p_active, 0, &mut sc));
            vec_map::insert(subs, p_paused, make_sub(p_paused, 1, &mut sc));
            vec_map::insert(subs, p_cancelled, make_sub(p_cancelled, 2, &mut sc));
        };

        // Pause the account.
        account::pause_account<TEST_USDC>(&cap, &mut account, &clock);

        // Account is paused.
        assert!(account::is_paused(account::status(&account)), 0);

        // Subscriptions:
        //   p_active: 0 -> 1 (cascaded)
        //   p_paused: 1 unchanged
        //   p_cancelled: 2 unchanged
        assert!(account::sub_is_paused(account::get_subscription(&account, &p_active)), 1);
        assert!(account::sub_is_paused(account::get_subscription(&account, &p_paused)), 2);
        assert!(account::sub_is_cancelled(account::get_subscription(&account, &p_cancelled)), 3);

        ac::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    /// Resuming the account flips `status` to active but does NOT
    /// auto-resume subscriptions (design §7.7 — explicit per-platform
    /// resume required to prevent surprise billing).
    #[test]
    fun test_resume_does_not_resume_subscriptions() {
        let mut sc = ts::begin(@0xA);
        let clock = clock::create_for_testing(ts::ctx(&mut sc));
        let r = registry_with_test_usdc(&mut sc);

        let (mut account, cap) = account::create_account<TEST_USDC>(
            &r,
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );

        // Insert an active sub, then pause the account.
        let p = object::id_from_address(@0xB1);
        {
            let subs = account::subscriptions_mut(&mut account);
            vec_map::insert(subs, p, make_sub(p, 0, &mut sc));
        };
        account::pause_account<TEST_USDC>(&cap, &mut account, &clock);
        assert!(account::is_paused(account::status(&account)), 0);
        assert!(account::sub_is_paused(account::get_subscription(&account, &p)), 1);

        // Resume the account.
        account::resume_account<TEST_USDC>(&cap, &mut account, &clock);
        assert!(account::is_active(account::status(&account)), 2);
        // Sub is still paused — explicit resume required.
        assert!(account::sub_is_paused(account::get_subscription(&account, &p)), 3);

        ac::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === update_policies ===

    /// `update_policies` replaces the account's `PolicySet` wholesale;
    /// the old set is reflected in the `PoliciesUpdated` event. Reading
    /// the new set via the accessor returns the new values.
    #[test]
    fun test_update_policies_replaces_wholesale() {
        let mut sc = ts::begin(@0xA);
        let clock = clock::create_for_testing(ts::ctx(&mut sc));
        let r = registry_with_test_usdc(&mut sc);

        let (mut account, cap) = account::create_account<TEST_USDC>(
            &r,
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );

        // Initial policies: all zero (no caps).
        let initial = account::policies(&account);
        assert!(account::policy_per_tx_max(initial) == 0, 0);
        assert!(account::policy_monthly_max(initial) == 0, 1);
        assert!(account::policy_min_balance(initial) == 0, 2);
        assert!(account::policy_frequency_min_ms(initial) == 0, 3);

        // Replace with non-trivial values.
        let new_set = account::new_policy_set(
            1_000,        // per_tx_max
            30_000,       // monthly_max
            500,          // min_balance
            60_000,       // frequency_min_ms (1 min)
        );
        account::update_policies<TEST_USDC>(&cap, &mut account, new_set, &clock);

        // Verify the new set is in place.
        let p = account::policies(&account);
        assert!(account::policy_per_tx_max(p) == 1_000, 4);
        assert!(account::policy_monthly_max(p) == 30_000, 5);
        assert!(account::policy_min_balance(p) == 500, 6);
        assert!(account::policy_frequency_min_ms(p) == 60_000, 7);

        ac::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === mint_delegated_cap ===

    /// An OWNER cap can mint a delegated cap; the minted cap has the
    /// requested permission bitfield, is bound to the same `account_id`,
    /// and has OWNER stripped if the requested bitfield is narrower
    /// than OWNER.
    #[test]
    fun test_mint_delegated_cap_requires_owner() {
        let mut sc = ts::begin(@0xA);
        let clock = clock::create_for_testing(ts::ctx(&mut sc));
        let r = registry_with_test_usdc(&mut sc);

        let (account, cap) = account::create_account<TEST_USDC>(
            &r,
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );
        let account_id = object::id(&account);

        // Owner mints a depositor-only delegated cap.
        let delegated = account::mint_delegated_cap<TEST_USDC>(
            &cap,
            &account,
            ac::permission_depositor(),
            &clock,
            ts::ctx(&mut sc),
        );
        assert!(ac::account_id(&delegated) == account_id, 0);
        assert!(
            ac::permissions(&delegated) == ac::permission_depositor(),
            1,
        );
        // Delegated cap has OWNER stripped (just the depositor bit).
        assert!(
            !ac::has_permission(&delegated, ac::permission_owner()),
            2,
        );

        ac::destroy_account_cap_for_testing(delegated);
        ac::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    /// A depositor-only cap cannot mint a delegated cap — aborts with
    /// `ENotOwnerCap` (0x01009).
    #[test]
    #[expected_failure(abort_code = 0x01009)]
    fun test_mint_delegated_cap_depositor_cap_fails() {
        let mut sc = ts::begin(@0xA);
        let clock = clock::create_for_testing(ts::ctx(&mut sc));
        let r = registry_with_test_usdc(&mut sc);

        let (account, _cap) = account::create_account<TEST_USDC>(
            &r,
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );
        let account_id = object::id(&account);

        // Depositor-only cap.
        let dep_cap = depositor_cap(account_id, &mut sc);
        let _bad = account::mint_delegated_cap<TEST_USDC>(
            &dep_cap,
            &account,
            ac::permission_depositor(),
            &clock,
            ts::ctx(&mut sc),
        );

        ac::destroy_account_cap_for_testing(_bad);
        ac::destroy_account_cap_for_testing(dep_cap);
        ac::destroy_account_cap_for_testing(_cap);
        account::destroy_account_for_testing(account);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === close_account ===

    /// Closing the account flips `status` to closed; subsequent deposits
    /// abort. The cap remains valid for close itself; only deposit is
    /// blocked. The companion test `test_close_account_deposit_abort_code`
    /// pins the abort code.
    #[test]
    fun test_close_account_flips_status() {
        let mut sc = ts::begin(@0xA);
        let clock = clock::create_for_testing(ts::ctx(&mut sc));
        let r = registry_with_test_usdc(&mut sc);

        let (mut account, cap) = account::create_account<TEST_USDC>(
            &r,
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );

        // Close the account.
        account::close_account<TEST_USDC>(&cap, &mut account, &clock);
        assert!(account::is_closed(account::status(&account)), 0);

        ac::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    /// `close_account` aborts the deposit specifically with the closed
    /// error (0x01003) — paired with `test_close_account_blocks_deposit`
    /// to pin the abort code.
    #[test]
    #[expected_failure(abort_code = 0x01003)]
    fun test_close_account_deposit_abort_code() {
        let mut sc = ts::begin(@0xA);
        let clock = clock::create_for_testing(ts::ctx(&mut sc));
        let r = registry_with_test_usdc(&mut sc);

        let (mut account, cap) = account::create_account<TEST_USDC>(
            &r,
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );
        account::close_account<TEST_USDC>(&cap, &mut account, &clock);

        let coin1 = coin::mint_for_testing<TEST_USDC>(100, ts::ctx(&mut sc));
        account::deposit<TEST_USDC>(&cap, &mut account, coin1, &clock, ts::ctx(&mut sc));

        ac::destroy_account_cap_for_testing(cap);
        account::destroy_account_for_testing(account);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === share_account ===

    /// `share_account` shares the account and transfers the cap to
    /// `ctx.sender()`. After the call, the account is a shared object
    /// and the cap is in the sender's inventory.
    #[test]
    fun test_share_account_shares_and_transfers_cap() {
        let mut sc = ts::begin(@0xA);
        let clock = clock::create_for_testing(ts::ctx(&mut sc));
        let r = registry_with_test_usdc(&mut sc);

        let (account, cap) = account::create_account<TEST_USDC>(
            &r,
            account::empty_policy_set(),
            &clock,
            ts::ctx(&mut sc),
        );
        let account_id = object::id(&account);

        account::share_account<TEST_USDC>(account, cap, ts::ctx(&mut sc));

        // The account is now a shared object; the cap is in @0xA's inventory.
        ts::next_tx(&mut sc, @0xA);
        let shared_account = ts::take_shared_by_id<account::SubscriptionAccount<TEST_USDC>>(
            &sc, account_id,
        );
        let cap_in_inventory = ts::take_from_address<ac::AccountCap>(&sc, @0xA);
        let cap_account_id = ac::account_id(&cap_in_inventory);
        assert!(cap_account_id == account_id, 0);

        ac::destroy_account_cap_for_testing(cap_in_inventory);
        account::destroy_account_for_testing(shared_account);
        registry::destroy_for_testing(r);
        clock::destroy_for_testing(clock);
        sc.end();
    }

    // === SubscriptionV1 accessors ===

    /// The `SubscriptionV1` constructor wires all fields through; each
    /// accessor returns the value that was passed in.
    #[test]
    fun test_subscription_v1_constructor_and_accessors() {
        let mut sc = ts::begin(@0xA);
        let platform_id = object::id_from_address(@0xCAFEBABE);
        let now: u64 = 1_700_000_000_000;
        let sub = account::new_subscription_v1(
            platform_id,
            3,             // tier_index
            5_000_000,     // tier_amount
            2_592_000_000, // tier_frequency_ms (30 days)
            registry::account_type_usdsui(),
            0,             // status (active)
            7_776_000_000, // schedule_frequency_ms
            1_700_000_000_000, // next_billing_time
            1_699_900_000_000, // last_billing_time
            50_000_000,    // total_paid
            10,            // payment_count
            1_699_950_000_000, // last_attempt_time
            2,             // attempt_count
            5,             // max_attempts
            7,             // nonce
            now - 30 * 86_400_000,
            now,
        );
        assert!(account::sub_platform_id(&sub) == platform_id, 0);
        assert!(account::sub_tier_index(&sub) == 3, 1);
        assert!(account::sub_tier_amount(&sub) == 5_000_000, 2);
        assert!(account::sub_tier_frequency_ms(&sub) == 2_592_000_000, 3);
        assert!(account::sub_schedule_frequency_ms(&sub) == 7_776_000_000, 4);
        assert!(account::sub_next_billing_time(&sub) == 1_700_000_000_000, 5);
        assert!(account::sub_last_billing_time(&sub) == 1_699_900_000_000, 6);
        assert!(account::sub_total_paid(&sub) == 50_000_000, 7);
        assert!(account::sub_payment_count(&sub) == 10, 8);
        assert!(account::sub_last_attempt_time(&sub) == 1_699_950_000_000, 9);
        assert!(account::sub_attempt_count(&sub) == 2, 10);
        assert!(account::sub_max_attempts(&sub) == 5, 11);
        assert!(account::sub_nonce(&sub) == 7, 12);
        assert!(account::sub_is_active(&sub), 13);
        assert!(!account::sub_is_paused(&sub), 14);
        assert!(!account::sub_is_cancelled(&sub), 15);
        // Denomination round-trips.
        let denom = account::sub_denomination(&sub);
        assert!(registry::account_type_to_u8(denom) == 1, 16);
        let _ = now;
        let _ = sub; // SubscriptionV1 has store+drop; let it drop.
        sc.end();
    }

    // === AccountStatus / PolicySet helpers ===

    /// `account_status_active/paused/closed` produce the right
    /// discriminants and `is_*` accessors.
    #[test]
    fun test_account_status_helpers() {
        let active: AccountStatus = account::account_status_active();
        let paused: AccountStatus = account::account_status_paused();
        let closed: AccountStatus = account::account_status_closed();
        assert!(account::status_variant(&active) == 0, 0);
        assert!(account::status_variant(&paused) == 1, 1);
        assert!(account::status_variant(&closed) == 2, 2);
        assert!(account::is_active(&active), 3);
        assert!(account::is_paused(&paused), 4);
        assert!(account::is_closed(&closed), 5);
    }

    /// `empty_policy_set` returns a `PolicySet` with all caps set to
    /// zero (no-cap defaults). `new_policy_set` wires through the
    /// supplied values.
    #[test]
    fun test_policy_set_helpers() {
        let empty: PolicySet = account::empty_policy_set();
        assert!(account::policy_per_tx_max(&empty) == 0, 0);
        assert!(account::policy_monthly_max(&empty) == 0, 1);
        assert!(account::policy_min_balance(&empty) == 0, 2);
        assert!(account::policy_frequency_min_ms(&empty) == 0, 3);

        let p: PolicySet = account::new_policy_set(10, 20, 30, 40);
        assert!(account::policy_per_tx_max(&p) == 10, 4);
        assert!(account::policy_monthly_max(&p) == 20, 5);
        assert!(account::policy_min_balance(&p) == 30, 6);
        assert!(account::policy_frequency_min_ms(&p) == 40, 7);
    }
}
