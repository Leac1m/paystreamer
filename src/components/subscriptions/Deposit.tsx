import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Transaction } from "@mysten/sui/transactions";
import { useCurrentClient, useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

const SUI_TYPE = "0x2::sui::SUI";

export function Deposit({
  accountId,
  accountCapId,
}: {
  accountId: string;
  accountCapId: string;
}) {
  const client = useCurrentClient();
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function depositFunds() {
    if (!account) return;
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      setError("Enter a valid amount");
      return;
    }

    setIsPending(true);
    setError(null);

    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(BigInt(amountNum * 1_000_000_000))]);

    tx.add((tx) =>
      tx.moveCall({
        package: "@local-pkg/subscriptions",
        module: "subscription_account",
        function: "deposit",
        arguments: [
          tx.object(accountCapId),
          tx.object(accountId),
          coin,
        ],
        typeArguments: [SUI_TYPE],
      }),
    );

    try {
      const result = await dAppKit.signAndExecuteTransaction({
        transaction: tx,
      });

      if (result.$kind === "FailedTransaction") {
        throw new Error(result.FailedTransaction.status.error?.message ?? "Transaction failed");
      }

      await client.core.waitForTransaction({ digest: result.Transaction.digest });
      await queryClient.invalidateQueries({ queryKey: ["subscription-account", accountId] });
      await queryClient.invalidateQueries({ queryKey: ["subscription-accounts", account.address] });
      setAmount("");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          type="number"
          placeholder="Amount in SUI"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min={0}
          step={0.001}
        />
        <Button onClick={depositFunds} disabled={!account || isPending} loading={isPending}>
          Deposit
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}