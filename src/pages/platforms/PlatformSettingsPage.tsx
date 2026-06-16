import { useState } from "react";
import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { useOwnedPlatforms } from "../../lib/platformDiscovery";
import { PACKAGE_ID } from "../../constants";
import { getErrorMessage } from "../../lib/errors";

export function PlatformSettingsPage() {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const navigate = useNavigate();
  const { data: platforms, isPending } = useOwnedPlatforms(account?.address ?? null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isPendingTx, setIsPendingTx] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isPending) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!platforms || platforms.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            You need to own a platform to access settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  const platform = platforms[0];
  const fields = platform.json;

  async function handleUpdateSettings() {
    if (!account) return;

    setIsPendingTx(true);
    setError(null);

    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::platform::update_platform`,
      arguments: [
        tx.sharedObjectRef({
          objectId: platform.objectId,
          initialSharedVersion: platform.initialSharedVersion,
          mutable: true,
        }),
        tx.pure.option("string", name || null),
        tx.pure.option("string", description || null),
        tx.pure.option("string", webhookUrl || null),
      ],
    });

    try {
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result.$kind === "FailedTransaction") {
        throw new Error(
          (result.FailedTransaction as any).effects?.status?.error ?? "Transaction failed"
        );
      }
      navigate(0);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsPendingTx(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform Settings</h1>
        <p className="text-muted-foreground text-sm">
          Update your platform information
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Update your platform details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Platform Name</label>
            <Input
              placeholder={fields.name}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Input
              placeholder={fields.description}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Webhook URL</label>
            <Input
              placeholder="https://..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button onClick={handleUpdateSettings} disabled={!account || isPendingTx} loading={isPendingTx}>
            Save Changes
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Platform Info</CardTitle>
          <CardDescription>Platform identification and creation details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Category</label>
            <p className="text-sm text-muted-foreground">
              {fields.category || "Uncategorized"}{" "}
              <span className="text-xs">(set at registration; not editable on-chain)</span>
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Platform ID</label>
            <p className="font-mono text-sm bg-muted p-2 rounded break-all">{platform.objectId}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Created</label>
            <p className="text-sm text-muted-foreground">
              {fields.created_at
                ? new Date(fields.created_at * 1000).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "Unknown"}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Owner</label>
            <p className="font-mono text-sm bg-muted p-2 rounded break-all">{fields.owner}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}