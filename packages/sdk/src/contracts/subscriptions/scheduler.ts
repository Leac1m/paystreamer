/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * `subscriptions::scheduler` — the permissionless payment scheduler.
 * 
 * This module provides the entry points for external callers (schedulers) to
 * trigger due payments.
 * 
 * ## Authority model
 * 
 * Scheduling functions are **permissionless**: any caller can submit a PTB calling
 * `process_due_payment` or the routed payment flow. The functions rely on the
 * underlying `payment` module to enforce subscription schedules, policies, and
 * circuit breakers.
 * 
 * Schedulers are incentivized with a 1% protocol fee for successful executions.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.js';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
const $moduleName = '@local-pkg/subscriptions::scheduler';
export const DuePaymentSubmitted = new MoveStruct({ name: `${$moduleName}::DuePaymentSubmitted`, fields: {
        account_id: bcs.Address,
        platform_id: bcs.Address,
        submitted_by: bcs.Address,
        v: bcs.u16()
    } });
export const PaymentScheduler = new MoveStruct({ name: `${$moduleName}::PaymentScheduler`, fields: {
        id: bcs.Address,
        /**
         * Timestamp (ms) of the most recent successful `process_due_payment`. Useful for
         * off-chain indexers that want to detect a stalled scheduler.
         */
        last_processed_at: bcs.u64(),
        /** Schema version (currently `2`). */
        version: bcs.u16()
    } });
export const SCHEDULER = new MoveStruct({ name: `${$moduleName}::SCHEDULER`, fields: {
        dummy_field: bcs.bool()
    } });
export interface ProcessDuePaymentArguments {
    registry: RawTransactionArgument<string>;
    scheduler: RawTransactionArgument<string>;
    platform: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
    policyLimiters: TransactionArgument;
}
export interface ProcessDuePaymentOptions {
    package?: string;
    arguments: ProcessDuePaymentArguments | [
        registry: RawTransactionArgument<string>,
        scheduler: RawTransactionArgument<string>,
        platform: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>,
        policyLimiters: TransactionArgument
    ];
    typeArguments: [
        string
    ];
}
/**
 * Permissionless entry point. Anyone can call this; the function is gated by the
 * downstream checks in `payment::process_due_payment` (schedule, amount,
 * per-platform rate limiters, per-account policy eval).
 *
 * 1. Delegate to `payment::process_due_payment` (which runs the address-balance
 *    payment flow).
 * 2. Stamp `last_processed_at = clock.timestamp_ms()`.
 * 3. Emit `DuePaymentSubmitted` with the post-state ids and the gas-paying sender.
 *
 * #### Aborts
 *
 * - Any abort from `payment::process_due_payment` (e.g. `ENotDue`,
 *   `EPolicyViolation`, `EZeroAmount`).
 */
export function processDuePayment(options: ProcessDuePaymentOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "scheduler", "platform", "account", "policyLimiters"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'scheduler',
        function: 'process_due_payment',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface WithdrawForRouteArguments {
    Scheduler: RawTransactionArgument<string>;
    platform: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
    policyLimiters: TransactionArgument;
    maxSpend: RawTransactionArgument<number | bigint>;
}
export interface WithdrawForRouteOptions {
    package?: string;
    arguments: WithdrawForRouteArguments | [
        Scheduler: RawTransactionArgument<string>,
        platform: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>,
        policyLimiters: TransactionArgument,
        maxSpend: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Step 1 of a routed payment. The scheduler withdraws `max_spend` of `FundingCoin`
 * to perform an off-chain or DEX swap into `PlatformCoin`.
 */
export function withdrawForRoute(options: WithdrawForRouteOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        '0x2::clock::Clock',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["Scheduler", "platform", "account", "policyLimiters", "maxSpend"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'scheduler',
        function: 'withdraw_for_route',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ProcessRoutedPaymentArguments {
    registry: RawTransactionArgument<string>;
    scheduler: RawTransactionArgument<string>;
    potato: TransactionArgument;
    platform: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
    coin: RawTransactionArgument<string>;
    change: RawTransactionArgument<string>;
}
export interface ProcessRoutedPaymentOptions {
    package?: string;
    arguments: ProcessRoutedPaymentArguments | [
        registry: RawTransactionArgument<string>,
        scheduler: RawTransactionArgument<string>,
        potato: TransactionArgument,
        platform: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>,
        coin: RawTransactionArgument<string>,
        change: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Step 2 of a routed payment. The scheduler consumes the `RoutingPotato` and
 * settles the payment by providing the `Coin<PlatformCoin>` and returning any
 * unspent `FundingCoin` change.
 */
export function processRoutedPayment(options: ProcessRoutedPaymentOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "scheduler", "potato", "platform", "account", "coin", "change"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'scheduler',
        function: 'process_routed_payment',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface LastProcessedAtArguments {
    scheduler: RawTransactionArgument<string>;
}
export interface LastProcessedAtOptions {
    package?: string;
    arguments: LastProcessedAtArguments | [
        scheduler: RawTransactionArgument<string>
    ];
}
/**
 * Timestamp (ms) of the most recent successful `process_due_payment`. `0` if no
 * payment has ever been processed by this scheduler. Off-chain indexers use this
 * to detect a stalled scheduler (e.g. a missing automated submitter).
 */
export function lastProcessedAt(options: LastProcessedAtOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["scheduler"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'scheduler',
        function: 'last_processed_at',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface VersionArguments {
    scheduler: RawTransactionArgument<string>;
}
export interface VersionOptions {
    package?: string;
    arguments: VersionArguments | [
        scheduler: RawTransactionArgument<string>
    ];
}
/** Schema version. Currently `2`. */
export function version(options: VersionOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["scheduler"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'scheduler',
        function: 'version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}