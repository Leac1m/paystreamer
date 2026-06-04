import { useState } from "react";
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
import { UpdatePolicy } from "./UpdatePolicy";
import { SubscribeToPlatform } from "./SubscribeToPlatform";
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
  const [activeSection, setActiveSection] = useState<"deposit" | "subscribe" | "policies">("deposit");

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
      {/* Account Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle>My Account</CardTitle>
          <CardDescription className="font-mono text-xs break-all">
            {accountId}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Balance</p>
              <p className="text-3xl font-bold">
                {fields?.balance ? Number(fields.balance) / 1_000_000_000 : 0} SUI
              </p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>Status: <Badge variant={(fields.status as any)?.variant === 0 ? "default" : "secondary"}>
                {(fields.status as any)?.variant === 0 ? "Active" : (fields.status as any)?.variant === 1 ? "Paused" : "Closed"}
              </Badge></p>
              <p className="mt-1">Subscribers: {Object.keys(fields.subscriptions || {}).length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={activeSection === "deposit" ? "default" : "secondary"}
              onClick={() => setActiveSection("deposit")}
            >
              Deposit
            </Button>
            <Button
              variant={activeSection === "subscribe" ? "default" : "secondary"}
              onClick={() => setActiveSection("subscribe")}
            >
              Subscribe
            </Button>
            <Button
              variant={activeSection === "policies" ? "default" : "secondary"}
              onClick={() => setActiveSection("policies")}
            >
              Policies
            </Button>
          </div>

          <div className="mt-4">
            {activeSection === "deposit" && (
              <Deposit accountId={accountId} accountCapId={accountCapId} />
            )}
            {activeSection === "subscribe" && (
              <SubscribeToPlatform accountId={accountId} accountCapId={accountCapId} />
            )}
            {activeSection === "policies" && (
              <UpdatePolicy accountId={accountId} accountCapId={accountCapId} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Subscriptions List */}
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
      ) : (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-muted-foreground mb-2">No active subscriptions</p>
            <Button variant="secondary" onClick={() => setActiveSection("subscribe")}>
              Browse Platforms
            </Button>
          </CardContent>
        </Card>
      )}
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
          <span className="text-xs text-muted-foreground">
            ({subscription.paymentCount || 0} payments)
          </span>
        </div>
      </div>
    </div>
  );
}