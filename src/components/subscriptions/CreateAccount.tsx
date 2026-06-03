import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Transaction } from "@mysten/sui/transactions";
import { useCurrentClient, useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { PlusCircle } from "lucide-react";

const SUI_TYPE = "0x2::sui::SUI";

export function CreateAccount({
  onCreated,
}: {
  onCreated: (id: string, capId: string) => void;
}) {
  const client = useCurrentClient();
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!account) return;
    setIsPending(true);
    setError(null);

    const tx = new Transaction();

    tx.add((tx) =>
      tx.moveCall({
        package: "@local-pkg/subscriptions",
        module: "subscription_account",
        function: "create_account",
        arguments: [],
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

      await client.core.waitForTransaction({
        digest: result.Transaction.digest,
      });

      // parse events to get account and cap IDs
      const txData = await client.core.getTransaction({
        digest: result.Transaction.digest,
        include: { events: true },
      });
      const events: any[] = "events" in txData && Array.isArray((txData as any).events) ? (txData as any).events : [];
      const accountCreated = events.find(
        (e: any) => e.type?.includes("::subscription_account::AccountCreated"),
      );
      if (accountCreated) {
        const [, accountId, capId] = accountCreated.parsed_json ?? [];
        if (accountId && capId) {
          onCreated(accountId, capId);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["subscription-accounts", account.address] });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlusCircle className="h-5 w-5" />
          Create Subscription Account
        </CardTitle>
        <CardDescription>
          Set up your account to deposit funds and subscribe to platforms.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
            {error}
          </div>
        )}
        <Button
          size="lg"
          className="w-full"
          onClick={create}
          disabled={!account || isPending}
          loading={isPending}
        >
          Create Account
        </Button>
      </CardContent>
    </Card>
  );
}