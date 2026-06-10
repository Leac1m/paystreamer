#!/usr/bin/env node

/**
 * End-to-end payment cycle for the v2 subscription contract on Sui devnet.
 *
 * Walks the full 10-step flow described in the v2 spec:
 *   0. Setup (load keypair, addresses, config)
 *   1. register_coin_type<SUI>   (registry admin)
 *   2. register_platform
 *   3. create_tier
 *   4. create_account + share_account
 *   5. deposit
 *   6. create_subscription
 *   7. process_due_payment  (first cycle)
 *   8. process_due_payment  (second cycle — frequency=1ms is immediately due again)
 *   9. cancel_subscription
 *  10. snapshot: query events and save JSON summary
 *
 * Usage: pnpm exec ts-node --esm scripts/v2/e2e-payment-cycle.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { config } from "dotenv";
config();

import { Transaction, Inputs } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiGraphQLClient } from "@mysten/sui/graphql";

import {
  CLOCK_OBJECT_ID,
  SUI_TYPE_ARG,
  V2_ACCESS_CONTROL_ID,
  V2_COIN_TYPE_REGISTRY_ID,
  V2_GRAPHQL_URL,
  V2_NETWORK,
  V2_PACKAGE_ID,
  V2_PAYMENT_SCHEDULER_ID,
} from "./config.ts";

const TIER_AMOUNT = 100_000_000n; // 0.1 SUI
const TIER_FREQUENCY_MS = 1n; // 1ms — due immediately each cycle
const DEPOSIT_AMOUNT = 1_000_000_000n; // 1 SUI

type Step = {
  name: string;
  tx: Transaction;
};

type StepResult = {
  step: string;
  digest: string;
  status: "success" | "failure";
  error?: string;
};

type Collected = {
  digests: Record<string, string>;
  ids: {
    platformId?: string;
    tierIndex?: number;
    accountId?: string;
    capId?: string;
    suiDiscriminant?: number;
  };
  balanceAfter1stPayment?: string;
  balanceAfter2ndPayment?: string;
  eventCounts: Record<string, number>;
};

const summary: Collected = {
  digests: {},
  ids: {},
  eventCounts: {},
};

function loadKeypair(): Ed25519Keypair {
  const keystorePath = join(homedir(), ".sui", "sui_config", "sui.keystore");
  const raw = readFileSync(keystorePath, "utf8").trim();
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`No keys found in ${keystorePath}`);
  }
  const first = parsed[0];
  if (typeof first !== "string") {
    throw new Error("Unexpected keypair entry shape (expected base64 string)");
  }
  // Sui 1.73.x keystore stores keys as: 1-byte scheme flag || 32-byte secret.
  // The byte 0x00 means ed25519, 0x01 means secp256k1. We strip the flag.
  // The @mysten/sui SDK's fromSecretKey expects a 32-byte array; the
  // raw base64 with the flag-prefix has 33 bytes.
  const raw_bytes = new Uint8Array(Buffer.from(first, "base64"));
  if (raw_bytes.length === 33) {
    const flag = raw_bytes[0];
    if (flag !== 0x00) {
      throw new Error(`Unsupported key scheme flag ${flag}; only ed25519 (0) is supported`);
    }
    return Ed25519Keypair.fromSecretKey(raw_bytes.slice(1));
  } else if (raw_bytes.length === 32) {
    return Ed25519Keypair.fromSecretKey(raw_bytes);
  } else {
    throw new Error(`Unexpected key length ${raw_bytes.length} bytes`);
  }
}

function newTx(keypair: Ed25519Keypair): Transaction {
  const tx = new Transaction();
  tx.setSender(keypair.toSuiAddress());
  tx.setGasBudget(50_000_000);
  return tx;
}

async function executeStep(
  client: SuiGraphQLClient,
  keypair: Ed25519Keypair,
  step: Step,
): Promise<StepResult> {
  console.log(`\n=== ${step.name} ===`);
  try {
    const result = await client.signAndExecuteTransaction({
      transaction: step.tx,
      signer: keypair,
    });
    if (result.$kind === "FailedTransaction") {
      const msg = result.FailedTransaction.status.error
        ? JSON.stringify(result.FailedTransaction.status.error)
        : "unknown";
      console.log(`  status: FAILED (${msg})`);
      return {
        step: step.name,
        digest: result.FailedTransaction.digest,
        status: "failure",
        error: msg,
      };
    }
    const digest = result.Transaction!.digest;
    console.log(`  status: success   digest: ${digest}`);
    summary.digests[step.name] = digest;
    return { step: step.name, digest, status: "success" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log(`  status: EXCEPTION (${message})`);
    return { step: step.name, digest: "", status: "failure", error: message };
  }
}

async function fetchBalanceMIST(
  client: SuiGraphQLClient,
  accountId: string,
): Promise<string> {
  const res = await client.query({
    query: `
            query GetAccount($id: SuiAddress!) {
                object(address: $id) {
                    asMoveObject {
                        contents { json }
                    }
                }
            }
        `,
    variables: { id: accountId },
  });
  const json: any = (res.data as any)?.object?.asMoveObject?.contents?.json;
  return json?.balance ?? "0";
}

async function fetchCoinTypeDiscriminant(
  client: SuiGraphQLClient,
  sender: string,
): Promise<number | undefined> {
  const res = await client.query({
    query: `
            query GetSuiRegistration($type: String!) {
                events(first: 5, filter: { type: $type }) {
                    nodes {
                        contents { json }
                        sender { address }
                    }
                }
            }
        `,
    variables: {
      type: `${V2_PACKAGE_ID}::registry::CoinTypeRegistered`,
    },
  });
  const nodes: any[] = (res.data as any)?.events?.nodes ?? [];
  for (const n of nodes) {
    if (n.sender?.address === sender) {
      return Number(n.contents?.json?.discriminant);
    }
  }
  return undefined;
}

async function fetchPlatformIdForSender(
  client: SuiGraphQLClient,
  sender: string,
): Promise<string | undefined> {
  const res = await client.query({
    query: `
            query GetPlatform($type: String!, $sender: SuiAddress!) {
                events(first: 5, filter: { type: $type, sender: $sender }) {
                    nodes {
                        contents { json }
                    }
                }
            }
        `,
    variables: {
      type: `${V2_PACKAGE_ID}::platform::PlatformRegistered`,
      sender,
    },
  });
  const nodes: any[] = (res.data as any)?.events?.nodes ?? [];
  return nodes[0]?.contents?.json?.platform_id;
}

async function fetchTreasuryCoinBalance(
  client: SuiGraphQLClient,
  treasuryAddress: string,
): Promise<string> {
  const res = await client.query({
    query: `
            query GetBalance($owner: SuiAddress!, $type: String!) {
                owner(address: $owner) {
                    balance(type: $type) { totalBalance }
                }
            }
        `,
    variables: { owner: treasuryAddress, type: SUI_TYPE_ARG },
  });
  return (res.data as any)?.owner?.balance?.totalBalance ?? "0";
}

// Shared object initial versions captured at publish time.
const SHARED_INIT_VERSION_REGISTRY = 10;
const SHARED_INIT_VERSION_SCHEDULER = 10;
let PLATFORM_INITIAL_VERSION = 10;  // bumped by create_tier etc.; updated by Step 2 hook

function sharedObjectMut(id: string, initialVersion: number) {
  // Wraps an Inputs.SharedObjectRef in a tx.object() call so the
  // returned value is a TransactionArgument (not a CallArg). Per the
  // SDK docs: `tx.object(Inputs.SharedObjectRef({...}))`.
  return (tx: Transaction) =>
    tx.object(
      Inputs.SharedObjectRef({
        objectId: id,
        mutable: true,
        initialSharedVersion: initialVersion,
      }),
    );
}

async function isSuiRegistered(client: SuiGraphQLClient): Promise<boolean> {
  // Check the registry's on-chain state directly: a Table<TypeName, u8>
  // doesn't have a clean GraphQL accessor, so use the discriminant-0
  // event as a proxy: if SUI is the registered coin (slot 0), then
  // there's an `AccountType::USDC` mapped from SUI's TypeName. We can
  // confirm by checking that the registry object exists and reading
  // its contents.
  // Simpler proxy: query the registry object and inspect its fields.
  try {
    const res = await client.query({
      query: `
        query GetRegistry($id: SuiAddress!) {
          object(address: $id) {
            asMoveObject { contents { json } }
          }
        }
      `,
      variables: { id: V2_COIN_TYPE_REGISTRY_ID },
    });
    const j = (res.data as any)?.object?.asMoveObject?.contents?.json;
    if (!j) return false;
    // Field name in Move struct: coin_to_discriminant (a Table).
    // The JSON projection may not include Table contents, but we can
    // check the registry's `version` field which is bumped on each
    // registration. If version > 1, *some* coin has been registered.
    // We also need a positive signal that SUI itself is registered.
    // The most reliable check: look for a `CoinTypeRegistered` event
    // whose json contains a TypeName for SUI.
    const eventRes = await client.query({
      query: `
        query GetSuiReg {
          events(first: 50, filter: { type: "${V2_PACKAGE_ID}::registry::CoinTypeRegistered" }) {
            nodes { contents { json } }
          }
        }
      `,
      variables: {},
    });
    const nodes: any[] = (eventRes.data as any)?.events?.nodes ?? [];
    return nodes.some((n) => {
      const t = n?.contents?.json?.type_name;
      return typeof t === "string" && t.includes("sui::SUI");
    });
  } catch (e) {
    console.log(`  [debug isSuiRegistered] error: ${e}`);
    return false;
  }
}

async function fetchEventCounts(
  client: SuiGraphQLClient,
  sender: string,
): Promise<Record<string, number>> {
  const eventTypes = [
    "CoinTypeRegistered",
    "PlatformRegistered",
    "TierCreated",
    "AccountCreated",
    "Deposit",
    "SubscriptionCreated",
    "SubscriptionUpdated",
    "PaymentProcessed",
    "PaymentFailed",
    "DuePaymentSubmitted",
  ];
  const counts: Record<string, number> = {};
  for (const name of eventTypes) {
    const module = eventModule(name);
    const type = `${V2_PACKAGE_ID}::${module}::${name}`;
    let total = 0;
    let cursor: string | null = null;
    let hasNextPage = true;
    while (hasNextPage) {
      const res: any = await client.query({
        query: `
                    query Count($type: String!, $sender: SuiAddress, $after: String) {
                        events(first: 50, after: $after, filter: { type: $type, sender: $sender }) {
                            nodes { contents { json } }
                            pageInfo { hasNextPage endCursor }
                        }
                    }
                `,
        variables: { type, sender, after: cursor },
      });
      const events: any = (res.data as any)?.events;
      const nodes: any[] = events?.nodes ?? [];
      total += nodes.length;
      hasNextPage = !!events?.pageInfo?.hasNextPage;
      cursor = events?.pageInfo?.endCursor ?? null;
      if (nodes.length === 0) break;
    }
    counts[name] = total;
  }
  return counts;
}

function eventModule(eventName: string): string {
  switch (eventName) {
    case "CoinTypeRegistered":
    case "CoinTypeRemoved":
      return "registry";
    case "PlatformRegistered":
    case "TierCreated":
    case "SubscriberCountChanged":
      return "platform";
    case "AccountCreated":
    case "Deposit":
    case "AccountPaused":
    case "AccountResumed":
    case "AccountClosed":
    case "PoliciesUpdated":
      return "account";
    case "SubscriptionCreated":
    case "SubscriptionUpdated":
    case "PaymentRecorded":
    case "FailedPaymentRecorded":
      return "billing";
    case "PaymentProcessed":
    case "PaymentFailed":
      return "payment";
    case "DuePaymentSubmitted":
    case "SchedulerPaused":
    case "SchedulerResumed":
      return "scheduler";
    default:
      return "";
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
  console.log(" PayStreamer v2 — E2E Payment Cycle");
  console.log("======================================================");
  console.log(`network:        ${V2_NETWORK}`);
  console.log(`package:        ${V2_PACKAGE_ID}`);
  console.log(`sender:         ${sender}`);
  console.log(`scheduler:      ${V2_PAYMENT_SCHEDULER_ID}`);
  console.log(`registry:       ${V2_COIN_TYPE_REGISTRY_ID}`);
  console.log(`access control: ${V2_ACCESS_CONTROL_ID}`);

  const results: StepResult[] = [];

  // Incremental build+execute: each step builds its TX only after the
  // prior step's effects are known. This is required because Step 3+
  // depend on the platformId/accountId/capId discovered from Steps 1-4.
  // ------------------------------------------------------------------
  // Step 1: register_coin_type<SUI> (idempotent — skip if already registered)
  // ------------------------------------------------------------------
  const suiAlreadyRegistered = await isSuiRegistered(client);
  if (suiAlreadyRegistered) {
    console.log("\n=== Step 1: register_coin_type<SUI> ===");
    console.log("  status: SKIP (SUI is already registered in the registry)");
    const d = await fetchCoinTypeDiscriminant(client, sender);
    if (d !== undefined) summary.ids.suiDiscriminant = d;
  } else {
    const tx = newTx(keypair);
    const info = tx.moveCall({
      target: `${V2_PACKAGE_ID}::registry::new_account_type_info`,
      arguments: [tx.pure.string("Sui"), tx.pure.u8(9), tx.pure.bool(false)],
    });
    tx.moveCall({
      target: `${V2_PACKAGE_ID}::registry::register_coin_type`,
      typeArguments: [SUI_TYPE_ARG],
      arguments: [sharedObjectMut(V2_COIN_TYPE_REGISTRY_ID, SHARED_INIT_VERSION_REGISTRY)(tx), info],
    });
    const r = await executeStep(client, keypair, { name: "Step 1: register_coin_type<SUI>", tx });
    results.push(r);
    if (r.status === "success") {
      const d = await fetchCoinTypeDiscriminant(client, sender);
      if (d !== undefined) summary.ids.suiDiscriminant = d;
    }
  }

  // ------------------------------------------------------------------
  // Step 2: register_platform
  // ------------------------------------------------------------------
  {
    const tx = newTx(keypair);
    tx.moveCall({
      target: `${V2_PACKAGE_ID}::platform::register_platform`,
      arguments: [
        tx.pure.string("PayStreamer E2E"),
        tx.pure.string("End-to-end payment cycle test platform"),
        tx.pure.string("Test"),
        tx.pure.option("string", null),
        tx.object(CLOCK_OBJECT_ID),
      ],
    });
    const r = await executeStep(client, keypair, { name: "Step 2: register_platform", tx });
    results.push(r);
    if (r.status === "success") {
      const p = await fetchPlatformIdForSender(client, sender);
      if (p) {
        summary.ids.platformId = p;
        // Look up the platform object's initialSharedVersion
        const objRes = await client.query({
          query: `query GetObj($id: SuiAddress!) {
            object(address: $id) { asMoveObject { contents { json } }
              owner { ... on Shared { initialSharedVersion } } } }`,
          variables: { id: p },
        });
        const v = (objRes.data as any)?.object?.owner?.initialSharedVersion;
        if (typeof v === "number") PLATFORM_INITIAL_VERSION = v;
      }
    }
  }

  if (!summary.ids.platformId) {
    throw new Error("Cannot determine platformId after Step 2");
  }

  // ------------------------------------------------------------------
  // Step 3: create_tier
  // ------------------------------------------------------------------
  {
    const tx = newTx(keypair);
    tx.moveCall({
      target: `${V2_PACKAGE_ID}::platform::create_tier`,
      arguments: [
        sharedObjectMut(summary.ids.platformId!, PLATFORM_INITIAL_VERSION)(tx),
        tx.pure.string("Test Tier"),
        tx.pure.u64(TIER_AMOUNT),
        tx.pure.u64(TIER_FREQUENCY_MS),
        tx.pure(bcs.U8.serialize(0).toBytes()), // AccountType::USDC variant (enum tag)
      ],
    });
    const r = await executeStep(client, keypair, { name: "Step 3: create_tier", tx });
    results.push(r);
  }

  // ------------------------------------------------------------------
  // Step 4: create_account + share_account
  // ------------------------------------------------------------------
  {
    const tx = newTx(keypair);
    const initialPolicies = tx.moveCall({
      target: `${V2_PACKAGE_ID}::account::empty_policy_set`,
    });
    const created = tx.moveCall({
      target: `${V2_PACKAGE_ID}::account::create_account`,
      typeArguments: [SUI_TYPE_ARG],
      arguments: [
        tx.object(V2_COIN_TYPE_REGISTRY_ID),  // immutable (&CoinTypeRegistry in create_account)
        initialPolicies,
        tx.object(CLOCK_OBJECT_ID),
      ],
    });
    const account = created[0];
    const cap = created[1];
    tx.moveCall({
      target: `${V2_PACKAGE_ID}::account::share_account`,
      typeArguments: [SUI_TYPE_ARG],
      arguments: [account, cap],
    });
    const r = await executeStep(client, keypair, { name: "Step 4: create_account + share_account", tx });
    results.push(r);
    if (r.status === "success") {
      // Discover accountId and capId from the AccountCreated event.
      const evRes = await client.query({
        query: `
          query GetAcctCreated($sender: SuiAddress!) {
            events(first: 5, filter: { type: "${V2_PACKAGE_ID}::account::AccountCreated", sender: $sender }) {
              nodes { contents { json } }
            }
          }
        `,
        variables: { sender },
      });
      const nodes: any[] = (evRes.data as any)?.events?.nodes ?? [];
      const latest = nodes[0]?.contents?.json;
      if (latest) {
        if (typeof latest.account_id === "string") summary.ids.accountId = latest.account_id;
        if (typeof latest.cap_id === "string") summary.ids.capId = latest.cap_id;
      }
    }
  }

  if (!summary.ids.accountId || !summary.ids.capId) {
    throw new Error("Cannot determine accountId/capId after Step 4");
  }

  // ------------------------------------------------------------------
  // Step 5: deposit
  // ------------------------------------------------------------------
  {
    const tx = newTx(keypair);
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(DEPOSIT_AMOUNT)]);
    tx.moveCall({
      target: `${V2_PACKAGE_ID}::account::deposit`,
      typeArguments: [SUI_TYPE_ARG],
      arguments: [
        tx.object(summary.ids.capId),
        tx.object(summary.ids.accountId),
        coin,
        tx.object(CLOCK_OBJECT_ID),
      ],
    });
    const r = await executeStep(client, keypair, { name: "Step 5: deposit<SUI>", tx });
    results.push(r);
  }

  // ------------------------------------------------------------------
  // Step 6: create_subscription
  // ------------------------------------------------------------------
  {
    const tx = newTx(keypair);
    tx.moveCall({
      target: `${V2_PACKAGE_ID}::billing::create_subscription`,
      typeArguments: [SUI_TYPE_ARG],
      arguments: [
        tx.object(summary.ids.capId),
        tx.object(summary.ids.accountId),
        tx.pure.id(summary.ids.platformId!),
        tx.pure.u64(0), // tier_index
        tx.pure.u64(TIER_AMOUNT),
        tx.pure.u64(TIER_FREQUENCY_MS),
        tx.pure(bcs.U8.serialize(0).toBytes()), // AccountType::USDC (enum tag as bcs)
        tx.object(CLOCK_OBJECT_ID),
      ],
    });
    const r = await executeStep(client, keypair, { name: "Step 6: create_subscription", tx });
    results.push(r);
  }

  // ------------------------------------------------------------------
  // Step 7: process_due_payment (1st cycle)
  // ------------------------------------------------------------------
  {
    const tx = newTx(keypair);
    const limiters = tx.moveCall({
      target: `${V2_PACKAGE_ID}::policies::empty_limiters`,
      typeArguments: [SUI_TYPE_ARG],
      arguments: [tx.object(CLOCK_OBJECT_ID)],
    });
    tx.moveCall({
      target: `${V2_PACKAGE_ID}::policies::ensure_initialized`,
      typeArguments: [SUI_TYPE_ARG],
      arguments: [
        tx.object(summary.ids.accountId!),
        limiters,
        tx.object(CLOCK_OBJECT_ID),
      ],
    });
    tx.moveCall({
      target: `${V2_PACKAGE_ID}::scheduler::process_due_payment`,
      typeArguments: [SUI_TYPE_ARG],
      arguments: [
        sharedObjectMut(V2_PAYMENT_SCHEDULER_ID, SHARED_INIT_VERSION_SCHEDULER)(tx),
        sharedObjectMut(summary.ids.platformId!, PLATFORM_INITIAL_VERSION)(tx),
        tx.object(summary.ids.accountId!),
        limiters,
        tx.object(CLOCK_OBJECT_ID),
      ],
    });
    const r = await executeStep(client, keypair, { name: "Step 7: process_due_payment (1st)", tx });
    results.push(r);
    if (r.status === "success" && summary.ids.accountId) {
      const b = await fetchBalanceMIST(client, summary.ids.accountId);
      summary.balanceAfter1stPayment = b;
      const treasuryBalance = await fetchTreasuryCoinBalance(client, sender);
      console.log(`  account balance:  ${b} MIST`);
      console.log(`  treasury (sender) balance: ${treasuryBalance} MIST`);
    }
  }

  // ------------------------------------------------------------------
  // Step 8: process_due_payment (2nd cycle)
  // ------------------------------------------------------------------
  {
    const tx = newTx(keypair);
    const limiters = tx.moveCall({
      target: `${V2_PACKAGE_ID}::policies::empty_limiters`,
      typeArguments: [SUI_TYPE_ARG],
      arguments: [tx.object(CLOCK_OBJECT_ID)],
    });
    tx.moveCall({
      target: `${V2_PACKAGE_ID}::policies::ensure_initialized`,
      typeArguments: [SUI_TYPE_ARG],
      arguments: [
        tx.object(summary.ids.accountId!),
        limiters,
        tx.object(CLOCK_OBJECT_ID),
      ],
    });
    tx.moveCall({
      target: `${V2_PACKAGE_ID}::scheduler::process_due_payment`,
      typeArguments: [SUI_TYPE_ARG],
      arguments: [
        sharedObjectMut(V2_PAYMENT_SCHEDULER_ID, SHARED_INIT_VERSION_SCHEDULER)(tx),
        sharedObjectMut(summary.ids.platformId!, PLATFORM_INITIAL_VERSION)(tx),
        tx.object(summary.ids.accountId!),
        limiters,
        tx.object(CLOCK_OBJECT_ID),
      ],
    });
    const r = await executeStep(client, keypair, { name: "Step 8: process_due_payment (2nd)", tx });
    results.push(r);
    if (r.status === "success" && summary.ids.accountId) {
      const b = await fetchBalanceMIST(client, summary.ids.accountId);
      summary.balanceAfter2ndPayment = b;
      console.log(`  account balance:  ${b} MIST`);
    }
  }

  // ------------------------------------------------------------------
  // Step 9: cancel_subscription
  // ------------------------------------------------------------------
  {
    const tx = newTx(keypair);
    tx.moveCall({
      target: `${V2_PACKAGE_ID}::billing::cancel_subscription`,
      typeArguments: [SUI_TYPE_ARG],
      arguments: [
        tx.object(summary.ids.capId),
        tx.object(summary.ids.accountId),
        tx.pure.id(summary.ids.platformId!),
        tx.object(CLOCK_OBJECT_ID),
      ],
    });
    const r = await executeStep(client, keypair, { name: "Step 9: cancel_subscription", tx });
    results.push(r);
  }

  // Step 10: snapshot
  console.log("\n=== Step 10: snapshot ===");
  summary.eventCounts = await fetchEventCounts(client, sender);

  const out = {
    network: V2_NETWORK,
    packageId: V2_PACKAGE_ID,
    sender,
    ids: summary.ids,
    digests: summary.digests,
    balanceAfter1stPayment: summary.balanceAfter1stPayment,
    balanceAfter2ndPayment: summary.balanceAfter2ndPayment,
    eventCounts: summary.eventCounts,
    results,
    timestamp: new Date().toISOString(),
  };
  writeFileSync(
    new URL("./e2e-result.json", import.meta.url),
    JSON.stringify(out, null, 2),
  );

  console.log("\n  Digests:");
  for (const [name, d] of Object.entries(summary.digests)) {
    console.log(`    ${name.padEnd(48)} ${d}`);
  }
  console.log("\n  Event counts (since sender):");
  for (const [name, n] of Object.entries(summary.eventCounts)) {
    console.log(`    ${name.padEnd(28)} ${n}`);
  }
  console.log("\nSummary saved to scripts/v2/e2e-result.json");

  const success = results.every((r) => r.status === "success");
  if (success) {
    console.log("\n\x1b[32m✓ E2E payment cycle completed successfully\x1b[0m");
  } else {
    console.log("\n\x1b[31m✗ One or more steps failed; see above\x1b[0m");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("E2E_FAILED:", e);
  if (e instanceof Error) {
    console.error("Stack:", e.stack);
  } else {
    console.error("Value:", JSON.stringify(e, null, 2));
  }
  process.exit(1);
});
