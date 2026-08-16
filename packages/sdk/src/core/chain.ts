import { SuiGrpcClient } from "@mysten/sui/grpc";
import { getConfig, SupportedNetwork } from "../constants";

const clients = new Map<SupportedNetwork, SuiGrpcClient>();

export function getGrpcClient(network?: SupportedNetwork) {
  const target = network || "testnet";
  if (!clients.has(target)) {
    clients.set(target, new SuiGrpcClient({
      baseUrl: getConfig(target).GRPC_URL,
      network: target as any,
    }));
  }
  return clients.get(target)!;
}

export interface PlatformObject {
  id: string;
  owner: string;
  name: string;
  description: string;
  category: string;
  image_url: string | null;
  is_paused: boolean;
  created_at: number;
  tiers?: Array<{
    name: string;
    amount: string;
    frequency: string;
    subscriber_count: number;
    is_active: boolean;
  }>;
}

export interface SubscriptionAccountObject {
  id: string;
  owner: string;
  paused: boolean;
  closed: boolean;
  address_balance: string;
}

export interface CoinTypeRegistryObject {
  id: string;
  version: number;
}

export interface PlatformVersionInfo {
  objectId: string;
  initialSharedVersion: number;
}

export interface PaymentSchedulerObject {
  id: string;
  initialSharedVersion: number;
  is_paused: boolean;
  min_gas_budget: string;
  last_processed_at?: string;
}

export interface PlatformRegisteredEvent {
  platform_id: string;
  owner: string;
  name: string;
  timestamp: number;
}

export interface AccountCreatedEvent {
  account_id: string;
  cap_id: string;
  owner: string;
  timestamp: number;
}

export interface SubscriptionCreatedEvent {
  subscription_id: string;
  account_id: string;
  platform_id: string;
  tier_index: number;
  amount: string;
  frequency_ms: string;
  timestamp: number;
}

export interface PaymentProcessedEvent {
  id: string;
  account_id: string;
  platform_id: string;
  amount: string;
  timestamp: number;
}

export interface SubscriptionUpdatedEvent {
  id?: string;
  account_id: string;
  platform_id: string;
  change_kind: number;
  timestamp: number;
}

export interface PaymentFailedEvent {
  id: string;
  account_id: string;
  platform_id: string;
  reason: string;
  timestamp: number;
}

export interface DepositEvent {
  id: string;
  account_id: string;
  amount: string;
  timestamp: number;
}

function eventTimestamp(json: Record<string, unknown> | null): number {
  const ts = (json as any)?.timestamp || (json as any)?.timestamp_ms;
  if (ts) return Number(ts);
  return Date.now();
}

function initialSharedVersion(owner: { $kind: string; Shared?: { initialSharedVersion: string } } | undefined): number {
  return owner?.$kind === "Shared" && owner.Shared ? Number(owner.Shared.initialSharedVersion) : 0;
}

/**
 * List every event of `eventType` and filter client-side by `matches`.
 *
 * gRPC's listEvents only filters by sender/module/eventType — unlike
 * GraphQL, there's no affectedObject predicate to scope a query to one
 * account/platform server-side. This scans the most recent page of the
 * type instead: fine for the volumes this protocol currently sees, but a
 * platform/account with heavy history could see events fall off this page
 * before the client-side filter has a chance to find them.
 */
async function listEventsOfType<T>(
  eventType: string,
  parse: (json: Record<string, unknown>) => T,
  network?: SupportedNetwork,
  matches?: (item: T) => boolean,
  limit = 50,
): Promise<T[]> {
  const client = getGrpcClient(network);
  const res = await client.core.listEvents({ filter: { eventType }, limit });
  const items = res.events.map((e) => parse(e.json ?? {}));
  return matches ? items.filter(matches) : items;
}

export async function queryPlatform(platformId: string, network?: SupportedNetwork): Promise<PlatformObject> {
  const client = getGrpcClient(network);
  const res = await client.core.getObject({ objectId: platformId, include: { json: true } });
  const json = res.object.json as any;

  // `tiers` is a Move VecMap<u64, SubscriptionTier> — its on-chain JSON
  // representation is `{ contents: [{ key, value }, ...] }`, not a plain
  // array. Unwrap it so callers get a usable tiers array directly, and map
  // the on-chain `frequency_ms` field to `frequency` for consistency with
  // usePlatform's shape.
  const rawTiers = Array.isArray(json?.tiers) ? json.tiers : json?.tiers?.contents;
  const tiers = Array.isArray(rawTiers)
    ? rawTiers.map((entry: any) => {
        const value = entry?.value ?? entry ?? {};
        return {
          name: value.name ?? "",
          amount: value.amount ?? "0",
          frequency: value.frequency_ms ?? value.frequency ?? "0",
          subscriber_count: Number(value.subscriber_count ?? 0),
          is_active: value.is_active ?? true,
        };
      })
    : json?.tiers;

  return { ...json, tiers } as unknown as PlatformObject;
}

export async function queryMultiplePlatforms(platformIds: string[], network?: SupportedNetwork): Promise<Array<{ objectId: string, initialSharedVersion: number, json: any }>> {
  if (platformIds.length === 0) return [];

  const client = getGrpcClient(network);
  const objects = await Promise.all(
    platformIds.map((id) => client.core.getObject({ objectId: id, include: { json: true } }))
  );

  return objects.map(({ object: obj }) => {
    const json = (obj.json as any) || {};
    let parsedTiers = [];

    if (json.tiers && Array.isArray(json.tiers)) {
      parsedTiers = json.tiers;
    } else if (json.tiers?.contents && Array.isArray(json.tiers.contents)) {
      parsedTiers = json.tiers.contents.map((t: any) => {
        const val = t.value || {};
        let frequency = val.frequency || val.frequency_ms || "monthly";

        if (frequency === "86400000") frequency = "daily";
        else if (frequency === "604800000") frequency = "weekly";
        else if (frequency === "2592000000") frequency = "monthly";
        else if (frequency === "31536000000") frequency = "yearly";

        return {
          name: val.name || "",
          amount: val.amount || "0",
          frequency,
          subscriber_count: parseInt(val.subscriber_count || "0", 10),
          is_active: val.is_active ?? true,
        };
      });
    }

    return {
      objectId: obj.objectId,
      initialSharedVersion: initialSharedVersion(obj.owner as any),
      json: {
        ...json,
        tiers: parsedTiers,
      },
    };
  });
}

export async function queryAccount(accountId: string, network?: SupportedNetwork): Promise<SubscriptionAccountObject> {
  const client = getGrpcClient(network);
  const res = await client.core.getObject({ objectId: accountId, include: { json: true } });
  return res.object.json as unknown as SubscriptionAccountObject;
}

export async function queryCoinTypeRegistry(registryId: string, network?: SupportedNetwork): Promise<CoinTypeRegistryObject> {
  const client = getGrpcClient(network);
  const res = await client.core.getObject({ objectId: registryId, include: { json: true } });
  return res.object.json as unknown as CoinTypeRegistryObject;
}

export async function queryPaymentScheduler(schedulerId: string, network?: SupportedNetwork): Promise<PaymentSchedulerObject> {
  const client = getGrpcClient(network);
  const res = await client.core.getObject({ objectId: schedulerId, include: { json: true } });
  return {
    ...(res.object.json as any),
    initialSharedVersion: initialSharedVersion(res.object.owner as any),
  };
}

export async function queryPlatformInitialVersions(
  platformIds: string[],
  network?: SupportedNetwork,
): Promise<PlatformVersionInfo[]> {
  if (platformIds.length === 0) return [];

  const client = getGrpcClient(network);
  return Promise.all(
    platformIds.map(async (id) => {
      const res = await client.core.getObject({ objectId: id });
      return {
        objectId: id,
        initialSharedVersion: initialSharedVersion(res.object.owner as any),
      };
    })
  );
}

export async function queryPlatformsByOwner(owner: string, network?: SupportedNetwork): Promise<PlatformRegisteredEvent[]> {
  const config = getConfig(network);
  return listEventsOfType<PlatformRegisteredEvent>(
    `${config.PACKAGE_ID}::platform::PlatformRegistered`,
    (json) => ({ ...(json as any), timestamp: eventTimestamp(json) }),
    network,
    (e) => e.owner === owner,
  );
}

export async function queryAccountCreatedEvents(sender: string, network?: SupportedNetwork): Promise<AccountCreatedEvent[]> {
  const config = getConfig(network);
  return listEventsOfType<AccountCreatedEvent>(
    `${config.PACKAGE_ID}::account::AccountCreated`,
    (json) => ({ ...(json as any), timestamp: eventTimestamp(json) }),
    network,
    (e) => e.owner === sender,
  );
}

export async function queryPlatformRegisteredEvents(network?: SupportedNetwork): Promise<PlatformRegisteredEvent[]> {
  const config = getConfig(network);
  return listEventsOfType<PlatformRegisteredEvent>(
    `${config.PACKAGE_ID}::platform::PlatformRegistered`,
    (json) => ({ ...(json as any), timestamp: eventTimestamp(json) }),
    network,
  );
}

export async function querySubscriptionCreatedEvents(accountId: string, network?: SupportedNetwork): Promise<SubscriptionCreatedEvent[]> {
  const config = getConfig(network);
  return listEventsOfType<SubscriptionCreatedEvent>(
    `${config.PACKAGE_ID}::billing::SubscriptionCreated`,
    (json) => ({ ...(json as any), timestamp: eventTimestamp(json) }),
    network,
    (e) => e.account_id === accountId,
  );
}

export async function querySubscriptionCreatedEventsByPlatform(platformId: string, network?: SupportedNetwork): Promise<SubscriptionCreatedEvent[]> {
  const config = getConfig(network);
  return listEventsOfType<SubscriptionCreatedEvent>(
    `${config.PACKAGE_ID}::billing::SubscriptionCreated`,
    (json) => ({ ...(json as any), timestamp: eventTimestamp(json) }),
    network,
    (e) => e.platform_id === platformId,
  );
}

export async function queryPaymentProcessedEvents(
  accountId?: string,
  platformId?: string,
  network?: SupportedNetwork
): Promise<PaymentProcessedEvent[]> {
  const config = getConfig(network);
  const events = await listEventsOfType<PaymentProcessedEvent>(
    `${config.PACKAGE_ID}::payment::PaymentProcessed`,
    (json) => ({ ...(json as any), timestamp: eventTimestamp(json) }),
    network,
  );
  return events.filter((e) => (!accountId || e.account_id === accountId) && (!platformId || e.platform_id === platformId));
}

export async function queryPaymentFailedEvents(
  accountId?: string,
  platformId?: string,
  network?: SupportedNetwork
): Promise<PaymentFailedEvent[]> {
  const config = getConfig(network);
  const events = await listEventsOfType<PaymentFailedEvent>(
    `${config.PACKAGE_ID}::payment::PaymentFailed`,
    (json) => ({ ...(json as any), timestamp: eventTimestamp(json) }),
    network,
  );
  return events.filter((e) => (!accountId || e.account_id === accountId) && (!platformId || e.platform_id === platformId));
}

export async function queryDepositEvents(accountId: string, network?: SupportedNetwork): Promise<DepositEvent[]> {
  const config = getConfig(network);
  return listEventsOfType<DepositEvent>(
    `${config.PACKAGE_ID}::account::Deposit`,
    (json) => ({ ...(json as any), timestamp: eventTimestamp(json) }),
    network,
    (e) => e.account_id === accountId,
  );
}

export async function queryRecentEventsByType(
  type: string,
  limit: number = 10,
  network?: SupportedNetwork
): Promise<Array<{ id: string; transactionDigest: string; timestamp: number; json: Record<string, unknown> }>> {
  const client = getGrpcClient(network);
  const res = await client.core.listEvents({ filter: { eventType: type }, limit: 50 });
  return res.events.slice(0, limit).map((e) => ({
    id: e.transactionDigest,
    transactionDigest: e.transactionDigest,
    timestamp: eventTimestamp(e.json),
    json: e.json ?? {},
  }));
}

export async function querySubscriptionUpdatedEventsByPlatform(
  platformId: string,
  network?: SupportedNetwork
): Promise<SubscriptionUpdatedEvent[]> {
  const config = getConfig(network);
  return listEventsOfType<SubscriptionUpdatedEvent>(
    `${config.PACKAGE_ID}::billing::SubscriptionUpdated`,
    (json) => ({ ...(json as any), timestamp: eventTimestamp(json) }),
    network,
    (e) => e.platform_id === platformId,
  );
}

export async function queryCoins(owner: string, coinType: string, network?: SupportedNetwork): Promise<Array<{ id: string, balance: string }>> {
  const client = getGrpcClient(network);
  const res = await client.core.listCoins({ owner, coinType });
  return res.objects.map((coin) => ({ id: coin.objectId, balance: coin.balance }));
}
