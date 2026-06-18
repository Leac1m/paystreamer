import { client } from '../lib/sui.js';
import { PACKAGE_ID } from '../lib/config.js';
import { QueryTransactionBlocksResponse } from '@mysten/sui/client';

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
    // Query for SubscriptionCreated events for this platform
    const subscriptionCreatedEventType = `${PACKAGE_ID}::billing::SubscriptionCreated`;
    
    const events = await client.queryEvents({
      query: {
        MoveEventType: subscriptionCreatedEventType,
      },
      limit: 200,
    });

    const subscriptions: DiscoveredSubscription[] = [];

    for (const event of events.data) {
      if (event.type === subscriptionCreatedEventType && event.parsedJson) {
        const parsed = event.parsedJson as {
          platform_id?: string;
          account_id?: string;
          subscription_id?: string;
          next_billing_time?: string | number;
          subscription?: {
            next_billing_time?: string | number;
            denomination?: string;
          };
        };

        // Filter by platform
        const eventPlatformId = parsed.platform_id;
        if (eventPlatformId !== platformId) {
          continue;
        }

        const accountId = parsed.account_id;
        const subscriptionId = parsed.subscription_id;
        
        // Extract next billing time and denomination
        let nextBillingTime: string | number = 0;
        let denomination = '';

        if (parsed.subscription) {
          nextBillingTime = parsed.subscription.next_billing_time || 0;
          denomination = parsed.subscription.denomination || '';
        } else {
          nextBillingTime = parsed.next_billing_time || 0;
        }

        if (accountId && subscriptionId) {
          subscriptions.push({
            accountId,
            platformId: eventPlatformId,
            subscriptionId,
            nextBillingTime: BigInt(nextBillingTime),
            denomination,
          });
        }
      }
    }

    console.log(`[Discovery] Found ${subscriptions.length} subscriptions for platform ${platformId}`);
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
