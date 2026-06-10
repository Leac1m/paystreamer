// Copyright (c) leac1m
// SPDX-License-Identifier: Apache-2.0

/// Coin type registry: multisig-managed map from coin `TypeName` to
/// `AccountType` discriminant and metadata.
///
/// This module owns the shared `CoinTypeRegistry` object that the
/// `REGISTRY_ADMIN_ROLE` holders populate to add new stablecoin types
/// without a package upgrade. The registry is the single source of truth
/// for which coin types are accepted by the protocol; `account.move` and
/// `payment.move` look up the `AccountType` here at account-creation time
/// and at deposit time (denomination enforcement, architecture §6.4).
///
/// Per the v2 architecture doc (§5.7, §6.10): stablecoin diversity is
/// **governance-extensible**. USDC and USDSui ship pre-registered at
/// `init` time in production; the bootstrap path uses the multisig
/// `register_coin_type<T>(info)` flow.
///
/// `AccessControl<AC>` (see `access_control.move`) is reserved
/// for a future hardening pass. The v2 bootstrap uses a simple
/// `admin_address` field as the authority. The bootstrap admin must be
/// rotated to the multisig in the same publish tx that calls
/// `init`-time registrations; the `rotate_admin` entry point handles the
/// rotation with an off-chain script and on-chain audit trail.
module paystreamer_v2::registry {
    use sui::object;
    use sui::tx_context::TxContext;
    use sui::table::{Self, Table};
    use sui::event;
    use sui::transfer;
    use std::type_name::{Self, TypeName};
    use std::string::String;

    // === AccountType enum ===

    /// Stablecoin denomination. Resolved at account-creation time from
    /// the `CoinTypeRegistry`. Adding a new variant would be a package
    /// upgrade; the v2 governance path adds new types by registering a
    /// custom `u8` discriminant in the registry's `discriminants` table
    /// (see `register_coin_type<T>` and `try_into_builtin`).
    public enum AccountType has copy, drop, store {
        USDC,       // variant 0
        USDSui,     // variant 1
    }

    /// `AccountType::USDC` (discriminant 0). Use at account-creation
    /// time; the registry is the source of truth at runtime.
    public fun account_type_usdc(): AccountType { AccountType::USDC }

    /// `AccountType::USDSui` (discriminant 1).
    public fun account_type_usdsui(): AccountType { AccountType::USDSui }

    /// `u8` discriminant of the enum variant. Built-in only; custom
    /// discriminants (>= 2) have no `AccountType` variant and must be
    /// handled via `CoinTypeRegistry::info_of` directly.
    public fun account_type_to_u8(t: &AccountType): u8 {
        match (t) {
            AccountType::USDC => 0,
            AccountType::USDSui => 1,
        }
    }

    /// Structural equality on the `u8` discriminant. `AccountType` is
    /// `copy + drop + store` but not `eq`-comparable by default, so we
    /// expose a thin equality helper.
    public fun account_type_eq(a: &AccountType, b: &AccountType): bool {
        account_type_to_u8(a) == account_type_to_u8(b)
    }

    // === AccountTypeInfo ===

    /// Metadata for a registered coin type. The `u8` discriminant in
    /// `CoinTypeRegistry` is the primary key; this struct is the value.
    /// `is_confidential` is a forward-looking flag: v2 ships with only
    /// public balances, but a confidential extension can register a
    /// `discriminant` here with `is_confidential = true` and the
    /// `BalanceContainer` logic in `asset.move` will respect it.
    public struct AccountTypeInfo has copy, drop, store {
        /// Human-readable name (e.g. `"USDC"`, `"USDSui"`).
        name: String,
        /// Decimal places. Stablecoins ship with 6 (USDC, USDSui).
        decimals: u8,
        /// True if this is a confidential-transfer asset (extension).
        is_confidential: bool,
    }

    /// Construct a fresh `AccountTypeInfo`. Pure value constructor; no
    /// permission required. Used by the multisig's `register_coin_type<T>`
    /// call to attach metadata to a new registration.
    public fun new_account_type_info(
        name: String,
        decimals: u8,
        is_confidential: bool,
    ): AccountTypeInfo {
        AccountTypeInfo { name, decimals, is_confidential }
    }

    /// Human-readable name of the registered type.
    public fun info_name(i: &AccountTypeInfo): &String { &i.name }
    /// Decimal places of the registered type.
    public fun info_decimals(i: &AccountTypeInfo): u8 { i.decimals }
    /// True if the registered type is a confidential-transfer asset.
    public fun info_is_confidential(i: &AccountTypeInfo): bool { i.is_confidential }

    // === CoinTypeRegistry ===

    /// Shared, multisig-only mutable object that maps coin `TypeName` to
    /// `AccountType` discriminant and metadata. New stablecoin types
    /// are added by `REGISTRY_ADMIN_ROLE` holders via `register_coin_type<T>`;
    /// USDC and USDSui are pre-registered at `init` time in production
    /// deployments. The registry is the single source of truth for which
    /// coin types are accepted by the protocol.
    public struct CoinTypeRegistry has key, store {
        id: object::UID,
        /// `TypeName -> u8` (discriminant for the `AccountType` enum / extended
        /// discriminants). Allows reverse lookup from a generic coin type to
        /// a known account type at `create_account` and at `deposit` time.
        coin_to_discriminant: Table<TypeName, u8>,
        /// `u8 -> AccountTypeInfo`. For 0 and 1 this maps to USDC / USDSui;
        /// future discriminants (>= 2) are added by multisig tx.
        discriminants: Table<u8, AccountTypeInfo>,
        /// The address authorized to add or remove coin types. Bootstrap
        /// field; the protocol-wide `AccessControl<AC>` is the
        /// source of truth (`REGISTRY_ADMIN_ROLE`). We mirror the address
        /// for O(1) reads; the AC is the authority.
        admin_address: address,
        /// Schema version. Bumped on metadata-format changes.
        version: u16,
    }

    // === Errors ===

    /// The coin `TypeName` is already in the registry. Re-registering a
    /// known type is a programmer error or a duplicate multisig tx.
    const ECoinTypeAlreadyRegistered: u64 = 0x04001;

    /// The coin `TypeName` is not registered. Removing an unknown type
    /// is a programmer error.
    const ECoinTypeNotFound: u64 = 0x04002;

    /// Caller is not the current `admin_address`. The bootstrap admin
    /// check; will be replaced by OZ `Auth<REGISTRY_ADMIN_ROLE>` in a
    /// future hardening pass.
    const EUnauthorizedRegistryAdmin: u64 = 0x04003;

    /// The new admin address is the zero address. A role granted to
    /// `@0x0` can never be exercised and is a footgun.
    const EZeroAddress: u64 = 0x04004;

    /// Reserved for callers that pass an out-of-range discriminant
    /// (e.g. the table is empty and we look up slot 0 manually).
    /// Currently unused; kept for forward-compat with stricter APIs.
    #[allow(unused_const)]
    const EInvalidDiscriminant: u64 = 0x04005;

    // === Events ===

    /// Emitted on every successful `register_coin_type<T>` call.
    public struct CoinTypeRegistered has copy, drop {
        type_name: TypeName,
        discriminant: u8,
        info: AccountTypeInfo,
        registered_by: address,
    }

    /// Emitted on every successful `remove_coin_type<T>` call.
    public struct CoinTypeRemoved has copy, drop {
        type_name: TypeName,
        removed_by: address,
    }

    // === init: mint the shared CoinTypeRegistry ===

    /// One-time init. Mints the shared `CoinTypeRegistry`. The deployer
    /// (`ctx.sender()`) becomes the initial admin; production deployments
    /// must immediately rotate `admin_address` to the multisig via
    /// `rotate_admin`, then call `register_coin_type<T>` for USDC and
    /// USDSui in the same bootstrap transaction.
    fun init(ctx: &mut TxContext) {
        let registry = CoinTypeRegistry {
            id: object::new(ctx),
            coin_to_discriminant: table::new(ctx),
            discriminants: table::new(ctx),
            admin_address: ctx.sender(),
            version: 1,
        };
        transfer::share_object(registry);
    }

    // === Accessors (view) ===

    /// Current bootstrap admin address. The protocol-wide
    /// `AccessControl<AC>` is the source of truth for the
    /// `REGISTRY_ADMIN_ROLE`; this is the O(1) mirror.
    public fun admin_address(r: &CoinTypeRegistry): address { r.admin_address }

    /// Schema version of the registry. Bumped on metadata-format changes.
    public fun version(r: &CoinTypeRegistry): u16 { r.version }

    /// `u8` discriminant registered against `T`, or `none` if the type is
    /// not in the registry. Read-only view; safe to call from any context.
    public fun discriminant_of<T>(r: &CoinTypeRegistry): std::option::Option<u8> {
        let tn = type_name::with_original_ids<T>();
        if (r.coin_to_discriminant.contains(tn)) {
            std::option::some(*r.coin_to_discriminant.borrow(tn))
        } else {
            std::option::none()
        }
    }

    /// `AccountTypeInfo` registered against the given `u8` discriminant,
    /// or `none` if the discriminant is unregistered.
    public fun info_of(
        r: &CoinTypeRegistry,
        discriminant: u8,
    ): std::option::Option<AccountTypeInfo> {
        if (r.discriminants.contains(discriminant)) {
            std::option::some(*r.discriminants.borrow(discriminant))
        } else {
            std::option::none()
        }
    }

    /// Convert a `u8` discriminant into a built-in `AccountType`, or
    /// return `none` if the discriminant is non-standard (>= 2). Custom
    /// discriminants are valid in the registry; they simply do not have
    /// a built-in `AccountType` variant. Callers that need to handle
    /// custom types should branch on `info_of` directly.
    public fun try_into_builtin(discriminant: u8): std::option::Option<AccountType> {
        if (discriminant == 0) {
            std::option::some(AccountType::USDC)
        } else if (discriminant == 1) {
            std::option::some(AccountType::USDSui)
        } else {
            std::option::none()
        }
    }

    // === Mutators (admin only) ===

    /// Register a new coin type. The caller must equal
    /// `CoinTypeRegistry.admin_address`. The protocol-wide
    /// `AccessControl<AC>` is the source of truth for the
    /// `REGISTRY_ADMIN_ROLE`; for v2 we use a simple `admin_address`
    /// check as a bootstrap mechanism (will be replaced by
    /// `Auth<REGISTRY_ADMIN_ROLE>` in a future hardening pass).
    ///
    /// Discriminant allocation: built-in slots 0 (USDC) and 1 (USDSui)
    /// are kept free for the canonical types; if both are taken we
    /// allocate the next free slot >= 2 for the custom type.
    ///
    /// #### Aborts
    /// - `EUnauthorizedRegistryAdmin` if `ctx.sender() != admin_address`.
    /// - `ECoinTypeAlreadyRegistered` if `T` is already in the registry.
    public fun register_coin_type<T>(
        r: &mut CoinTypeRegistry,
        info: AccountTypeInfo,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == r.admin_address, EUnauthorizedRegistryAdmin);
        let tn = type_name::with_original_ids<T>();
        assert!(!r.coin_to_discriminant.contains(tn), ECoinTypeAlreadyRegistered);

        // Allocate the lowest free discriminant. A fresh registry hands
        // out 0 first, then 1, then 2+. Built-in `AccountType` variants
        // (USDC=0, USDSui=1) are reserved by convention; a multisig that
        // wants strict built-in-first semantics can pre-register USDC
        // and USDSui before any custom type. Either way, the discriminant
        // is unique and monotonic. `u8` gives 256 slots; the upper bound
        // is the table-add abort, not this loop.
        let mut d: u8 = 0;
        while (d != 255u8 && r.discriminants.contains(d)) { d = d + 1; };
        r.coin_to_discriminant.add(tn, d);
        r.discriminants.add(d, info);

        event::emit(CoinTypeRegistered {
            type_name: tn,
            discriminant: d,
            info,
            registered_by: ctx.sender(),
        });
    }

    /// Remove a coin type. The caller must be the current admin. Emits
    /// `CoinTypeRemoved`. Future registrations of the same `T` after
    /// removal are allowed and re-allocate a fresh discriminant via
    /// `register_coin_type<T>`.
    ///
    /// #### Aborts
    /// - `EUnauthorizedRegistryAdmin` if `ctx.sender() != admin_address`.
    /// - `ECoinTypeNotFound` if `T` is not in the registry.
    public fun remove_coin_type<T>(r: &mut CoinTypeRegistry, ctx: &mut TxContext) {
        assert!(ctx.sender() == r.admin_address, EUnauthorizedRegistryAdmin);
        let tn = type_name::with_original_ids<T>();
        assert!(r.coin_to_discriminant.contains(tn), ECoinTypeNotFound);
        let d = r.coin_to_discriminant.remove(tn);
        if (r.discriminants.contains(d)) {
            let _ = r.discriminants.remove(d);
        };
        event::emit(CoinTypeRemoved {
            type_name: tn,
            removed_by: ctx.sender(),
        });
    }

    /// Rotate the bootstrap admin address. Should be replaced by an OZ
    /// `Auth<REGISTRY_ADMIN_ROLE>` flow in a future hardening pass.
    /// Production deployments must call this once at bootstrap to
    /// transfer authority to the multisig.
    ///
    /// #### Aborts
    /// - `EUnauthorizedRegistryAdmin` if `ctx.sender() != admin_address`.
    /// - `EZeroAddress` if `new_admin == @0x0`.
    public fun rotate_admin(
        r: &mut CoinTypeRegistry,
        new_admin: address,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == r.admin_address, EUnauthorizedRegistryAdmin);
        assert!(new_admin != @0x0, EZeroAddress);
        r.admin_address = new_admin;
    }

    // === Test-only ===

    /// Test-only constructor. Mirrors the `init` body but returns the
    /// `CoinTypeRegistry` by value so unit tests can register, query,
    /// and dispose without going through a shared object.
    #[test_only]
    public fun new_registry_for_testing(ctx: &mut TxContext): CoinTypeRegistry {
        CoinTypeRegistry {
            id: object::new(ctx),
            coin_to_discriminant: table::new(ctx),
            discriminants: table::new(ctx),
            admin_address: ctx.sender(),
            version: 1,
        }
    }

    /// Test-only destructor. `CoinTypeRegistry` has `key + store` but
    /// not `drop`, so unit tests need an explicit way to dispose of
    /// registries they constructed. Both `Table` fields are
    /// `Table<TypeName, u8>` and `Table<u8, AccountTypeInfo>`; the value
    /// types are `copy + drop + store`, so we use `table::drop` (the
    /// `drop`-valued variant) which works regardless of size.
    #[test_only]
    public fun destroy_for_testing(r: CoinTypeRegistry) {
        let CoinTypeRegistry {
            id,
            coin_to_discriminant,
            discriminants,
            admin_address: _,
            version: _,
        } = r;
        object::delete(id);
        table::drop(coin_to_discriminant);
        table::drop(discriminants);
    }
}
