import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "../../../");

function readPublishOutput(dir: string, file: string): any {
  console.log(`Parsing ${file} from ${dir}...`);
  const content = readFileSync(join(rootDir, dir, file), "utf8");
  return JSON.parse(content);
}

const pusdRes = readPublishOutput("move/stablecoin", "pusd_output.json");
const subRes = readPublishOutput("move/subscriptions", "sub_output.json");

let pusdPackageId = "";
let pusdTreasuryCapId = "";
let pusdTreasuryCapVersion = 0;

for (const change of pusdRes.objectChanges) {
  if (change.type === "published") {
    pusdPackageId = change.packageId;
  } else if (change.type === "created") {
    if (change.objectType.includes("::coin::TreasuryCap")) {
      pusdTreasuryCapId = change.objectId;
      pusdTreasuryCapVersion = Number(change.version);
    }
  }
}

let subPackageId = "";
let registryId = "";
let registryVersion = 0;
let schedulerId = "";
let schedulerVersion = 0;
let accessControlId = "";

for (const change of subRes.objectChanges) {
  if (change.type === "published") {
    subPackageId = change.packageId;
  } else if (change.type === "created") {
    if (change.objectType.endsWith("::registry::Registry")) {
      registryId = change.objectId;
      registryVersion = Number(change.version);
    } else if (change.objectType.endsWith("::scheduler::PaymentScheduler")) {
      schedulerId = change.objectId;
      schedulerVersion = Number(change.version);
    } else if (change.objectType.endsWith("::access_control::AccessControl")) {
      accessControlId = change.objectId;
    }
  }
}

console.log("Deployed Objects:", {
  pusdPackageId,
  pusdTreasuryCapId,
  pusdTreasuryCapVersion,
  subPackageId,
  registryId,
  registryVersion,
  schedulerId,
  schedulerVersion,
  accessControlId
});

if (!pusdPackageId || !subPackageId) {
    throw new Error("Failed to extract package IDs from publish output.");
}

const targetNetwork = process.env.VITE_NETWORK || "local";
console.log(`Targeting network: ${targetNetwork}`);

const deployment = {
  PACKAGE_ID: subPackageId,
  COIN_TYPE_REGISTRY_ID: registryId,
  COIN_TYPE_REGISTRY_INIT_VERSION: registryVersion,
  PAYMENT_SCHEDULER_ID: schedulerId,
  PAYMENT_SCHEDULER_INIT_VERSION: schedulerVersion,
  ACCESS_CONTROL_ID: accessControlId,
  PUSD_PACKAGE_ID: pusdPackageId,
  PUSD_TYPE_ARG: `${pusdPackageId}::pusd::PUSD`,
  PUSD_TREASURY_CAP_ID: pusdTreasuryCapId,
  PUSD_TREASURY_CAP_INIT_VERSION: pusdTreasuryCapVersion,
};

if (targetNetwork === "local") {
  // `local` is a per-developer-machine deployment — every fresh local
  // redeploy produces different object IDs, so there is no single "correct"
  // value to share. Writing them into the committed constants.ts (as this
  // script used to do) produced pure git churn: someone runs this locally,
  // forgets it silently rewrote a shared file, and a stale, meaningless
  // diff sits uncommitted (or worse, gets committed and immediately goes
  // stale for everyone else). Write to a gitignored file instead.
  const outPath = join(rootDir, "packages/sdk/scripts/local-deployment.json");
  writeFileSync(outPath, JSON.stringify(deployment, null, 2), "utf8");
  console.log(`Wrote fresh local deployment to ${outPath} (gitignored — not shared).`);
  console.log("constants.ts's committed `local` block is a static, frozen baseline for type-checking/tests only, not a live deployment.");
  console.log("Point scripts/apps at this file directly, or export the values as env vars, for real local-network work.");
} else {
  // devnet/testnet/mainnet ARE the single shared source of truth and
  // belong in the committed file — update it in place as before.
  const constantsPath = join(rootDir, "packages/sdk/src/constants.ts");
  let src = readFileSync(constantsPath, "utf8");

  const targetConfigRegex = new RegExp(`(${targetNetwork}:\\s*\\{[^}]+\\})`);
  const match = src.match(targetConfigRegex);

  if (match) {
    let targetBlock = match[1];
    targetBlock = targetBlock.replace(/PACKAGE_ID: "[^"]*"/, `PACKAGE_ID: "${deployment.PACKAGE_ID}"`);
    targetBlock = targetBlock.replace(/COIN_TYPE_REGISTRY_ID: "[^"]*"/, `COIN_TYPE_REGISTRY_ID: "${deployment.COIN_TYPE_REGISTRY_ID}"`);
    targetBlock = targetBlock.replace(/COIN_TYPE_REGISTRY_INIT_VERSION: \d+/, `COIN_TYPE_REGISTRY_INIT_VERSION: ${deployment.COIN_TYPE_REGISTRY_INIT_VERSION}`);
    targetBlock = targetBlock.replace(/PAYMENT_SCHEDULER_ID: "[^"]*"/, `PAYMENT_SCHEDULER_ID: "${deployment.PAYMENT_SCHEDULER_ID}"`);
    targetBlock = targetBlock.replace(/PAYMENT_SCHEDULER_INIT_VERSION: \d+/, `PAYMENT_SCHEDULER_INIT_VERSION: ${deployment.PAYMENT_SCHEDULER_INIT_VERSION}`);
    targetBlock = targetBlock.replace(/ACCESS_CONTROL_ID: "[^"]*"/, `ACCESS_CONTROL_ID: "${deployment.ACCESS_CONTROL_ID}"`);
    targetBlock = targetBlock.replace(/PUSD_PACKAGE_ID: "[^"]*"/g, `PUSD_PACKAGE_ID: "${deployment.PUSD_PACKAGE_ID}"`);
    targetBlock = targetBlock.replace(/PUSD_TYPE_ARG: "[^"]*"/g, `PUSD_TYPE_ARG: "${deployment.PUSD_TYPE_ARG}"`);
    targetBlock = targetBlock.replace(/PUSD_TREASURY_CAP_ID: "[^"]*"/, `PUSD_TREASURY_CAP_ID: "${deployment.PUSD_TREASURY_CAP_ID}"`);
    targetBlock = targetBlock.replace(/PUSD_TREASURY_CAP_INIT_VERSION: \d+/, `PUSD_TREASURY_CAP_INIT_VERSION: ${deployment.PUSD_TREASURY_CAP_INIT_VERSION}`);

    src = src.replace(targetConfigRegex, targetBlock);
    writeFileSync(constantsPath, src, "utf8");
    console.log(`Updated src/constants.ts with fresh ${targetNetwork} deployment.`);
  } else {
    throw new Error(`Could not find ${targetNetwork} configuration block in src/constants.ts`);
  }
}
