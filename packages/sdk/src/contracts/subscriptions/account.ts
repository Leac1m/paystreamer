/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * `subscriptions::account` — Core subscription account management.
 * 
 * This module owns:
 * 
 * 1.  The `SubscriptionAccount<T>` shared object, holding the user's funds
 *     (`Balance<T>`).
 * 2.  The `AccountCap` object, which grants ownership and management rights over
 *     the account.
 * 3.  The `AccountStatus` lifecycle enum (active / paused / closed).
 * 4.  `PolicySet` definitions which restrict maximum spending over specific
 *     periods.
 * 
 * ## Architecture
 * 
 * Users fund a `SubscriptionAccount<T>` with a specific coin type `T`.
 * Subscriptions are registered within this account. Schedulers then use the
 * `payment` module (which calls `internal_withdraw` here) to process payments
 * against the user's balance.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.js';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
import * as type_name from './deps/std/type_name.js';
import * as balance_1 from './deps/sui/balance.js';
import * as vec_map from './deps/sui/vec_map.js';
import * as subscription from './subscription.js';
const $moduleName = '@local-pkg/subscriptions::account';
export const PolicySet = new MoveStruct({ name: `${$moduleName}::PolicySet`, fields: {
        /** Per-transaction maximum amount. `0` = no cap. */
        per_tx_max: bcs.u64(),
        /** Monthly maximum amount. `0` = no cap. */
        monthly_max: bcs.u64(),
        /** Minimum balance that must remain after any withdrawal. `0` = no min. */
        min_balance: bcs.u64(),
        /** Minimum cooldown between attempts. `0` = no cooldown. */
        frequency_min_ms: bcs.u64()
    } });
export const AccountStatus = new MoveStruct({ name: `${$moduleName}::AccountStatus`, fields: {
        variant: bcs.u8()
    } });
export const SubscriptionAccount = new MoveStruct({ name: `${$moduleName}::SubscriptionAccount<phantom T>`, fields: {
        id: bcs.Address,
        /** Coin denomination of the account. */
        coin_type: type_name.TypeName,
        /**
         * Stored balance for the account. Subscriber deposits funds via `deposit` before
         * payments are processed.
         */
        balance: balance_1.Balance,
        /** Per-platform subscriptions, keyed by `platform_id`. The */
        subscriptions: vec_map.VecMap(bcs.Address, subscription.Subscription),
        /** Policy set. Replaced wholesale via `update_policies`. */
        policies: PolicySet,
        /** Lifecycle status. Pause cascades to subscriptions; close is terminal. */
        status: AccountStatus,
        /** Creation timestamp (ms, Sui `Clock`). */
        created_at: bcs.u64(),
        /**
         * Per-account replay nonce. Bumped on every successful payment (via `bump_nonce`
         * from `payment.move`).
         */
        nonce: bcs.u64(),
        /** Schema version (currently `2`). Bumped on account-creating migration. */
        version: bcs.u16()
    } });
export const AccountCap = new MoveStruct({ name: `${$moduleName}::AccountCap`, fields: {
        id: bcs.Address,
        /** ID of the `SubscriptionAccount<T>` this cap authorizes. */
        account_id: bcs.Address
    } });
export const AccountCreated = new MoveStruct({ name: `${$moduleName}::AccountCreated`, fields: {
        account_id: bcs.Address,
        cap_id: bcs.Address,
        owner: bcs.Address,
        v: bcs.u16()
    } });
export const Deposit = new MoveStruct({ name: `${$moduleName}::Deposit`, fields: {
        account_id: bcs.Address,
        depositor: bcs.Address,
        amount: bcs.u64(),
        new_balance: bcs.u64(),
        v: bcs.u16()
    } });
export const AccountPaused = new MoveStruct({ name: `${$moduleName}::AccountPaused`, fields: {
        account_id: bcs.Address,
        subscription_count: bcs.u64(),
        v: bcs.u16()
    } });
export const AccountResumed = new MoveStruct({ name: `${$moduleName}::AccountResumed`, fields: {
        account_id: bcs.Address,
        v: bcs.u16()
    } });
export const AccountClosed = new MoveStruct({ name: `${$moduleName}::AccountClosed`, fields: {
        account_id: bcs.Address,
        v: bcs.u16()
    } });
export const PoliciesUpdated = new MoveStruct({ name: `${$moduleName}::PoliciesUpdated`, fields: {
        account_id: bcs.Address,
        old_policies: PolicySet,
        new_policies: PolicySet,
        v: bcs.u16()
    } });
export interface EmptyPolicySetOptions {
    package?: string;
    arguments?: [
    ];
}
/**
 * unlimited" defaults and a safe starting point for new accounts. Role: any
 * caller.
 */
export function emptyPolicySet(options: EmptyPolicySetOptions = {}) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'empty_policy_set',
    });
}
export interface NewPolicySetArguments {
    perTxMax: RawTransactionArgument<number | bigint>;
    monthlyMax: RawTransactionArgument<number | bigint>;
    minBalance: RawTransactionArgument<number | bigint>;
    frequencyMinMs: RawTransactionArgument<number | bigint>;
}
export interface NewPolicySetOptions {
    package?: string;
    arguments: NewPolicySetArguments | [
        perTxMax: RawTransactionArgument<number | bigint>,
        monthlyMax: RawTransactionArgument<number | bigint>,
        minBalance: RawTransactionArgument<number | bigint>,
        frequencyMinMs: RawTransactionArgument<number | bigint>
    ];
}
/**
 * Custom `PolicySet` constructor. `0` on any field means "no cap for this
 * dimension" (semantics defined by `policies.move`). Role: any caller.
 */
export function newPolicySet(options: NewPolicySetOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        'u64',
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["perTxMax", "monthlyMax", "minBalance", "frequencyMinMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'new_policy_set',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PolicyPerTxMaxArguments {
    p: TransactionArgument;
}
export interface PolicyPerTxMaxOptions {
    package?: string;
    arguments: PolicyPerTxMaxArguments | [
        p: TransactionArgument
    ];
}
/** `per_tx_max` cap. */
export function policyPerTxMax(options: PolicyPerTxMaxOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["p"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'policy_per_tx_max',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PolicyMonthlyMaxArguments {
    p: TransactionArgument;
}
export interface PolicyMonthlyMaxOptions {
    package?: string;
    arguments: PolicyMonthlyMaxArguments | [
        p: TransactionArgument
    ];
}
/** `monthly_max` cap. */
export function policyMonthlyMax(options: PolicyMonthlyMaxOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["p"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'policy_monthly_max',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PolicyMinBalanceArguments {
    p: TransactionArgument;
}
export interface PolicyMinBalanceOptions {
    package?: string;
    arguments: PolicyMinBalanceArguments | [
        p: TransactionArgument
    ];
}
/** `min_balance` floor. */
export function policyMinBalance(options: PolicyMinBalanceOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["p"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'policy_min_balance',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PolicyFrequencyMinMsArguments {
    p: TransactionArgument;
}
export interface PolicyFrequencyMinMsOptions {
    package?: string;
    arguments: PolicyFrequencyMinMsArguments | [
        p: TransactionArgument
    ];
}
/** `frequency_min_ms` cooldown. */
export function policyFrequencyMinMs(options: PolicyFrequencyMinMsOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["p"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'policy_frequency_min_ms',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountStatusActiveOptions {
    package?: string;
    arguments?: [
    ];
}
/** `AccountStatus::active`. */
export function accountStatusActive(options: AccountStatusActiveOptions = {}) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'account_status_active',
    });
}
export interface AccountStatusPausedOptions {
    package?: string;
    arguments?: [
    ];
}
/** `AccountStatus::paused`. */
export function accountStatusPaused(options: AccountStatusPausedOptions = {}) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'account_status_paused',
    });
}
export interface AccountStatusClosedOptions {
    package?: string;
    arguments?: [
    ];
}
/** `AccountStatus::closed`. */
export function accountStatusClosed(options: AccountStatusClosedOptions = {}) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'account_status_closed',
    });
}
export interface StatusVariantArguments {
    s: TransactionArgument;
}
export interface StatusVariantOptions {
    package?: string;
    arguments: StatusVariantArguments | [
        s: TransactionArgument
    ];
}
/** Raw `u8` discriminant. */
export function statusVariant(options: StatusVariantOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'status_variant',
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
/** True iff `variant == 0`. */
export function isActive(options: IsActiveOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
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
/** True iff `variant == 1`. */
export function isPaused(options: IsPausedOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'is_paused',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsClosedArguments {
    s: TransactionArgument;
}
export interface IsClosedOptions {
    package?: string;
    arguments: IsClosedArguments | [
        s: TransactionArgument
    ];
}
/** True iff `variant == 2`. */
export function isClosed(options: IsClosedOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'is_closed',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountCapIdArguments {
    cap: RawTransactionArgument<string>;
}
export interface AccountCapIdOptions {
    package?: string;
    arguments: AccountCapIdArguments | [
        cap: RawTransactionArgument<string>
    ];
}
/**
 * ID of the `SubscriptionAccount<T>` this cap authorizes. Role: any caller
 * (read-only view).
 */
export function accountCapId(options: AccountCapIdOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["cap"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'account_cap_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TransferAccountCapArguments {
    cap: RawTransactionArgument<string>;
    recipient: RawTransactionArgument<string>;
}
export interface TransferAccountCapOptions {
    package?: string;
    arguments: TransferAccountCapArguments | [
        cap: RawTransactionArgument<string>,
        recipient: RawTransactionArgument<string>
    ];
}
/**
 * Transfer a freshly-minted `AccountCap` to a recipient. Since it lacks `store`,
 * this is the only way to relocate it on chain.
 */
export function transferAccountCap(options: TransferAccountCapOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["cap", "recipient"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'transfer_account_cap',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CreateAccountArguments {
    policies: TransactionArgument;
}
export interface CreateAccountOptions {
    package?: string;
    arguments: CreateAccountArguments | [
        policies: TransactionArgument
    ];
    typeArguments: [
        string
    ];
}
/**
 * Create a new `SubscriptionAccount<T>` and mint a fresh `AccountCap` with the
 * OWNER permission bit set.
 *
 * Returns the account and cap by value. The caller (PTB) is responsible for
 * `share_account` to share the account and transfer the cap to the appropriate
 * address. The cap's `account_id` field is pre-bound to the freshly-minted
 * account.
 */
export function createAccount(options: CreateAccountOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["policies"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'create_account',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ShareAccountArguments {
    account: RawTransactionArgument<string>;
    cap: RawTransactionArgument<string>;
}
export interface ShareAccountOptions {
    package?: string;
    arguments: ShareAccountArguments | [
        account: RawTransactionArgument<string>,
        cap: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Share the account and transfer the cap to `ctx.sender()`. The typical
 * post-`create_account` step in a PTB:
 *
 * ```ignore
 * let (account, cap) = account::create_account<T>(...);
 * account::share_account(account, cap, ctx);
 * ```
 *
 * The cap goes to the caller; the account is shared so that `payment.move` (and
 * other PTB steps) can take `&mut` on it.
 */
export function shareAccount(options: ShareAccountOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account", "cap"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'share_account',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DepositArguments {
    account: RawTransactionArgument<string>;
    coin: RawTransactionArgument<string>;
}
export interface DepositOptions {
    package?: string;
    arguments: DepositArguments | [
        account: RawTransactionArgument<string>,
        coin: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Deposit a `Coin<T>` into the account. The account must not be closed.
 *
 * #### Aborts
 *
 * - `EAccountClosed` if the account is closed.
 * - `EZeroAmount` if the coin has zero value.
 */
export function deposit(options: DepositOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account", "coin"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'deposit',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface WithdrawArguments {
    cap: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
}
export interface WithdrawOptions {
    package?: string;
    arguments: WithdrawArguments | [
        cap: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * withdraw `amount` of a `Coin<T>` from the account. The cap's `account_id` must
 * match the account. The account must not be closed.
 *
 * #### Aborts
 *
 * - `EInvalidCap` if `cap.account_id != object::id(account)`.
 * - `EAccountClosed` if the account is closed.
 * - `EZeroAmount` if the requested amount is zero.
 * - `EInsufficientBalance` if the account balance is less than the requested
 *   amount.
 */
export function withdraw(options: WithdrawOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["cap", "account", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'withdraw',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PauseAccountArguments {
    cap: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
}
export interface PauseAccountOptions {
    package?: string;
    arguments: PauseAccountArguments | [
        cap: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Pause the account. Cascades to all active subscriptions cap must hold the OWNER
 * permission.
 *
 * #### Aborts
 *
 * - `EInvalidCap` if `cap.account_id != object::id(account)`.
 * - `EAccountClosed` if the account is already closed.
 * - `EUnauthorized` if the cap lacks the OWNER bit.
 */
export function pauseAccount(options: PauseAccountOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["cap", "account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'pause_account',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ResumeAccountArguments {
    cap: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
}
export interface ResumeAccountOptions {
    package?: string;
    arguments: ResumeAccountArguments | [
        cap: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Resume the account. Does NOT auto-resume subscriptions — the user must call
 * `billing::resume_subscription` per platform to the OWNER permission.
 *
 * #### Aborts
 *
 * - `EInvalidCap` if `cap.account_id != object::id(account)`.
 * - `EAccountNotPaused` if the account is not in the paused state.
 * - `EUnauthorized` if the cap lacks the OWNER bit.
 */
export function resumeAccount(options: ResumeAccountOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["cap", "account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'resume_account',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CloseAccountArguments {
    cap: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
}
export interface CloseAccountOptions {
    package?: string;
    arguments: CloseAccountArguments | [
        cap: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Close the account. Terminal — deposits are rejected after close. The cap must
 * hold the OWNER permission. Does NOT auto-drain remaining balance; the user or
 * `payment.move` may still pull funds out via `internal_withdraw` until the
 * container is empty.
 *
 * #### Aborts
 *
 * - `EInvalidCap` if `cap.account_id != object::id(account)`.
 * - `EUnauthorized` if the cap lacks the OWNER bit.
 */
export function closeAccount(options: CloseAccountOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["cap", "account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'close_account',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UpdatePoliciesArguments {
    cap: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
    newPolicies: TransactionArgument;
}
export interface UpdatePoliciesOptions {
    package?: string;
    arguments: UpdatePoliciesArguments | [
        cap: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>,
        newPolicies: TransactionArgument
    ];
    typeArguments: [
        string
    ];
}
/**
 * Replace the account's `PolicySet` wholesale. The cap must hold the OWNER
 * permission. Both old and new sets are emitted in the `PoliciesUpdated` event for
 * off-chain reconciliation.
 *
 * #### Aborts
 *
 * - `EInvalidCap` if `cap.account_id != object::id(account)`.
 * - `EUnauthorized` if the cap lacks the OWNER bit.
 */
export function updatePolicies(options: UpdatePoliciesOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["cap", "account", "newPolicies"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'update_policies',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface IdArguments {
    account: RawTransactionArgument<string>;
}
export interface IdOptions {
    package?: string;
    arguments: IdArguments | [
        account: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** object::id of the account. Role: any caller (read-only view). */
export function id(options: IdOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AccountTypeArguments {
    account: RawTransactionArgument<string>;
}
export interface AccountTypeOptions {
    package?: string;
    arguments: AccountTypeArguments | [
        account: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Coin denomination (immutable after creation). Role: any caller (read-only view). */
export function accountType(options: AccountTypeOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'account_type',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BalanceArguments {
    account: RawTransactionArgument<string>;
}
export interface BalanceOptions {
    package?: string;
    arguments: BalanceArguments | [
        account: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Live headroom in the smallest unit of `T`. Role: any caller (read-only view). */
export function balance(options: BalanceOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'balance',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface HasActiveSubscriptionArguments {
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
}
export interface HasActiveSubscriptionOptions {
    package?: string;
    arguments: HasActiveSubscriptionArguments | [
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Read-only helper for Seal/Access-Control integrations. Returns true if the
 * account has an active, unpaused subscription to the platform.
 */
export function hasActiveSubscription(options: HasActiveSubscriptionOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["account", "platformId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'has_active_subscription',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface StatusArguments {
    account: RawTransactionArgument<string>;
}
export interface StatusOptions {
    package?: string;
    arguments: StatusArguments | [
        account: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Account lifecycle status. Role: any caller (read-only view). */
export function status(options: StatusOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'status',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PoliciesArguments {
    account: RawTransactionArgument<string>;
}
export interface PoliciesOptions {
    package?: string;
    arguments: PoliciesArguments | [
        account: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Active `PolicySet` reference. Role: any caller (read-only view). */
export function policies(options: PoliciesOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'policies',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface NonceArguments {
    account: RawTransactionArgument<string>;
}
export interface NonceOptions {
    package?: string;
    arguments: NonceArguments | [
        account: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Per-account replay nonce. Role: any caller (read-only view). */
export function nonce(options: NonceOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'nonce',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface VersionArguments {
    account: RawTransactionArgument<string>;
}
export interface VersionOptions {
    package?: string;
    arguments: VersionArguments | [
        account: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Schema version (currently `2`). Role: any caller (read-only view). */
export function version(options: VersionOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CreatedAtArguments {
    account: RawTransactionArgument<string>;
}
export interface CreatedAtOptions {
    package?: string;
    arguments: CreatedAtArguments | [
        account: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Creation timestamp (ms). Role: any caller (read-only view). */
export function createdAt(options: CreatedAtOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'created_at',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SubscriptionsArguments {
    account: RawTransactionArgument<string>;
}
export interface SubscriptionsOptions {
    package?: string;
    arguments: SubscriptionsArguments | [
        account: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Read-only handle to the subscriptions map. `billing.move` reads from this to
 * look up per-platform state. Role: any caller (read-only view).
 */
export function subscriptions(options: SubscriptionsOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'subscriptions',
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
/**
 * True iff the account has a subscription keyed by `platform_id`. Role: any caller
 * (read-only view).
 */
export function hasSubscription(options: HasSubscriptionOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["account", "platformId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'has_subscription',
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
/**
 * Read-only lookup of a single subscription by `platform_id`. Role: any caller
 * (read-only view).
 */
export function getSubscription(options: GetSubscriptionOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["account", "platformId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'get_subscription',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SubscriptionCountArguments {
    account: RawTransactionArgument<string>;
}
export interface SubscriptionCountOptions {
    package?: string;
    arguments: SubscriptionCountArguments | [
        account: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Number of embedded subscriptions. Role: any caller (read-only view). */
export function subscriptionCount(options: SubscriptionCountOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'subscription_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CreateSubscriptionArguments {
    cap: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
    tierIndex: RawTransactionArgument<number | bigint>;
    tierAmount: RawTransactionArgument<number | bigint>;
    tierFrequencyMs: RawTransactionArgument<number | bigint>;
    maxAttempts: RawTransactionArgument<number>;
}
export interface CreateSubscriptionOptions {
    package?: string;
    arguments: CreateSubscriptionArguments | [
        cap: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>,
        tierIndex: RawTransactionArgument<number | bigint>,
        tierAmount: RawTransactionArgument<number | bigint>,
        tierFrequencyMs: RawTransactionArgument<number | bigint>,
        maxAttempts: RawTransactionArgument<number>
    ];
    typeArguments: [
        string
    ];
}
export function createSubscription(options: CreateSubscriptionOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        'u64',
        'u64',
        'u64',
        'u8',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["cap", "account", "platformId", "tierIndex", "tierAmount", "tierFrequencyMs", "maxAttempts"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'create_subscription',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PauseSubscriptionArguments {
    cap: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
}
export interface PauseSubscriptionOptions {
    package?: string;
    arguments: PauseSubscriptionArguments | [
        cap: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function pauseSubscription(options: PauseSubscriptionOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["cap", "account", "platformId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'pause_subscription',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ResumeSubscriptionArguments {
    cap: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
}
export interface ResumeSubscriptionOptions {
    package?: string;
    arguments: ResumeSubscriptionArguments | [
        cap: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function resumeSubscription(options: ResumeSubscriptionOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["cap", "account", "platformId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'resume_subscription',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CancelSubscriptionArguments {
    cap: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
}
export interface CancelSubscriptionOptions {
    package?: string;
    arguments: CancelSubscriptionArguments | [
        cap: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function cancelSubscription(options: CancelSubscriptionOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["cap", "account", "platformId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'cancel_subscription',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UpdateSubscriptionMaxAttemptsArguments {
    cap: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
    maxAttempts: RawTransactionArgument<number>;
}
export interface UpdateSubscriptionMaxAttemptsOptions {
    package?: string;
    arguments: UpdateSubscriptionMaxAttemptsArguments | [
        cap: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>,
        maxAttempts: RawTransactionArgument<number>
    ];
    typeArguments: [
        string
    ];
}
export function updateSubscriptionMaxAttempts(options: UpdateSubscriptionMaxAttemptsOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        'u8',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["cap", "account", "platformId", "maxAttempts"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'update_subscription_max_attempts',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UpdateSubscriptionTierArguments {
    cap: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
    tierIndex: RawTransactionArgument<number | bigint>;
    tierAmount: RawTransactionArgument<number | bigint>;
    tierFrequencyMs: RawTransactionArgument<number | bigint>;
}
export interface UpdateSubscriptionTierOptions {
    package?: string;
    arguments: UpdateSubscriptionTierArguments | [
        cap: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>,
        tierIndex: RawTransactionArgument<number | bigint>,
        tierAmount: RawTransactionArgument<number | bigint>,
        tierFrequencyMs: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function updateSubscriptionTier(options: UpdateSubscriptionTierOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        'u64',
        'u64',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["cap", "account", "platformId", "tierIndex", "tierAmount", "tierFrequencyMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'update_subscription_tier',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UpdateSubscriptionScheduleFrequencyArguments {
    cap: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
    scheduleFrequencyMs: RawTransactionArgument<number | bigint>;
}
export interface UpdateSubscriptionScheduleFrequencyOptions {
    package?: string;
    arguments: UpdateSubscriptionScheduleFrequencyArguments | [
        cap: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>,
        scheduleFrequencyMs: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function updateSubscriptionScheduleFrequency(options: UpdateSubscriptionScheduleFrequencyOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["cap", "account", "platformId", "scheduleFrequencyMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'update_subscription_schedule_frequency',
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
        module: 'account',
        function: 'can_bill',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SubscriptionStatusArguments {
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
}
export interface SubscriptionStatusOptions {
    package?: string;
    arguments: SubscriptionStatusArguments | [
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function subscriptionStatus(options: SubscriptionStatusOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["account", "platformId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'subscription_status',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SubscriptionTotalPaidArguments {
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
}
export interface SubscriptionTotalPaidOptions {
    package?: string;
    arguments: SubscriptionTotalPaidArguments | [
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function subscriptionTotalPaid(options: SubscriptionTotalPaidOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["account", "platformId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'subscription_total_paid',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SubscriptionPaymentCountArguments {
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
}
export interface SubscriptionPaymentCountOptions {
    package?: string;
    arguments: SubscriptionPaymentCountArguments | [
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function subscriptionPaymentCount(options: SubscriptionPaymentCountOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["account", "platformId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'subscription_payment_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SubscriptionNonceArguments {
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
}
export interface SubscriptionNonceOptions {
    package?: string;
    arguments: SubscriptionNonceArguments | [
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function subscriptionNonce(options: SubscriptionNonceOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["account", "platformId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'subscription_nonce',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SubscriptionTierAmountArguments {
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
}
export interface SubscriptionTierAmountOptions {
    package?: string;
    arguments: SubscriptionTierAmountArguments | [
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function subscriptionTierAmount(options: SubscriptionTierAmountOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["account", "platformId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'subscription_tier_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SubscriptionTierFrequencyMsArguments {
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
}
export interface SubscriptionTierFrequencyMsOptions {
    package?: string;
    arguments: SubscriptionTierFrequencyMsArguments | [
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function subscriptionTierFrequencyMs(options: SubscriptionTierFrequencyMsOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["account", "platformId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'subscription_tier_frequency_ms',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SubscriptionNextBillingTimeArguments {
    account: RawTransactionArgument<string>;
    platformId: RawTransactionArgument<string>;
}
export interface SubscriptionNextBillingTimeOptions {
    package?: string;
    arguments: SubscriptionNextBillingTimeArguments | [
        account: RawTransactionArgument<string>,
        platformId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function subscriptionNextBillingTime(options: SubscriptionNextBillingTimeOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["account", "platformId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'subscription_next_billing_time',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SubscriptionDenominationArguments {
    account: RawTransactionArgument<string>;
}
export interface SubscriptionDenominationOptions {
    package?: string;
    arguments: SubscriptionDenominationArguments | [
        account: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function subscriptionDenomination(options: SubscriptionDenominationOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'subscription_denomination',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}