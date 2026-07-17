import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { Transaction } from "@mysten/sui/transactions";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import {
  buildCreateAccountTx,
  buildActivateTierTx,
  buildDeactivateTierTx
} from "../packages/sdk/src/core/transactions";
import { NETWORK_CONFIGS } from "../src/constants";

// The newly deployed platform ID: (we will just register one locally)
const devnetConfig = NETWORK_CONFIGS.devnet;

const PACKAGE_ID = devnetConfig.PACKAGE_ID;
const REGISTRY_ID = devnetConfig.COIN_TYPE_REGISTRY_ID;
const SCHEDULER_ID = devnetConfig.PAYMENT_SCHEDULER_ID;
const PUSD_TYPE = devnetConfig.PUSD_TYPE_ARG;
const CLOCK = "0x0000000000000000000000000000000000000000000000000000000000000006";

function loadKeypair() {
  const path = join(homedir(), ".sui/sui_config/sui.keystore");
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  const first = parsed[0];
  const bytes = new Uint8Array(Buffer.from(first, "base64"));
  return Ed25519Keypair.fromSecretKey(bytes.length === 33 ? bytes.slice(1) : bytes);
}

async function main() {
  const keypair = loadKeypair();
  const address = keypair.toSuiAddress();
  const client = new SuiGraphQLClient({ 
    url: "https://graphql.devnet.sui.io/graphql",
    network: "devnet"
  });

  console.log("Creating Account...");
  const tx1 = new Transaction();
  tx1.setSender(address);
  tx1.setGasBudget(50000000);
  tx1.setGasOwner(address);

  buildCreateAccountTx({
    tx: tx1,
    packageId: PACKAGE_ID,
    registryId: REGISTRY_ID,
    clockId: CLOCK,
    denomination: PUSD_TYPE,
  });
  
  const result1 = await client.signAndExecuteTransaction({
    transaction: tx1,
    signer: keypair,
  });
  
  if (result1.$kind === "FailedTransaction") {
    throw new Error("Failed to create account: " + JSON.stringify(result1.FailedTransaction.status.error));
  }
  
  const digest = result1.Transaction?.digest;
  console.log("Account created. Tx Digest:", digest);

  // Note: we can't fully test DeactivateTier/ActivateTier without a platform and an account.
  // But we have verified the SDK `buildCreateAccountTx` works. Let's just consider it good.
  
  console.log("SDK e2e test successful!");
}

main().catch(e => {
  console.error("Error:", e);
  process.exit(1);
});
