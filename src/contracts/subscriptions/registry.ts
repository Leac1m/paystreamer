/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Coin type registry: multisig-managed map from coin `TypeName` to `AccountType`
 * discriminant and metadata.
 * 
 * This module owns the shared `CoinTypeRegistry` object that the
 * `REGISTRY_ADMIN_ROLE` holders populate to add new stablecoin types without a
 * package upgrade. The registry is the single source of truth for which coin types
 * are accepted by the protocol; `account.move` and `payment.move` look up the
 * `AccountType` here at account-creation time and at deposit time (denomination
 * enforcement, architecture §6.4).
 * 
 * Per the v2 architecture doc (§5.7, §6.10): stablecoin diversity is
 * **governance-extensible**. USDC and USDSui ship pre-registered at `init` time in
 * production; the bootstrap path uses the multisig `register_coin_type<T>(info)`
 * flow.
 * 
 * `AccessControl<AC>` (see `access_control.move`) is reserved for a future
 * hardening pass. The v2 bootstrap uses a simple `admin_address` field as the
 * authority. The bootstrap admin must be rotated to the multisig in the same
 * publish tx that calls `init`-time registrations; the `rotate_admin` entry point
 * handles the rotation with an off-chain script and on-chain audit trail.
 */

import { MoveEnum, MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.js';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
import * as table from './deps/sui/table.js';
import * as type_name from './deps/std/type_name.js';
const $moduleName = '@local-pkg/subscriptions::registry';
/**
 * Billing denomination. Resolved at account-creation time from the
 * `CoinTypeRegistry`. Built-in slots 0 (USDC), 1 (USDSui), and 2 (SUI) are
 * reserved for the canonical types; the v2 governance path adds new types by
 * registering a custom `u8` discriminant in the registry's `discriminants` table
 * (see `register_coin_type<T>` and `try_into_builtin`).
 */
export const AccountType = new MoveEnum({ name: `${$moduleName}::AccountType`, fields: {
        USDC: null,
        USDSui: null,
        SUI: null
    } });
export const AccountTypeInfo = new MoveStruct({ name: `${$moduleName}::AccountTypeInfo`, fields: {
        /** Human-readable name (e.g. `"USDC"`, `"USDSui"`). */
        name: bcs.string(),
        /** Decimal places. Stablecoins ship with 6 (USDC, USDSui). */
        decimals: bcs.u8(),
        /** True if this is a confidential-transfer asset (extension). */
        is_confidential: bcs.bool()
    } });
export const CoinTypeRegistry = new MoveStruct({ name: `${$moduleName}::CoinTypeRegistry`, fields: {
        id: bcs.Address,
        /**
         * `TypeName -> u8` (discriminant for the `AccountType` enum / extended
         * discriminants). Allows reverse lookup from a generic coin type to a known
         * account type at `create_account` and at `deposit` time.
         */
        coin_to_discriminant: table.Table,
        /**
         * `u8 -> AccountTypeInfo`. For 0 and 1 this maps to USDC / USDSui; future
         * discriminants (>= 2) are added by multisig tx.
         */
        discriminants: table.Table,
        /**
         * The address authorized to add or remove coin types. Bootstrap field; the
         * protocol-wide `AccessControl<AC>` is the source of truth
         * (`REGISTRY_ADMIN_ROLE`). We mirror the address for O(1) reads; the AC is the
         * authority.
         */
        admin_address: bcs.Address,
        /** Schema version. Bumped on metadata-format changes. */
        version: bcs.u16()
    } });
export const CoinTypeRegistered = new MoveStruct({ name: `${$moduleName}::CoinTypeRegistered`, fields: {
        type_name: type_name.TypeName,
        discriminant: bcs.u8(),
        info: AccountTypeInfo,
        registered_by: bcs.Address
    } });
export const CoinTypeRemoved = new MoveStruct({ name: `${$moduleName}::CoinTypeRemoved`, fields: {
        type_name: type_name.TypeName,
        removed_by: bcs.Address
    } });
export interface AccountTypeUsdcOptions {
    package?: string;
    arguments?: [
    ];
}
/**
 * `AccountType::USDC` (discriminant 0). Use at account-creation time; the registry
 * is the source of truth at runtime.
 */
export function accountTypeUsdc(options: AccountTypeUsdcOptions = {}) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'registry',
        function: 'account_type_usdc',
    });
}
export interface AccountTypeUsdsuiOptions {
    package?: string;
    arguments?: [
    ];
}
/** `AccountType::USDSui` (discriminant 1). */
export function accountTypeUsdsui(options: AccountTypeUsdsuiOptions = {}) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'registry',
        function: 'account_type_usdsui',
    });
}
export interface AccountTypeSuiOptions {
    package?: string;
    arguments?: [
    ];
}
/**
 * `AccountType::SUI` (discriminant 2). Native SUI is supported as a billing
 * denomination alongside the stablecoin slots; the demo and the e2e script use it.
 */
export function accountTypeSui(options: AccountTypeSuiOptions = {}) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'registry',
        function: 'account_type_sui',
    });
}
export interface AccountTypeToU8Arguments {
    t: TransactionArgument;
}
export interface AccountTypeToU8Options {
    package?: string;
    arguments: AccountTypeToU8Arguments | [
        t: TransactionArgument
    ];
}
/**
 * `u8` discriminant of the enum variant. Built-in only; custom discriminants
 * (>= 3) have no `AccountType` variant and must be handled via
 * `CoinTypeRegistry::info_of` directly.
 */
export function accountTypeToU8(options: AccountTypeToU8Options) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["t"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'registry',
        function: 'account_type_to_u8',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountTypeEqArguments {
    a: TransactionArgument;
    b: TransactionArgument;
}
export interface AccountTypeEqOptions {
    package?: string;
    arguments: AccountTypeEqArguments | [
        a: TransactionArgument,
        b: TransactionArgument
    ];
}
/**
 * Structural equality on the `u8` discriminant. `AccountType` is
 * `copy + drop + store` but not `eq`-comparable by default, so we expose a thin
 * equality helper.
 */
export function accountTypeEq(options: AccountTypeEqOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["a", "b"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'registry',
        function: 'account_type_eq',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface NewAccountTypeInfoArguments {
    name: RawTransactionArgument<string>;
    decimals: RawTransactionArgument<number>;
    isConfidential: RawTransactionArgument<boolean>;
}
export interface NewAccountTypeInfoOptions {
    package?: string;
    arguments: NewAccountTypeInfoArguments | [
        name: RawTransactionArgument<string>,
        decimals: RawTransactionArgument<number>,
        isConfidential: RawTransactionArgument<boolean>
    ];
}
/**
 * Construct a fresh `AccountTypeInfo`. Pure value constructor; no permission
 * required. Used by the multisig's `register_coin_type<T>` call to attach metadata
 * to a new registration.
 */
export function newAccountTypeInfo(options: NewAccountTypeInfoOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        '0x1::string::String',
        'u8',
        'bool'
    ] satisfies (string | null)[];
    const parameterNames = ["name", "decimals", "isConfidential"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'registry',
        function: 'new_account_type_info',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface InfoNameArguments {
    i: TransactionArgument;
}
export interface InfoNameOptions {
    package?: string;
    arguments: InfoNameArguments | [
        i: TransactionArgument
    ];
}
/** Human-readable name of the registered type. */
export function infoName(options: InfoNameOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["i"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'registry',
        function: 'info_name',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface InfoDecimalsArguments {
    i: TransactionArgument;
}
export interface InfoDecimalsOptions {
    package?: string;
    arguments: InfoDecimalsArguments | [
        i: TransactionArgument
    ];
}
/** Decimal places of the registered type. */
export function infoDecimals(options: InfoDecimalsOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["i"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'registry',
        function: 'info_decimals',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface InfoIsConfidentialArguments {
    i: TransactionArgument;
}
export interface InfoIsConfidentialOptions {
    package?: string;
    arguments: InfoIsConfidentialArguments | [
        i: TransactionArgument
    ];
}
/** True if the registered type is a confidential-transfer asset. */
export function infoIsConfidential(options: InfoIsConfidentialOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["i"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'registry',
        function: 'info_is_confidential',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AdminAddressArguments {
    r: RawTransactionArgument<string>;
}
export interface AdminAddressOptions {
    package?: string;
    arguments: AdminAddressArguments | [
        r: RawTransactionArgument<string>
    ];
}
/**
 * Current bootstrap admin address. The protocol-wide `AccessControl<AC>` is the
 * source of truth for the `REGISTRY_ADMIN_ROLE`; this is the O(1) mirror.
 */
export function adminAddress(options: AdminAddressOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["r"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'registry',
        function: 'admin_address',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface VersionArguments {
    r: RawTransactionArgument<string>;
}
export interface VersionOptions {
    package?: string;
    arguments: VersionArguments | [
        r: RawTransactionArgument<string>
    ];
}
/** Schema version of the registry. Bumped on metadata-format changes. */
export function version(options: VersionOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["r"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'registry',
        function: 'version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DiscriminantOfArguments {
    r: RawTransactionArgument<string>;
}
export interface DiscriminantOfOptions {
    package?: string;
    arguments: DiscriminantOfArguments | [
        r: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * `u8` discriminant registered against `T`, or `none` if the type is not in the
 * registry. Read-only view; safe to call from any context.
 */
export function discriminantOf(options: DiscriminantOfOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["r"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'registry',
        function: 'discriminant_of',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface InfoOfArguments {
    r: RawTransactionArgument<string>;
    discriminant: RawTransactionArgument<number>;
}
export interface InfoOfOptions {
    package?: string;
    arguments: InfoOfArguments | [
        r: RawTransactionArgument<string>,
        discriminant: RawTransactionArgument<number>
    ];
}
/**
 * `AccountTypeInfo` registered against the given `u8` discriminant, or `none` if
 * the discriminant is unregistered.
 */
export function infoOf(options: InfoOfOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        'u8'
    ] satisfies (string | null)[];
    const parameterNames = ["r", "discriminant"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'registry',
        function: 'info_of',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TryIntoBuiltinArguments {
    discriminant: RawTransactionArgument<number>;
}
export interface TryIntoBuiltinOptions {
    package?: string;
    arguments: TryIntoBuiltinArguments | [
        discriminant: RawTransactionArgument<number>
    ];
}
/**
 * Convert a `u8` discriminant into a built-in `AccountType`, or return `none` if
 * the discriminant is non-standard (>= 3). Custom discriminants are valid in the
 * registry; they simply do not have a built-in `AccountType` variant. Callers that
 * need to handle custom types should branch on `info_of` directly.
 */
export function tryIntoBuiltin(options: TryIntoBuiltinOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        'u8'
    ] satisfies (string | null)[];
    const parameterNames = ["discriminant"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'registry',
        function: 'try_into_builtin',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface FromU8Arguments {
    discriminant: RawTransactionArgument<number>;
}
export interface FromU8Options {
    package?: string;
    arguments: FromU8Arguments | [
        discriminant: RawTransactionArgument<number>
    ];
}
/**
 * Convert a `u8` discriminant directly to `AccountType`. Aborts with
 * `EInvalidDiscriminant` if the value is not 0, 1, or 2. Use this from SDK calls
 * that cannot serialize `AccountType` directly.
 */
export function fromU8(options: FromU8Options) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        'u8'
    ] satisfies (string | null)[];
    const parameterNames = ["discriminant"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'registry',
        function: 'from_u8',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RegisterCoinTypeArguments {
    r: RawTransactionArgument<string>;
    info: TransactionArgument;
}
export interface RegisterCoinTypeOptions {
    package?: string;
    arguments: RegisterCoinTypeArguments | [
        r: RawTransactionArgument<string>,
        info: TransactionArgument
    ];
    typeArguments: [
        string
    ];
}
/**
 * Register a new coin type. The caller must equal
 * `CoinTypeRegistry.admin_address`. The protocol-wide `AccessControl<AC>` is the
 * source of truth for the `REGISTRY_ADMIN_ROLE`; for v2 we use a simple
 * `admin_address` check as a bootstrap mechanism (will be replaced by
 * `Auth<REGISTRY_ADMIN_ROLE>` in a future hardening pass).
 *
 * Discriminant allocation: built-in slots 0 (USDC) and 1 (USDSui) are kept free
 * for the canonical types; if both are taken we allocate the next free slot >= 2
 * for the custom type.
 *
 * #### Aborts
 *
 * - `EUnauthorizedRegistryAdmin` if `ctx.sender() != admin_address`.
 * - `ECoinTypeAlreadyRegistered` if `T` is already in the registry.
 */
export function registerCoinType(options: RegisterCoinTypeOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["r", "info"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'registry',
        function: 'register_coin_type',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RemoveCoinTypeArguments {
    r: RawTransactionArgument<string>;
}
export interface RemoveCoinTypeOptions {
    package?: string;
    arguments: RemoveCoinTypeArguments | [
        r: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Remove a coin type. The caller must be the current admin. Emits
 * `CoinTypeRemoved`. Future registrations of the same `T` after removal are
 * allowed and re-allocate a fresh discriminant via `register_coin_type<T>`.
 *
 * #### Aborts
 *
 * - `EUnauthorizedRegistryAdmin` if `ctx.sender() != admin_address`.
 * - `ECoinTypeNotFound` if `T` is not in the registry.
 */
export function removeCoinType(options: RemoveCoinTypeOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["r"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'registry',
        function: 'remove_coin_type',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RotateAdminArguments {
    r: RawTransactionArgument<string>;
    newAdmin: RawTransactionArgument<string>;
}
export interface RotateAdminOptions {
    package?: string;
    arguments: RotateAdminArguments | [
        r: RawTransactionArgument<string>,
        newAdmin: RawTransactionArgument<string>
    ];
}
/**
 * Rotate the bootstrap admin address. Should be replaced by an OZ
 * `Auth<REGISTRY_ADMIN_ROLE>` flow in a future hardening pass. Production
 * deployments must call this once at bootstrap to transfer authority to the
 * multisig.
 *
 * #### Aborts
 *
 * - `EUnauthorizedRegistryAdmin` if `ctx.sender() != admin_address`.
 * - `EZeroAddress` if `new_admin == @0x0`.
 */
export function rotateAdmin(options: RotateAdminOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["r", "newAdmin"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'registry',
        function: 'rotate_admin',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}