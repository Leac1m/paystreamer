import * as fs from "fs";

let content = fs.readFileSync("src/lib/graphql.ts", "utf8");

content = content.replace(/export const graphqlClient = new SuiGraphQLClient\(\{\s+url: GRAPHQL_URL,\s+network: NETWORK as any,\s+\}\);/, `const clients = new Map<SupportedNetwork, SuiGraphQLClient>();

export function getGraphQLClient(network?: SupportedNetwork) {
  const target = network || "testnet";
  if (!clients.has(target)) {
    clients.set(target, new SuiGraphQLClient({
      url: getConfig(target).GRAPHQL_URL,
      network: target as any,
    }));
  }
  return clients.get(target)!;
}`);

content = content.replace(/import {\n  SUBSCRIPTION_DEVNET_PACKAGE_ID,\n  GRAPHQL_URL,\n  NETWORK,\n} from "\.\.\/constants";/, `import { getConfig, SupportedNetwork } from "../constants";`);

content = content.replace(/async function executeQuery<T>\(query: string, variables\?: Record<string, unknown>\): Promise<T> {/, `async function executeQuery<T>(query: string, variables?: Record<string, unknown>, network?: SupportedNetwork): Promise<T> {`);
content = content.replace(/const result = await graphqlClient\.query\(\{ query, variables \}\);/, `const client = getGraphQLClient(network);\n  const result = await client.query({ query, variables });`);

// replace SUBSCRIPTION_DEVNET_PACKAGE_ID with config.PACKAGE_ID
content = content.replace(/SUBSCRIPTION_DEVNET_PACKAGE_ID/g, "config.PACKAGE_ID");

// replace all function signatures
content = content.replace(/export async function queryPlatformsByOwner\(owner: string\): Promise<PlatformRegisteredEvent\[\]> {/, `export async function queryPlatformsByOwner(owner: string, network?: SupportedNetwork): Promise<PlatformRegisteredEvent[]> {\n  const config = getConfig(network);`);
content = content.replace(/export async function queryAccountCreatedEvents\(sender: string\): Promise<AccountCreatedEvent\[\]> {/, `export async function queryAccountCreatedEvents(sender: string, network?: SupportedNetwork): Promise<AccountCreatedEvent[]> {\n  const config = getConfig(network);`);
content = content.replace(/export async function queryPlatformRegisteredEvents\(\): Promise<PlatformRegisteredEvent\[\]> {/, `export async function queryPlatformRegisteredEvents(network?: SupportedNetwork): Promise<PlatformRegisteredEvent[]> {\n  const config = getConfig(network);`);
content = content.replace(/export async function querySubscriptionCreatedEvents\(accountId: string\): Promise<SubscriptionCreatedEvent\[\]> {/, `export async function querySubscriptionCreatedEvents(accountId: string, network?: SupportedNetwork): Promise<SubscriptionCreatedEvent[]> {\n  const config = getConfig(network);`);
content = content.replace(/export async function querySubscriptionCreatedEventsByPlatform\(platformId: string\): Promise<SubscriptionCreatedEvent\[\]> {/, `export async function querySubscriptionCreatedEventsByPlatform(platformId: string, network?: SupportedNetwork): Promise<SubscriptionCreatedEvent[]> {\n  const config = getConfig(network);`);

content = content.replace(/export async function queryPaymentProcessedEvents\(\n  accountId\?: string,\n  platformId\?: string\n\): Promise<PaymentProcessedEvent\[\]> {/, `export async function queryPaymentProcessedEvents(\n  accountId?: string,\n  platformId?: string,\n  network?: SupportedNetwork\n): Promise<PaymentProcessedEvent[]> {\n  const config = getConfig(network);`);
content = content.replace(/export async function queryPaymentFailedEvents\(accountId\?: string\): Promise<PaymentFailedEvent\[\]> {/, `export async function queryPaymentFailedEvents(accountId?: string, network?: SupportedNetwork): Promise<PaymentFailedEvent[]> {\n  const config = getConfig(network);`);
content = content.replace(/export async function queryDepositEvents\(accountId: string\): Promise<DepositEvent\[\]> {/, `export async function queryDepositEvents(accountId: string, network?: SupportedNetwork): Promise<DepositEvent[]> {\n  const config = getConfig(network);`);
content = content.replace(/export async function queryRecentEventsByType\(\n  type: string,\n  limit: number = 10\n\): Promise<Array<{ id: string; transactionDigest: string; timestamp: number; json: Record<string, unknown> }>> {/, `export async function queryRecentEventsByType(\n  type: string,\n  limit: number = 10,\n  network?: SupportedNetwork\n): Promise<Array<{ id: string; transactionDigest: string; timestamp: number; json: Record<string, unknown> }>> {`);
content = content.replace(/export async function querySubscriptionUpdatedEventsByPlatform\(\n  platformId: string\n\): Promise<SubscriptionUpdatedEvent\[\]> {/, `export async function querySubscriptionUpdatedEventsByPlatform(\n  platformId: string,\n  network?: SupportedNetwork\n): Promise<SubscriptionUpdatedEvent[]> {\n  const config = getConfig(network);`);

// inject network to executeQuery calls
content = content.replace(/\{ type: `\$\{config\.PACKAGE_ID\}::platform::PlatformRegistered`, owner \}\n  \);/g, `{ type: \`\${config.PACKAGE_ID}::platform::PlatformRegistered\`, owner },\n    network\n  );`);
content = content.replace(/\{ type: `\$\{config\.PACKAGE_ID\}::account::AccountCreated`, sender \}\n  \);/g, `{ type: \`\${config.PACKAGE_ID}::account::AccountCreated\`, sender },\n    network\n  );`);
content = content.replace(/\{ type: `\$\{config\.PACKAGE_ID\}::platform::PlatformRegistered` \}\n  \);/g, `{ type: \`\${config.PACKAGE_ID}::platform::PlatformRegistered\` },\n    network\n  );`);
content = content.replace(/\{ type: `\$\{config\.PACKAGE_ID\}::billing::SubscriptionCreated` \}\n  \);/g, `{ type: \`\${config.PACKAGE_ID}::billing::SubscriptionCreated\` },\n    network\n  );`);
content = content.replace(/\{ type: `\$\{config\.PACKAGE_ID\}::payment::PaymentProcessed` \}\n  \);/g, `{ type: \`\${config.PACKAGE_ID}::payment::PaymentProcessed\` },\n    network\n  );`);
content = content.replace(/\{ type: `\$\{config\.PACKAGE_ID\}::payment::PaymentFailed` \}\n  \);/g, `{ type: \`\${config.PACKAGE_ID}::payment::PaymentFailed\` },\n    network\n  );`);
content = content.replace(/\{ type: `\$\{config\.PACKAGE_ID\}::account::Deposit` \}\n  \);/g, `{ type: \`\${config.PACKAGE_ID}::account::Deposit\` },\n    network\n  );`);
content = content.replace(/\{ type \}\n  \);/g, `{ type },\n    network\n  );`);
content = content.replace(/\{ type: `\$\{config\.PACKAGE_ID\}::billing::SubscriptionUpdated` \}\n  \);/g, `{ type: \`\${config.PACKAGE_ID}::billing::SubscriptionUpdated\` },\n    network\n  );`);

fs.writeFileSync("src/lib/graphql.ts", content);
console.log("graphql.ts updated");
