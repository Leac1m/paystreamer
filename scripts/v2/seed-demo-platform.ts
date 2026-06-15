#!/usr/bin/env node

/**
 * Idempotent demo-platform seeder for the v2 subscription contract on Sui
 * devnet.
 *
 * This script is the one-command entry point for keeping the PayStreamer
 * demo alive on devnet. It is safe to run multiple times — on each run it
 * either:
 *   (a) discovers an existing "Demo SaaS" platform on devnet (by scanning
 *       `PlatformRegistered` events for the fixed name) and re-prints its
 *       object ID and `initialSharedVersion`, or
 *   (b) creates a fresh platform (and a single demo tier with 1-minute
 *       billing) and prints the new IDs.
 *
 * The fixed inputs are:
 *   - platform name:    "Demo SaaS"
 *   - platform category: "SaaS"
 *   - tier name:        "Demo Tier (1-minute billing)"
 *   - tier amount:      1_000_000 MIST (0.001 SUI)
 *   - tier frequency:   60_000 ms (60 seconds — short enough to demo the
 *                       permissionless scheduler in well under a minute)
 *
 * Requirements:
 *   - The `sui` CLI is configured with a devnet account that has SUI for
 *     gas (the script signs with the active keypair in
 *     `~/.sui/sui_config/sui.keystore`).
 *   - `V2_PACKAGE_ID` (see `scripts/v2/config.ts`) is published on devnet.
 *
 * Output: a single JSON object on stdout with the platform/tier metadata,
 * suitable for piping into `src/constants.ts`. See the bottom of
 * `main()` for the `DEMO_PLATFORM_ID` / `DEMO_PLATFORM_INIT_VERSION`
 * patch.
 *
 * Usage: pnpm seed:demo
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Transaction, Inputs } from "@mysten/sui/transactions";
import { SuiGraphQLClient } from "@mysten/sui/graphql";

import {
  CLOCK_OBJECT_ID,
  SUI_TYPE_ARG,
  V2_COIN_TYPE_REGISTRY_ID,
  V2_COIN_TYPE_REGISTRY_INIT_VERSION,
  V2_GRAPHQL_URL,
  V2_NETWORK,
  V2_PACKAGE_ID,
} from "./config.ts";
import { loadKeypair, newTx, sharedObjectMut } from "./test-utils.ts";

// Fixed demo inputs — the idempotency contract relies on these being stable.
const DEMO_PLATFORM_NAME = "Demo SaaS";
const DEMO_PLATFORM_DESCRIPTION =
  "A demo platform for the PayStreamer hackathon. Subscribe for a few minutes of test billing.";
const DEMO_PLATFORM_CATEGORY = "SaaS";
const DEMO_TIER_NAME = "Demo Tier (1-minute billing)";
const DEMO_TIER_AMOUNT_MIST = 1_000_000n; // 0.001 SUI per cycle
const DEMO_TIER_FREQUENCY_MS = 60_000n; // 60 seconds

// Shared-object initial versions are discovered dynamically from the
// on-chain object (see `fetchPlatformObjectVersion`). We don't need a
// hard-coded `SHARED_INIT_VERSION_*` constant for the demo platform
// itself — the script is the canonical source of truth, and it always
// re-queries the chain.

type DiscoveredPlatform = {
  platformId: string;
  initialSharedVersion: number;
  foundExisting: boolean;
};

type SeedResult = {
  platformId: string;
  platformInitVersion: number;
  tierIndex: number;
  tierName: string;
  tierAmountMist: string;
  tierFrequencyMs: string;
  suiDiscriminant: number;
};

async function fetchPlatformObjectVersion(
  client: SuiGraphQLClient,
  platformId: string,
): Promise<number | undefined> {
  const res = await client.query({
    query: `
      query GetObj($id: SuiAddress!) {
        object(address: $id) {
          asMoveObject { contents { json } }
          owner { ... on Shared { initialSharedVersion } }
        }
      }
    `,
    variables: { id: platformId },
  });
  const v = (res.data as any)?.object?.owner?.initialSharedVersion;
  return typeof v === "number" ? v : undefined;
}

/**
 * Scan `PlatformRegistered` events emitted by the configured package and
 * return the most recent one whose `name` field matches
 * `DEMO_PLATFORM_NAME`.
 *
 * The Sui GraphQL `events` connection is returned in descending order by
 * checkpoint / timestamp, so the first match in the first page is the
 * latest one. We only paginate if the first page has no match.
 *
 * We can't filter on a JSON field via the GraphQL `filter` arg, so we walk
 * pages and inspect `contents.json` in JS. This is acceptable for a
 * seeder: `PlatformRegistered` events are sparse.
 */
async function discoverDemoPlatform(
  client: SuiGraphQLClient,
): Promise<DiscoveredPlatform | undefined> {
  const eventType = `${V2_PACKAGE_ID}::platform::PlatformRegistered`;
  let cursor: string | null = null;
  let hasNextPage = true;
  let match: { platformId: string } | undefined;

  while (hasNextPage) {
    const res: any = await client.query({
      query: `
        query GetPlatforms($type: String!, $after: String) {
          events(first: 50, after: $after, filter: { type: $type }) {
            nodes {
              contents { json }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      `,
      variables: { type: eventType, after: cursor },
    });
    const events: any = (res.data as any)?.events;
    const nodes: any[] = events?.nodes ?? [];
    for (const n of nodes) {
      const json = n?.contents?.json;
      if (json && json.name === DEMO_PLATFORM_NAME && typeof json.platform_id === "string") {
        match = { platformId: json.platform_id };
        break;
      }
    }
    if (match) break;
    hasNextPage = !!events?.pageInfo?.hasNextPage;
    cursor = events?.pageInfo?.endCursor ?? null;
    if (nodes.length === 0) break;
  }

  if (!match) return undefined;
  const version = await fetchPlatformObjectVersion(client, match.platformId);
  if (version === undefined) return undefined;
  return {
    platformId: match.platformId,
    initialSharedVersion: version,
    foundExisting: true,
  };
}

/**
 * Look up the on-chain discriminant assigned to `SUI` in the
 * `CoinTypeRegistry`. Returns `undefined` if SUI is not yet registered.
 *
 * Reads the most recent `CoinTypeRegistered` event whose
 * `contents.json.type_name` matches `0x2::sui::SUI` and returns its
 * `discriminant`. The registry may assign 0, 1, 2, or higher depending
 * on the registration order — we just use whatever SUI actually got.
 */
async function fetchSuiDiscriminant(
  client: SuiGraphQLClient,
): Promise<number | undefined> {
  const res = await client.query({
    query: `
      query GetSuiRegistrations($type: String!) {
        events(first: 50, filter: { type: $type }) {
          nodes {
            contents { json }
          }
        }
      }
    `,
    variables: { type: `${V2_PACKAGE_ID}::registry::CoinTypeRegistered` },
  });
  const nodes: any[] = (res.data as any)?.events?.nodes ?? [];
  // Find the most recent event for the SUI type. Events come back
  // newest-first, so the first match is what we want.
  for (const n of nodes) {
    const json = n?.contents?.json;
    if (json && typeof json.type_name === "string" && json.type_name.endsWith("::sui::SUI")) {
      if (typeof json.discriminant === "number") return json.discriminant;
      if (typeof json.discriminant === "string") return Number(json.discriminant);
    }
  }
  return undefined;
}

/**
 * Register `SUI` as a coin type in the `CoinTypeRegistry`. Idempotent:
 * returns the existing discriminant if SUI is already registered.
 */
async function registerSuiCoinType(
  client: SuiGraphQLClient,
  keypair: ReturnType<typeof loadKeypair>,
): Promise<number> {
  const existing = await fetchSuiDiscriminant(client);
  if (existing !== undefined) {
    console.log("\n=== Step 0: register_coin_type<SUI> ===");
    console.log(`  status: SKIP (SUI already registered, discriminant=${existing})`);
    return existing;
  }

  const tx = newTx(keypair);
  const info = tx.moveCall({
    target: `${V2_PACKAGE_ID}::registry::new_account_type_info`,
    arguments: [tx.pure.string("Sui"), tx.pure.u8(9), tx.pure.bool(false)],
  });
  tx.moveCall({
    target: `${V2_PACKAGE_ID}::registry::register_coin_type`,
    typeArguments: [SUI_TYPE_ARG],
    arguments: [
      tx.object(
        Inputs.SharedObjectRef({
          objectId: V2_COIN_TYPE_REGISTRY_ID,
          mutable: true,
          initialSharedVersion: V2_COIN_TYPE_REGISTRY_INIT_VERSION,
        }),
      ),
      info,
    ],
  });
  const r = await executeOrSkip(client, keypair, "Step 0: register_coin_type<SUI>", tx, []);
  if (r.status === "failure") {
    throw new Error(`register_coin_type<SUI> failed: ${r.error ?? "unknown"}`);
  }
  // Discover the discriminant we were just assigned.
  const d = await fetchSuiDiscriminant(client);
  if (d === undefined) {
    throw new Error("register_coin_type<SUI> succeeded but no discriminant was discovered");
  }
  return d;
}

async function findExistingTier(
  client: SuiGraphQLClient,
  platformId: string,
): Promise<{ tierIndex: number; amount: string; frequencyMs: string } | undefined> {
  // Read the platform object and look for a tier with a matching name.
  // Tier 0 is the only tier on a freshly seeded demo platform, but the
  // seed should be robust to re-runs that added extra tiers.
  const res = await client.query({
    query: `
      query GetPlatform($id: SuiAddress!) {
        object(address: $id) {
          asMoveObject { contents { json } }
        }
      }
    `,
    variables: { id: platformId },
  });
  const json: any = (res.data as any)?.object?.asMoveObject?.contents?.json;
  if (!json || typeof json !== "object") return undefined;

  // The `tiers` field is a `VecMap<u64, SubscriptionTier>`. Sui GraphQL
  // renders `VecMap` as `{ contents: [{ key, value }, ...] }` — the
  // top-level `tiers` object is the wrapper, not the array of pairs.
  // Unwrap the `contents` array first, then iterate the pairs.
  const tiers = json.tiers;
  if (!tiers) return undefined;

  let pairs: Array<{ key: number; value: any }> = [];
  if (Array.isArray(tiers.contents)) {
    for (const e of tiers.contents) {
      if (e && typeof e.key !== "undefined" && e.value) {
        pairs.push({ key: Number(e.key), value: e.value });
      }
    }
  } else if (Array.isArray(tiers)) {
    // Defensive: in case a future Sui GraphQL change drops the
    // `contents` wrapper.
    for (const e of tiers) {
      if (e && typeof e.key !== "undefined" && e.value) {
        pairs.push({ key: Number(e.key), value: e.value });
      }
    }
  } else if (typeof tiers === "object") {
    for (const [k, v] of Object.entries(tiers)) {
      if (v && typeof v === "object" && (v as any).name) {
        pairs.push({ key: Number(k), value: v });
      }
    }
  }

  for (const { key, value } of pairs) {
    if (value && value.name === DEMO_TIER_NAME) {
      return {
        tierIndex: key,
        amount: String(value.amount ?? DEMO_TIER_AMOUNT_MIST),
        frequencyMs: String(value.frequency_ms ?? DEMO_TIER_FREQUENCY_MS),
      };
    }
  }
  return undefined;
}

async function executeOrSkip(
  client: SuiGraphQLClient,
  keypair: ReturnType<typeof loadKeypair>,
  name: string,
  tx: Transaction,
  expectedAbortCodes: number[] = [],
): Promise<{ status: "success" | "failure" | "skipped"; digest: string; error?: string }> {
  console.log(`\n=== ${name} ===`);
  try {
    const result = await client.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair,
    });
    if (result.$kind === "FailedTransaction") {
      const msg = result.FailedTransaction.status.error
        ? JSON.stringify(result.FailedTransaction.status.error)
        : "unknown";
      // Treat known idempotency-related aborts (e.g. tier already exists
      // with the same name) as a soft success: the script's discover
      // step will pick up the existing tier afterwards.
      const knownAborts: Record<number, string> = {
        32770: "EInvalidTier",
        4097: "EPlatformAlreadyExists", // placeholder — adjust if Move defines its own
      };
      const matched = expectedAbortCodes.find((c) => msg.includes(String(c)));
      if (matched !== undefined) {
        console.log(`  status: expected (${knownAborts[matched] ?? `code ${matched}`})`);
        return { status: "success", digest: "" };
      }
      console.log(`  status: FAILED (${msg})`);
      return { status: "failure", digest: result.FailedTransaction.digest, error: msg };
    }
    const digest = result.Transaction!.digest;
    console.log(`  status: success   digest: ${digest}`);
    return { status: "success", digest };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (expectedAbortCodes.some((c) => message.includes(String(c)))) {
      console.log(`  status: expected abort caught (idempotent re-run)`);
      return { status: "success", digest: "" };
    }
    console.log(`  status: EXCEPTION (${message})`);
    return { status: "failure", digest: "", error: message };
  }
}

async function registerPlatform(
  client: SuiGraphQLClient,
  keypair: ReturnType<typeof loadKeypair>,
): Promise<DiscoveredPlatform> {
  const tx = newTx(keypair);
  tx.moveCall({
    target: `${V2_PACKAGE_ID}::platform::register_platform`,
    arguments: [
      tx.pure.string(DEMO_PLATFORM_NAME),
      tx.pure.string(DEMO_PLATFORM_DESCRIPTION),
      tx.pure.string(DEMO_PLATFORM_CATEGORY),
      tx.pure.option("string", null),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  const r = await executeOrSkip(
    client,
    keypair,
    "Step 1: register_platform(\"Demo SaaS\")",
    tx,
  );
  if (r.status === "failure") {
    throw new Error(`register_platform failed: ${r.error ?? "unknown"}`);
  }
  // The platform was just shared in this tx (or already existed from a
  // prior run). Discover it by name and capture the version.
  const discovered = await discoverDemoPlatform(client);
  if (!discovered) {
    throw new Error(
      "register_platform reported success but no \"Demo SaaS\" PlatformRegistered event was found",
    );
  }
  return discovered;
}

async function createDemoTier(
  client: SuiGraphQLClient,
  keypair: ReturnType<typeof loadKeypair>,
  platformId: string,
  platformInitVersion: number,
  suiDiscriminant: number,
): Promise<{ tierIndex: number; amount: string; frequencyMs: string; created: boolean }> {
  // Check first whether the tier already exists.
  const existing = await findExistingTier(client, platformId);
  if (existing) {
    console.log(`\n=== Step 2: create_tier("${DEMO_TIER_NAME}") ===`);
    console.log(`  status: SKIP (tier already exists at index ${existing.tierIndex})`);
    return { ...existing, created: false };
  }

  const tx = newTx(keypair);
  const accountType = tx.moveCall({
    target: `${V2_PACKAGE_ID}::registry::from_u8`,
    arguments: [tx.pure.u8(suiDiscriminant)],
  });
  tx.moveCall({
    target: `${V2_PACKAGE_ID}::platform::create_tier`,
    arguments: [
      sharedObjectMut(platformId, platformInitVersion)(tx),
      tx.pure.string(DEMO_TIER_NAME),
      tx.pure.u64(DEMO_TIER_AMOUNT_MIST),
      tx.pure.u64(DEMO_TIER_FREQUENCY_MS),
      accountType,
    ],
  });
  const r = await executeOrSkip(
    client,
    keypair,
    `Step 2: create_tier("${DEMO_TIER_NAME}")`,
    tx,
    [32770], // EInvalidTier (0x8002) — a previous run already created it
  );
  if (r.status === "failure") {
    throw new Error(`create_tier failed: ${r.error ?? "unknown"}`);
  }
  // Re-discover: the tier should now be present.
  const after = await findExistingTier(client, platformId);
  if (!after) {
    throw new Error(
      "create_tier reported success but the demo tier was not found on the platform object",
    );
  }
  return { ...after, created: true };
}

/**
 * Patch `src/constants.ts` so the demo platform ID is wired in to the
 * frontend. The patch is idempotent: if the constants are already set to
 * the same values, the file is left unchanged. If the file already has a
 * different DEMO_PLATFORM_ID, it is overwritten (the script is a
 * seeder, and re-running it is the documented way to point the demo at a
 * fresh platform).
 */
function patchConstants(result: SeedResult): { patched: boolean; reason: string } {
  const constantsPath = fileURLToPath(new URL("../../src/constants.ts", import.meta.url));
  let src: string;
  try {
    src = readFileSync(constantsPath, "utf8");
  } catch (e) {
    return { patched: false, reason: `could not read ${constantsPath}: ${String(e)}` };
  }

  const idReplacement = `export const DEMO_PLATFORM_ID: string | undefined = "${result.platformId}";`;
  const versionReplacement = `export const DEMO_PLATFORM_INIT_VERSION: number | undefined = ${result.platformInitVersion};`;

  const idLineRegex =
    /export const DEMO_PLATFORM_ID:[^=]*=\s*("[^"]*"|undefined)([^;\n]*);/;
  const verLineRegex =
    /export const DEMO_PLATFORM_INIT_VERSION:[^=]*=\s*(\d+|undefined)([^;\n]*);/;

  const newIdLine = src.match(idLineRegex);
  const newVerLine = src.match(verLineRegex);
  if (!newIdLine || !newVerLine) {
    return {
      patched: false,
      reason: `expected DEMO_PLATFORM_ID / DEMO_PLATFORM_INIT_VERSION lines not found in ${constantsPath}`,
    };
  }

  const currentId = newIdLine[1];
  const currentVer = newVerLine[1];
  const desiredId = `"${result.platformId}"`;
  const desiredVer = String(result.platformInitVersion);
  if (currentId === desiredId && currentVer === desiredVer) {
    return { patched: false, reason: "constants already up to date" };
  }

  const next = src
    .replace(idLineRegex, `${idReplacement} // populated by pnpm seed:demo`)
    .replace(verLineRegex, `${versionReplacement} // populated by pnpm seed:demo`);

  try {
    writeFileSync(constantsPath, next, "utf8");
    return { patched: true, reason: "ok" };
  } catch (e) {
    return { patched: false, reason: `could not write ${constantsPath}: ${String(e)}` };
  }
}

async function main() {
  const keypair = loadKeypair();
  const sender = keypair.toSuiAddress();
  const client = new SuiGraphQLClient({
    url: V2_GRAPHQL_URL,
    network: V2_NETWORK,
  });

  console.log("======================================================");
  console.log(" PayStreamer v2 — Demo Platform Seeder");
  console.log("======================================================");
  console.log(`network:   ${V2_NETWORK}`);
  console.log(`package:   ${V2_PACKAGE_ID}`);
  console.log(`sender:    ${sender}`);
  console.log(`name:      "${DEMO_PLATFORM_NAME}"`);
  console.log(`tier:      "${DEMO_TIER_NAME}" (${DEMO_TIER_AMOUNT_MIST} MIST / ${DEMO_TIER_FREQUENCY_MS} ms)`);

  // ----------------------------------------------------------------
  // Step 1: discover or create the platform
  // ----------------------------------------------------------------
  // ----------------------------------------------------------------
  // Step 0: ensure SUI is registered in CoinTypeRegistry (idempotent)
  // ----------------------------------------------------------------
  const suiDiscriminant = await registerSuiCoinType(client, keypair);
  console.log(`  SUI discriminant: ${suiDiscriminant}`);

  // ----------------------------------------------------------------
  // Step 1: discover or create the platform
  // ----------------------------------------------------------------
  let platform: DiscoveredPlatform;
  const existing = await discoverDemoPlatform(client);
  if (existing) {
    console.log("\n=== Step 1: discover platform ===");
    console.log(`  status: FOUND existing "Demo SaaS" platform`);
    console.log(`  platformId:           ${existing.platformId}`);
    console.log(`  initialSharedVersion: ${existing.initialSharedVersion}`);
    platform = existing;
  } else {
    platform = await registerPlatform(client, keypair);
  }

  // ----------------------------------------------------------------
  // Step 2: discover or create the tier
  // ----------------------------------------------------------------
  const tier = await createDemoTier(client, keypair, platform.platformId, platform.initialSharedVersion, suiDiscriminant);

  // ----------------------------------------------------------------
  // Step 3: print the result
  // ----------------------------------------------------------------
  const result: SeedResult = {
    platformId: platform.platformId,
    platformInitVersion: platform.initialSharedVersion,
    tierIndex: tier.tierIndex,
    tierName: DEMO_TIER_NAME,
    tierAmountMist: tier.amount,
    tierFrequencyMs: tier.frequencyMs,
    suiDiscriminant,
  };

  console.log("\n======================================================");
  console.log(" Demo platform ready");
  console.log("======================================================");
  // Print a single JSON object on stdout so the result is easy to pipe
  // (e.g. `pnpm seed:demo | jq .`).
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");

  // ----------------------------------------------------------------
  // Step 4: patch src/constants.ts so the frontend picks it up
  // ----------------------------------------------------------------
  const patch = patchConstants(result);
  if (patch.patched) {
    console.log(`\nPatched src/constants.ts (${patch.reason})`);
  } else {
    console.log(`\nsrc/constants.ts not patched: ${patch.reason}`);
    console.log("Add these manually:");
    console.log(`  export const DEMO_PLATFORM_ID = "${result.platformId}";`);
    console.log(`  export const DEMO_PLATFORM_INIT_VERSION = ${result.platformInitVersion};`);
  }

  if (!platform.foundExisting) {
    console.log("\nNote: this run created a NEW platform. Old \"Demo SaaS\" platforms");
    console.log("(if any) are still on chain. The frontend uses the most recent one");
    console.log("pinned in src/constants.ts.");
  }
}

main().catch((e) => {
  console.error("SEED_DEMO_FAILED:", e);
  if (e instanceof Error) {
    console.error("Stack:", e.stack);
  } else {
    console.error("Value:", JSON.stringify(e, null, 2));
  }
  process.exit(1);
});
