// Copyright (c) leac1m
// SPDX-License-Identifier: Apache-2.0

#[test_only]
module subscriptions::registry_tests {
    use subscriptions::registry;
    use std::string;
    use sui::test_scenario as ts;

    /// Coin witnesses used as test-only denominations. They have `drop`
    /// so we can construct them freely; no treasury cap is needed
    /// because the registry never touches balances.
    public struct TEST_TOKEN_X has drop {}
    public struct TEST_TOKEN_Y has drop {}
    public struct TEST_TOKEN_Z has drop {}

    /// Helper: construct an `AccountTypeInfo` for tests.
    fun test_info(name: vector<u8>, decimals: u8, is_confidential: bool): registry::AccountTypeInfo {
        registry::new_account_type_info(string::utf8(name), decimals, is_confidential)
    }

    /// Registering the first coin type assigns discriminant 0 (USDC slot,
    /// per the spec's "built-in uses 0/1" rule). `info_of` returns the
    /// attached metadata, and `try_into_builtin` resolves it to
    /// `AccountType::USDC`.
    #[test]
    fun test_register_coin_type_assigns_discriminant() {
        let mut sc = ts::begin(@0xA);
        let mut r = registry::new_registry_for_testing(ts::ctx(&mut sc));

        let info = test_info(b"USDC", 6, false);
        registry::register_coin_type<TEST_TOKEN_X>(&mut r, info, ts::ctx(&mut sc));

        // First registration lands in the USDC built-in slot.
        let d = registry::discriminant_of<TEST_TOKEN_X>(&r);
        assert!(d == std::option::some(0), 0);
        assert!(std::option::is_some(&registry::try_into_builtin(0)), 1);

        // Metadata round-trips: AccountTypeInfo is `copy + drop + store`,
        // so we copy out the stored value for the assertions.
        let stored_info = *std::option::borrow(&registry::info_of(&r, 0));
        assert!(registry::info_decimals(&stored_info) == 6, 2);
        assert!(registry::info_is_confidential(&stored_info) == false, 3);
        assert!(string::as_bytes(registry::info_name(&stored_info)) == &b"USDC", 4);

        // A second distinct type gets discriminant 1 (USDSui slot).
        let info2 = test_info(b"USDSui", 6, false);
        registry::register_coin_type<TEST_TOKEN_Y>(&mut r, info2, ts::ctx(&mut sc));
        assert!(registry::discriminant_of<TEST_TOKEN_Y>(&r) == std::option::some(1), 5);

        // A third distinct type gets discriminant 2 (custom slot).
        let info3 = test_info(b"CustomUSD", 6, false);
        registry::register_coin_type<TEST_TOKEN_Z>(&mut r, info3, ts::ctx(&mut sc));
        assert!(registry::discriminant_of<TEST_TOKEN_Z>(&r) == std::option::some(2), 6);
        assert!(std::option::is_none(&registry::try_into_builtin(2)), 7);

        // `Option<u8>` is `drop`; the bindings above are dropped at scope end.
        let _ = d;

        registry::destroy_for_testing(r);
        sc.end();
    }

    /// Register then remove: after remove, both `discriminant_of<T>` and
    /// `info_of` return `none`. The discriminant slot is freed.
    #[test]
    fun test_register_then_remove_round_trip() {
        let mut sc = ts::begin(@0xA);
        let mut r = registry::new_registry_for_testing(ts::ctx(&mut sc));

        let info = test_info(b"USDC", 6, false);
        registry::register_coin_type<TEST_TOKEN_X>(&mut r, info, ts::ctx(&mut sc));
        assert!(registry::discriminant_of<TEST_TOKEN_X>(&r) == std::option::some(0), 0);
        assert!(std::option::is_some(&registry::info_of(&r, 0)), 1);

        registry::remove_coin_type<TEST_TOKEN_X>(&mut r, ts::ctx(&mut sc));

        assert!(registry::discriminant_of<TEST_TOKEN_X>(&r) == std::option::none(), 2);
        assert!(registry::info_of(&r, 0) == std::option::none(), 3);

        registry::destroy_for_testing(r);
        sc.end();
    }

    /// Registering the same `T` twice aborts with the duplicate-error
    /// code. The registry is unchanged after the failed tx.
    #[test]
    #[expected_failure(abort_code = registry::ECoinTypeAlreadyRegistered)]
    fun test_register_duplicate_fails() {
        let mut sc = ts::begin(@0xA);
        let mut r = registry::new_registry_for_testing(ts::ctx(&mut sc));

        let info = test_info(b"USDC", 6, false);
        registry::register_coin_type<TEST_TOKEN_X>(&mut r, info, ts::ctx(&mut sc));
        // Second registration of the same T must abort.
        let info2 = test_info(b"USDC-dup", 6, false);
        registry::register_coin_type<TEST_TOKEN_X>(&mut r, info2, ts::ctx(&mut sc));

        registry::destroy_for_testing(r);
        sc.end();
    }

    /// A non-admin sender cannot register. `ctx.sender()` is the address
    /// that started the scenario, not the bootstrap admin.
    #[test]
    #[expected_failure(abort_code = registry::EUnauthorizedRegistryAdmin)]
    fun test_unauthorized_register_fails() {
        let mut sc = ts::begin(@0xA);
        // Bootstrap admin is @0xA. Now switch to @0xB and try to register.
        let mut r = registry::new_registry_for_testing(ts::ctx(&mut sc));

        ts::next_tx(&mut sc, @0xB);
        let info = test_info(b"USDC", 6, false);
        registry::register_coin_type<TEST_TOKEN_X>(&mut r, info, ts::ctx(&mut sc));

        registry::destroy_for_testing(r);
        sc.end();
    }

    /// Admin can rotate to a new address. After rotation, the new admin
    /// can register, and the old admin can no longer.
    #[test]
    fun test_rotate_admin_works() {
        let mut sc = ts::begin(@0xA);
        let mut r = registry::new_registry_for_testing(ts::ctx(&mut sc));

        // Initial admin is @0xA.
        assert!(registry::admin_address(&r) == @0xA, 0);

        // Rotate to @0xB.
        registry::rotate_admin(&mut r, @0xB, ts::ctx(&mut sc));
        assert!(registry::admin_address(&r) == @0xB, 1);

        // @0xB can now register.
        ts::next_tx(&mut sc, @0xB);
        let info = test_info(b"USDC", 6, false);
        registry::register_coin_type<TEST_TOKEN_X>(&mut r, info, ts::ctx(&mut sc));
        assert!(registry::discriminant_of<TEST_TOKEN_X>(&r) == std::option::some(0), 2);

        registry::destroy_for_testing(r);
        sc.end();
    }

    /// Companion to `test_rotate_admin_works`: after rotation, the old
    /// admin (now @0xB) is rejected. Kept as a separate expected-failure
    /// test so the abort code is the obvious one and not the
    /// duplicate-register abort.
    #[test]
    #[expected_failure(abort_code = registry::EUnauthorizedRegistryAdmin)]
    fun test_rotate_admin_old_admin_loses_authority() {
        let mut sc = ts::begin(@0xA);
        let mut r = registry::new_registry_for_testing(ts::ctx(&mut sc));

        // Rotate to @0xB.
        registry::rotate_admin(&mut r, @0xB, ts::ctx(&mut sc));

        // @0xA is no longer the admin; the second register call aborts.
        let info = test_info(b"USDC", 6, false);
        registry::register_coin_type<TEST_TOKEN_X>(&mut r, info, ts::ctx(&mut sc));

        registry::destroy_for_testing(r);
        sc.end();
    }

    /// Rotating to the zero address is rejected.
    #[test]
    #[expected_failure(abort_code = registry::EZeroAddress)]
    fun test_rotate_admin_zero_address_fails() {
        let mut sc = ts::begin(@0xA);
        let mut r = registry::new_registry_for_testing(ts::ctx(&mut sc));
        registry::rotate_admin(&mut r, @0x0, ts::ctx(&mut sc));
        registry::destroy_for_testing(r);
        sc.end();
    }

    /// `AccountType` enum discriminants are stable: 0 for USDC, 1 for
    /// USDSui, and the equality helper matches.
    #[test]
    fun test_account_type_enum_helpers() {
        let u = registry::account_type_usdc();
        let v = registry::account_type_usdsui();
        assert!(registry::account_type_to_u8(&u) == 0, 0);
        assert!(registry::account_type_to_u8(&v) == 1, 1);
        assert!(registry::account_type_eq(&u, &u), 2);
        assert!(!registry::account_type_eq(&u, &v), 3);
    }
}
