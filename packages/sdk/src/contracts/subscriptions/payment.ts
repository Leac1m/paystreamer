/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * `subscriptions::payment` — Core payment processing module.
 * 
 * Handles both standard and cross-currency routed payments. These functions are
 * `public(package)` and must be called through the `scheduler.move` entry points
 * to ensure circuit breakers and platform permissions are enforced.
 * 
 * ## Address-balance payment flow
 * 
 * Payments use Sui's address balance model via the `SubscriptionAccount`:
 * 
 * 1.  Withdraw from the subscriber's account balance
 * 2.  Split fees for scheduler (1%) and protocol (2%)
 * 3.  Send the remainder to the platform treasury
 * 
 * ## Routed Payments
 * 
 * Schedulers can execute cross-currency payments via atomic PTB swaps using the
 * `RoutingPotato` pattern, allowing users to fund subscriptions with a single coin
 * type while paying platforms in their requested token.
 */

import { MoveStruct } from '../utils/index.js';
import { bcs } from '@mysten/sui/bcs';
const $moduleName = '@local-pkg/subscriptions::payment';
export const PaymentProcessed = new MoveStruct({ name: `${$moduleName}::PaymentProcessed`, fields: {
        account_id: bcs.Address,
        platform_id: bcs.Address,
        amount: bcs.u64(),
        platform_amount: bcs.u64(),
        protocol_fee: bcs.u64(),
        scheduler_fee: bcs.u64(),
        policy_failures_count: bcs.u64(),
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
export const RoutingPotato = new MoveStruct({ name: `${$moduleName}::RoutingPotato<phantom FundingCoin, phantom PlatformCoin>`, fields: {
        account_id: bcs.Address,
        platform_id: bcs.Address,
        amount_needed: bcs.u64()
    } });