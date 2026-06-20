import * as fs from "fs";

function replaceInFile(file: string, replacer: (content: string) => string) {
  let content = fs.readFileSync(file, "utf8");
  const newContent = replacer(content);
  if (content !== newContent) {
    fs.writeFileSync(file, newContent);
    console.log(`Updated ${file}`);
  }
}

const files = [
  "src/components/subscriptions/SubscriptionDetail.tsx",
  "src/components/subscriptions/ActivityFeed.tsx",
  "src/components/platform/PlatformOwnerOverview.tsx",
  "src/pages/SubscribePage.tsx",
  "src/pages/dashboard/AccountsPage.tsx",
  "src/pages/dashboard/SubscriptionsPage.tsx",
  "src/pages/platforms/SubscribersPage.tsx",
  "src/hooks/usePaymentNotifications.ts"
];

for (const f of files) {
  replaceInFile(f, content => {
    // Inject useAppConfig
    if (!content.includes("useAppConfig")) {
      const depth = f.split("/").length - 2; 
      const prefix = depth > 1 ? "../".repeat(depth - 1) : "./";
      content = `import { useAppConfig } from "${prefix}hooks/useAppConfig";\n` + content;
    }
    
    // Replace SUBSCRIPTION_DEVNET_PACKAGE_ID with config.PACKAGE_ID
    content = content.replace(/SUBSCRIPTION_DEVNET_PACKAGE_ID/g, "config.PACKAGE_ID");

    // Replace the specific graphql calls
    content = content.replace(/queryAccountCreatedEvents\(([^,)]+)\)/g, "queryAccountCreatedEvents($1, config.network)");
    content = content.replace(/queryPaymentProcessedEvents\(([^,)]+), ([^,)]+)\)/g, "queryPaymentProcessedEvents($1, $2, config.network)");
    content = content.replace(/queryPaymentProcessedEvents\(([^,)]+)\)/g, "queryPaymentProcessedEvents($1, undefined, config.network)");
    content = content.replace(/queryDepositEvents\(([^,)]+)\)/g, "queryDepositEvents($1, config.network)");
    content = content.replace(/queryPaymentFailedEvents\(([^,)]+)\)/g, "queryPaymentFailedEvents($1, config.network)");
    content = content.replace(/querySubscriptionCreatedEventsByPlatform\(([^,)]+)\)/g, "querySubscriptionCreatedEventsByPlatform($1, config.network)");
    content = content.replace(/querySubscriptionUpdatedEventsByPlatform\(([^,)]+)\)/g, "querySubscriptionUpdatedEventsByPlatform($1, config.network)");
    content = content.replace(/queryPlatformInitialVersions\(([^,)]+)\)/g, "queryPlatformInitialVersions($1, config.network)");
    content = content.replace(/queryRecentEventsByType\(([^,)]+), ([^,)]+)\)/g, "queryRecentEventsByType($1, $2, config.network)");

    return content;
  });
}
