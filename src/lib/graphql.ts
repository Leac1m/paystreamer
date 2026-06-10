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

export interface PaymentSchedulerObject {
  id: string;
  is_paused: boolean;
  min_gas_budget: string;
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
  const data = await executeQuery<{ object: { contents: { json: PlatformObject } } }>(
    `query GetPlatform($id: SuiAddress!) {
      object(address: $id) {
        asMoveObject { contents { json } }
        owner { ... on Shared { initialSharedVersion } }
      }
    }`,
    { id: platformId }
  );
  return data.object.contents.json;
}

export async function queryAccount(accountId: string): Promise<SubscriptionAccountObject> {
  const data = await executeQuery<{ object: { contents: { json: SubscriptionAccountObject } } }>(
    `query GetAccount($id: SuiAddress!) {
      object(address: $id) {
        asMoveObject { contents { json } }
      }
    }`,
    { id: accountId }
  );
  return data.object.contents.json;
}

export async function queryCoinTypeRegistry(registryId: string): Promise<CoinTypeRegistryObject> {
  const data = await executeQuery<{ object: { contents: { json: CoinTypeRegistryObject } } }>(
    `query GetRegistry($id: SuiAddress!) {
      object(address: $id) {
        asMoveObject { contents { json } }
      }
    }`,
    { id: registryId }
  );
  return data.object.contents.json;
}

export async function queryPaymentScheduler(schedulerId: string): Promise<PaymentSchedulerObject> {
  const data = await executeQuery<{ object: { contents: { json: PaymentSchedulerObject } } }>(
    `query GetScheduler($id: SuiAddress!) {
      object(address: $id) {
        asMoveObject { contents { json } }
      }
    }`,
    { id: schedulerId }
  );
  return data.object.contents.json;
}

export async function queryPlatformsByOwner(owner: string): Promise<PlatformRegisteredEvent[]> {
  const data = await executeQuery<{ events: { nodes: { contents: { json: PlatformRegisteredEvent } }[] } }>(
    `query GetPlatformsByOwner($type: String!, $owner: SuiAddress!) {
      events(first: 50, filter: { type: $type, sender: $owner }) {
        nodes { contents { json } }
      }
    }`,
    { type: `${DEVNET_V2_PACKAGE_ID}::platform::PlatformRegistered`, owner }
  );
  return data.events.nodes.map((n) => n.contents.json);
}

export async function queryAccountCreatedEvents(sender: string): Promise<AccountCreatedEvent[]> {
  const data = await executeQuery<{ events: { nodes: { contents: { json: AccountCreatedEvent } }[] } }>(
    `query GetAccountCreated($type: String!, $sender: SuiAddress!) {
      events(first: 50, filter: { type: $type, sender: $sender }) {
        nodes { contents { json } }
      }
    }`,
    { type: `${DEVNET_V2_PACKAGE_ID}::account::AccountCreated`, sender }
  );
  return data.events.nodes.map((n) => n.contents.json);
}

export async function queryPlatformRegisteredEvents(): Promise<PlatformRegisteredEvent[]> {
  const data = await executeQuery<{ events: { nodes: { contents: { json: PlatformRegisteredEvent } }[] } }>(
    `query GetPlatformRegistered($type: String!) {
      events(first: 50, filter: { type: $type }) {
        nodes { contents { json } }
      }
    }`,
    { type: `${DEVNET_V2_PACKAGE_ID}::platform::PlatformRegistered` }
  );
  return data.events.nodes.map((n) => n.contents.json);
}

export async function querySubscriptionCreatedEvents(accountId: string): Promise<SubscriptionCreatedEvent[]> {
  const data = await executeQuery<{ events: { nodes: { contents: { json: SubscriptionCreatedEvent } }[] } }>(
    `query GetSubscriptionCreated($type: String!, $accountId: SuiAddress!) {
      events(first: 50, filter: { type: $type }) {
        nodes { contents { json } }
      }
    }`,
    { type: `${DEVNET_V2_PACKAGE_ID}::billing::SubscriptionCreated` }
  );
  return data.events.nodes
    .map((n) => n.contents.json)
    .filter((e) => e.account_id === accountId);
}

export async function queryPaymentProcessedEvents(
  accountId?: string,
  platformId?: string
): Promise<PaymentProcessedEvent[]> {
  const allEvents = await executeQuery<{ events: { nodes: { contents: { json: PaymentProcessedEvent } }[] } }>(
    `query GetPaymentProcessed($type: String!) {
      events(first: 100, filter: { type: $type }) {
        nodes { contents { json } }
      }
    }`,
    { type: `${DEVNET_V2_PACKAGE_ID}::payment::PaymentProcessed` }
  );
  let events = allEvents.events.nodes.map((n) => n.contents.json);
  if (accountId) {
    events = events.filter((e) => e.account_id === accountId);
  }
  if (platformId) {
    events = events.filter((e) => e.platform_id === platformId);
  }
  return events;
}

export async function queryPaymentFailedEvents(accountId?: string): Promise<PaymentFailedEvent[]> {
  const allEvents = await executeQuery<{ events: { nodes: { contents: { json: PaymentFailedEvent } }[] } }>(
    `query GetPaymentFailed($type: String!) {
      events(first: 100, filter: { type: $type }) {
        nodes { contents { json } }
      }
    }`,
    { type: `${DEVNET_V2_PACKAGE_ID}::payment::PaymentFailed` }
  );
  let events = allEvents.events.nodes.map((n) => n.contents.json);
  if (accountId) {
    events = events.filter((e) => e.account_id === accountId);
  }
  return events;
}

export async function queryDepositEvents(accountId: string): Promise<DepositEvent[]> {
  const data = await executeQuery<{ events: { nodes: { contents: { json: DepositEvent } }[] } }>(
    `query GetDeposits($type: String!, $accountId: SuiAddress!) {
      events(first: 50, filter: { type: $type }) {
        nodes { contents { json } }
      }
    }`,
    { type: `${DEVNET_V2_PACKAGE_ID}::account::Deposit` }
  );
  return data.events.nodes
    .map((n) => n.contents.json)
    .filter((e) => e.account_id === accountId);
}