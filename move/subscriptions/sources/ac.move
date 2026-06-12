// Copyright (c) leac1m
// SPDX-License-Identifier: Apache-2.0

/// Protocol-wide access control primitives for PayStreamer v2.
///
/// This module owns:
/// 1. The protocol-wide `AC` one-time witness (OTW) — the
///    VM-required upper-case of the module name `access_control`. The
///    OTW is consumed by `openzeppelin_access::access_control::new` to
///    mint the protocol-wide `AccessControl<AC>` singleton.
/// 2. The eight role types consumed by every other core module.
/// 3. The user-facing `AccountCap` carrying the delegated permission
///    bitfield (BUG FIX #1 from the v2 architecture doc, §2 and §5.2).
///
/// Per the OpenZeppelin invariant, all role types live in the same
/// module as the OTW. The `init` function mints and shares the
/// protocol-wide `AccessControl<AC>` for the global
/// `CoinTypeRegistry` multisig; per-Platform and per-Account
/// `AccessControl<AC>` registries are minted in their own
/// modules.
///
/// `Auth<Role>` is a self-validating typed witness. The phantom
/// `AC` tag (the OTW) is the type parameter on every
/// `AccessControl<AC>` instance in the protocol.
module subscriptions::ac {
    use sui::object;
    use sui::tx_context::TxContext;
    use openzeppelin_access::access_control::{Self, AccessControl};

    /// Protocol-wide one-time witness. Named `AC` because the
    /// Sui VM requires the OTW type to be the upper-case of the module
    /// that declares it. Consumed exactly once at package publish to mint
    /// the protocol-wide `AccessControl<AC>` singleton.
    public struct AC has drop {}

    // === Role types ===
    //
    // Per the OZ invariant, all role types live in the same module as the
    // OTW. Foreign role types are rejected at the boundary by OZ's home-
    // module check.

    /// Platform admin: registers tiers, updates platform metadata, proposes
    /// treasury changes.
    public struct PLATFORM_ADMIN_ROLE {}

    /// Platform scheduler: the on-chain `PLATFORM_SCHEDULER_ROLE` member
    /// whose role grant authorizes any caller to submit a due payment
    /// against the platform (no signing key required; see architecture §7.3).
    public struct PLATFORM_SCHEDULER_ROLE {}

    /// Platform treasury: receives withdrawn subscription funds.
    public struct PLATFORM_TREASURY_ROLE {}

    /// Global scheduler admin: the multisig-only role that flips the
    /// `PaymentScheduler.pause_flag` circuit breaker.
    public struct PLATFORM_GLOBAL_ADMIN_ROLE {}

    /// Account owner: full authority over an `AccountCap` and its account.
    public struct ACCOUNT_OWNER_ROLE {}

    /// Account depositor: may deposit into the account but may not change
    /// policies, subscribe, or withdraw.
    public struct ACCOUNT_DEPOSITOR_ROLE {}

    /// Account agent: agentic-commerce seam. May submit delegated payments
    /// within a per-agent budget envelope (extension: `agent_pay`).
    public struct ACCOUNT_AGENT_ROLE {}

    /// Registry admin: the multisig-only role that registers or removes
    /// coin types in the `CoinTypeRegistry`.
    public struct REGISTRY_ADMIN_ROLE {}

    // === AccountCap ===

    /// User-facing capability for a `SubscriptionAccount<T>`. Non-transferable
    /// by default (`key` only, not `store`). The bitfield `permissions`
    /// encodes which fine-grained actions the holder is allowed to perform
    /// (BUG FIX #1). Pair with the embedded `AccessControl<AC>`
    /// on the account, which mints the corresponding `Auth<Role>` at call
    /// time.
    public struct AccountCap has key {
        id: object::UID,
        /// ID of the `SubscriptionAccount<T>` this cap authorizes.
        account_id: object::ID,
        /// Permission bitfield. `OWNER=1`, `DEPOSITOR=2`, `AGENT=4`.
        permissions: u32,
        /// Cap version; bumped when permissions are extended or revoked.
        version: u8,
        /// Creation timestamp in milliseconds (Sui `Clock`).
        created_at: u64,
    }

    // === Permission bitfield constants ===

    /// Owner permission: full authority over the account.
    const PERMISSION_OWNER: u32 = 1;       // bit 0

    /// Depositor permission: may deposit into the account.
    const PERMISSION_DEPOSITOR: u32 = 2;   // bit 1

    /// Agent permission: agentic-commerce seam (extension: `agent_pay`).
    const PERMISSION_AGENT: u32 = 4;       // bit 2

    // === Errors ===

    /// Permission bitfield is zero (no permissions) or contains bits beyond
    /// the defined mask (bits 3-31).
    const EInvalidPermission: u64 = 0x02001;

    // === init ===

    /// One-time initializer. The Sui VM injects the `AC` OTW
    /// exactly once at first publish, so the resulting
    /// `AccessControl<AC>` is the protocol-wide singleton. The
    /// deployer (`ctx.sender()`) becomes the initial default admin; the
    /// deployer is expected to immediately transfer that role to the
    /// multisig via the OZ delayed transfer flow.
    ///
    /// Role: protocol publish tx only; not callable by users.
    fun init(otw: AC, ctx: &mut TxContext) {
        let ac = access_control::new<AC>(otw, 48 * 60 * 60 * 1_000, ctx);
        sui::transfer::public_share_object(ac);
    }

    // === AccountCap constructor + accessors ===

    /// Mint a fresh `AccountCap` bound to `account_id` with the given
    /// permission bitfield. The cap is returned by value; the caller is
    /// responsible for transferring it to the appropriate address.
    ///
    /// Role: caller must already hold `ACCOUNT_OWNER_ROLE` on the account's
    /// embedded `AccessControl<AC>` (checked at the call site
    /// in `account.move`).
    public fun new_account_cap(
        account_id: object::ID,
        permissions: u32,
        clock_ms: u64,
        ctx: &mut TxContext,
    ): AccountCap {
        assert!(permissions != 0 && permissions <= 7, EInvalidPermission);
        AccountCap {
            id: object::new(ctx),
            account_id,
            permissions,
            version: 1,
            created_at: clock_ms,
        }
    }

    /// ID of the `SubscriptionAccount<T>` this cap authorizes.
    /// Role: any caller (read-only view).
    public fun account_id(cap: &AccountCap): object::ID { cap.account_id }

    /// Raw permission bitfield.
    /// Role: any caller (read-only view).
    public fun permissions(cap: &AccountCap): u32 { cap.permissions }

    /// Cap version.
    /// Role: any caller (read-only view).
    public fun version(cap: &AccountCap): u8 { cap.version }

    /// Creation timestamp in milliseconds (Sui `Clock`).
    /// Role: any caller (read-only view).
    public fun created_at(cap: &AccountCap): u64 { cap.created_at }

    /// True iff the cap's `permissions` bitfield contains every bit in
    /// `perm`. Zero-`perm` always returns `false` (no permission is a
    /// programmer error, not a positive grant).
    /// Role: any caller (read-only view).
    public fun has_permission(cap: &AccountCap, perm: u32): bool {
        (cap.permissions & perm) == perm && perm != 0
    }

    // === Permission constants accessors ===

    /// Owner permission bit (value `1`).
    /// Role: any caller (read-only view).
    public fun permission_owner(): u32 { PERMISSION_OWNER }

    /// Depositor permission bit (value `2`).
    /// Role: any caller (read-only view).
    public fun permission_depositor(): u32 { PERMISSION_DEPOSITOR }

    /// Agent permission bit (value `4`).
    /// Role: any caller (read-only view).
    public fun permission_agent(): u32 { PERMISSION_AGENT }

    // === Test-only helpers ===

    /// Transfer a freshly-minted `AccountCap` to a recipient. Since
    /// `AccountCap` is `key`-only (not `store`) per the design doc
    /// (§5.2: "non-transferable by default"), the only way to relocate
    /// it on chain is via this helper. This is intentionally narrow:
    /// the cap is minted and then handed to the user exactly once.
    /// Subsequent re-transfers are a future hardening pass (the
    /// v1→v2 migration path will add a `transfer_account_cap_to`).
    ///
    /// Role: any caller. The cap is `key`-only, so the only entity
    /// that can pass it to this function is the one that just minted
    /// or currently holds it.
    public fun transfer_account_cap(cap: AccountCap, recipient: address) {
        sui::transfer::transfer(cap, recipient);
    }

    /// Test-only constructor that pins `created_at` to `0`, mirroring the
    /// `clock`-free behavior expected by Move unit tests. Production code
    /// must use `new_account_cap` with a real `clock.timestamp_ms()`.
    #[test_only]
    public fun new_account_cap_for_testing(
        account_id: object::ID,
        permissions: u32,
        ctx: &mut TxContext,
    ): AccountCap {
        new_account_cap(account_id, permissions, 0, ctx)
    }

    /// Test-only destructor. `AccountCap` has `key` but not `drop`, so unit
    /// tests need an explicit way to dispose of caps they constructed.
    #[test_only]
    public fun destroy_account_cap_for_testing(cap: AccountCap) {
        let AccountCap { id, account_id: _, permissions: _, version: _, created_at: _ } = cap;
        object::delete(id);
    }
}
