/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * `subscriptions::scheduler` — the on-chain, permissionless payment scheduler.
 * 
 * Per architecture §5.6, §6.9, §7.3: the scheduler is the single entry point that
 * lets **anyone** trigger a due payment. The off-chain indexer that previously
 * signed payments with `SCHEDULER_SECRET` (v1) is gone; v2's indexer is read-only.
 * 
 * ## Authority model
 * 
 * `process_due_payment` is **permissionless**: any caller can submit. The function
 * is gated by:
 * 
 * 1.  The global pause flag (a kill switch flipped by `pause` / `unpause`;
 *     production hardening will gate these behind
 *     `Auth<PLATFORM_GLOBAL_ADMIN_ROLE>`).
 * 2.  The platform's `PLATFORM_SCHEDULER_ROLE` grant and the per-subscription
 *     schedule — both enforced downstream in `payment::process_due_payment`.
 * 
 * The platform's role check is **deferred to a future hardening pass** (the role
 * is declared in `access_control.move` but the per-Platform `AccessControl<AC>` is
 * not yet wired in; see `account.move` and `platform.move` for the bootstrap admin
 * pattern).
 * 
 * ## `pause` / `unpause`
 * 
 * v2 ships `pause` and `unpause` **without an auth check** so any caller can flip
 * the kill switch in an emergency. This is intentional: a v2.1 hardening pass will
 * replace the `_ctx:&mut TxContext` placeholder with a multisig / OZ
 * `Auth<PLATFORM_GLOBAL_ADMIN_ROLE>` check, matching the role declared in
 * `access_control.move` §6.2.
 * 
 * ## Error code range
 * 
 * 0x0A\_\_ per the project convention; see `account.move`, `payment.move`, and
 * `platform.move` for sibling ranges.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.js';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
const $moduleName = '@local-pkg/subscriptions::scheduler';
export const SchedulerPaused = new MoveStruct({ name: `${$moduleName}::SchedulerPaused`, fields: {
        paused_by: bcs.Address,
        v: bcs.u16()
    } });
export const SchedulerResumed = new MoveStruct({ name: `${$moduleName}::SchedulerResumed`, fields: {
        resumed_by: bcs.Address,
        v: bcs.u16()
    } });
export const DuePaymentSubmitted = new MoveStruct({ name: `${$moduleName}::DuePaymentSubmitted`, fields: {
        account_id: bcs.Address,
        platform_id: bcs.Address,
        submitted_by: bcs.Address,
        v: bcs.u16()
    } });
export const PaymentScheduler = new MoveStruct({ name: `${$moduleName}::PaymentScheduler`, fields: {
        id: bcs.Address,
        /**
         * Emergency kill switch. Flipped by `pause` / `unpause`. v2: any caller; v2.1:
         * `Auth<PLATFORM_GLOBAL_ADMIN_ROLE>`.
         */
        pause_flag: bcs.bool(),
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
    scheduler: RawTransactionArgument<string>;
    platform: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
    policyLimiters: TransactionArgument;
}
export interface ProcessDuePaymentOptions {
    package?: string;
    arguments: ProcessDuePaymentArguments | [
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
 * global pause flag and the downstream checks in `payment::process_due_payment`
 * (schedule, denomination, amount, per-platform rate limiters, per-account policy
 * eval).
 *
 * Steps (architecture §6.9):
 *
 * 1. `!pause_flag` (else `ESchedulerPaused`).
 * 2. Delegate to `payment::process_due_payment` (which runs the 12-step billing
 *    flow per architecture §6.8).
 * 3. Stamp `last_processed_at = clock.timestamp_ms()`.
 * 4. Emit `DuePaymentSubmitted` with the post-state ids and the gas-paying sender.
 *
 * The returned `Coin<T>` is a zero-value coin (see `payment.move` for the
 * forward-compat rationale); the caller discards it. The scheduler is shared, so
 * PTBs can compose `process_due_payment` with downstream transfer / split steps (a
 * future variant) by binding the return.
 *
 * #### Aborts
 *
 * - `ESchedulerPaused` if `pause_flag == true`.
 * - Any abort from `payment::process_due_payment` (e.g. `ENotDue`,
 *   `EPolicyViolation`, `EInsufficientBalance`).
 */
export function processDuePayment(options: ProcessDuePaymentOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["scheduler", "platform", "account", "policyLimiters"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'scheduler',
        function: 'process_due_payment',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PauseArguments {
    scheduler: RawTransactionArgument<string>;
}
export interface PauseOptions {
    package?: string;
    arguments: PauseArguments | [
        scheduler: RawTransactionArgument<string>
    ];
}
/**
 * Flip the kill switch to `true`. While paused, every `process_due_payment` aborts
 * with `ESchedulerPaused`.
 *
 * v2: any caller can pause — this is the emergency kill switch and is
 * intentionally open. v2.1 will replace `_ctx` with an
 * `Auth<PLATFORM_GLOBAL_ADMIN_ROLE>` check, matching the role declared in
 * `access_control.move` §6.2.
 *
 * Emits `SchedulerPaused`. Idempotent: pausing an already-paused scheduler
 * re-emits the event (the on-chain record is append-only, which is the right shape
 * for audit trails).
 */
export function pause(options: PauseOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["scheduler"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'scheduler',
        function: 'pause',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UnpauseArguments {
    scheduler: RawTransactionArgument<string>;
}
export interface UnpauseOptions {
    package?: string;
    arguments: UnpauseArguments | [
        scheduler: RawTransactionArgument<string>
    ];
}
/**
 * Flip the kill switch back to `false`. Idempotent: resuming an already-resumed
 * scheduler re-emits the event (same audit rationale as `pause`).
 *
 * v2: any caller. v2.1: multisig-only, see `pause` doc.
 */
export function unpause(options: UnpauseOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["scheduler"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'scheduler',
        function: 'unpause',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsPausedArguments {
    scheduler: RawTransactionArgument<string>;
}
export interface IsPausedOptions {
    package?: string;
    arguments: IsPausedArguments | [
        scheduler: RawTransactionArgument<string>
    ];
}
/**
 * `true` iff the scheduler is currently paused. Read-only view; safe to call from
 * any context.
 */
export function isPaused(options: IsPausedOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["scheduler"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'scheduler',
        function: 'is_paused',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
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