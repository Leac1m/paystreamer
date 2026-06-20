import * as fs from "fs";

let content = fs.readFileSync("src/lib/graphql.ts", "utf8");

// Remove statically initialized graphqlClient
content = content.replace(
  /export const graphqlClient = new SuiGraphQLClient\(\{\s*url: GRAPHQL_URL,\s*network: NETWORK as any,\s*\}\);\s*/g,
  ""
);

// Replace imports
content = content.replace(
  /import \{\s*SUBSCRIPTION_DEVNET_PACKAGE_ID,\s*GRAPHQL_URL,\s*NETWORK,\s*\} from "\.\.\/constants";/g,
  ""
);

// Add SuiGraphQLClient to all executeQuery usages
content = content.replace(
  /async function executeQuery<T>\(query: string, variables\?: Record<string, unknown>\): Promise<T> \{/g,
  "async function executeQuery<T>(client: SuiGraphQLClient, query: string, variables?: Record<string, unknown>): Promise<T> {"
);

content = content.replace(
  /const result = await graphqlClient\.query\(\{ query, variables \}\);/g,
  "const result = await client.query({ query, variables });"
);

// Update all exported functions to take `client: SuiGraphQLClient` as first argument
content = content.replace(
  /export async function query([a-zA-Z0-9_]+)\(/g,
  "export async function query$1(client: SuiGraphQLClient, "
);
content = content.replace(
  /export async function query([a-zA-Z0-9_]+)\(client: SuiGraphQLClient, \)/g,
  "export async function query$1(client: SuiGraphQLClient)"
);

// We also need to replace SUBSCRIPTION_DEVNET_PACKAGE_ID with a `packageId: string` argument for events
content = content.replace(
  /export async function query([a-zA-Z0-9_]+)\(client: SuiGraphQLClient, ([^)]*)\)/g,
  (match, p1, p2) => {
    if (p1.includes("Event") || p1.includes("PlatformsByOwner") || p1.includes("RecentEvents")) {
      // Need packageId
      if (p2 === "") {
        return `export async function query${p1}(client: SuiGraphQLClient, packageId: string)`;
      } else {
        return `export async function query${p1}(client: SuiGraphQLClient, packageId: string, ${p2})`;
      }
    }
    return match;
  }
);

// Update executeQuery calls
content = content.replace(
  /executeQuery</g,
  "executeQuery(client, <"
);
content = content.replace(
  /executeQuery\(client, </g,
  "executeQuery<"
);
content = content.replace(
  /await executeQuery<([^>]+)>\(/g,
  "await executeQuery<$1>(client, "
);

// Replace SUBSCRIPTION_DEVNET_PACKAGE_ID with ${packageId}
content = content.replace(
  /\$\{SUBSCRIPTION_DEVNET_PACKAGE_ID\}/g,
  "${packageId}"
);

fs.writeFileSync("src/lib/graphql.ts", content);
console.log("Refactored graphql.ts");
