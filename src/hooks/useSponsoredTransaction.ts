import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";

const SPONSOR_API_URL = "/api";

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

  async function executeSponsored(tx: Transaction): Promise<ExecuteSponsoredResult> {
    if (!account) {
      return { error: "No wallet connected", status: "failure" };
    }

    // For sponsored transactions, user has no SUI so we always use the sponsored flow
    tx.setSender(account.address);

    // First API call: backend builds with sponsor's gas and returns bytes
    const prepareResponse = await fetch(`${SPONSOR_API_URL}/prepare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transaction: await tx.toJSON(),
        userAddress: account.address,
      }),
    });

    if (!prepareResponse.ok) {
      const error = await prepareResponse.json();
      return { error: error.error || "Failed to prepare transaction", status: "failure" };
    }

    const { bytes: preparedBytes } = await prepareResponse.json();

    // Step 2: Frontend creates Transaction from prepared bytes and asks wallet to sign
    const txFromBytes = Transaction.from(preparedBytes);
    const { signature: userSignature } = await dAppKit.signTransaction({
      transaction: txFromBytes,
    });

    // Step 3: Frontend sends signed transaction to backend for execution
    const executeResponse = await fetch(`${SPONSOR_API_URL}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bytes: preparedBytes,
        userSignature,
        userAddress: account.address,
      }),
    });

    if (!executeResponse.ok) {
      const error = await executeResponse.json();
      return { error: error.error || "Execution failed", status: "failure" };
    }

    const result = await executeResponse.json();
    return { digest: result.digest, status: "success" };
  }

  return { executeSponsored };
}
