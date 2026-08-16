import { Transaction } from '@mysten/sui/transactions';
import { createDeepBookClient, swapExactQuantity, buildProcessRoutedPaymentTx } from '@paystreamer/sdk/core';
import { testnetCoins, testnetPools, mainnetCoins, mainnetPools } from '@mysten/deepbook-v3';
import { grpcClient, getSchedulerKeypair, getSchedulerAddress } from '../lib/sui.js';
import { PACKAGE_ID, PAYMENT_SCHEDULER_ID, REGISTRY_ID, CLOCK_OBJECT_ID, NETWORK } from '../lib/config.js';
import { DEEP_COIN_TYPE, RoutingPoolConfig } from '../lib/routingConfig.js';
import { DiscoveredSubscription } from './discovery.js';

const initialSharedVersionCache = new Map<string, number>();

async function getInitialSharedVersion(objectId: string): Promise<number> {
  if (initialSharedVersionCache.has(objectId)) return initialSharedVersionCache.get(objectId)!;
  const res = await grpcClient.core.getObject({ objectId });
  const owner = res.object?.owner as any;
  const version = owner?.$kind === 'Shared' && owner.Shared ? Number(owner.Shared.initialSharedVersion) : 0;
  initialSharedVersionCache.set(objectId, version);
  return version;
}

async function getLargestOwnedCoin(owner: string, coinType: string) {
  const coins = await grpcClient.core.listCoins({ owner, coinType });
  return coins.objects.sort((a: any, b: any) => Number(BigInt(b.balance) - BigInt(a.balance)))[0];
}

/**
 * Executes the routed-payment path for one due, currency-mismatched
 * subscription the operator has explicitly opted into `ROUTING_ALLOWLIST_JSON`:
 * `withdraw_for_route` -> DeepBook swap -> `process_routed_payment`, composed
 * in one PTB via the SDK's `buildProcessRoutedPaymentTx` seam.
 *
 * UNTESTED against live liquidity: no real DeepBook pool exists for any
 * PayStreamer demo token on any network today (roadmap.md Phase 3), so
 * this path only has structural/mocked coverage. Two design choices follow
 * directly from that gap, documented rather than hidden:
 *  - There's no price oracle here, so the swap spends the account's
 *    *entire* withdrawn `maxSpend` (a pool-config value the operator sets
 *    per pair) as the DeepBook input, with `minOut` set to the exact
 *    PlatformCoin amount the potato demands.
 *  - `process_routed_payment` requires *exactly* that amount in
 *    PlatformCoin — any swap proceeds above it are split off and sent to
 *    the scheduler's own address as an explicit, disclosed margin, not
 *    silently discarded. Likewise any unfilled leftover of the funding
 *    coin (a real possibility on a partially-filled order book, not just
 *    a theoretical one — see `swapExactQuantity`'s `inputChange` doc in
 *    `@paystreamer/sdk/core`) flows back into the account via the
 *    potato's own `change` refund, not lost.
 */
export async function processRoutedPayment(
  sub: DiscoveredSubscription,
  pool: RoutingPoolConfig,
): Promise<string> {
  if (!DEEP_COIN_TYPE) {
    throw new Error('DEEP_COIN_TYPE is not configured — cannot pay DeepBook trading fees');
  }
  if (!sub.settlementDenomination) {
    throw new Error(`No settlement denomination resolved for platform ${sub.platformId}`);
  }
  if (NETWORK !== 'mainnet' && NETWORK !== 'testnet') {
    throw new Error(`DeepBook routing is not available on network "${NETWORK}"`);
  }

  const schedulerAddress = getSchedulerAddress();
  const schedulerKeypair = getSchedulerKeypair();

  const [platformInitVersion, schedulerInitVersion, deepCoinRef] = await Promise.all([
    getInitialSharedVersion(sub.platformId),
    getInitialSharedVersion(PAYMENT_SCHEDULER_ID),
    getLargestOwnedCoin(schedulerAddress, DEEP_COIN_TYPE),
  ]);

  if (!deepCoinRef) {
    throw new Error(`Scheduler holds no DEEP (${DEEP_COIN_TYPE}) to pay trading fees`);
  }

  const tx = new Transaction();

  const deepbook = createDeepBookClient({
    client: grpcClient,
    address: schedulerAddress,
    network: NETWORK,
    coins: NETWORK === 'mainnet' ? mainnetCoins : testnetCoins,
    pools: NETWORK === 'mainnet' ? mainnetPools : testnetPools,
  });

  buildProcessRoutedPaymentTx({
    tx,
    packageId: PACKAGE_ID,
    registryId: REGISTRY_ID,
    clockId: CLOCK_OBJECT_ID,
    fundingCoinType: sub.denomination,
    platformCoinType: sub.settlementDenomination,
    accountId: sub.accountId,
    platformId: sub.platformId,
    platformInitVersion,
    schedulerId: PAYMENT_SCHEDULER_ID,
    schedulerInitVersion,
    maxSpend: BigInt(pool.maxSpend),
    performSwap: (fundingCoin) => {
      const deepCoinArg = tx.object(deepCoinRef.objectId);
      const { outputCoin, inputChange, deepChange } = swapExactQuantity({
        deepbook,
        tx,
        poolKey: pool.poolKey,
        isBaseToCoin: pool.isBaseToCoin,
        // `amount` is only used by DeepBook to auto-fund an input coin
        // when none is supplied; since we always supply `fundingCoin`
        // below, this value is ignored — see swapExactQuantity's doc.
        amount: BigInt(pool.maxSpend),
        minOut: sub.tierAmount,
        deepAmount: BigInt(pool.deepAmount),
        deepCoin: deepCoinArg,
        ...(pool.isBaseToCoin ? { baseCoin: fundingCoin } : { quoteCoin: fundingCoin }),
      });

      // process_routed_payment requires the exact tier amount in
      // PlatformCoin; split it off and keep any swap-proceeds surplus at
      // the scheduler's own address as an explicit slippage margin.
      const [exactPlatformCoin] = tx.splitCoins(outputCoin, [tx.pure.u64(sub.tierAmount)]);
      tx.transferObjects([outputCoin, deepChange], tx.pure.address(schedulerAddress));

      return { platformCoin: exactPlatformCoin, fundingChange: inputChange };
    },
  });

  tx.setSender(schedulerAddress);

  const gasCoin = await getLargestOwnedCoin(schedulerAddress, '0x2::sui::SUI');
  if (!gasCoin) {
    throw new Error(`Unable to perform gas selection due to insufficient SUI balance for scheduler address ${schedulerAddress}`);
  }
  tx.setGasPayment([{ objectId: gasCoin.objectId, version: gasCoin.version, digest: gasCoin.digest }]);
  tx.setGasBudget(100_000_000);

  const bytes = await tx.build({ client: grpcClient });
  const { signature } = await schedulerKeypair.signTransaction(bytes);

  const result = await grpcClient.core.executeTransaction({
    transaction: bytes,
    signatures: [signature],
    include: { effects: true },
  });

  if (result.$kind === 'FailedTransaction') {
    throw new Error(`Failed execution: ${result.FailedTransaction.status.error?.message}`);
  }

  const digest = result.Transaction.digest;
  await grpcClient.waitForTransaction({ digest });
  return digest;
}
