import { Transaction } from '@mysten/sui/transactions';
import { PACKAGE_ID, PUSD_PACKAGE_ID } from '../lib/config.js';

// ALLOWED_TARGETS: List of Move function targets that the sponsor will accept.
// Built from the configured PACKAGE_ID/PUSD_PACKAGE_ID rather than hardcoded
// literals, so it can't silently drift out of sync with whatever package is
// actually deployed the way it previously did (a stale package ID here meant
// every real transaction was rejected, even though PACKAGE_ID itself was
// configured correctly via env var). Function names match what
// @paystreamer/sdk's transaction builders (packages/sdk/src/core/transactions.ts)
// actually call — verified against that file directly, not assumed.
export const ALLOWED_TARGETS = [
  // Move stdlib — buildCreateTierTx (packages/sdk/src/core/transactions.ts)
  // calls this directly to construct the TypeName argument create_tier
  // needs for a tier's denomination. Not a PayStreamer contract call, so
  // it isn't built from PACKAGE_ID — it's the same fixed address (0x1)
  // on every network. Must be the fully-padded 32-byte form: verified
  // live that command.MoveCall.package normalizes "0x1" to
  // "0x000...0001" — a bare "0x1" here silently never matches.
  "0x0000000000000000000000000000000000000000000000000000000000000001::type_name::get",

  // pusd module
  `${PUSD_PACKAGE_ID}::pusd::mint`,

  // account module
  `${PACKAGE_ID}::account::empty_policy_set`,
  `${PACKAGE_ID}::account::create_account`,
  `${PACKAGE_ID}::account::share_account`,
  `${PACKAGE_ID}::account::deposit`,
  `${PACKAGE_ID}::account::withdraw`,
  `${PACKAGE_ID}::account::create_subscription`,
  `${PACKAGE_ID}::account::pause_subscription`,
  `${PACKAGE_ID}::account::resume_subscription`,
  `${PACKAGE_ID}::account::cancel_subscription`,

  // policies module
  `${PACKAGE_ID}::policies::empty_limiters`,
  `${PACKAGE_ID}::policies::ensure_initialized`,

  // scheduler module
  `${PACKAGE_ID}::scheduler::process_due_payment`,
  `${PACKAGE_ID}::scheduler::withdraw_for_route`,
  `${PACKAGE_ID}::scheduler::process_routed_payment`,

  // platform module
  `${PACKAGE_ID}::platform::create_platform`,
  `${PACKAGE_ID}::platform::register_platform`,
  `${PACKAGE_ID}::platform::create_tier`,
  `${PACKAGE_ID}::platform::deactivate_tier_by_index`,
  `${PACKAGE_ID}::platform::propose_treasury_change`,
  `${PACKAGE_ID}::platform::accept_treasury_change`,
  `${PACKAGE_ID}::platform::cancel_treasury_change`,
];

/**
 * Validates that all Move call targets in the transaction are in ALLOWED_TARGETS.
 * @param transaction The Transaction object to validate
 * @throws Error if any Move call target is not in ALLOWED_TARGETS
 */
export function validateMoveCalls(transaction: Transaction): void {
  // getData() is the public, documented snapshot API. The previous version
  // reached into `(transaction as any)._transaction?.kind?.commands`, an
  // internal field that doesn't exist on this SDK version's Transaction
  // class — it always hit the "could not extract commands" warning branch
  // and returned without validating anything, silently sponsoring calls to
  // *any* Move function regardless of ALLOWED_TARGETS.
  const commands = transaction.getData().commands;

  for (const command of commands) {
    if (command.$kind === 'MoveCall' && command.MoveCall) {
      const { package: pkg, module, function: fn } = command.MoveCall;
      const target = `${pkg}::${module}::${fn}`;

      if (!ALLOWED_TARGETS.includes(target)) {
        throw new Error(`Move call target "${target}" is not in ALLOWED_TARGETS`);
      }
    }
  }
}

/**
 * Validates the transaction bytes directly
 * @param transactionBytes Base64 encoded transaction bytes
 */
export function validateTransactionBytes(transactionBytes: Uint8Array): void {
  if (!transactionBytes || transactionBytes.length === 0) {
    throw new Error('Transaction bytes are empty');
  }
}
