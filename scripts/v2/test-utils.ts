/**
 * Shared helpers for the v2 scripts (`e2e-payment-cycle.ts`,
 * `seed-demo-platform.ts`).
 *
 * `loadKeypair` and `newTx` are reproduced here from the e2e script so the
 * seed script can stay focused on its own logic. The e2e script keeps its
 * own copy to avoid coupling — the two scripts are independently runnable
 * and we want each one to keep working if this helper file is broken.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { Inputs, Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";

export function loadKeypair(): Ed25519Keypair {
  let first = "";
  if (process.env.E2E_PRIVATE_KEY) {
    first = process.env.E2E_PRIVATE_KEY;
  } else {
    const keystorePath = join(homedir(), ".sui", "sui_config", "sui.keystore");
    const raw = readFileSync(keystorePath, "utf8").trim();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error(`No keys found in ${keystorePath}`);
    }
    first = parsed[0];
  }
  if (typeof first !== "string") {
    throw new Error("Unexpected keypair entry shape (expected base64 string)");
  }
  if (first.startsWith("suiprivkey")) {
    const parsedKey = decodeSuiPrivateKey(first);
    return Ed25519Keypair.fromSecretKey(parsedKey.secretKey);
  }
  // Sui 1.73.x keystore stores keys as: 1-byte scheme flag || 32-byte secret.
  const raw_bytes = new Uint8Array(Buffer.from(first, "base64"));
  if (raw_bytes.length === 33) {
    const flag = raw_bytes[0];
    if (flag !== 0x00) {
      throw new Error(`Unsupported key scheme flag ${flag}; only ed25519 (0) is supported`);
    }
    return Ed25519Keypair.fromSecretKey(raw_bytes.slice(1));
  } else if (raw_bytes.length === 32) {
    return Ed25519Keypair.fromSecretKey(raw_bytes);
  }
  throw new Error(`Unexpected keystore entry length ${raw_bytes.length}; expected 32 or 33`);
}

export function newTx(keypair: Ed25519Keypair): Transaction {
  const tx = new Transaction();
  tx.setSender(keypair.toSuiAddress());
  tx.setGasBudget(50_000_000);
  tx.setGasOwner(keypair.toSuiAddress());
  return tx;
}

export function sharedObjectMut(id: string, initialVersion: number) {
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
