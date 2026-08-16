import { Transaction } from "@mysten/sui/transactions";

export interface BuildCreateAccountTxParams {
  tx: Transaction;
  packageId: string;
  clockId: string;
  denomination: string; // e.g. "0x...::pusd::PUSD"
  depositAmount?: bigint; // in mist
  coinsToUse?: string[]; // object IDs of the coins to use for deposit
  isSuiDenomination?: boolean;
}

export function buildCreateAccountTx(params: BuildCreateAccountTxParams) {
  const {
    tx, packageId, clockId, denomination, depositAmount = 0n, coinsToUse = [], isSuiDenomination = false
  } = params;

  const policies = tx.moveCall({
    target: `${packageId}::account::empty_policy_set`,
  });

  const [accountObj, cap] = tx.moveCall({
    target: `${packageId}::account::create_account`,
    typeArguments: [denomination],
    arguments: [policies, tx.object(clockId)],
  });

  if (depositAmount > 0n) {
    let primaryCoin: any;
    if (isSuiDenomination) {
      const [splitCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(depositAmount)]);
      primaryCoin = splitCoin;
    } else {
      if (coinsToUse.length === 0) {
        throw new Error("coinsToUse must be provided for non-SUI deposits");
      }
      const coinObjs = coinsToUse.map(id => tx.object(id));
      if (coinObjs.length > 1) {
         tx.mergeCoins(coinObjs[0], coinObjs.slice(1));
      }
      const [splitCoin] = tx.splitCoins(coinObjs[0], [tx.pure.u64(depositAmount)]);
      primaryCoin = splitCoin;
    }
    
    tx.moveCall({
      target: `${packageId}::account::deposit`,
      typeArguments: [denomination],
      arguments: [accountObj, primaryCoin],
    });
  }

  tx.moveCall({
    target: `${packageId}::account::share_account`,
    typeArguments: [denomination],
    arguments: [accountObj, cap],
  });

  return { accountObj, cap };
}

export interface BuildDepositTxParams {
  tx: Transaction;
  packageId: string;
  denomination: string;
  accountId: string;
  depositAmount: bigint;
  coinsToUse: string[];
}

export function buildDepositTx(params: BuildDepositTxParams) {
  const { tx, packageId, denomination, accountId, depositAmount, coinsToUse } = params;

  if (coinsToUse.length === 0) {
    throw new Error("coinsToUse must be provided for deposit");
  }

  const coinObjs = coinsToUse.map(id => tx.object(id));
  if (coinObjs.length > 1) {
     tx.mergeCoins(coinObjs[0], coinObjs.slice(1));
  }
  const [splitCoin] = tx.splitCoins(coinObjs[0], [tx.pure.u64(depositAmount)]);
  
  tx.moveCall({
    target: `${packageId}::account::deposit`,
    typeArguments: [denomination],
    arguments: [
      tx.object(accountId),
      splitCoin,
    ],
  });
}

export interface BuildWithdrawTxParams {
  tx: Transaction;
  packageId: string;
  denomination: string;
  accountId: string;
  capId: string;
  withdrawAmount: bigint;
  recipientAddress: string;
}

export function buildWithdrawTx(params: BuildWithdrawTxParams) {
  const { tx, packageId, denomination, accountId, capId, withdrawAmount, recipientAddress } = params;

  const [withdrawnCoin] = tx.moveCall({
    target: `${packageId}::account::withdraw`,
    typeArguments: [denomination],
    arguments: [
      tx.object(capId),
      tx.object(accountId),
      tx.pure.u64(withdrawAmount)
    ],
  });

  tx.transferObjects([withdrawnCoin], tx.pure.address(recipientAddress));
}

export interface BuildSubscribeTxParams {
  tx: Transaction;
  packageId: string;
  clockId: string;
  denomination: string;
  platformId: string;
  tierIndex: number | bigint;
  tierAmount: bigint;
  tierFrequencyMs: bigint;
  maxAttempts?: number;
  
  // Optional account details (if user already has an account)
  accountId?: string;
  accountCapId?: string;

  // Optional deposit details. `coinsToUse` are existing owned coin object
  // IDs to merge/split from. `depositCoin` is an alternative for when the
  // deposit source is a fresh transaction argument that doesn't exist as
  // an owned object yet -- e.g. buildOnboardWithSwapTx's DeepBook swap
  // output -- in which case it's deposited directly, no merge/split.
  depositAmount?: bigint;
  coinsToUse?: string[];
  depositCoin?: any;
}

export function buildSubscribeTx(params: BuildSubscribeTxParams) {
  const {
    tx, packageId, clockId, denomination, platformId, tierIndex, tierAmount, tierFrequencyMs,
    maxAttempts = 3, accountId, accountCapId, depositAmount = 0n, coinsToUse = [], depositCoin
  } = params;

  let workingAccountObj: any;
  let workingCap: any;
  const hasAccount = !!accountId && !!accountCapId;

  if (!hasAccount) {
    const policies = tx.moveCall({
      target: `${packageId}::account::empty_policy_set`,
    });

    const [newAccountObj, newCap] = tx.moveCall({
      target: `${packageId}::account::create_account`,
      typeArguments: [denomination],
      arguments: [
        policies,
        tx.object(clockId),
      ],
    });
    workingAccountObj = newAccountObj;
    workingCap = newCap;
  } else {
    workingAccountObj = tx.object(accountId!);
    workingCap = tx.object(accountCapId!);
  }

  if (depositCoin !== undefined) {
    tx.moveCall({
      target: `${packageId}::account::deposit`,
      typeArguments: [denomination],
      arguments: [workingAccountObj, depositCoin],
    });
  } else if (depositAmount > 0n && coinsToUse.length > 0) {
    const coinObjs = coinsToUse.map(id => tx.object(id));
    if (coinObjs.length > 1) {
       tx.mergeCoins(coinObjs[0], coinObjs.slice(1));
    }
    const [splitCoin] = tx.splitCoins(coinObjs[0], [tx.pure.u64(depositAmount)]);

    tx.moveCall({
      target: `${packageId}::account::deposit`,
      typeArguments: [denomination],
      arguments: [workingAccountObj, splitCoin],
    });
  }

  tx.moveCall({
    target: `${packageId}::account::create_subscription`,
    typeArguments: [denomination],
    arguments: [
      workingCap,
      workingAccountObj,
      tx.pure.id(platformId),
      tx.pure.u64(BigInt(tierIndex)),
      tx.pure.u64(tierAmount),
      tx.pure.u64(tierFrequencyMs),
      tx.pure.u8(maxAttempts),
      tx.object(clockId),
    ],
  });

  if (!hasAccount) {
    tx.moveCall({
      target: `${packageId}::account::share_account`,
      typeArguments: [denomination],
      arguments: [workingAccountObj, workingCap],
    });
  }
}

export interface BuildOnboardWithSwapTxParams extends Omit<BuildSubscribeTxParams, 'depositAmount' | 'coinsToUse' | 'depositCoin'> {
  /**
   * Called with no arguments; perform your swap (e.g. into a
   * `deepbook.swapExactQuantity` call producing `Coin<denomination>`) and
   * return the resulting coin argument. Composed into the same `tx`,
   * before account creation and the deposit/subscribe call.
   */
  performSwap: () => any;
}

/**
 * Lets a brand-new user subscribe by paying in whatever token they
 * actually hold, converting it to the platform's settlement denomination
 * in the same PTB — no separate "acquire PUSD first" step. Composes a
 * swap with buildSubscribeTx's existing account-creation/deposit/subscribe
 * flow via the `depositCoin` seam, rather than requiring the caller to
 * already own a `denomination` coin the way `coinsToUse` does.
 */
export function buildOnboardWithSwapTx(params: BuildOnboardWithSwapTxParams) {
  const { performSwap, ...subscribeParams } = params;
  const depositCoin = performSwap();
  buildSubscribeTx({ ...subscribeParams, depositCoin });
}

export interface BuildManageSubscriptionTxParams {
  tx: Transaction;
  packageId: string;
  clockId: string;
  denomination: string;
  accountId: string;
  capId: string;
  platformId: string;
}

export function buildPauseSubscriptionTx(params: BuildManageSubscriptionTxParams) {
  const { tx, packageId, clockId, denomination, accountId, capId, platformId } = params;
  tx.moveCall({
    target: `${packageId}::account::pause_subscription`,
    typeArguments: [denomination],
    arguments: [
      tx.object(capId),
      tx.object(accountId),
      tx.pure.id(platformId),
      tx.object(clockId),
    ],
  });
}

export function buildResumeSubscriptionTx(params: BuildManageSubscriptionTxParams) {
  const { tx, packageId, clockId, denomination, accountId, capId, platformId } = params;
  tx.moveCall({
    target: `${packageId}::account::resume_subscription`,
    typeArguments: [denomination],
    arguments: [
      tx.object(capId),
      tx.object(accountId),
      tx.pure.id(platformId),
      tx.object(clockId),
    ],
  });
}

export function buildCancelSubscriptionTx(params: BuildManageSubscriptionTxParams) {
  const { tx, packageId, clockId, denomination, accountId, capId, platformId } = params;
  tx.moveCall({
    target: `${packageId}::account::cancel_subscription`,
    typeArguments: [denomination],
    arguments: [
      tx.object(capId),
      tx.object(accountId),
      tx.pure.id(platformId),
      tx.object(clockId),
    ],
  });
}

export interface BuildProcessPaymentTxParams {
  tx: Transaction;
  packageId: string;
  registryId: string;
  clockId: string;
  denomination: string;
  accountId: string;
  platformId: string;
  platformInitVersion: number;
  schedulerId: string;
  schedulerInitVersion: number;
}

export function buildProcessPaymentTx(params: BuildProcessPaymentTxParams) {
  const {
    tx, packageId, registryId, clockId, denomination, accountId, platformId, platformInitVersion, schedulerId, schedulerInitVersion
  } = params;

  const limiters = tx.moveCall({
    target: `${packageId}::policies::empty_limiters`,
    arguments: [tx.object(clockId)],
  });

  tx.moveCall({
    target: `${packageId}::policies::ensure_initialized`,
    typeArguments: [denomination],
    arguments: [tx.object(accountId), limiters, tx.object(clockId)],
  });

  tx.moveCall({
    target: `${packageId}::scheduler::process_due_payment`,
    typeArguments: [denomination],
    arguments: [
      tx.object(registryId),
      tx.sharedObjectRef({
        objectId: schedulerId,
        initialSharedVersion: schedulerInitVersion,
        mutable: true,
      }),
      tx.sharedObjectRef({
        objectId: platformId,
        initialSharedVersion: platformInitVersion,
        mutable: true,
      }),
      tx.object(accountId),
      limiters,
      tx.object(clockId),
    ],
  });
}

export interface BuildProcessRoutedPaymentTxParams {
  tx: Transaction;
  packageId: string;
  registryId: string;
  clockId: string;
  /** The coin type the account actually holds. */
  fundingCoinType: string;
  /** The coin type the platform settles in. */
  platformCoinType: string;
  accountId: string;
  platformId: string;
  platformInitVersion: number;
  schedulerId: string;
  schedulerInitVersion: number;
  /** Upper bound on how much of the account's FundingCoin the swap may spend — also the amount policy limiters are evaluated against. */
  maxSpend: bigint;
  /**
   * Called with the `Coin<FundingCoin>` withdrawn from the account (a
   * transaction argument, not a value) — perform your swap against it
   * (e.g. `deepbook.swapExactQuantity`) and return the resulting
   * `Coin<PlatformCoin>` plus any unspent `Coin<FundingCoin>` change.
   * Composed into the same `tx`, between `withdraw_for_route` and
   * `process_routed_payment` — this is the only place a swap can go,
   * since the funding coin doesn't exist until `withdraw_for_route` runs.
   */
  performSwap: (fundingCoin: any) => { platformCoin: any; fundingChange: any };
}

/**
 * Recurring, scheduler-driven routed payment: withdraws up to `maxSpend`
 * of the account's held coin, lets the caller swap it into the platform's
 * settlement coin via `performSwap`, and settles the payment with the
 * result — refunding unspent funding-coin change back into the account.
 * Mirrors `move/subscriptions/sources/scheduler.move`'s
 * `withdraw_for_route`/`process_routed_payment` pair exactly; see
 * roadmap.md Phase 3 for why this exists (the on-chain side was already
 * fully implemented, just never wired up to the SDK).
 */
export function buildProcessRoutedPaymentTx(params: BuildProcessRoutedPaymentTxParams) {
  const {
    tx, packageId, registryId, clockId, fundingCoinType, platformCoinType,
    accountId, platformId, platformInitVersion, schedulerId, schedulerInitVersion,
    maxSpend, performSwap,
  } = params;

  const limiters = tx.moveCall({
    target: `${packageId}::policies::empty_limiters`,
    arguments: [tx.object(clockId)],
  });

  tx.moveCall({
    target: `${packageId}::policies::ensure_initialized`,
    typeArguments: [fundingCoinType],
    arguments: [tx.object(accountId), limiters, tx.object(clockId)],
  });

  const schedulerRef = tx.sharedObjectRef({
    objectId: schedulerId,
    initialSharedVersion: schedulerInitVersion,
    mutable: true,
  });
  const platformRef = tx.sharedObjectRef({
    objectId: platformId,
    initialSharedVersion: platformInitVersion,
    mutable: true,
  });

  const [fundingCoin, potato] = tx.moveCall({
    target: `${packageId}::scheduler::withdraw_for_route`,
    typeArguments: [fundingCoinType, platformCoinType],
    arguments: [
      schedulerRef,
      platformRef,
      tx.object(accountId),
      limiters,
      tx.object(clockId),
      tx.pure.u64(maxSpend),
    ],
  });

  const { platformCoin, fundingChange } = performSwap(fundingCoin);

  tx.moveCall({
    target: `${packageId}::scheduler::process_routed_payment`,
    typeArguments: [fundingCoinType, platformCoinType],
    arguments: [
      tx.object(registryId),
      schedulerRef,
      potato,
      platformRef,
      tx.object(accountId),
      platformCoin,
      fundingChange,
      tx.object(clockId),
    ],
  });
}

export interface BuildRegisterPlatformTxParams {
  tx: Transaction;
  packageId: string;
  clockId: string;
  name: string;
  description: string;
  category: string;
  iconUrl?: string;
}

export function buildRegisterPlatformTx(params: BuildRegisterPlatformTxParams) {
  const { tx, packageId, clockId, name, description, category, iconUrl } = params;
  const [platform, receipt] = tx.moveCall({
    target: `${packageId}::platform::create_platform`,
    arguments: [
      tx.pure.string(name),
      tx.pure.string(description),
      tx.pure.string(category),
      tx.pure.option("string", iconUrl || null),
      tx.object(clockId),
    ],
  });

  tx.moveCall({
    target: `${packageId}::platform::register_platform`,
    arguments: [platform, receipt],
  });
}

export interface BuildManageTierTxParams {
  tx: Transaction;
  packageId: string;
  platformId: string;
  platformInitVersion: number;
}

export interface BuildCreateTierTxParams extends BuildManageTierTxParams {
  name: string;
  amount: bigint | number;
  frequencySeconds: bigint | number;
  pusdTypeArg: string;
}

export function buildCreateTierTx(params: BuildCreateTierTxParams) {
  const { tx, packageId, platformId, platformInitVersion, name, amount, frequencySeconds, pusdTypeArg } = params;
  const denominationTypeName = tx.moveCall({
    target: "0x1::type_name::get",
    typeArguments: [pusdTypeArg],
    arguments: [],
  });

  tx.moveCall({
    target: `${packageId}::platform::create_tier`,
    arguments: [
      tx.sharedObjectRef({
        objectId: platformId,
        initialSharedVersion: platformInitVersion,
        mutable: true,
      }),
      tx.pure.string(name),
      tx.pure.u64(amount),
      tx.pure.u64(frequencySeconds),
      denominationTypeName,
    ],
  });
}

export interface BuildDeactivateTierTxParams extends BuildManageTierTxParams {
  tierIndex: number | bigint;
}

export function buildDeactivateTierTx(params: BuildDeactivateTierTxParams) {
  const { tx, packageId, platformId, platformInitVersion, tierIndex } = params;
  tx.moveCall({
    target: `${packageId}::platform::deactivate_tier_by_index`,
    arguments: [
      tx.sharedObjectRef({
        objectId: platformId,
        initialSharedVersion: platformInitVersion,
        mutable: true,
      }),
      tx.pure.u64(tierIndex),
    ],
  });
}

export interface BuildManageTreasuryTxParams extends BuildManageTierTxParams {
  clockId: string;
}

export interface BuildProposeTreasuryChangeTxParams extends BuildManageTreasuryTxParams {
  newTreasury: string;
}

export function buildProposeTreasuryChangeTx(params: BuildProposeTreasuryChangeTxParams) {
  const { tx, packageId, clockId, platformId, platformInitVersion, newTreasury } = params;
  tx.moveCall({
    target: `${packageId}::platform::propose_treasury_change`,
    arguments: [
      tx.sharedObjectRef({
        objectId: platformId,
        initialSharedVersion: platformInitVersion,
        mutable: true,
      }),
      tx.pure.address(newTreasury),
      tx.object(clockId),
    ],
  });
}

export function buildAcceptTreasuryChangeTx(params: BuildManageTreasuryTxParams) {
  const { tx, packageId, clockId, platformId, platformInitVersion } = params;
  tx.moveCall({
    target: `${packageId}::platform::accept_treasury_change`,
    arguments: [
      tx.sharedObjectRef({
        objectId: platformId,
        initialSharedVersion: platformInitVersion,
        mutable: true,
      }),
      tx.object(clockId),
    ],
  });
}

export function buildCancelTreasuryChangeTx(params: BuildManageTierTxParams) {
  const { tx, packageId, platformId, platformInitVersion } = params;
  tx.moveCall({
    target: `${packageId}::platform::cancel_treasury_change`,
    arguments: [
      tx.sharedObjectRef({
        objectId: platformId,
        initialSharedVersion: platformInitVersion,
        mutable: true,
      }),
    ],
  });
}
