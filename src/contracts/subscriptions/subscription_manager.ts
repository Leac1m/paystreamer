/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Subscription manager module: subscription lifecycle management, child object
 * creation, and billing operations.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.js';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
const $moduleName = '@local-pkg/subscriptions::subscription_manager';
export const SubscriptionCreated = new MoveStruct({ name: `${$moduleName}::SubscriptionCreated`, fields: {
        account_id: bcs.Address,
        platform_id: bcs.Address,
        tier_index: bcs.u64(),
        timestamp: bcs.u64()
    } });
export const SubscriptionUpdated = new MoveStruct({ name: `${$moduleName}::SubscriptionUpdated`, fields: {
        account_id: bcs.Address,
        platform_id: bcs.Address,
        changes: bcs.u8(),
        timestamp: bcs.u64()
    } });
export const SubscriptionPaused = new MoveStruct({ name: `${$moduleName}::SubscriptionPaused`, fields: {
        account_id: bcs.Address,
        platform_id: bcs.Address,
        timestamp: bcs.u64()
    } });
export const SubscriptionResumed = new MoveStruct({ name: `${$moduleName}::SubscriptionResumed`, fields: {
        account_id: bcs.Address,
        platform_id: bcs.Address,
        timestamp: bcs.u64()
    } });
export const SubscriptionCancelled = new MoveStruct({ name: `${$moduleName}::SubscriptionCancelled`, fields: {
        account_id: bcs.Address,
        platform_id: bcs.Address,
        timestamp: bcs.u64()
    } });
export const FailedPaymentRecorded = new MoveStruct({ name: `${$moduleName}::FailedPaymentRecorded`, fields: {
        account_id: bcs.Address,
        platform_id: bcs.Address,
        amount: bcs.u64(),
        reason: bcs.u64(),
        timestamp: bcs.u64()
    } });
export interface CreateSubscriptionArguments {
    accountCap: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
    platform: RawTransactionArgument<string>;
    tierIndex: RawTransactionArgument<number | bigint>;
}
export interface CreateSubscriptionOptions {
    package?: string;
    arguments: CreateSubscriptionArguments | [
        accountCap: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>,
        platform: RawTransactionArgument<string>,
        tierIndex: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Creates and authorizes a subscription in one step. Subscription is embedded
 * directly in the account's VecMap.
 */
export function createSubscription(options: CreateSubscriptionOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        null,
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["accountCap", "account", "platform", "tierIndex"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_manager',
        function: 'create_subscription',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UpdateSubscriptionTierArguments {
    accountCap: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
    newTierIndex: RawTransactionArgument<number | bigint>;
}
export interface UpdateSubscriptionTierOptions {
    package?: string;
    arguments: UpdateSubscriptionTierArguments | [
        accountCap: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>,
        newTierIndex: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/** Updates subscription tier. */
export function updateSubscriptionTier(options: UpdateSubscriptionTierOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["accountCap", "account", "platformId", "newTierIndex"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_manager',
        function: 'update_subscription_tier',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PauseSubscriptionArguments {
    accountCap: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
}
export interface PauseSubscriptionOptions {
    package?: string;
    arguments: PauseSubscriptionArguments | [
        accountCap: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Pauses an active subscription. */
export function pauseSubscription(options: PauseSubscriptionOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["accountCap", "account", "platformId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_manager',
        function: 'pause_subscription',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ResumeSubscriptionArguments {
    accountCap: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
}
export interface ResumeSubscriptionOptions {
    package?: string;
    arguments: ResumeSubscriptionArguments | [
        accountCap: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Resumes a paused subscription. */
export function resumeSubscription(options: ResumeSubscriptionOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["accountCap", "account", "platformId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_manager',
        function: 'resume_subscription',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CancelSubscriptionArguments {
    accountCap: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
}
export interface CancelSubscriptionOptions {
    package?: string;
    arguments: CancelSubscriptionArguments | [
        accountCap: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Cancels a subscription immediately. */
export function cancelSubscription(options: CancelSubscriptionOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["accountCap", "account", "platformId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_manager',
        function: 'cancel_subscription',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RecordFailedPaymentArguments {
    accountCap: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
    reason: RawTransactionArgument<number | bigint>;
}
export interface RecordFailedPaymentOptions {
    package?: string;
    arguments: RecordFailedPaymentArguments | [
        accountCap: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint>,
        reason: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/** Records a failed payment attempt (called by platform on failure). */
export function recordFailedPayment(options: RecordFailedPaymentOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        'u64',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["accountCap", "account", "platformId", "amount", "reason"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_manager',
        function: 'record_failed_payment',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface GetScheduleArguments {
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
}
export interface GetScheduleOptions {
    package?: string;
    arguments: GetScheduleArguments | [
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function getSchedule(options: GetScheduleOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["account", "platformId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_manager',
        function: 'get_schedule',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface GetSubscriptionInfoArguments {
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
}
export interface GetSubscriptionInfoOptions {
    package?: string;
    arguments: GetSubscriptionInfoArguments | [
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function getSubscriptionInfo(options: GetSubscriptionInfoOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["account", "platformId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_manager',
        function: 'get_subscription_info',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface IsActiveArguments {
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
}
export interface IsActiveOptions {
    package?: string;
    arguments: IsActiveArguments | [
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function isActive(options: IsActiveOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["account", "platformId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_manager',
        function: 'is_active',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CanBillArguments {
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
}
export interface CanBillOptions {
    package?: string;
    arguments: CanBillArguments | [
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function canBill(options: CanBillOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["account", "platformId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_manager',
        function: 'can_bill',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}