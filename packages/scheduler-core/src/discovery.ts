import type { SchedulerContext } from './context.js';
import { normalizeCoinType } from './typeNames.js';

export interface DiscoveredPlatform {
  platformId: string;
}

export interface DiscoveredSubscription {
  accountId: string;
  platformId: string;
  nextBillingTime: bigint;
  /** The coin type the account actually holds (`SubscriptionAccount<T>`'s `T`), canonicalized by `normalizeCoinType`. */
  denomination: string;
  /** Index into the platform's tier `VecMap` this subscription is billed under. */
  tierIndex: number;
  /** Per-cycle amount owed, in the settlement currency's smallest unit (`Subscription.tier_amount`). */
  tierAmount: bigint;
  /**
   * The coin type the platform's tier actually settles in
   * (`SubscriptionTier.denomination`), canonicalized by `normalizeCoinType`.
   * Undefined if the tier lookup fails — treated as "unknown, do not route"
   * rather than assumed same-currency.
   */
  settlementDenomination?: string;
}

export async function discoverPlatforms(ctx: SchedulerContext): Promise<DiscoveredPlatform[]> {
  console.log('[Discovery] Discovering platforms from PlatformRegistered events...');

  try {
    const platformRegisteredEventType = `${ctx.packageId}::platform::PlatformRegistered`;

    const query = `
      query getPlatformEvents($eventType: String!) {
        events(filter: { type: $eventType }, last: 50) {
          nodes {
            contents {
              json
            }
          }
        }
      }
    `;

    const result = await ctx.gqlClient.query({
      query,
      variables: { eventType: platformRegisteredEventType }
    });

    const platforms: DiscoveredPlatform[] = [];
    const nodes = (result.data as any)?.events?.nodes || [];

    for (const node of nodes) {
      const json = node.contents?.json;
      if (json && (json.platform_id || json.id)) {
        platforms.push({ platformId: json.platform_id || json.id });
      }
    }

    console.log(`[Discovery] Discovered ${platforms.length} platforms`);
    return platforms;
  } catch (error) {
    console.error('[Discovery] Error discovering platforms:', error);
    return [];
  }
}

export async function discoverSubscriptions(
  ctx: SchedulerContext,
  platformId: string,
): Promise<DiscoveredSubscription[]> {
  try {
    const subscriptionCreatedEventType = `${ctx.packageId}::subscription::SubscriptionCreated`;

    const query = `
      query getSubEvents($eventType: String!) {
        events(filter: { type: $eventType }, last: 50) {
          nodes {
            contents {
              json
            }
          }
        }
      }
    `;

    const result = await ctx.gqlClient.query({
      query,
      variables: { eventType: subscriptionCreatedEventType }
    });

    const accountIds = new Set<string>();
    const nodes = (result.data as any)?.events?.nodes || [];

    for (const node of nodes) {
      const json = node.contents?.json;
      if (json && json.platform_id === platformId && json.account_id) {
        accountIds.add(json.account_id);
      }
    }

    if (accountIds.size === 0) return [];

    const accountIdsArray = Array.from(accountIds);
    const subscriptions: DiscoveredSubscription[] = [];

    const BATCH_SIZE = 50;
    for (let i = 0; i < accountIdsArray.length; i += BATCH_SIZE) {
      const batchIds = accountIdsArray.slice(i, i + BATCH_SIZE);

      try {
        const objects = await ctx.grpcClient.core.getObjects({
          objectIds: batchIds,
          include: { json: true, type: true }
        });

        for (const obj of objects.objects) {
          if (obj instanceof Error || !('json' in obj) || !obj.json) continue;

          const accountId = obj.objectId;
          const typeStr = obj.type || '';

          const match = typeStr.match(/<(.+)>/);
          // Canonicalized so it compares equal to the tier's `TypeName`,
          // which the chain encodes without the `0x` prefix.
          const denomination = match ? normalizeCoinType(match[1]) : '';
          if (!denomination) continue;

          const fields = obj.json as any;
          const subscriptionsMap = fields.subscriptions?.fields?.contents || fields.subscriptions?.contents || [];

          const platformSub = subscriptionsMap.find((entry: any) => (entry.fields?.key || entry.key) === platformId);
          if (platformSub) {
            const subData = platformSub.fields?.value?.fields || platformSub.value?.fields || platformSub.value;
            const statusVal = typeof subData.status === 'object' ? subData.status?.variant : subData.status;
            if (statusVal === 0) { // Active
              subscriptions.push({
                accountId,
                platformId,
                nextBillingTime: BigInt(subData.next_billing_time || 0),
                denomination,
                tierIndex: Number(subData.tier_index ?? 0),
                tierAmount: BigInt(subData.tier_amount || 0),
              });
            }
          }
        }
      } catch (err) {
        console.error(`[Discovery] Error fetching objects batch:`, err);
      }
    }

    if (subscriptions.length > 0) {
      const tierDenominations = await getPlatformTierDenominations(ctx, platformId);
      for (const sub of subscriptions) {
        sub.settlementDenomination = tierDenominations.get(sub.tierIndex);
      }
    }

    return subscriptions;
  } catch (error) {
    console.error(`[Discovery] Error discovering subscriptions for ${platformId}:`, error);
    return [];
  }
}

/**
 * Reads a platform's tier `VecMap<u64, SubscriptionTier>` and returns
 * tier_index -> settlement denomination (`SubscriptionTier.denomination`,
 * a `TypeName` which gRPC encodes as a plain fully-qualified type string,
 * e.g. `"0xpkg::pusd::PUSD"` — confirmed directly against a live testnet
 * platform object, not assumed). One call per platform per cycle.
 */
export async function getPlatformTierDenominations(
  ctx: SchedulerContext,
  platformId: string,
): Promise<Map<number, string>> {
  const denominations = new Map<number, string>();
  try {
    const res = await ctx.grpcClient.core.getObject({ objectId: platformId, include: { json: true } });
    const json = res.object?.json as any;
    const rawTiers = Array.isArray(json?.tiers) ? json.tiers : json?.tiers?.contents;
    if (Array.isArray(rawTiers)) {
      rawTiers.forEach((entry: any, idx: number) => {
        const value = entry?.value ?? entry ?? {};
        const key = entry?.key !== undefined ? Number(entry.key) : idx;
        if (typeof value.denomination === 'string') {
          denominations.set(key, normalizeCoinType(value.denomination));
        }
      });
    }
  } catch (error) {
    console.error(`[Discovery] Error fetching tier denominations for ${platformId}:`, error);
  }
  return denominations;
}

export async function getCurrentTime(ctx: SchedulerContext): Promise<bigint> {
  try {
    const clockObject = await ctx.grpcClient.core.getObject({
      objectId: '0x6',
      include: { json: true }
    });

    if (clockObject.object?.json) {
      const content = clockObject.object.json as { timestamp_ms?: string | number };
      return BigInt(content.timestamp_ms || 0);
    }
    return BigInt(Date.now());
  } catch (error) {
    console.error('[Discovery] Error getting clock time:', error);
    return BigInt(Date.now());
  }
}

export function filterDueSubscriptions(
  subscriptions: DiscoveredSubscription[],
  currentTime: bigint
): DiscoveredSubscription[] {
  return subscriptions.filter(sub => sub.nextBillingTime <= currentTime);
}
