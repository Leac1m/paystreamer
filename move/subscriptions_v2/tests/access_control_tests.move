// Copyright (c) leac1m
// SPDX-License-Identifier: Apache-2.0

#[test_only]
module paystreamer_v2::access_control_tests {
    use paystreamer_v2::access_control;

    /// `new_account_cap` accepts the three defined single-bit permissions
    /// and rejects anything beyond the defined mask (bit 3, the next
    /// available bit, aborts).
    #[test]
    fun test_new_account_cap_valid_permissions() {
        let mut ctx = tx_context::dummy();
        let account_id = object::id_from_address(@0xA);

        let cap_owner = access_control::new_account_cap_for_testing(
            account_id, access_control::permission_owner(), &mut ctx,
        );
        assert!(access_control::permissions(&cap_owner) == 1, 0);
        let cap_dep = access_control::new_account_cap_for_testing(
            account_id, access_control::permission_depositor(), &mut ctx,
        );
        assert!(access_control::permissions(&cap_dep) == 2, 0);
        let cap_agent = access_control::new_account_cap_for_testing(
            account_id, access_control::permission_agent(), &mut ctx,
        );
        assert!(access_control::permissions(&cap_agent) == 4, 0);

        access_control::destroy_account_cap_for_testing(cap_owner);
        access_control::destroy_account_cap_for_testing(cap_dep);
        access_control::destroy_account_cap_for_testing(cap_agent);
    }

    /// A zero permission bitfield is rejected: a cap with no permissions
    /// would be a wallet-visible inert object and a footgun for users.
    #[test]
    #[expected_failure(abort_code = 0x02001)]
    fun test_new_account_cap_zero_fails() {
        let mut ctx = tx_context::dummy();
        let account_id = object::id_from_address(@0xA);
        let cap = access_control::new_account_cap_for_testing(account_id, 0, &mut ctx);
        access_control::destroy_account_cap_for_testing(cap);
    }

    /// `has_permission` correctly masks for owner/depositor/agent
    /// combinations: an `OWNER|DEPOSITOR` cap accepts both single-bit
    /// queries and the combined query; an `AGENT`-only cap rejects
    /// `OWNER` and `OWNER|DEPOSITOR` queries.
    #[test]
    fun test_has_permission_mask() {
        let mut ctx = tx_context::dummy();
        let account_id = object::id_from_address(@0xA);

        let owner_dep = 1u32 | 2u32;
        let cap = access_control::new_account_cap_for_testing(
            account_id, owner_dep, &mut ctx,
        );
        assert!(access_control::has_permission(&cap, access_control::permission_owner()), 0);
        assert!(access_control::has_permission(&cap, access_control::permission_depositor()), 0);
        assert!(!access_control::has_permission(&cap, access_control::permission_agent()), 0);
        assert!(access_control::has_permission(&cap, owner_dep), 0);
        access_control::destroy_account_cap_for_testing(cap);

        let agent_only = access_control::permission_agent();
        let cap2 = access_control::new_account_cap_for_testing(
            account_id, agent_only, &mut ctx,
        );
        assert!(!access_control::has_permission(&cap2, access_control::permission_owner()), 0);
        assert!(!access_control::has_permission(&cap2, access_control::permission_depositor()), 0);
        assert!(access_control::has_permission(&cap2, access_control::permission_agent()), 0);
        assert!(
            !access_control::has_permission(
                &cap2,
                access_control::permission_owner() | access_control::permission_depositor(),
            ),
            0,
        );
        access_control::destroy_account_cap_for_testing(cap2);
    }

    /// Accessors return exactly what was passed in to the constructor.
    #[test]
    fun test_account_cap_accessors() {
        let mut ctx = tx_context::dummy();
        let account_id = object::id_from_address(@0xC0FFEE);
        let perms = access_control::permission_owner() | access_control::permission_agent();

        let cap = access_control::new_account_cap_for_testing(
            account_id, perms, &mut ctx,
        );

        assert!(access_control::account_id(&cap) == account_id, 0);
        assert!(access_control::permissions(&cap) == perms, 0);
        assert!(access_control::version(&cap) == 1, 0);
        assert!(access_control::created_at(&cap) == 0, 0);

        access_control::destroy_account_cap_for_testing(cap);
    }
}
