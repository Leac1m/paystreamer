import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Transaction } from "@mysten/sui/transactions";
import { useCurrentClient, useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useQuery } from "@tanstack/react-query";

const SUI_TYPE = "0x2::sui::SUI";

export function UpdatePolicy({
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [maxMonthlyWithdrawal, setMaxMonthlyWithdrawal] = useState("");
  const [maxPerTransaction, setMaxPerTransaction] = useState("");
  const [minBalance, setMinBalance] = useState("");
  const [minFrequencyDays, setMinFrequencyDays] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch current policies
  const { data: accountObj } = useQuery({
    queryKey: ["subscription-account", accountId],
    queryFn: async () => {
      const { object } = await client.core.getObject({
        objectId: accountId,
        include: { json: true },
      });
      return object;
    },
    enabled: !!accountId,
  });

  async function updatePolicies() {
    if (!account) return;

    const maxMonthly = parseFloat(maxMonthlyWithdrawal) * 1_000_000_000;
    const maxPerTx = parseFloat(maxPerTransaction) * 1_000_000_000;
    const minBal = parseFloat(minBalance) * 1_000_000_000;
    const freqDays = parseInt(minFrequencyDays);

    if (!maxMonthly || !maxPerTx || !minBal || isNaN(freqDays)) {
      setError("Enter valid numeric values");
      return;
    }

    setIsPending(true);
    setError(null);

    const tx = new Transaction();

    // Create new PolicyConfig
    const policyConfigArg = tx.add((tx) =>
      tx.moveCall({
        package: "@local-pkg/subscriptions",
        module: "subscription_account",
        function: "new_policy_config",
        arguments: [
          tx.pure.u64(BigInt(maxMonthly)),
          tx.pure.u64(BigInt(maxPerTx)),
          tx.pure.u64(BigInt(minBal)),
          tx.pure.u64(BigInt(freqDays)),
        ],
      }),
    );

    // Call update_policy
    tx.add((tx) =>
      tx.moveCall({
        package: "@local-pkg/subscriptions",
        module: "subscription_account",
        function: "update_policy",
        arguments: [
          tx.object(accountCapId),
          tx.object(accountId),
          policyConfigArg,
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
      setIsExpanded(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsPending(false);
    }
  }

  const currentPolicies = accountObj?.json?.policies as Record<string, unknown> | undefined;

  return (
    <div className="space-y-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? "Cancel" : "Update Policies"}
      </Button>

      {isExpanded && (
        <div className="space-y-3 p-4 border rounded-lg bg-white/5">
          <p className="text-sm font-medium">Current Policies:</p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Max Monthly: {currentPolicies ? Number(currentPolicies.max_monthly_withdrawal as number) / 1_000_000_000 : "?"} SUI</p>
            <p>Max Per Tx: {currentPolicies ? Number(currentPolicies.max_per_transaction as number) / 1_000_000_000 : "?"} SUI</p>
            <p>Min Balance: {currentPolicies ? Number(currentPolicies.min_balance as number) / 1_000_000_000 : "?"} SUI</p>
            <p>Min Frequency: {String(currentPolicies?.min_frequency_days ?? "?")} days</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              placeholder="Max monthly (SUI)"
              value={maxMonthlyWithdrawal}
              onChange={(e) => setMaxMonthlyWithdrawal(e.target.value)}
            />
            <Input
              type="number"
              placeholder="Max per tx (SUI)"
              value={maxPerTransaction}
              onChange={(e) => setMaxPerTransaction(e.target.value)}
            />
            <Input
              type="number"
              placeholder="Min balance (SUI)"
              value={minBalance}
              onChange={(e) => setMinBalance(e.target.value)}
            />
            <Input
              type="number"
              placeholder="Min frequency (days)"
              value={minFrequencyDays}
              onChange={(e) => setMinFrequencyDays(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button size="sm" onClick={updatePolicies} disabled={!account || isPending} loading={isPending}>
            Save Policies
          </Button>
        </div>
      )}
    </div>
  );
}