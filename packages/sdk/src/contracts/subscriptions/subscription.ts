/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * `subscriptions::subscription` — Subscription lifecycle and record keeping.
 * 
 * Manages the `Subscription` struct which is embedded in the
 * `SubscriptionAccount`. Keeps track of the billing schedule, failures, and
 * active/paused/cancelled status.
 */

import { MoveStruct, normalizeMoveArguments } from '../utils/index.js';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
const $moduleName = '@local-pkg/subscriptions::subscription';
export const Subscription = new MoveStruct({ name: `${$moduleName}::Subscription`, fields: {
        platform_id: bcs.Address,
        tier_index: bcs.u64(),
        tier_amount: bcs.u64(),
        tier_frequency_ms: bcs.u64(),
        status: bcs.u8(),
        schedule_frequency_ms: bcs.u64(),
        next_billing_time: bcs.u64(),
        last_billing_time: bcs.u64(),
        total_paid: bcs.u64(),
        payment_count: bcs.u64(),
        last_attempt_time: bcs.u64(),
        attempt_count: bcs.u8(),
        max_attempts: bcs.u8(),
        nonce: bcs.u64(),
        created_at: bcs.u64(),
        updated_at: bcs.u64()
    } });
export const SubscriptionCreated = new MoveStruct({ name: `${$moduleName}::SubscriptionCreated`, fields: {
        account_id: bcs.Address,
        platform_id: bcs.Address,
        tier_index: bcs.u64(),
        tier_amount: bcs.u64(),
        tier_frequency_ms: bcs.u64(),
        v: bcs.u16()
    } });
export const SubscriptionUpdated = new MoveStruct({ name: `${$moduleName}::SubscriptionUpdated`, fields: {
        account_id: bcs.Address,
        platform_id: bcs.Address,
        change_kind: bcs.u8(),
        v: bcs.u16()
    } });
export const PaymentRecorded = new MoveStruct({ name: `${$moduleName}::PaymentRecorded`, fields: {
        account_id: bcs.Address,
        platform_id: bcs.Address,
        amount: bcs.u64(),
        new_total_paid: bcs.u64(),
        new_payment_count: bcs.u64(),
        nonce: bcs.u64(),
        v: bcs.u16()
    } });
export const FailedPaymentRecorded = new MoveStruct({ name: `${$moduleName}::FailedPaymentRecorded`, fields: {
        account_id: bcs.Address,
        platform_id: bcs.Address,
        amount: bcs.u64(),
        reason: bcs.u64(),
        v: bcs.u16()
    } });
export interface CanBillArguments {
    s: TransactionArgument;
}
export interface CanBillOptions {
    package?: string;
    arguments: CanBillArguments | [
        s: TransactionArgument
    ];
}
/**
 * `true` iff the subscription exists, is active (`status == 0`), and
 * `now >= next_billing_time`.
 */
export function canBill(options: CanBillOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription',
        function: 'can_bill',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PlatformIdArguments {
    s: TransactionArgument;
}
export interface PlatformIdOptions {
    package?: string;
    arguments: PlatformIdArguments | [
        s: TransactionArgument
    ];
}
export function platformId(options: PlatformIdOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription',
        function: 'platform_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TierIndexArguments {
    s: TransactionArgument;
}
export interface TierIndexOptions {
    package?: string;
    arguments: TierIndexArguments | [
        s: TransactionArgument
    ];
}
export function tierIndex(options: TierIndexOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription',
        function: 'tier_index',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TierAmountArguments {
    s: TransactionArgument;
}
export interface TierAmountOptions {
    package?: string;
    arguments: TierAmountArguments | [
        s: TransactionArgument
    ];
}
export function tierAmount(options: TierAmountOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription',
        function: 'tier_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TierFrequencyMsArguments {
    s: TransactionArgument;
}
export interface TierFrequencyMsOptions {
    package?: string;
    arguments: TierFrequencyMsArguments | [
        s: TransactionArgument
    ];
}
export function tierFrequencyMs(options: TierFrequencyMsOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription',
        function: 'tier_frequency_ms',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface StatusArguments {
    s: TransactionArgument;
}
export interface StatusOptions {
    package?: string;
    arguments: StatusArguments | [
        s: TransactionArgument
    ];
}
export function status(options: StatusOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription',
        function: 'status',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsActiveArguments {
    s: TransactionArgument;
}
export interface IsActiveOptions {
    package?: string;
    arguments: IsActiveArguments | [
        s: TransactionArgument
    ];
}
export function isActive(options: IsActiveOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription',
        function: 'is_active',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsPausedArguments {
    s: TransactionArgument;
}
export interface IsPausedOptions {
    package?: string;
    arguments: IsPausedArguments | [
        s: TransactionArgument
    ];
}
export function isPaused(options: IsPausedOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription',
        function: 'is_paused',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsCancelledArguments {
    s: TransactionArgument;
}
export interface IsCancelledOptions {
    package?: string;
    arguments: IsCancelledArguments | [
        s: TransactionArgument
    ];
}
export function isCancelled(options: IsCancelledOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription',
        function: 'is_cancelled',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ScheduleFrequencyMsArguments {
    s: TransactionArgument;
}
export interface ScheduleFrequencyMsOptions {
    package?: string;
    arguments: ScheduleFrequencyMsArguments | [
        s: TransactionArgument
    ];
}
export function scheduleFrequencyMs(options: ScheduleFrequencyMsOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription',
        function: 'schedule_frequency_ms',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface NextBillingTimeArguments {
    s: TransactionArgument;
}
export interface NextBillingTimeOptions {
    package?: string;
    arguments: NextBillingTimeArguments | [
        s: TransactionArgument
    ];
}
export function nextBillingTime(options: NextBillingTimeOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription',
        function: 'next_billing_time',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface LastBillingTimeArguments {
    s: TransactionArgument;
}
export interface LastBillingTimeOptions {
    package?: string;
    arguments: LastBillingTimeArguments | [
        s: TransactionArgument
    ];
}
export function lastBillingTime(options: LastBillingTimeOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription',
        function: 'last_billing_time',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TotalPaidArguments {
    s: TransactionArgument;
}
export interface TotalPaidOptions {
    package?: string;
    arguments: TotalPaidArguments | [
        s: TransactionArgument
    ];
}
export function totalPaid(options: TotalPaidOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription',
        function: 'total_paid',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PaymentCountArguments {
    s: TransactionArgument;
}
export interface PaymentCountOptions {
    package?: string;
    arguments: PaymentCountArguments | [
        s: TransactionArgument
    ];
}
export function paymentCount(options: PaymentCountOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription',
        function: 'payment_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface LastAttemptTimeArguments {
    s: TransactionArgument;
}
export interface LastAttemptTimeOptions {
    package?: string;
    arguments: LastAttemptTimeArguments | [
        s: TransactionArgument
    ];
}
export function lastAttemptTime(options: LastAttemptTimeOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription',
        function: 'last_attempt_time',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AttemptCountArguments {
    s: TransactionArgument;
}
export interface AttemptCountOptions {
    package?: string;
    arguments: AttemptCountArguments | [
        s: TransactionArgument
    ];
}
export function attemptCount(options: AttemptCountOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription',
        function: 'attempt_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MaxAttemptsArguments {
    s: TransactionArgument;
}
export interface MaxAttemptsOptions {
    package?: string;
    arguments: MaxAttemptsArguments | [
        s: TransactionArgument
    ];
}
export function maxAttempts(options: MaxAttemptsOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription',
        function: 'max_attempts',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface NonceArguments {
    s: TransactionArgument;
}
export interface NonceOptions {
    package?: string;
    arguments: NonceArguments | [
        s: TransactionArgument
    ];
}
export function nonce(options: NonceOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription',
        function: 'nonce',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CreatedAtArguments {
    s: TransactionArgument;
}
export interface CreatedAtOptions {
    package?: string;
    arguments: CreatedAtArguments | [
        s: TransactionArgument
    ];
}
export function createdAt(options: CreatedAtOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription',
        function: 'created_at',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UpdatedAtArguments {
    s: TransactionArgument;
}
export interface UpdatedAtOptions {
    package?: string;
    arguments: UpdatedAtArguments | [
        s: TransactionArgument
    ];
}
export function updatedAt(options: UpdatedAtOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription',
        function: 'updated_at',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}