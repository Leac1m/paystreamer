/// `subscriptions::registry` — Global protocol registry and treasury management.
///
/// This module manages the `Registry` shared object which tracks the protocol's
/// global treasury address, where the 2% protocol fee is routed.
///
/// ## Authority model
///
/// The `RegistryAdminCap` is granted to the package publisher on `init`.
/// Mutating functions like `propose_treasury_change` require this cap.
module subscriptions::registry {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::clock::{Self, Clock};
    use sui::event;

    // === Errors ===
    const ETreasuryChangeAlreadyPending: u64 = 0;
    const ENoPendingTreasuryChange: u64 = 1;
    const ETreasuryChangeTimelockNotElapsed: u64 = 2;
    const EZeroAddress: u64 = 3;

    // 48-hour timelock
    const TREASURY_CHANGE_DELAY_MS: u64 = 48 * 60 * 60 * 1_000;

    // === Events ===
    public struct RegistryCreated has copy, drop {
        registry_id: ID,
        admin_id: ID,
    }

    public struct TreasuryChangeProposed has copy, drop {
        registry_id: ID,
        new_treasury: address,
        execute_after_ms: u64,
    }

    public struct TreasuryChangeAccepted has copy, drop {
        registry_id: ID,
        new_treasury: address,
    }

    public struct TreasuryChangeCancelled has copy, drop {
        registry_id: ID,
    }

    // === Types ===
    
    /// Capability that grants the right to configure the global registry
    public struct AdminCap has key, store {
        id: UID,
    }

    public struct PendingTreasuryChange has store, drop {
        new_treasury: address,
        execute_after_ms: u64,
    }

    /// Global shared object that stores protocol-wide settings
    public struct Registry has key {
        id: UID,
        protocol_treasury: address,
        pending_treasury: std::option::Option<PendingTreasuryChange>,
        version: u16,
    }

    // === Init ===
    
    fun init(ctx: &mut TxContext) {
        let admin_cap = AdminCap { id: object::new(ctx) };
        let admin_id = object::id(&admin_cap);
        
        let registry = Registry {
            id: object::new(ctx),
            protocol_treasury: ctx.sender(),
            pending_treasury: std::option::none(),
            version: 2,
        };
        let registry_id = object::id(&registry);

        transfer::public_transfer(admin_cap, ctx.sender());
        transfer::share_object(registry);

        event::emit(RegistryCreated { registry_id, admin_id });
    }

    // === Accessors ===

    public fun protocol_treasury(registry: &Registry): address {
        registry.protocol_treasury
    }

    // === Treasury Management ===

    public fun propose_treasury_change(
        registry: &mut Registry,
        _cap: &AdminCap,
        new_treasury: address,
        clock: &Clock,
    ) {
        assert!(new_treasury != @0x0, EZeroAddress);
        assert!(registry.pending_treasury.is_none(), ETreasuryChangeAlreadyPending);
        
        let execute_after_ms = clock.timestamp_ms() + TREASURY_CHANGE_DELAY_MS;
        registry.pending_treasury = std::option::some(PendingTreasuryChange {
            new_treasury,
            execute_after_ms,
        });

        event::emit(TreasuryChangeProposed {
            registry_id: object::id(registry),
            new_treasury,
            execute_after_ms,
        });
    }

    public fun accept_treasury_change(
        registry: &mut Registry,
        _cap: &AdminCap,
        clock: &Clock,
    ) {
        assert!(registry.pending_treasury.is_some(), ENoPendingTreasuryChange);
        let pending = std::option::extract(&mut registry.pending_treasury);
        assert!(clock.timestamp_ms() >= pending.execute_after_ms, ETreasuryChangeTimelockNotElapsed);

        registry.protocol_treasury = pending.new_treasury;
        registry.pending_treasury = std::option::none();

        event::emit(TreasuryChangeAccepted {
            registry_id: object::id(registry),
            new_treasury: pending.new_treasury,
        });
    }

    public fun cancel_treasury_change(
        registry: &mut Registry,
        _cap: &AdminCap,
    ) {
        assert!(registry.pending_treasury.is_some(), ENoPendingTreasuryChange);
        registry.pending_treasury = std::option::none();

        event::emit(TreasuryChangeCancelled {
            registry_id: object::id(registry),
        });
    }

    // === Testing ===

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}
