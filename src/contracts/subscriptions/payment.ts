/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * `subscriptions::payment` — the single money-moving path for v2.
 * 
 * Per architecture §6.8 (with the per-Platform AC seam deferred to a future
 * hardening pass, see `access_control.move`): `process_due_payment` is the
 * **only** function in the v2 contract that withdraws user funds. It is called by
 * `scheduler.move` (the permissionless on-chain entry point) after the global
 * circuit breaker, the global pause flag, and the platform's
 * `PLATFORM_SCHEDULER_ROLE` grant have been checked upstream. The function then
 * verifies the per-subscription schedule, runs the per-platform rate limiters,
 * performs the two-pass policy evaluation, and only then calls
 * `account::internal_withdraw` to split off the amount and
 * `billing::record_payment` to advance the schedule.
 * 
 * The architecture also lists four other invariants that live in `scheduler.move`
 * rather than here (architecture §6.8 steps 1, 2, 4, 6): the global circuit
 * breaker, the global pause flag, the denomination match, and the
 * `PLATFORM_SCHEDULER_ROLE` mint. We do not duplicate those checks — the scheduler
 * is the single place that is allowed to call this function, and the
 * per-subscription invariants we DO check (the schedule, the amount, the rate
 * limiters, the policies) are the only invariants the scheduler cannot see.
 * 
 * ## Why a Coin return value
 * 
 * The actual `Coin<T>` is transferred to `platform.treasury` inside this function.
 * A zero-value `Coin<T>` is returned for forward- compatibility (a future variant
 * that returns the coin to the caller for composability with PTBs would not change
 * the signature). The scheduler is expected to discard the return.
 * 
 * ## Error code range
 * 
 * 0x09\_\_ per the project convention; see `account.move` and `billing.move` for
 * sibling ranges.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.js';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
const $moduleName = '@local-pkg/subscriptions::payment';
export const PaymentProcessed = new MoveStruct({ name: `${$moduleName}::PaymentProcessed`, fields: {
        account_id: bcs.Address,
        platform_id: bcs.Address,
        amount: bcs.u64(),
        policy_failures_count: bcs.u64(),
        remaining_balance: bcs.u64(),
        nonce: bcs.u64(),
        v: bcs.u16()
    } });
export const PaymentFailed = new MoveStruct({ name: `${$moduleName}::PaymentFailed`, fields: {
        account_id: bcs.Address,
        platform_id: bcs.Address,
        amount: bcs.u64(),
        reason: bcs.u64(),
        v: bcs.u16()
    } });
export interface ProcessDuePaymentArguments {
    platform: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
    policyLimiters: TransactionArgument;
}
export interface ProcessDuePaymentOptions {
    package?: string;
    arguments: ProcessDuePaymentArguments | [
        platform: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>,
        policyLimiters: TransactionArgument
    ];
    typeArguments: [
        string
    ];
}
/**
 * THE single money-moving path. Called by `scheduler.move` (which has already
 * checked the global circuit breaker, the global pause flag, and the platform's
 * `PLATFORM_SCHEDULER_ROLE` grant).
 *
 * Steps (per design §6.8, scoped to the checks this function owns; the scheduler
 * owns steps 1, 2, 4, 6):
 *
 * 1. Verify `can_bill` (subscription is active and due)
 * 2. Read `sub.tier_amount` (BUG FIX #5: tier amount is the billed amount, not a
 *    caller-supplied value)
 * 3. Check the platform's three rate limiters (`volume`, `frequency`,
 *    `account_billing`)
 * 4. Two-pass policy evaluation against the account's `PolicySet` and live
 *    `PolicyLimiters`
 * 5. `internal_withdraw` from the account -> `Balance<T>`
 * 6. `record_payment` on the subscription (advances schedule, bumps the
 *    per-subscription nonce) and `bump_nonce` on the account (bumps the
 *    per-account replay nonce; design §6.8 step 10)
 * 7. Convert the `Balance<T>` to a `Coin<T>` and transfer it to
 *    `platform.treasury`
 * 8. Emit `PaymentProcessed` with the policy results and the post-payment state
 *
 * On a policy violation, `record_failed_payment` is called so the subscription's
 * retry state (attempt_count, last_attempt_time) is correctly stamped for the next
 * call. On other failures (`ENotDue`, `EPlatformRateLimited`,
 * `EInsufficientBalance`, `EZeroAmount`) the call aborts before any state change;
 * the `PaymentFailed` event records the reason.
 *
 * Returns a zero-value `Coin<T>` for forward-compatibility (the actual transfer
 * happens inside the function). The caller (scheduler) is expected to discard the
 * return.
 */
export function processDuePayment(options: ProcessDuePaymentOptions) {
    const packageAddress = options.package ?? '@local-pkg/subscriptions';
    const argumentsTypes = [
        null,
        null,
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["platform", "account", "policyLimiters"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'payment',
        function: 'process_due_payment',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}