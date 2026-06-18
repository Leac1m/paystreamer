import { useCurrentAccount, useDAppKit, useCurrentClient } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";

const SPONSOR_API_URL = process.env.NEXT_PUBLIC_SPONSOR_API_URL || "http://localhost:3000";
const SPONSOR_ADDRESS =
  process.env.NEXT_PUBLIC_SPONSOR_ADDRESS || "0x4cdce7c7afad9318fab1cedfc8ff07fb66bea30420443600544282dcb3bc3993";

export interface SponsoredTransactionResult {
  digest: string;
  status?: "success" | "failure";
}

export interface ExecuteSponsoredResult {
  digest?: string;
  error?: string;
  status?: "success" | "failure";
}

export function useSponsoredTransaction() {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const client = useCurrentClient();

  async function executeSponsored(tx: Transaction): Promise<ExecuteSponsoredResult> {
    if (!account) {
      return { error: "No wallet connected", status: "failure" };
    }

    // Set sponsorship info
    tx.setSender(account.address);
    tx.setGasOwner(SPONSOR_ADDRESS);
    tx.setGasPayment([]); // Address balance gas

    // Build transaction (only transaction kind - no gas resolution)
    const bytes = await tx.build({ client, onlyTransactionKind: true });

    // Get user signature via dAppKit
    const { signature: userSignature } = await dAppKit.signTransaction({
      transaction: tx,
    });

    // Send to sponsor API
    const response = await fetch(`${SPONSOR_API_URL}/sponsor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bytes: Buffer.from(bytes).toString("base64"),
        userSignature,
        userAddress: account.address,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return { error: result.error || "Sponsorship failed", status: "failure" };
    }

    return { digest: result.digest, status: "success" };
  }

  return { executeSponsored };
}
