import { client } from '../lib/sui.js';
import { PACKAGE_ID } from '../lib/config.js';

/**
 * Represents a platform discovered from events
 */
export interface DiscoveredPlatform {
  platformId: string;
  owner: string;
}

/**
 * Discovers all registered platforms by querying PlatformRegistered events
 * @returns Array of discovered platforms
 */
export async function discoverPlatforms(): Promise<DiscoveredPlatform[]> {
  console.log('[Discovery] Discovering platforms from PlatformRegistered events...');

  try {
    // Query for PlatformRegistered events
    // The event type follows the pattern: ${PACKAGE_ID}::platform::PlatformRegistered
    const platformRegisteredEventType = `${PACKAGE_ID}::platform::PlatformRegistered`;
    
    const events = await client.queryEvents({
      query: {
        MoveEventType: platformRegisteredEventType,
      },
      limit: 100,
    });

    const platforms: DiscoveredPlatform[] = [];

    for (const event of events.data) {
      if (event.type === platformRegisteredEventType && event.parsedJson) {
        const parsed = event.parsedJson as {
          platform_id?: string;
          owner?: string;
          // Some events may have different field names
          id?: string;
        };

        const platformId = parsed.platform_id || parsed.id;
        const owner = parsed.owner;

        if (platformId && owner) {
          platforms.push({
            platformId,
            owner,
          });
          console.log(`[Discovery] Found platform: ${platformId} (owner: ${owner})`);
        }
      }
    }

    console.log(`[Discovery] Discovered ${platforms.length} platforms`);
    return platforms;
  } catch (error) {
    console.error('[Discovery] Error discovering platforms:', error);
    return [];
  }
}

/**
 * Represents an active subscription discovered from events
 */
export interface DiscoveredSubscription {
  accountId: string;
  platformId: string;
  subscriptionId: string;
  nextBillingTime: bigint;
  denomination: string;
}

/**
 * Discovers active subscriptions for a given platform
 * @param platformId The platform ID to query subscriptions for
 * @returns Array of discovered subscriptions
 */
export async function discoverSubscriptions(platformId: string): Promise<DiscoveredSubscription[]> {
  console.log(`[Discovery] Discovering subscriptions for platform: ${platformId}`);

  try {
    // 1. Query for SubscriptionCreated events for this platform to find all account IDs
    const subscriptionCreatedEventType = `${PACKAGE_ID}::billing::SubscriptionCreated`;
    
    // In a production system, we'd paginate through all events or use an indexer.
    // For this demo, we'll fetch a large chunk.
    const events = await client.queryEvents({
      query: {
        MoveEventType: subscriptionCreatedEventType,
      },
      limit: 1000,
    });

    const accountIds = new Set<string>();

    for (const event of events.data) {
      if (event.type === subscriptionCreatedEventType && event.parsedJson) {
        const parsed = event.parsedJson as {
          platform_id?: string;
          account_id?: string;
        };

        if (parsed.platform_id === platformId && parsed.account_id) {
          accountIds.add(parsed.account_id);
        }
      }
    }

    if (accountIds.size === 0) {
      console.log(`[Discovery] No accounts found for platform ${platformId}`);
      return [];
    }

    console.log(`[Discovery] Found ${accountIds.size} unique accounts. Fetching account objects...`);

    // 2. Fetch the actual account objects in batches
    const accountIdsArray = Array.from(accountIds);
    const subscriptions: DiscoveredSubscription[] = [];
    
    // multiGetObjects allows max 50 objects per request
    const BATCH_SIZE = 50;
    for (let i = 0; i < accountIdsArray.length; i += BATCH_SIZE) {
      const batchIds = accountIdsArray.slice(i, i + BATCH_SIZE);
      const objects = await client.multiGetObjects({
        ids: batchIds,
        options: { showContent: true, showType: true },
      });

      for (const obj of objects) {
        if (!obj.data || !obj.data.content || obj.data.content.dataType !== 'moveObject') continue;
        
        const accountId = obj.data.objectId;
        const typeStr = obj.data.type || '';
        
        // Extract denomination from type: ...::account::SubscriptionAccount<DENOMINATION>
        const match = typeStr.match(/<(.+)>/);
        const denomination = match ? match[1] : '';

        if (!denomination) continue;

        // Parse VecMap containing subscriptions
        const fields = obj.data.content.fields as any;
        const subscriptionsMap = fields.subscriptions?.fields?.contents || [];

        // Find the subscription for this platform
        const platformSub = subscriptionsMap.find((entry: any) => entry.fields.key === platformId);
        
        if (platformSub) {
          const subData = platformSub.fields.value.fields;
          // status === 0 means active
          if (subData.status === 0) {
            subscriptions.push({
              accountId,
              platformId,
              subscriptionId: platformId, // In V2, platformId is effectively the subscription key
              nextBillingTime: BigInt(subData.next_billing_time),
              denomination,
            });
          }
        }
      }
    }

    console.log(`[Discovery] Found ${subscriptions.length} active subscriptions for platform ${platformId}`);
    return subscriptions;
  } catch (error) {
    console.error(`[Discovery] Error discovering subscriptions for platform ${platformId}:`, error);
    return [];
  }
}

/**
 * Gets the current time from the Clock object
 * @returns Current Unix timestamp in milliseconds
 */
export async function getCurrentTime(): Promise<bigint> {
  try {
    const clockObject = await client.getObject({
      id: '0x0000000000000000000000000000000000000000000000000000000000000006',
      options: {
        showContent: true,
      },
    });

    if (clockObject.data?.content?.dataType === 'moveObject') {
      const content = clockObject.data.content.fields as { timestamp_ms?: string | number };
      return BigInt(content.timestamp_ms || 0);
    }

    return BigInt(Date.now());
  } catch (error) {
    console.error('[Discovery] Error getting current time from Clock:', error);
    return BigInt(Date.now());
  }
}

/**
 * Filters subscriptions that are due for payment
 * @param subscriptions Array of subscriptions to filter
 * @param currentTime Current time to compare against
 * @returns Subscriptions that are due (next_billing_time <= currentTime)
 */
export function filterDueSubscriptions(
  subscriptions: DiscoveredSubscription[],
  currentTime: bigint
): DiscoveredSubscription[] {
  return subscriptions.filter(sub => sub.nextBillingTime <= currentTime);
}
