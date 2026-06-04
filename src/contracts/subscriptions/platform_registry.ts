/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Platform registry module: platform registration, tier management, and withdrawal
 * operations for the subscription system.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.js';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
const $moduleName = '@local-pkg/subscriptions::platform_registry';
export const PlatformStatus = new MoveStruct({ name: `${$moduleName}::PlatformStatus`, fields: {
        variant: bcs.u8()
    } });
export const BillingFrequency = new MoveStruct({ name: `${$moduleName}::BillingFrequency`, fields: {
        variant: bcs.u8(),
        custom_ms: bcs.u64()
    } });
export const SubscriptionTier = new MoveStruct({ name: `${$moduleName}::SubscriptionTier`, fields: {
        name: bcs.string(),
        amount: bcs.u64(),
        frequency: BillingFrequency,
        is_active: bcs.bool()
    } });
export const Platform = new MoveStruct({ name: `${$moduleName}::Platform`, fields: {
        id: bcs.Address,
        owner: bcs.Address,
        treasury: bcs.Address,
        name: bcs.string(),
        description: bcs.string(),
        category: bcs.string(),
        webhook_url: bcs.option(bcs.string()),
        is_verified: bcs.bool(),
        subscriber_count: bcs.u64(),
        created_at: bcs.u64(),
        status: PlatformStatus,
        tiers: bcs.vector(SubscriptionTier)
    } });
export const PlatformOwnerCap = new MoveStruct({ name: `${$moduleName}::PlatformOwnerCap`, fields: {
        id: bcs.Address,
        platform_id: bcs.Address,
        created_at: bcs.u64()
    } });
export const SchedulerCap = new MoveStruct({ name: `${$moduleName}::SchedulerCap`, fields: {
        id: bcs.Address,
        platform_id: bcs.Address,
        created_at: bcs.u64()
    } });
export const PlatformRegistered = new MoveStruct({ name: `${$moduleName}::PlatformRegistered`, fields: {
        platform_id: bcs.Address,
        owner: bcs.Address,
        name: bcs.string(),
        category: bcs.string(),
        timestamp: bcs.u64()
    } });
export const PlatformUpdated = new MoveStruct({ name: `${$moduleName}::PlatformUpdated`, fields: {
        platform_id: bcs.Address,
        updated_by: bcs.Address,
        timestamp: bcs.u64()
    } });
export const TierCreated = new MoveStruct({ name: `${$moduleName}::TierCreated`, fields: {
        platform_id: bcs.Address,
        tier_index: bcs.u64(),
        tier_name: bcs.string(),
        amount: bcs.u64(),
        frequency: bcs.u8(),
        timestamp: bcs.u64()
    } });
export const TierUpdated = new MoveStruct({ name: `${$moduleName}::TierUpdated`, fields: {
        platform_id: bcs.Address,
        tier_index: bcs.u64(),
        changes: bcs.string(),
        timestamp: bcs.u64()
    } });
export const TierRemoved = new MoveStruct({ name: `${$moduleName}::TierRemoved`, fields: {
        platform_id: bcs.Address,
        tier_index: bcs.u64(),
        timestamp: bcs.u64()
    } });
export const WithdrawalProcessed = new MoveStruct({ name: `${$moduleName}::WithdrawalProcessed`, fields: {
        platform_id: bcs.Address,
        account_id: bcs.Address,
        amount: bcs.u64(),
        success: bcs.bool(),
        timestamp: bcs.u64()
    } });
export interface PlatformStatusActiveOptions {
    package?: string;
    arguments?: [
    ];
}
export function platformStatusActive(options: PlatformStatusActiveOptions = {}) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'platform_status_active',
    });
}
export interface PlatformStatusSuspendedOptions {
    package?: string;
    arguments?: [
    ];
}
export function platformStatusSuspended(options: PlatformStatusSuspendedOptions = {}) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'platform_status_suspended',
    });
}
export interface PlatformStatusDeprecatedOptions {
    package?: string;
    arguments?: [
    ];
}
export function platformStatusDeprecated(options: PlatformStatusDeprecatedOptions = {}) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'platform_status_deprecated',
    });
}
export interface PlatformStatusVariantArguments {
    s: TransactionArgument;
}
export interface PlatformStatusVariantOptions {
    package?: string;
    arguments: PlatformStatusVariantArguments | [
        s: TransactionArgument
    ];
}
export function platformStatusVariant(options: PlatformStatusVariantOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'platform_status_variant',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BillingFrequencyDailyOptions {
    package?: string;
    arguments?: [
    ];
}
export function billingFrequencyDaily(options: BillingFrequencyDailyOptions = {}) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'billing_frequency_daily',
    });
}
export interface BillingFrequencyWeeklyOptions {
    package?: string;
    arguments?: [
    ];
}
export function billingFrequencyWeekly(options: BillingFrequencyWeeklyOptions = {}) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'billing_frequency_weekly',
    });
}
export interface BillingFrequencyMonthlyOptions {
    package?: string;
    arguments?: [
    ];
}
export function billingFrequencyMonthly(options: BillingFrequencyMonthlyOptions = {}) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'billing_frequency_monthly',
    });
}
export interface BillingFrequencyYearlyOptions {
    package?: string;
    arguments?: [
    ];
}
export function billingFrequencyYearly(options: BillingFrequencyYearlyOptions = {}) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'billing_frequency_yearly',
    });
}
export interface BillingFrequencyCustomArguments {
    customMs: RawTransactionArgument<number | bigint>;
}
export interface BillingFrequencyCustomOptions {
    package?: string;
    arguments: BillingFrequencyCustomArguments | [
        customMs: RawTransactionArgument<number | bigint>
    ];
}
export function billingFrequencyCustom(options: BillingFrequencyCustomOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["customMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'billing_frequency_custom',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BillingFrequencyVariantArguments {
    f: TransactionArgument;
}
export interface BillingFrequencyVariantOptions {
    package?: string;
    arguments: BillingFrequencyVariantArguments | [
        f: TransactionArgument
    ];
}
export function billingFrequencyVariant(options: BillingFrequencyVariantOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["f"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'billing_frequency_variant',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BillingFrequencyCustomMsArguments {
    f: TransactionArgument;
}
export interface BillingFrequencyCustomMsOptions {
    package?: string;
    arguments: BillingFrequencyCustomMsArguments | [
        f: TransactionArgument
    ];
}
export function billingFrequencyCustomMs(options: BillingFrequencyCustomMsOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["f"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'billing_frequency_custom_ms',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RegisterPlatformArguments {
    name: RawTransactionArgument<string>;
    description: RawTransactionArgument<string>;
    category: RawTransactionArgument<string>;
    webhookUrl: RawTransactionArgument<string | null>;
}
export interface RegisterPlatformOptions {
    package?: string;
    arguments: RegisterPlatformArguments | [
        name: RawTransactionArgument<string>,
        description: RawTransactionArgument<string>,
        category: RawTransactionArgument<string>,
        webhookUrl: RawTransactionArgument<string | null>
    ];
}
/**
 * Registers a new platform with the subscription system. The registering address
 * becomes the platform owner.
 */
export function registerPlatform(options: RegisterPlatformOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        '0x1::string::String',
        '0x1::string::String',
        '0x1::string::String',
        '0x1::option::Option<0x1::string::String>'
    ] satisfies (string | null)[];
    const parameterNames = ["name", "description", "category", "webhookUrl"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'register_platform',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UpdatePlatformArguments {
    ownerCap: RawTransactionArgument<string>;
    platform: RawTransactionArgument<string>;
    name: RawTransactionArgument<string | null>;
    description: RawTransactionArgument<string | null>;
    webhookUrl: RawTransactionArgument<string | null>;
}
export interface UpdatePlatformOptions {
    package?: string;
    arguments: UpdatePlatformArguments | [
        ownerCap: RawTransactionArgument<string>,
        platform: RawTransactionArgument<string>,
        name: RawTransactionArgument<string | null>,
        description: RawTransactionArgument<string | null>,
        webhookUrl: RawTransactionArgument<string | null>
    ];
}
/** Updates platform metadata (owner only). */
export function updatePlatform(options: UpdatePlatformOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        '0x1::option::Option<0x1::string::String>',
        '0x1::option::Option<0x1::string::String>',
        '0x1::option::Option<0x1::string::String>'
    ] satisfies (string | null)[];
    const parameterNames = ["ownerCap", "platform", "name", "description", "webhookUrl"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'update_platform',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetVerifiedArguments {
    ownerCap: RawTransactionArgument<string>;
    platform: RawTransactionArgument<string>;
    verified: RawTransactionArgument<boolean>;
}
export interface SetVerifiedOptions {
    package?: string;
    arguments: SetVerifiedArguments | [
        ownerCap: RawTransactionArgument<string>,
        platform: RawTransactionArgument<string>,
        verified: RawTransactionArgument<boolean>
    ];
}
/** Updates platform verification status (owner only). */
export function setVerified(options: SetVerifiedOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        'bool'
    ] satisfies (string | null)[];
    const parameterNames = ["ownerCap", "platform", "verified"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'set_verified',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UpdateTreasuryArguments {
    ownerCap: RawTransactionArgument<string>;
    platform: RawTransactionArgument<string>;
    newTreasury: RawTransactionArgument<string>;
}
export interface UpdateTreasuryOptions {
    package?: string;
    arguments: UpdateTreasuryArguments | [
        ownerCap: RawTransactionArgument<string>,
        platform: RawTransactionArgument<string>,
        newTreasury: RawTransactionArgument<string>
    ];
}
/** Updates platform treasury address (owner only). */
export function updateTreasury(options: UpdateTreasuryOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["ownerCap", "platform", "newTreasury"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'update_treasury',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MintSchedulerCapArguments {
    ownerCap: RawTransactionArgument<string>;
    platform: RawTransactionArgument<string>;
}
export interface MintSchedulerCapOptions {
    package?: string;
    arguments: MintSchedulerCapArguments | [
        ownerCap: RawTransactionArgument<string>,
        platform: RawTransactionArgument<string>
    ];
}
/** Mints a new SchedulerCap for automated withdrawals. */
export function mintSchedulerCap(options: MintSchedulerCapOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["ownerCap", "platform"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'mint_scheduler_cap',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CreateTierArguments {
    ownerCap: RawTransactionArgument<string>;
    platform: RawTransactionArgument<string>;
    name: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
    frequency: TransactionArgument;
}
export interface CreateTierOptions {
    package?: string;
    arguments: CreateTierArguments | [
        ownerCap: RawTransactionArgument<string>,
        platform: RawTransactionArgument<string>,
        name: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint>,
        frequency: TransactionArgument
    ];
}
export function createTier(options: CreateTierOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String',
        'u64',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["ownerCap", "platform", "name", "amount", "frequency"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'create_tier',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UpdateTierArguments {
    ownerCap: RawTransactionArgument<string>;
    platform: RawTransactionArgument<string>;
    tierIndex: RawTransactionArgument<number | bigint>;
    name: RawTransactionArgument<string | null>;
    amount: RawTransactionArgument<number | bigint | null>;
    isActive: RawTransactionArgument<boolean | null>;
}
export interface UpdateTierOptions {
    package?: string;
    arguments: UpdateTierArguments | [
        ownerCap: RawTransactionArgument<string>,
        platform: RawTransactionArgument<string>,
        tierIndex: RawTransactionArgument<number | bigint>,
        name: RawTransactionArgument<string | null>,
        amount: RawTransactionArgument<number | bigint | null>,
        isActive: RawTransactionArgument<boolean | null>
    ];
}
/** Updates an existing subscription tier. */
export function updateTier(options: UpdateTierOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        'u64',
        '0x1::option::Option<0x1::string::String>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<bool>'
    ] satisfies (string | null)[];
    const parameterNames = ["ownerCap", "platform", "tierIndex", "name", "amount", "isActive"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'update_tier',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RemoveTierArguments {
    ownerCap: RawTransactionArgument<string>;
    platform: RawTransactionArgument<string>;
    tierIndex: RawTransactionArgument<number | bigint>;
}
export interface RemoveTierOptions {
    package?: string;
    arguments: RemoveTierArguments | [
        ownerCap: RawTransactionArgument<string>,
        platform: RawTransactionArgument<string>,
        tierIndex: RawTransactionArgument<number | bigint>
    ];
}
/** Removes a subscription tier. */
export function removeTier(options: RemoveTierOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["ownerCap", "platform", "tierIndex"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'remove_tier',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ProcessWithdrawalArguments {
    ownerCap: RawTransactionArgument<string>;
    platform: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
}
export interface ProcessWithdrawalOptions {
    package?: string;
    arguments: ProcessWithdrawalArguments | [
        ownerCap: RawTransactionArgument<string>,
        platform: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Processes a withdrawal from a user account. Requires a valid PlatformOwnerCap
 * for the platform. Calls subscription_account::withdraw to process the actual
 * transfer, then subscription_manager::record_payment to update billing schedule.
 */
export function processWithdrawal(options: ProcessWithdrawalOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        null,
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["ownerCap", "platform", "account", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'process_withdrawal',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BatchWithdrawArguments {
    ownerCap: RawTransactionArgument<string>;
    platform: RawTransactionArgument<string>;
    accounts: TransactionArgument;
    amounts: RawTransactionArgument<Array<number | bigint>>;
}
export interface BatchWithdrawOptions {
    package?: string;
    arguments: BatchWithdrawArguments | [
        ownerCap: RawTransactionArgument<string>,
        platform: RawTransactionArgument<string>,
        accounts: TransactionArgument,
        amounts: RawTransactionArgument<Array<number | bigint>>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Batch withdrawal processing for multiple accounts. Optimized for platform server
 * efficiency.
 */
export function batchWithdraw(options: BatchWithdrawOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        'vector<null>',
        'vector<u64>',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["ownerCap", "platform", "accounts", "amounts"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'batch_withdraw',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ProcessWithdrawalSchedulerArguments {
    schedulerCap: RawTransactionArgument<string>;
    platform: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
}
export interface ProcessWithdrawalSchedulerOptions {
    package?: string;
    arguments: ProcessWithdrawalSchedulerArguments | [
        schedulerCap: RawTransactionArgument<string>,
        platform: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/** Processes a withdrawal using a SchedulerCap. */
export function processWithdrawalScheduler(options: ProcessWithdrawalSchedulerOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        null,
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["schedulerCap", "platform", "account", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'process_withdrawal_scheduler',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BatchWithdrawSchedulerArguments {
    schedulerCap: RawTransactionArgument<string>;
    platform: RawTransactionArgument<string>;
    accounts: TransactionArgument;
    amounts: RawTransactionArgument<Array<number | bigint>>;
}
export interface BatchWithdrawSchedulerOptions {
    package?: string;
    arguments: BatchWithdrawSchedulerArguments | [
        schedulerCap: RawTransactionArgument<string>,
        platform: RawTransactionArgument<string>,
        accounts: TransactionArgument,
        amounts: RawTransactionArgument<Array<number | bigint>>
    ];
    typeArguments: [
        string
    ];
}
/** Batch withdrawal processing using a SchedulerCap. */
export function batchWithdrawScheduler(options: BatchWithdrawSchedulerOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        'vector<null>',
        'vector<u64>',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["schedulerCap", "platform", "accounts", "amounts"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'batch_withdraw_scheduler',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface GetPlatformInfoArguments {
    platform: RawTransactionArgument<string>;
}
export interface GetPlatformInfoOptions {
    package?: string;
    arguments: GetPlatformInfoArguments | [
        platform: RawTransactionArgument<string>
    ];
}
export function getPlatformInfo(options: GetPlatformInfoOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["platform"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'get_platform_info',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface GetPlatformTiersArguments {
    platform: RawTransactionArgument<string>;
}
export interface GetPlatformTiersOptions {
    package?: string;
    arguments: GetPlatformTiersArguments | [
        platform: RawTransactionArgument<string>
    ];
}
export function getPlatformTiers(options: GetPlatformTiersOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["platform"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'get_platform_tiers',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface GetTierArguments {
    platform: RawTransactionArgument<string>;
    tierIndex: RawTransactionArgument<number | bigint>;
}
export interface GetTierOptions {
    package?: string;
    arguments: GetTierArguments | [
        platform: RawTransactionArgument<string>,
        tierIndex: RawTransactionArgument<number | bigint>
    ];
}
export function getTier(options: GetTierOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["platform", "tierIndex"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'get_tier',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TierNameArguments {
    tier: TransactionArgument;
}
export interface TierNameOptions {
    package?: string;
    arguments: TierNameArguments | [
        tier: TransactionArgument
    ];
}
export function tierName(options: TierNameOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["tier"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'tier_name',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TierAmountArguments {
    tier: TransactionArgument;
}
export interface TierAmountOptions {
    package?: string;
    arguments: TierAmountArguments | [
        tier: TransactionArgument
    ];
}
export function tierAmount(options: TierAmountOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["tier"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'tier_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TierFrequencyArguments {
    tier: TransactionArgument;
}
export interface TierFrequencyOptions {
    package?: string;
    arguments: TierFrequencyArguments | [
        tier: TransactionArgument
    ];
}
export function tierFrequency(options: TierFrequencyOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["tier"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'tier_frequency',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TierIsActiveArguments {
    tier: TransactionArgument;
}
export interface TierIsActiveOptions {
    package?: string;
    arguments: TierIsActiveArguments | [
        tier: TransactionArgument
    ];
}
export function tierIsActive(options: TierIsActiveOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["tier"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'tier_is_active',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TierFrequencyVariantArguments {
    tier: TransactionArgument;
}
export interface TierFrequencyVariantOptions {
    package?: string;
    arguments: TierFrequencyVariantArguments | [
        tier: TransactionArgument
    ];
}
export function tierFrequencyVariant(options: TierFrequencyVariantOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["tier"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'tier_frequency_variant',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TierFrequencyCustomMsArguments {
    tier: TransactionArgument;
}
export interface TierFrequencyCustomMsOptions {
    package?: string;
    arguments: TierFrequencyCustomMsArguments | [
        tier: TransactionArgument
    ];
}
export function tierFrequencyCustomMs(options: TierFrequencyCustomMsOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["tier"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'tier_frequency_custom_ms',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface GetSubscriberCountArguments {
    platform: RawTransactionArgument<string>;
}
export interface GetSubscriberCountOptions {
    package?: string;
    arguments: GetSubscriberCountArguments | [
        platform: RawTransactionArgument<string>
    ];
}
export function getSubscriberCount(options: GetSubscriberCountOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["platform"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'get_subscriber_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface GetPlatformStatusArguments {
    platform: RawTransactionArgument<string>;
}
export interface GetPlatformStatusOptions {
    package?: string;
    arguments: GetPlatformStatusArguments | [
        platform: RawTransactionArgument<string>
    ];
}
export function getPlatformStatus(options: GetPlatformStatusOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["platform"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'get_platform_status',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PlatformIdArguments {
    platform: RawTransactionArgument<string>;
}
export interface PlatformIdOptions {
    package?: string;
    arguments: PlatformIdArguments | [
        platform: RawTransactionArgument<string>
    ];
}
export function platformId(options: PlatformIdOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["platform"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'platform_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PlatformOwnerAddressArguments {
    platform: RawTransactionArgument<string>;
}
export interface PlatformOwnerAddressOptions {
    package?: string;
    arguments: PlatformOwnerAddressArguments | [
        platform: RawTransactionArgument<string>
    ];
}
export function platformOwnerAddress(options: PlatformOwnerAddressOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["platform"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'platform_owner_address',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OwnerCapPlatformIdArguments {
    cap: RawTransactionArgument<string>;
}
export interface OwnerCapPlatformIdOptions {
    package?: string;
    arguments: OwnerCapPlatformIdArguments | [
        cap: RawTransactionArgument<string>
    ];
}
export function ownerCapPlatformId(options: OwnerCapPlatformIdOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["cap"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'owner_cap_platform_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SchedulerCapPlatformIdArguments {
    cap: RawTransactionArgument<string>;
}
export interface SchedulerCapPlatformIdOptions {
    package?: string;
    arguments: SchedulerCapPlatformIdArguments | [
        cap: RawTransactionArgument<string>
    ];
}
export function schedulerCapPlatformId(options: SchedulerCapPlatformIdOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["cap"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'scheduler_cap_platform_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PlatformTreasuryArguments {
    platform: RawTransactionArgument<string>;
}
export interface PlatformTreasuryOptions {
    package?: string;
    arguments: PlatformTreasuryArguments | [
        platform: RawTransactionArgument<string>
    ];
}
export function platformTreasury(options: PlatformTreasuryOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["platform"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'platform_registry',
        function: 'platform_treasury',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}