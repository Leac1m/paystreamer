import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Transaction } from "@mysten/sui/transactions";
import { useCurrentClient, useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "../ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";

const SUI_TYPE = "0x2::sui::SUI";

export function SubscribeToPlatform({
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
  const [platformId, setPlatformId] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: platform, isPending: platformLoading } = useQuery({
    queryKey: ["platform-by-id", platformId],
    queryFn: async () => {
      if (!platformId || platformId.length < 66) return null;
      const { object } = await client.core.getObject({
        objectId: platformId,
        include: { json: true },
      });
      return object;
    },
    enabled: platformId.length >= 66,
  });

  async function subscribe(tierIndex: number, _tierName: string, _tierAmount: bigint) {
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
          tx.object("0x6"), // Clock
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsPending(false);
    }
  }

  const fields = platform?.json as Record<string, unknown> | undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscribe to Platform</CardTitle>
        <CardDescription>
          Enter a platform ID to browse and subscribe to it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Platform ID (0x...)"
          value={platformId}
          onChange={(e) => setPlatformId(e.target.value)}
          className="font-mono text-xs"
        />

        {platformLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

        {platform && fields && (
          <div className="space-y-3 p-4 border rounded-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{String(fields.name ?? "Unnamed Platform")}</p>
                <p className="text-sm text-muted-foreground">{String(fields.description ?? "No description")}</p>
              </div>
              {(fields as any).is_verified && <Badge>Verified</Badge>}
            </div>

            {typeof fields.category === 'string' && (
              <p className="text-sm text-muted-foreground">{fields.category}</p>
            )}

            {Array.isArray(fields.tiers) && fields.tiers.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Available Tiers:</p>
                {fields.tiers.map((tier: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <span className="text-sm">{tier.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {Number(tier.amount) / 1_000_000_000} SUI / {FREQUENCY_LABELS[tier.frequency?.variant] || "Unknown"}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => subscribe(i, tier.name, BigInt(tier.amount))}
                      disabled={isPending}
                      loading={isPending}
                    >
                      Subscribe
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No tiers available.</p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}

const FREQUENCY_LABELS = ["Daily", "Weekly", "Monthly", "Yearly"];