import { useQuery } from "@tanstack/react-query";
import { useCurrentClient } from "@mysten/dapp-kit-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Deposit } from "./Deposit";
import { Badge } from "../ui/badge";

export function MySubscriptionAccount({
  accountId,
  accountCapId,
  onAccountLost,
}: {
  accountId: string;
  accountCapId: string;
  onAccountLost: () => void;
}) {
  const client = useCurrentClient();

  const { data: account, isPending } = useQuery({
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

  if (isPending) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading account...</div>
        </CardContent>
      </Card>
    );
  }

  if (!account || !account.json) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-muted-foreground">
            Account not found. It may have been transferred or doesn't exist.
          </p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={onAccountLost}
          >
            Create New Account
          </Button>
        </CardContent>
      </Card>
    );
  }

  const fields = account.json as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>My Account</CardTitle>
          <CardDescription className="font-mono text-xs break-all">
            {accountId}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Balance</p>
            <p className="text-3xl font-bold">
              {fields?.balance ? Number(fields.balance) / 1_000_000_000 : 0} SUI
            </p>
          </div>
          <Deposit
            accountId={accountId}
            accountCapId={accountCapId}
          />
        </CardContent>
      </Card>

      {fields?.subscriptions && typeof fields.subscriptions === "object" && Object.keys(fields.subscriptions as Record<string, unknown>).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>My Subscriptions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(fields.subscriptions as Record<string, unknown>).map(([platformId, sub]) => (
              <SubscriptionItem
                key={platformId}
                platformId={platformId}
                subscription={sub}
              />
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function SubscriptionItem({
  platformId,
  subscription,
}: {
  platformId: string;
  subscription: any;
}) {
  const statusLabel =
    subscription.status?.variant === 0
      ? "Active"
      : subscription.status?.variant === 1
      ? "Paused"
      : "Cancelled";
  const statusVariant =
    statusLabel === "Active"
      ? "default"
      : statusLabel === "Paused"
      ? "secondary"
      : "destructive";

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div>
        <p className="font-mono text-xs text-muted-foreground">{platformId}</p>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant={statusVariant as any}>{statusLabel}</Badge>
          <span className="text-sm">
            {Number(subscription.totalPaid || 0) / 1_000_000_000} SUI paid
          </span>
        </div>
      </div>
    </div>
  );
}