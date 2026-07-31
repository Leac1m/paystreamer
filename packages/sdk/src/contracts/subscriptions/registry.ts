/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * `subscriptions::registry` — Global protocol registry and treasury management.
 * 
 * This module manages the `Registry` shared object which tracks the protocol's
 * global treasury address, where the 2% protocol fee is routed.
 * 
 * ## Authority model
 * 
 * The `RegistryAdminCap` is granted to the package publisher on `init`. Mutating
 * functions like `propose_treasury_change` require this cap.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.js';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
const $moduleName = '@local-pkg/subscriptions::registry';
export const RegistryCreated = new MoveStruct({ name: `${$moduleName}::RegistryCreated`, fields: {
        registry_id: bcs.Address,
        admin_id: bcs.Address
    } });
export const TreasuryChangeProposed = new MoveStruct({ name: `${$moduleName}::TreasuryChangeProposed`, fields: {
        registry_id: bcs.Address,
        new_treasury: bcs.Address,
        execute_after_ms: bcs.u64()
    } });
export const TreasuryChangeAccepted = new MoveStruct({ name: `${$moduleName}::TreasuryChangeAccepted`, fields: {
        registry_id: bcs.Address,
        new_treasury: bcs.Address
    } });
export const TreasuryChangeCancelled = new MoveStruct({ name: `${$moduleName}::TreasuryChangeCancelled`, fields: {
        registry_id: bcs.Address
    } });
export const AdminCap = new MoveStruct({ name: `${$moduleName}::AdminCap`, fields: {
        id: bcs.Address
    } });
export const PendingTreasuryChange = new MoveStruct({ name: `${$moduleName}::PendingTreasuryChange`, fields: {
        new_treasury: bcs.Address,
        execute_after_ms: bcs.u64()
    } });
export const Registry = new MoveStruct({ name: `${$moduleName}::Registry`, fields: {
        id: bcs.Address,
        protocol_treasury: bcs.Address,
        pending_treasury: bcs.option(PendingTreasuryChange),
        version: bcs.u16()
    } });
export interface ProtocolTreasuryArguments {
    registry: RawTransactionArgument<string>;
}
export interface ProtocolTreasuryOptions {
    package?: string;
    arguments: ProtocolTreasuryArguments | [
        registry: RawTransactionArgument<string>
    ];
}
export function protocolTreasury(options: ProtocolTreasuryOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'registry',
        function: 'protocol_treasury',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ProposeTreasuryChangeArguments {
    registry: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    newTreasury: RawTransactionArgument<string>;
}
export interface ProposeTreasuryChangeOptions {
    package?: string;
    arguments: ProposeTreasuryChangeArguments | [
        registry: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        newTreasury: RawTransactionArgument<string>
    ];
}
export function proposeTreasuryChange(options: ProposeTreasuryChangeOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        'address',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "Cap", "newTreasury"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'registry',
        function: 'propose_treasury_change',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AcceptTreasuryChangeArguments {
    registry: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
}
export interface AcceptTreasuryChangeOptions {
    package?: string;
    arguments: AcceptTreasuryChangeArguments | [
        registry: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>
    ];
}
export function acceptTreasuryChange(options: AcceptTreasuryChangeOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "Cap"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'registry',
        function: 'accept_treasury_change',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CancelTreasuryChangeArguments {
    registry: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
}
export interface CancelTreasuryChangeOptions {
    package?: string;
    arguments: CancelTreasuryChangeArguments | [
        registry: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>
    ];
}
export function cancelTreasuryChange(options: CancelTreasuryChangeOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "Cap"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'registry',
        function: 'cancel_treasury_change',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}