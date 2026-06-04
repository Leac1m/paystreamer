import { useQuery } from "@tanstack/react-query";
import { useCurrentClient, useCurrentAccount } from "@mysten/dapp-kit-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { CreateSubscription } from "./CreateSubscription";
import { DEVNET_SUBSCRIPTIONS_PACKAGE_ID } from "../../constants";

const FREQUENCY_LABELS = ["Daily", "Weekly", "Monthly", "Yearly"];

export function PlatformBrowser() {
  const client = useCurrentClient();
  const account = useCurrentAccount();

  const { data: platforms, isPending } = useQuery({
    queryKey: ["platforms"],
    queryFn: async () => {
      // Platform is a shared object, so we query PlatformRegistered events to discover them
      const res = await fetch("https://fullnode.devnet.sui.io:443", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "suix_queryEvents",
          params: [
            { MoveEventType: `${DEVNET_SUBSCRIPTIONS_PACKAGE_ID}::platform_registry::PlatformRegistered` },
            null,
            50,
            true
          ]
        })
      });
      const data = await res.json();
      const events = data.result?.data || [];
      const platformIds = Array.from(new Set(events.map((e: any) => e.parsedJson.platform_id)));

      if (platformIds.length === 0) return [];

      const { objects } = await client.core.getObjects({
        objectIds: platformIds as string[],
        include: { json: true },
      });
      return objects;
    },
  });

  if (isPending) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Loading platforms...
      </div>
    );
  }

  if (!platforms || platforms.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No platforms registered yet.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {platforms.map((obj) => (
        <PlatformCard key={obj.objectId} object={obj} account={account} />
      ))}
    </div>
  );
}

function PlatformCard({ object, account }: { object: any; account: any }) {
  const fields = object.json;

  if (!fields) {
    return (
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">Unable to parse platform</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{fields.name || "Unnamed Platform"}</CardTitle>
            <CardDescription className="mt-1">
              {fields.description || "No description"}
            </CardDescription>
          </div>
          {fields.is_verified && (
            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
              Verified
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.category && (
          <p className="text-sm text-muted-foreground">{fields.category}</p>
        )}

        {fields.tiers && fields.tiers.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Tiers:</p>
            {fields.tiers.map((tier: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span>{tier.name}</span>
                <span>
                  {Number(tier.amount) / 1_000_000_000} SUI /{" "}
                  {FREQUENCY_LABELS[tier.frequency?.variant] || "Unknown"}
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {fields.subscriber_count || 0} subscribers
        </p>

        {account && (
          <CreateSubscription
            accountId={""}
            accountCapId={""}
            platformId={object.objectId}
            tierIndex={0}
            tierName={fields.tiers?.[0]?.name ?? ""}
          />
        )}
      </CardContent>
    </Card>
  );
}