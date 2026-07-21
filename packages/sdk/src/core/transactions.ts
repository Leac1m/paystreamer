import { Transaction } from "@mysten/sui/transactions";

export interface BuildCreateAccountTxParams {
  tx: Transaction;
  packageId: string;
  registryId: string;
  clockId: string;
  denomination: string; // e.g. "0x...::pusd::PUSD"
  depositAmount?: bigint; // in mist
  coinsToUse?: string[]; // object IDs of the coins to use for deposit
  isSuiDenomination?: boolean;
}

export function buildCreateAccountTx(params: BuildCreateAccountTxParams) {
  const {
    tx, packageId, registryId, clockId, denomination, depositAmount = 0n, coinsToUse = [], isSuiDenomination = false
  } = params;

  const [accountObj, cap] = tx.moveCall({
    target: `${packageId}::account::create_account`,
    typeArguments: [denomination],
    arguments: [tx.object(registryId), tx.object(clockId)],
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
      arguments: [cap, accountObj, primaryCoin, tx.object(clockId)],
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
  clockId: string;
  denomination: string;
  accountId: string;
  capId: string;
  depositAmount: bigint;
  coinsToUse: string[];
}

export function buildDepositTx(params: BuildDepositTxParams) {
  const { tx, packageId, clockId, denomination, accountId, capId, depositAmount, coinsToUse } = params;

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
      tx.object(capId),
      tx.object(accountId),
      splitCoin,
      tx.object(clockId)
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
  registryId: string;
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

  // Optional deposit details
  depositAmount?: bigint;
  coinsToUse?: string[];
}

export function buildSubscribeTx(params: BuildSubscribeTxParams) {
  const {
    tx, packageId, registryId, clockId, denomination, platformId, tierIndex, tierAmount, tierFrequencyMs,
    maxAttempts = 3, accountId, accountCapId, depositAmount = 0n, coinsToUse = []
  } = params;

  let workingAccountObj: any;
  let workingCap: any;
  const hasAccount = !!accountId && !!accountCapId;

  if (!hasAccount) {
    const [newAccountObj, newCap] = tx.moveCall({
      target: `${packageId}::account::create_account`,
      typeArguments: [denomination],
      arguments: [
        tx.object(registryId),
        tx.object(clockId),
      ],
    });
    workingAccountObj = newAccountObj;
    workingCap = newCap;
  } else {
    workingAccountObj = tx.object(accountId!);
    workingCap = tx.object(accountCapId!);
  }

  if (depositAmount > 0n && coinsToUse.length > 0) {
    const coinObjs = coinsToUse.map(id => tx.object(id));
    if (coinObjs.length > 1) {
       tx.mergeCoins(coinObjs[0], coinObjs.slice(1));
    }
    const [splitCoin] = tx.splitCoins(coinObjs[0], [tx.pure.u64(depositAmount)]);
    
    tx.moveCall({
      target: `${packageId}::account::deposit`,
      typeArguments: [denomination],
      arguments: [workingCap, workingAccountObj, splitCoin, tx.object(clockId)],
    });
  }

  tx.moveCall({
    target: `${packageId}::billing::create_subscription`,
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
    target: `${packageId}::billing::pause_subscription`,
    typeArguments: [denomination],
    arguments: [tx.object(capId), tx.object(accountId), tx.pure.id(platformId), tx.object(clockId)],
  });
}

export function buildResumeSubscriptionTx(params: BuildManageSubscriptionTxParams) {
  const { tx, packageId, clockId, denomination, accountId, capId, platformId } = params;
  tx.moveCall({
    target: `${packageId}::billing::resume_subscription`,
    typeArguments: [denomination],
    arguments: [tx.object(capId), tx.object(accountId), tx.pure.id(platformId), tx.object(clockId)],
  });
}

export function buildCancelSubscriptionTx(params: BuildManageSubscriptionTxParams) {
  const { tx, packageId, clockId, denomination, accountId, capId, platformId } = params;
  tx.moveCall({
    target: `${packageId}::billing::cancel_subscription`,
    typeArguments: [denomination],
    arguments: [tx.object(capId), tx.object(accountId), tx.pure.id(platformId), tx.object(clockId)],
  });
}

export interface BuildProcessPaymentTxParams {
  tx: Transaction;
  packageId: string;
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
    tx, packageId, clockId, denomination, accountId, platformId, platformInitVersion, schedulerId, schedulerInitVersion
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

