/// Verifies the Seal integration example shown in
/// apps/docs/pages/integration.mdx actually compiles and behaves
/// correctly against the real contract. This is *not* a module PayStreamer
/// publishes — per roadmap.md Phase 3, the Seal integration is
/// documentation-only: platform integrators write their own tiny
/// `seal_approve` in their own package, delegating to
/// `account::has_active_subscription`. This file exists purely so that
/// claim is tested, not just asserted in prose.
///
/// The only difference from the docs sample: `platform_id` is passed as a
/// parameter here instead of baked in as a module-level `const address`,
/// since test platform IDs are only known at runtime. The policy logic
/// (namespace-prefix check on `id`, then delegate to
/// `has_active_subscription`) is otherwise identical.
#[test_only]
module subscriptions::seal_policy_example_tests {
    use subscriptions::account;
    use subscriptions::platform;
    use sui::test_scenario as ts;
    use sui::clock;
    use std::string;

    public struct TEST_USDC has drop {}

    const ENoAccess: u64 = 1;

    /// Mirrors the `seal_approve` sample in integration.mdx.
    fun seal_approve<T>(
        id: vector<u8>,
        platform_id: sui::object::ID,
        account: &account::SubscriptionAccount<T>,
    ) {
        assert!(is_namespaced_to_platform(id, platform_id), ENoAccess);
        assert!(account::has_active_subscription(account, platform_id), ENoAccess);
    }

    /// Mirrors `is_namespaced_to_platform` in integration.mdx.
    fun is_namespaced_to_platform(id: vector<u8>, platform_id: sui::object::ID): bool {
        let namespace = sui::address::to_bytes(sui::object::id_to_address(&platform_id));
        if (namespace.length() > id.length()) return false;
        let mut i = 0;
        while (i < namespace.length()) {
            if (namespace[i] != id[i]) return false;
            i = i + 1;
        };
        true
    }

    fun fresh_clock(scenario: &mut ts::Scenario): clock::Clock {
        let mut c = clock::create_for_testing(ts::ctx(scenario));
        clock::set_for_testing(&mut c, 1_000);
        c
    }

    fun setup_account_with_subscription(
        clock: &clock::Clock,
        scenario: &mut ts::Scenario,
    ): (account::SubscriptionAccount<TEST_USDC>, account::AccountCap, sui::object::ID) {
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

        let (mut acct, cap) = account::create_account<TEST_USDC>(
            account::empty_policy_set(),
            clock,
            ts::ctx(scenario),
        );
        account::create_subscription<TEST_USDC>(
            &cap, &mut acct, platform_id, 0, 100, 0, 3, clock,
        );
        (acct, cap, platform_id)
    }

    fun id_bytes_for(platform_id: sui::object::ID, nonce: u8): vector<u8> {
        let mut id = sui::address::to_bytes(sui::object::id_to_address(&platform_id));
        id.push_back(nonce);
        id
    }

    #[test]
    fun test_seal_approve_grants_access_for_active_subscription() {
        let owner = @0xA;
        let mut sc = ts::begin(owner);
        let clock = fresh_clock(&mut sc);
        let (acct, cap, platform_id) = setup_account_with_subscription(&clock, &mut sc);

        seal_approve(id_bytes_for(platform_id, 7), platform_id, &acct);

        account::transfer_account_cap(cap, owner);
        std::unit_test::destroy(acct);
        clock::destroy_for_testing(clock);
        ts::end(sc);
    }

    #[test, expected_failure(abort_code = ENoAccess)]
    fun test_seal_approve_denies_paused_subscription() {
        let owner = @0xA;
        let mut sc = ts::begin(owner);
        let clock = fresh_clock(&mut sc);
        let (mut acct, cap, platform_id) = setup_account_with_subscription(&clock, &mut sc);

        account::pause_subscription(&cap, &mut acct, platform_id, &clock);

        seal_approve(id_bytes_for(platform_id, 7), platform_id, &acct);

        account::transfer_account_cap(cap, owner);
        std::unit_test::destroy(acct);
        clock::destroy_for_testing(clock);
        ts::end(sc);
    }

    #[test, expected_failure(abort_code = ENoAccess)]
    fun test_seal_approve_denies_unrelated_platform() {
        let owner = @0xA;
        let mut sc = ts::begin(owner);
        let clock = fresh_clock(&mut sc);
        let (acct, cap, _platform_id) = setup_account_with_subscription(&clock, &mut sc);
        let other_platform_id = sui::object::id_from_address(@0xB0B0);

        // Never subscribed to `other_platform_id` -> has_active_subscription is false.
        seal_approve(id_bytes_for(other_platform_id, 7), other_platform_id, &acct);

        account::transfer_account_cap(cap, owner);
        std::unit_test::destroy(acct);
        clock::destroy_for_testing(clock);
        ts::end(sc);
    }

    #[test, expected_failure(abort_code = ENoAccess)]
    fun test_seal_approve_denies_wrong_namespace_prefix() {
        let owner = @0xA;
        let mut sc = ts::begin(owner);
        let clock = fresh_clock(&mut sc);
        let (acct, cap, platform_id) = setup_account_with_subscription(&clock, &mut sc);
        let wrong_id = id_bytes_for(sui::object::id_from_address(@0xDEADBEEF), 7);

        // Subscription is active, but `id` isn't namespaced under this platform.
        seal_approve(wrong_id, platform_id, &acct);

        account::transfer_account_cap(cap, owner);
        std::unit_test::destroy(acct);
        clock::destroy_for_testing(clock);
        ts::end(sc);
    }
}
