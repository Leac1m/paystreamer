import * as fs from "fs";

let content = fs.readFileSync("src/lib/platformDiscovery.ts", "utf8");

content = content.replace(
  /import \{ graphqlClient, queryPlatformsByOwner \} from "\.\/graphql";/g,
  "import { queryPlatformsByOwner } from \"./graphql\";\nimport { SuiGraphQLClient } from \"@mysten/sui/graphql\";"
);

content = content.replace(
  /export async function loadSubscribedPlatforms\(walletAddress: string\) \{/g,
  "export async function loadSubscribedPlatforms(client: SuiGraphQLClient, packageId: string, walletAddress: string) {"
);

content = content.replace(
  /const events = await queryPlatformsByOwner\(walletAddress\);/g,
  "const events = await queryPlatformsByOwner(client, packageId, walletAddress);"
);

content = content.replace(
  /export async function getRecommendedPlatforms\(\) \{/g,
  "export async function getRecommendedPlatforms(client: SuiGraphQLClient, packageId: string) {"
);

content = content.replace(
  /const events = await import\("\.\/graphql"\)\.then\(\(m\) => m\.queryPlatformRegisteredEvents\(\)\);/g,
  "const events = await import(\"./graphql\").then((m) => m.queryPlatformRegisteredEvents(client, packageId));"
);

fs.writeFileSync("src/lib/platformDiscovery.ts", content);
console.log("Refactored platformDiscovery.ts");
