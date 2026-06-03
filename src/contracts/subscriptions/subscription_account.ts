/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * SubscriptionAccount module: core account management, balance operations, and
 * on-chain policy enforcement for stablecoin-denominated subscriptions.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.js';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
import * as balance from './deps/sui/balance.js';
import * as vec_map from './deps/sui/vec_map.js';
const $moduleName = '@local-pkg/subscriptions::subscription_account';
export const AccountStatus = new MoveStruct({ name: `${$moduleName}::AccountStatus`, fields: {
        variant: bcs.u8()
    } });
export const SubscriptionStatus = new MoveStruct({ name: `${$moduleName}::SubscriptionStatus`, fields: {
        variant: bcs.u8()
    } });
export const PolicyConfig = new MoveStruct({ name: `${$moduleName}::PolicyConfig`, fields: {
        max_monthly_withdrawal: bcs.u64(),
        max_per_transaction: bcs.u64(),
        min_balance: bcs.u64(),
        min_frequency_days: bcs.u64(),
        last_withdrawal_time: bcs.u64()
    } });
export const BillingSchedule = new MoveStruct({ name: `${$moduleName}::BillingSchedule`, fields: {
        frequency_days: bcs.u64(),
        next_billing_time: bcs.u64(),
        last_billing_time: bcs.u64()
    } });
export const Subscription = new MoveStruct({ name: `${$moduleName}::Subscription`, fields: {
        platform_id: bcs.Address,
        tier_index: bcs.u64(),
        tier_amount: bcs.u64(),
        tier_frequency_days: bcs.u64(),
        status: SubscriptionStatus,
        schedule: BillingSchedule,
        total_paid: bcs.u64(),
        payment_count: bcs.u64(),
        created_at: bcs.u64(),
        updated_at: bcs.u64()
    } });
export const SubscriptionAccount = new MoveStruct({ name: `${$moduleName}::SubscriptionAccount<phantom T>`, fields: {
        id: bcs.Address,
        balance: balance.Balance,
        policies: PolicyConfig,
        subscriptions: vec_map.VecMap(bcs.Address, Subscription),
        monthly_withdrawn: bcs.u64(),
        current_month_start: bcs.u64(),
        created_at: bcs.u64(),
        status: AccountStatus
    } });
export const AccountCap = new MoveStruct({ name: `${$moduleName}::AccountCap`, fields: {
        id: bcs.Address,
        account_id: bcs.Address,
        created_at: bcs.u64()
    } });
export const AccountCreated = new MoveStruct({ name: `${$moduleName}::AccountCreated`, fields: {
        account_id: bcs.Address,
        cap_id: bcs.Address,
        owner: bcs.Address,
        timestamp: bcs.u64()
    } });
export const Deposit = new MoveStruct({ name: `${$moduleName}::Deposit`, fields: {
        account_id: bcs.Address,
        depositor: bcs.Address,
        amount: bcs.u64(),
        new_balance: bcs.u64(),
        timestamp: bcs.u64()
    } });
export const Withdrawal = new MoveStruct({ name: `${$moduleName}::Withdrawal`, fields: {
        account_id: bcs.Address,
        platform_id: bcs.Address,
        platform_address: bcs.Address,
        amount: bcs.u64(),
        remaining_balance: bcs.u64(),
        monthly_total: bcs.u64(),
        policy_passed: bcs.vector(bcs.bool()),
        timestamp: bcs.u64()
    } });
export const PolicyUpdated = new MoveStruct({ name: `${$moduleName}::PolicyUpdated`, fields: {
        account_id: bcs.Address,
        old_max_monthly: bcs.u64(),
        new_max_monthly: bcs.u64(),
        old_max_per_tx: bcs.u64(),
        new_max_per_tx: bcs.u64(),
        old_min_balance: bcs.u64(),
        new_min_balance: bcs.u64(),
        timestamp: bcs.u64()
    } });
export const PaymentRecorded = new MoveStruct({ name: `${$moduleName}::PaymentRecorded`, fields: {
        account_id: bcs.Address,
        platform_id: bcs.Address,
        amount: bcs.u64(),
        new_total_paid: bcs.u64(),
        timestamp: bcs.u64()
    } });
export interface AccountStatusActiveOptions {
    package?: string;
    arguments?: [
    ];
}
export function accountStatusActive(options: AccountStatusActiveOptions = {}) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'account_status_active',
    });
}
export interface AccountStatusPausedOptions {
    package?: string;
    arguments?: [
    ];
}
export function accountStatusPaused(options: AccountStatusPausedOptions = {}) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'account_status_paused',
    });
}
export interface AccountStatusClosedOptions {
    package?: string;
    arguments?: [
    ];
}
export function accountStatusClosed(options: AccountStatusClosedOptions = {}) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'account_status_closed',
    });
}
export interface AccountStatusVariantArguments {
    s: TransactionArgument;
}
export interface AccountStatusVariantOptions {
    package?: string;
    arguments: AccountStatusVariantArguments | [
        s: TransactionArgument
    ];
}
export function accountStatusVariant(options: AccountStatusVariantOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'account_status_variant',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SubscriptionStatusActiveOptions {
    package?: string;
    arguments?: [
    ];
}
export function subscriptionStatusActive(options: SubscriptionStatusActiveOptions = {}) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'subscription_status_active',
    });
}
export interface SubscriptionStatusPausedOptions {
    package?: string;
    arguments?: [
    ];
}
export function subscriptionStatusPaused(options: SubscriptionStatusPausedOptions = {}) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'subscription_status_paused',
    });
}
export interface SubscriptionStatusCancelledOptions {
    package?: string;
    arguments?: [
    ];
}
export function subscriptionStatusCancelled(options: SubscriptionStatusCancelledOptions = {}) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'subscription_status_cancelled',
    });
}
export interface SubscriptionStatusVariantArguments {
    s: TransactionArgument;
}
export interface SubscriptionStatusVariantOptions {
    package?: string;
    arguments: SubscriptionStatusVariantArguments | [
        s: TransactionArgument
    ];
}
export function subscriptionStatusVariant(options: SubscriptionStatusVariantOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'subscription_status_variant',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SubscriptionStatusIsActiveArguments {
    s: TransactionArgument;
}
export interface SubscriptionStatusIsActiveOptions {
    package?: string;
    arguments: SubscriptionStatusIsActiveArguments | [
        s: TransactionArgument
    ];
}
export function subscriptionStatusIsActive(options: SubscriptionStatusIsActiveOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'subscription_status_is_active',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SubscriptionStatusIsPausedArguments {
    s: TransactionArgument;
}
export interface SubscriptionStatusIsPausedOptions {
    package?: string;
    arguments: SubscriptionStatusIsPausedArguments | [
        s: TransactionArgument
    ];
}
export function subscriptionStatusIsPaused(options: SubscriptionStatusIsPausedOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'subscription_status_is_paused',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SubscriptionStatusIsCancelledArguments {
    s: TransactionArgument;
}
export interface SubscriptionStatusIsCancelledOptions {
    package?: string;
    arguments: SubscriptionStatusIsCancelledArguments | [
        s: TransactionArgument
    ];
}
export function subscriptionStatusIsCancelled(options: SubscriptionStatusIsCancelledOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'subscription_status_is_cancelled',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountIdArguments {
    account: RawTransactionArgument<string>;
}
export interface AccountIdOptions {
    package?: string;
    arguments: AccountIdArguments | [
        account: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function accountId(options: AccountIdOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'account_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AccountBalanceArguments {
    account: RawTransactionArgument<string>;
}
export interface AccountBalanceOptions {
    package?: string;
    arguments: AccountBalanceArguments | [
        account: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function accountBalance(options: AccountBalanceOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'account_balance',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AccountStatusArguments {
    account: RawTransactionArgument<string>;
}
export interface AccountStatusOptions {
    package?: string;
    arguments: AccountStatusArguments | [
        account: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function accountStatus(options: AccountStatusOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'account_status',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AccountCreatedAtArguments {
    account: RawTransactionArgument<string>;
}
export interface AccountCreatedAtOptions {
    package?: string;
    arguments: AccountCreatedAtArguments | [
        account: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function accountCreatedAt(options: AccountCreatedAtOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'account_created_at',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AccountPoliciesArguments {
    account: RawTransactionArgument<string>;
}
export interface AccountPoliciesOptions {
    package?: string;
    arguments: AccountPoliciesArguments | [
        account: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function accountPolicies(options: AccountPoliciesOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'account_policies',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CapAccountIdArguments {
    cap: RawTransactionArgument<string>;
}
export interface CapAccountIdOptions {
    package?: string;
    arguments: CapAccountIdArguments | [
        cap: RawTransactionArgument<string>
    ];
}
export function capAccountId(options: CapAccountIdOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["cap"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'cap_account_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CreateAccountOptions {
    package?: string;
    arguments?: [
    ];
    typeArguments: [
        string
    ];
}
/**
 * Creates a new subscription account for the caller. Returns the AccountCap to the
 * transaction sender.
 */
export function createAccount(options: CreateAccountOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'create_account',
        typeArguments: options.typeArguments
    });
}
export interface DepositArguments {
    cap: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
    coin: RawTransactionArgument<string>;
}
export interface DepositOptions {
    package?: string;
    arguments: DepositArguments | [
        cap: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>,
        coin: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Deposits stablecoins into the subscription account. Requires a valid AccountCap. */
export function deposit(options: DepositOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["cap", "account", "coin"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'deposit',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface WithdrawArguments {
    platformId: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
    Recipient: RawTransactionArgument<string>;
}
export interface WithdrawOptions {
    package?: string;
    arguments: WithdrawArguments | [
        platformId: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint>,
        Recipient: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Withdraws stablecoins from the account to a specified recipient. Used by
 * platforms to collect subscription payments. Requires platform authorization via
 * platform_id (checked by caller). Enforces all policy constraints. Returns the
 * withdrawn Balance so the PTB can transfer to recipient.
 */
export function withdraw(options: WithdrawOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        '0x2::object::ID',
        null,
        'u64',
        'address',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["platformId", "account", "amount", "Recipient"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'withdraw',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UpdatePolicyArguments {
    cap: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
    newPolicies: TransactionArgument;
}
export interface UpdatePolicyOptions {
    package?: string;
    arguments: UpdatePolicyArguments | [
        cap: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>,
        newPolicies: TransactionArgument
    ];
    typeArguments: [
        string
    ];
}
/**
 * Updates the account's withdrawal policy configuration. Requires a valid
 * AccountCap.
 */
export function updatePolicy(options: UpdatePolicyOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["cap", "account", "newPolicies"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'update_policy',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface GetSubscriptionsArguments {
    account: RawTransactionArgument<string>;
}
export interface GetSubscriptionsOptions {
    package?: string;
    arguments: GetSubscriptionsArguments | [
        account: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function getSubscriptions(options: GetSubscriptionsOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'get_subscriptions',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface GetSubscriptionArguments {
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
}
export interface GetSubscriptionOptions {
    package?: string;
    arguments: GetSubscriptionArguments | [
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function getSubscription(options: GetSubscriptionOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["account", "platformId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'get_subscription',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface HasSubscriptionArguments {
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
}
export interface HasSubscriptionOptions {
    package?: string;
    arguments: HasSubscriptionArguments | [
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function hasSubscription(options: HasSubscriptionOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["account", "platformId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'has_subscription',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AddSubscriptionArguments {
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
    subscription: TransactionArgument;
}
export interface AddSubscriptionOptions {
    package?: string;
    arguments: AddSubscriptionArguments | [
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>,
        subscription: TransactionArgument
    ];
    typeArguments: [
        string
    ];
}
/** Internal: adds a subscription to the account's VecMap. */
export function addSubscription(options: AddSubscriptionOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account", "platformId", "subscription"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'add_subscription',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface GetSubscriptionMutArguments {
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
}
export interface GetSubscriptionMutOptions {
    package?: string;
    arguments: GetSubscriptionMutArguments | [
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Internal: gets a mutable reference to a subscription. */
export function getSubscriptionMut(options: GetSubscriptionMutOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["account", "platformId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'get_subscription_mut',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SubscriptionPlatformIdArguments {
    sub: TransactionArgument;
}
export interface SubscriptionPlatformIdOptions {
    package?: string;
    arguments: SubscriptionPlatformIdArguments | [
        sub: TransactionArgument
    ];
}
export function subscriptionPlatformId(options: SubscriptionPlatformIdOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["sub"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'subscription_platform_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SubscriptionTierIndexArguments {
    sub: TransactionArgument;
}
export interface SubscriptionTierIndexOptions {
    package?: string;
    arguments: SubscriptionTierIndexArguments | [
        sub: TransactionArgument
    ];
}
export function subscriptionTierIndex(options: SubscriptionTierIndexOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["sub"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'subscription_tier_index',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SubscriptionStatusArguments {
    sub: TransactionArgument;
}
export interface SubscriptionStatusOptions {
    package?: string;
    arguments: SubscriptionStatusArguments | [
        sub: TransactionArgument
    ];
}
export function subscriptionStatus(options: SubscriptionStatusOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["sub"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'subscription_status',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SubscriptionTotalPaidArguments {
    sub: TransactionArgument;
}
export interface SubscriptionTotalPaidOptions {
    package?: string;
    arguments: SubscriptionTotalPaidArguments | [
        sub: TransactionArgument
    ];
}
export function subscriptionTotalPaid(options: SubscriptionTotalPaidOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["sub"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'subscription_total_paid',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SubscriptionPaymentCountArguments {
    sub: TransactionArgument;
}
export interface SubscriptionPaymentCountOptions {
    package?: string;
    arguments: SubscriptionPaymentCountArguments | [
        sub: TransactionArgument
    ];
}
export function subscriptionPaymentCount(options: SubscriptionPaymentCountOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["sub"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'subscription_payment_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SubscriptionScheduleArguments {
    sub: TransactionArgument;
}
export interface SubscriptionScheduleOptions {
    package?: string;
    arguments: SubscriptionScheduleArguments | [
        sub: TransactionArgument
    ];
}
export function subscriptionSchedule(options: SubscriptionScheduleOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["sub"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'subscription_schedule',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BillingScheduleFrequencyDaysArguments {
    s: TransactionArgument;
}
export interface BillingScheduleFrequencyDaysOptions {
    package?: string;
    arguments: BillingScheduleFrequencyDaysArguments | [
        s: TransactionArgument
    ];
}
export function billingScheduleFrequencyDays(options: BillingScheduleFrequencyDaysOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'billing_schedule_frequency_days',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BillingScheduleNextBillingTimeArguments {
    s: TransactionArgument;
}
export interface BillingScheduleNextBillingTimeOptions {
    package?: string;
    arguments: BillingScheduleNextBillingTimeArguments | [
        s: TransactionArgument
    ];
}
export function billingScheduleNextBillingTime(options: BillingScheduleNextBillingTimeOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'billing_schedule_next_billing_time',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SubscriptionSetTierIndexArguments {
    sub: TransactionArgument;
    tierIndex: RawTransactionArgument<number | bigint>;
}
export interface SubscriptionSetTierIndexOptions {
    package?: string;
    arguments: SubscriptionSetTierIndexArguments | [
        sub: TransactionArgument,
        tierIndex: RawTransactionArgument<number | bigint>
    ];
}
export function subscriptionSetTierIndex(options: SubscriptionSetTierIndexOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["sub", "tierIndex"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'subscription_set_tier_index',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SubscriptionSetStatusArguments {
    sub: TransactionArgument;
    status: TransactionArgument;
}
export interface SubscriptionSetStatusOptions {
    package?: string;
    arguments: SubscriptionSetStatusArguments | [
        sub: TransactionArgument,
        status: TransactionArgument
    ];
}
export function subscriptionSetStatus(options: SubscriptionSetStatusOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["sub", "status"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'subscription_set_status',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SubscriptionIncTotalPaidArguments {
    sub: TransactionArgument;
    amount: RawTransactionArgument<number | bigint>;
}
export interface SubscriptionIncTotalPaidOptions {
    package?: string;
    arguments: SubscriptionIncTotalPaidArguments | [
        sub: TransactionArgument,
        amount: RawTransactionArgument<number | bigint>
    ];
}
export function subscriptionIncTotalPaid(options: SubscriptionIncTotalPaidOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["sub", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'subscription_inc_total_paid',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SubscriptionIncPaymentCountArguments {
    sub: TransactionArgument;
}
export interface SubscriptionIncPaymentCountOptions {
    package?: string;
    arguments: SubscriptionIncPaymentCountArguments | [
        sub: TransactionArgument
    ];
}
export function subscriptionIncPaymentCount(options: SubscriptionIncPaymentCountOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["sub"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'subscription_inc_payment_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SubscriptionUpdateScheduleArguments {
    sub: TransactionArgument;
    lastBillingTime: RawTransactionArgument<number | bigint>;
    nextBillingTime: RawTransactionArgument<number | bigint>;
}
export interface SubscriptionUpdateScheduleOptions {
    package?: string;
    arguments: SubscriptionUpdateScheduleArguments | [
        sub: TransactionArgument,
        lastBillingTime: RawTransactionArgument<number | bigint>,
        nextBillingTime: RawTransactionArgument<number | bigint>
    ];
}
export function subscriptionUpdateSchedule(options: SubscriptionUpdateScheduleOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["sub", "lastBillingTime", "nextBillingTime"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'subscription_update_schedule',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SubscriptionSetUpdatedAtArguments {
    sub: TransactionArgument;
    timestamp: RawTransactionArgument<number | bigint>;
}
export interface SubscriptionSetUpdatedAtOptions {
    package?: string;
    arguments: SubscriptionSetUpdatedAtArguments | [
        sub: TransactionArgument,
        timestamp: RawTransactionArgument<number | bigint>
    ];
}
export function subscriptionSetUpdatedAt(options: SubscriptionSetUpdatedAtOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["sub", "timestamp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'subscription_set_updated_at',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface NewBillingScheduleArguments {
    frequencyDays: RawTransactionArgument<number | bigint>;
    nextBillingTime: RawTransactionArgument<number | bigint>;
    lastBillingTime: RawTransactionArgument<number | bigint>;
}
export interface NewBillingScheduleOptions {
    package?: string;
    arguments: NewBillingScheduleArguments | [
        frequencyDays: RawTransactionArgument<number | bigint>,
        nextBillingTime: RawTransactionArgument<number | bigint>,
        lastBillingTime: RawTransactionArgument<number | bigint>
    ];
}
export function newBillingSchedule(options: NewBillingScheduleOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["frequencyDays", "nextBillingTime", "lastBillingTime"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'new_billing_schedule',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface NewSubscriptionArguments {
    platformId: RawTransactionArgument<string>;
    tierIndex: RawTransactionArgument<number | bigint>;
    tierAmount: RawTransactionArgument<number | bigint>;
    tierFrequencyDays: RawTransactionArgument<number | bigint>;
    status: TransactionArgument;
    schedule: TransactionArgument;
    totalPaid: RawTransactionArgument<number | bigint>;
    paymentCount: RawTransactionArgument<number | bigint>;
    createdAt: RawTransactionArgument<number | bigint>;
    updatedAt: RawTransactionArgument<number | bigint>;
}
export interface NewSubscriptionOptions {
    package?: string;
    arguments: NewSubscriptionArguments | [
        platformId: RawTransactionArgument<string>,
        tierIndex: RawTransactionArgument<number | bigint>,
        tierAmount: RawTransactionArgument<number | bigint>,
        tierFrequencyDays: RawTransactionArgument<number | bigint>,
        status: TransactionArgument,
        schedule: TransactionArgument,
        totalPaid: RawTransactionArgument<number | bigint>,
        paymentCount: RawTransactionArgument<number | bigint>,
        createdAt: RawTransactionArgument<number | bigint>,
        updatedAt: RawTransactionArgument<number | bigint>
    ];
}
export function newSubscription(options: NewSubscriptionOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        '0x2::object::ID',
        'u64',
        'u64',
        'u64',
        null,
        null,
        'u64',
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["platformId", "tierIndex", "tierAmount", "tierFrequencyDays", "status", "schedule", "totalPaid", "paymentCount", "createdAt", "updatedAt"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'new_subscription',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface NewPolicyConfigArguments {
    maxMonthlyWithdrawal: RawTransactionArgument<number | bigint>;
    maxPerTransaction: RawTransactionArgument<number | bigint>;
    minBalance: RawTransactionArgument<number | bigint>;
    minFrequencyDays: RawTransactionArgument<number | bigint>;
}
export interface NewPolicyConfigOptions {
    package?: string;
    arguments: NewPolicyConfigArguments | [
        maxMonthlyWithdrawal: RawTransactionArgument<number | bigint>,
        maxPerTransaction: RawTransactionArgument<number | bigint>,
        minBalance: RawTransactionArgument<number | bigint>,
        minFrequencyDays: RawTransactionArgument<number | bigint>
    ];
}
export function newPolicyConfig(options: NewPolicyConfigOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        'u64',
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["maxMonthlyWithdrawal", "maxPerTransaction", "minBalance", "minFrequencyDays"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'new_policy_config',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RecordPaymentArguments {
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
}
export interface RecordPaymentOptions {
    package?: string;
    arguments: RecordPaymentArguments | [
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Records a successful payment and advances the billing schedule. Called by
 * platform after withdrawal. No capability needed since withdraw already verified
 * platform authorization.
 */
export function recordPayment(options: RecordPaymentOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["account", "platformId", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'record_payment',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface GetBalanceArguments {
    account: RawTransactionArgument<string>;
}
export interface GetBalanceOptions {
    package?: string;
    arguments: GetBalanceArguments | [
        account: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function getBalance(options: GetBalanceOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'get_balance',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface GetPoliciesArguments {
    account: RawTransactionArgument<string>;
}
export interface GetPoliciesOptions {
    package?: string;
    arguments: GetPoliciesArguments | [
        account: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function getPolicies(options: GetPoliciesOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'get_policies',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface GetAccountInfoArguments {
    account: RawTransactionArgument<string>;
}
export interface GetAccountInfoOptions {
    package?: string;
    arguments: GetAccountInfoArguments | [
        account: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function getAccountInfo(options: GetAccountInfoOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'get_account_info',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CheckWithdrawalArguments {
    account: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
}
export interface CheckWithdrawalOptions {
    package?: string;
    arguments: CheckWithdrawalArguments | [
        account: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function checkWithdrawal(options: CheckWithdrawalOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["account", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'subscription_account',
        function: 'check_withdrawal',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}