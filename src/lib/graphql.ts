import { SuiGraphQLClient } from "@mysten/sui/graphql";
import {
  DEVNET_V2_PACKAGE_ID,
  GRAPHQL_URL,
} from "../constants";

export const graphqlClient = new SuiGraphQLClient({
  url: GRAPHQL_URL,
  network: "devnet",
});

export interface PlatformObject {
  id: string;
  owner: string;
  name: string;
  description: string;
  category: string;
  image_url: string | null;
  is_paused: boolean;
  created_at: number;
}

export interface SubscriptionAccountObject {
  id: string;
  owner: string;
  paused: boolean;
  closed: boolean;
  balance: { value: string };
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

async function executeQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const result = await graphqlClient.query({ query, variables });
  return result.data as T;
}

export async function queryPlatform(platformId: string): Promise<PlatformObject> {
  const data = await executeQuery<{ object: { asMoveObject: { contents: { json: PlatformObject } }, owner: { initialSharedVersion: number } } }>(
    `query GetPlatform($id: SuiAddress!) {
      object(address: $id) {
        asMoveObject { contents { json } }
        owner { ... on Shared { initialSharedVersion } }
      }
    }`,
    { id: platformId }
  );
  return data.object.asMoveObject.contents.json;
}

export async function queryAccount(accountId: string): Promise<SubscriptionAccountObject> {
  const data = await executeQuery<{ object: { asMoveObject: { contents: { json: SubscriptionAccountObject } } } }>(
    `query GetAccount($id: SuiAddress!) {
      object(address: $id) {
        asMoveObject { contents { json } }
      }
    }`,
    { id: accountId }
  );
  return data.object.asMoveObject.contents.json;
}

export async function queryCoinTypeRegistry(registryId: string): Promise<CoinTypeRegistryObject> {
  const data = await executeQuery<{ object: { asMoveObject: { contents: { json: CoinTypeRegistryObject } } } }>(
    `query GetRegistry($id: SuiAddress!) {
      object(address: $id) {
        asMoveObject { contents { json } }
      }
    }`,
    { id: registryId }
  );
  return data.object.asMoveObject.contents.json;
}

export async function queryPaymentScheduler(schedulerId: string): Promise<PaymentSchedulerObject> {
  const data = await executeQuery<{ object: { asMoveObject: { contents: { json: PaymentSchedulerObject } }, owner: { initialSharedVersion: number } } }>(
    `query GetScheduler($id: SuiAddress!) {
      object(address: $id) {
        asMoveObject { contents { json } }
        owner { ... on Shared { initialSharedVersion } }
      }
    }`,
    { id: schedulerId }
  );
  return {
    ...data.object.asMoveObject.contents.json,
    initialSharedVersion: data.object.owner?.initialSharedVersion ?? 0,
  };
}

export async function queryPlatformInitialVersions(
  platformIds: string[]
): Promise<PlatformVersionInfo[]> {
  if (platformIds.length === 0) return [];

  const results = await Promise.all(
    platformIds.map(async (id) => {
      const data = await executeQuery<{ object: { owner: { initialSharedVersion: number } | null } }>(
        `query GetPlatformVersion($id: SuiAddress!) {
          object(address: $id) {
            owner { ... on Shared { initialSharedVersion } }
          }
        }`,
        { id }
      );
      return {
        objectId: id,
        initialSharedVersion: data.object?.owner?.initialSharedVersion ?? 0,
      };
    })
  );

  return results;
}

export async function queryPlatformsByOwner(owner: string): Promise<PlatformRegisteredEvent[]> {
  const data = await executeQuery<{ events: { nodes: { timestamp: string, contents: { json: PlatformRegisteredEvent } }[] } }>(
    `query GetPlatformsByOwner($type: String!, $owner: SuiAddress!) {
      events(first: 50, filter: { type: $type, sender: $owner }) {
        nodes { timestamp, contents { json } }
      }
    }`,
    { type: `${DEVNET_V2_PACKAGE_ID}::platform::PlatformRegistered`, owner }
  );
  return data.events.nodes.map((n) => ({ ...n.contents.json, timestamp: new Date(n.timestamp).getTime() }) as PlatformRegisteredEvent);
}

export async function queryAccountCreatedEvents(sender: string): Promise<AccountCreatedEvent[]> {
  const data = await executeQuery<{ events: { nodes: { timestamp: string, contents: { json: AccountCreatedEvent } }[] } }>(
    `query GetAccountCreated($type: String!, $sender: SuiAddress!) {
      events(first: 50, filter: { type: $type, sender: $sender }) {
        nodes { timestamp, contents { json } }
      }
    }`,
    { type: `${DEVNET_V2_PACKAGE_ID}::account::AccountCreated`, sender }
  );
  return data.events.nodes.map((n) => ({ ...n.contents.json, timestamp: new Date(n.timestamp).getTime() }) as AccountCreatedEvent);
}

export async function queryPlatformRegisteredEvents(): Promise<PlatformRegisteredEvent[]> {
  const data = await executeQuery<{ events: { nodes: { timestamp: string, contents: { json: PlatformRegisteredEvent } }[] } }>(
    `query GetPlatformRegistered($type: String!) {
      events(first: 50, filter: { type: $type }) {
        nodes { timestamp, contents { json } }
      }
    }`,
    { type: `${DEVNET_V2_PACKAGE_ID}::platform::PlatformRegistered` }
  );
  return data.events.nodes.map((n) => ({ ...n.contents.json, timestamp: new Date(n.timestamp).getTime() }) as PlatformRegisteredEvent);
}

export async function querySubscriptionCreatedEvents(accountId: string): Promise<SubscriptionCreatedEvent[]> {
  const data = await executeQuery<{ events: { nodes: { timestamp: string, contents: { json: SubscriptionCreatedEvent } }[] } }>(
    `query GetSubscriptionCreated($type: String!) {
      events(first: 50, filter: { type: $type }) {
        nodes { timestamp, contents { json } }
      }
    }`,
    { type: `${DEVNET_V2_PACKAGE_ID}::billing::SubscriptionCreated` }
  );
  return data.events.nodes
    .map((n) => ({ ...n.contents.json, timestamp: new Date(n.timestamp).getTime() }) as SubscriptionCreatedEvent)
    .filter((e) => e.account_id === accountId);
}

export async function querySubscriptionCreatedEventsByPlatform(platformId: string): Promise<SubscriptionCreatedEvent[]> {
  const data = await executeQuery<{ events: { nodes: { timestamp: string, contents: { json: SubscriptionCreatedEvent } }[] } }>(
    `query GetSubscriptionCreated($type: String!) {
      events(first: 50, filter: { type: $type }) {
        nodes { timestamp, contents { json } }
      }
    }`,
    { type: `${DEVNET_V2_PACKAGE_ID}::billing::SubscriptionCreated` }
  );
  return data.events.nodes
    .map((n) => ({ ...n.contents.json, timestamp: new Date(n.timestamp).getTime() }) as SubscriptionCreatedEvent)
    .filter((e) => e.platform_id === platformId);
}

export async function queryPaymentProcessedEvents(
  accountId?: string,
  platformId?: string
): Promise<PaymentProcessedEvent[]> {
  const allEvents = await executeQuery<{ events: { nodes: { timestamp: string, contents: { json: PaymentProcessedEvent } }[] } }>(
    `query GetPaymentProcessed($type: String!) {
      events(first: 50, filter: { type: $type }) {
        nodes { timestamp, contents { json } }
      }
    }`,
    { type: `${DEVNET_V2_PACKAGE_ID}::payment::PaymentProcessed` }
  );
  let events = allEvents.events.nodes.map((n) => ({ ...n.contents.json, timestamp: new Date(n.timestamp).getTime() }) as PaymentProcessedEvent);
  if (accountId) {
    events = events.filter((e) => e.account_id === accountId);
  }
  if (platformId) {
    events = events.filter((e) => e.platform_id === platformId);
  }
  return events;
}

export async function queryPaymentFailedEvents(accountId?: string): Promise<PaymentFailedEvent[]> {
  const allEvents = await executeQuery<{ events: { nodes: { timestamp: string, contents: { json: PaymentFailedEvent } }[] } }>(
    `query GetPaymentFailed($type: String!) {
      events(first: 50, filter: { type: $type }) {
        nodes { timestamp, contents { json } }
      }
    }`,
    { type: `${DEVNET_V2_PACKAGE_ID}::payment::PaymentFailed` }
  );
  let events = allEvents.events.nodes.map((n) => ({ ...n.contents.json, timestamp: new Date(n.timestamp).getTime() }) as PaymentFailedEvent);
  if (accountId) {
    events = events.filter((e) => e.account_id === accountId);
  }
  return events;
}

export async function queryDepositEvents(accountId: string): Promise<DepositEvent[]> {
  const data = await executeQuery<{ events: { nodes: { timestamp: string, contents: { json: DepositEvent } }[] } }>(
    `query GetDeposits($type: String!) {
      events(first: 50, filter: { type: $type }) {
        nodes { timestamp, contents { json } }
      }
    }`,
    { type: `${DEVNET_V2_PACKAGE_ID}::account::Deposit` }
  );
  return data.events.nodes
    .map((n) => ({ ...n.contents.json, timestamp: new Date(n.timestamp).getTime() }) as DepositEvent)
    .filter((e) => e.account_id === accountId);
}

export async function queryRecentEventsByType(
  type: string,
  limit: number = 10
): Promise<Array<{ id: string; transactionDigest: string; timestamp: number; json: Record<string, unknown> }>> {
  const data = await executeQuery<{ events: { nodes: { id: string; transactionDigest: string; timestamp: string; contents: { json: Record<string, unknown> } }[] } }>(
    `query GetRecentEvents($type: String!) {
      events(first: 50, filter: { type: $type }) {
        nodes {
          id
          transactionDigest
          timestamp
          contents { json }
        }
      }
    }`,
    { type }
  );
  return (data.events?.nodes ?? []).map((n) => ({
    id: n.id,
    transactionDigest: n.transactionDigest,
    timestamp: new Date(n.timestamp).getTime(),
    json: n.contents?.json ?? {},
  })).slice(0, limit);
}

export async function querySubscriptionUpdatedEventsByPlatform(
  platformId: string
): Promise<SubscriptionUpdatedEvent[]> {
  const data = await executeQuery<{ events: { nodes: { timestamp: string, contents: { json: SubscriptionUpdatedEvent } }[] } }>(
    `query GetSubscriptionUpdated($type: String!) {
      events(first: 50, filter: { type: $type }) {
        nodes { timestamp, contents { json } }
      }
    }`,
    { type: `${DEVNET_V2_PACKAGE_ID}::billing::SubscriptionUpdated` }
  );
  return data.events.nodes
    .map((n) => ({ ...n.contents.json, timestamp: new Date(n.timestamp).getTime() }) as SubscriptionUpdatedEvent)
    .filter((e) => e.platform_id === platformId);
}