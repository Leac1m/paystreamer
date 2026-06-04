import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { Transaction } from "@mysten/sui/transactions";
import { useCurrentClient, useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { DEVNET_SUBSCRIPTIONS_PACKAGE_ID } from "../../constants";

const FREQUENCY_LABELS = ["Daily", "Weekly", "Monthly", "Yearly"];

export function PlatformOwnerDashboard() {
  const client = useCurrentClient();
  const account = useCurrentAccount();

  const { data: ownerCaps, isPending } = useQuery({
    queryKey: ["platform-owner-caps", account?.address],
    queryFn: async () => {
      if (!account?.address) return [];
      const { objects } = await client.core.listOwnedObjects({
        owner: account.address,
        type: `${DEVNET_SUBSCRIPTIONS_PACKAGE_ID}::platform_registry::PlatformOwnerCap`,
        include: { json: true },
        limit: 50,
      });
      return objects;
    },
    enabled: !!account?.address,
  });

  if (isPending) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!ownerCaps || ownerCaps.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground mb-4">
            You don't own any platforms.
          </p>
          <RegisterPlatformCard />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <RegisterPlatformCard />
      {ownerCaps.map((obj) => (
        <PlatformOwnerCard key={obj.objectId} ownerCap={obj} />
      ))}
    </div>
  );
}

function PlatformOwnerCard({ ownerCap }: { ownerCap: any }) {
  const client = useCurrentClient();

  const ownerCapId = ownerCap.objectId;
  const platformId = ownerCap.json?.platform_id;

  const { data: platform } = useQuery({
    queryKey: ["platform", platformId],
    queryFn: async () => {
      const { object } = await client.core.getObject({
        objectId: platformId,
        include: { json: true },
      });
      return object;
    },
    enabled: !!platformId,
  });

  const fields = platform?.json as Record<string, unknown> | null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{String(fields?.name ?? "Platform")}</CardTitle>
        <CardDescription className="font-mono text-xs break-all">
          {platformId}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">Tiers</p>
          {!fields?.tiers || (fields.tiers as unknown[]).length === 0 ? (
            <p className="text-sm text-muted-foreground">No tiers yet.</p>
          ) : (
            <div className="space-y-2">
              {(fields.tiers as unknown[]).map((tier: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span>{tier.name}</span>
                  <span className="text-muted-foreground">
                    {FREQUENCY_LABELS[tier.frequency?.variant] || "Unknown"} —{" "}
                    {Number(tier.amount) / 1_000_000_000} SUI
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <TierManagement ownerCapId={ownerCapId} platformId={platformId} />
      </CardContent>
    </Card>
  );
}

function RegisterPlatformCard() {
  const client = useCurrentClient();
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function registerPlatform() {
    if (!account || !name || !description || !category) {
      setError("Fill in all fields");
      return;
    }

    setIsPending(true);
    setError(null);

    const tx = new Transaction();

    // Call register_platform which returns PlatformOwnerCap
    // We need to transfer it to the sender in the same PTB
    const [ownerCap] = tx.add((tx) =>
      tx.moveCall({
        package: "@local-pkg/subscriptions",
        module: "platform_registry",
        function: "register_platform",
        arguments: [
          tx.pure.string(name),
          tx.pure.string(description),
          tx.pure.string(category),
          tx.pure("option<string>", null), // None for webhook_url
        ],
      }),
    );

    // Transfer the PlatformOwnerCap to sender
    tx.add((tx) =>
      tx.transferObjects(
        [ownerCap],
        tx.pure.address(account.address),
      ),
    );

    try {
      const result = await dAppKit.signAndExecuteTransaction({
        transaction: tx,
      });

      if (result.$kind === "FailedTransaction") {
        throw new Error(result.FailedTransaction.status.error?.message ?? "Transaction failed");
      }

      await client.core.waitForTransaction({ digest: result.Transaction.digest });
      await queryClient.invalidateQueries({ queryKey: ["platform-owner-caps", account.address] });
      setName("");
      setDescription("");
      setCategory("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Register New Platform</CardTitle>
        <CardDescription>Create a new platform to start accepting subscriptions.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          <Input
            placeholder="Platform name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Input
            placeholder="Category (e.g., Streaming, AI, Gaming)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button size="sm" onClick={registerPlatform} disabled={!account || isPending} loading={isPending}>
          Register Platform
        </Button>
      </CardContent>
    </Card>
  );
}

function TierManagement({
  ownerCapId,
  platformId,
}: {
  ownerCapId: string;
  platformId: string;
}) {
  const client = useCurrentClient();
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();
  const [tierName, setTierName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("2");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addTier() {
    if (!account || !tierName || !amount) {
      setError("Fill in all fields");
      return;
    }

    setIsPending(true);
    setError(null);

    const tx = new Transaction();
    const freqVariant = parseInt(frequency);

    const freqTxArg = (() => {
      switch (freqVariant) {
        case 0:
          return tx.moveCall({
            package: "@local-pkg/subscriptions",
            module: "platform_registry",
            function: "billing_frequency_daily",
            arguments: [],
          });
        case 1:
          return tx.moveCall({
            package: "@local-pkg/subscriptions",
            module: "platform_registry",
            function: "billing_frequency_weekly",
            arguments: [],
          });
        case 3:
          return tx.moveCall({
            package: "@local-pkg/subscriptions",
            module: "platform_registry",
            function: "billing_frequency_yearly",
            arguments: [],
          });
        default:
          return tx.moveCall({
            package: "@local-pkg/subscriptions",
            module: "platform_registry",
            function: "billing_frequency_monthly",
            arguments: [],
          });
      }
    })();

    tx.add((tx) =>
      tx.moveCall({
        package: "@local-pkg/subscriptions",
        module: "platform_registry",
        function: "create_tier",
        arguments: [
          tx.object(ownerCapId),
          tx.object(platformId),
          tx.pure.string(tierName),
          tx.pure.u64(BigInt(parseFloat(amount) * 1_000_000_000)),
          freqTxArg,
        ],
      }),
    );

    try {
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });

      if (result.$kind === "FailedTransaction") {
        throw new Error(result.FailedTransaction.status.error?.message ?? "Transaction failed");
      }

      await client.core.waitForTransaction({ digest: result.Transaction.digest });
      await queryClient.invalidateQueries({ queryKey: ["platform", platformId] });
      setTierName("");
      setAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Add Tier</p>
      <div className="grid grid-cols-3 gap-2">
        <Input
          placeholder="Tier name"
          value={tierName}
          onChange={(e) => setTierName(e.target.value)}
        />
        <Input
          type="number"
          placeholder="SUI amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
        >
          <option value="0">Daily</option>
          <option value="1">Weekly</option>
          <option value="2">Monthly</option>
          <option value="3">Yearly</option>
        </select>
      </div>
      <Button size="sm" onClick={addTier} disabled={!account || isPending} loading={isPending}>
        Add Tier
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}