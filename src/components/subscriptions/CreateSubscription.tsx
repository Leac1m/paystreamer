import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Transaction } from "@mysten/sui/transactions";
import { useCurrentClient, useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { Button } from "../ui/button";

const SUI_TYPE = "0x2::sui::SUI";

export function CreateSubscription({
  accountId,
  accountCapId,
  platformId,
  tierIndex,
  tierName,
  onSuccess,
}: {
  accountId: string;
  accountCapId: string;
  platformId: string;
  tierIndex: number;
  tierName: string;
  onSuccess?: () => void;
}) {
  const client = useCurrentClient();
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subscribe() {
    if (!account) return;
    setIsPending(true);
    setError(null);

    const tx = new Transaction();

    tx.add((tx) =>
      tx.moveCall({
        package: "@local-pkg/subscriptions",
        module: "subscription_manager",
        function: "create_subscription",
        arguments: [
          tx.object(accountCapId),
          tx.object(accountId),
          tx.object(platformId),
          tx.pure.u64(BigInt(tierIndex)),
          tx.object("0x6"),
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
      onSuccess?.();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button size="sm" onClick={subscribe} disabled={!account || isPending} loading={isPending}>
        Subscribe to {tierName}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}