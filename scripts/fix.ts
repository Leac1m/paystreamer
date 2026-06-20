import * as fs from "fs";

function fixFile(path: string, replacer: (content: string) => string) {
  let content = fs.readFileSync(path, "utf8");
  content = replacer(content);
  fs.writeFileSync(path, content);
}

fixFile("src/lib/graphql.ts", content => {
  return content
    .replace(/export async function queryRecentEventsByType\(client: SuiGraphQLClient, packageId: string,/g, "export async function queryRecentEventsByType(client: SuiGraphQLClient,")
    .replace(/filter: \{ type: \$type \}/g, "filter: { type: $type }");
});

fixFile("src/lib/platformDiscovery.ts", content => {
  return content
    .replace(/import \{ queryPlatformsByOwner \} from "\.\/graphql";/g, "import { queryPlatformsByOwner, queryPlatformRegisteredEvents } from \"./graphql\";")
    .replace(/const client = graphqlClient;/g, "const client = import('./graphql').then(m => m.getClient('testnet'));") // wait, better to just pass client from component
});

