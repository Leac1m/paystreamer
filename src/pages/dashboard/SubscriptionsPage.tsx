import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentClient, useCurrentAccount } from "@mysten/dapp-kit-react";
import { Card, CardContent } from "../../components/ui/card";
import { SubscriptionCard } from "../../components/subscriptions/SubscriptionCard";
import { SubscriptionDetail } from "../../components/subscriptions/SubscriptionDetail";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { SubscriptionCardSkeleton } from "../../components/ui/skeleton";
import { NoSubscriptionsEmpty } from "../../components/ui/empty-state";
import { DEVNET_V2_PACKAGE_ID } from "../../constants";

interface SubscriptionInfo {
  accountId: string;
  capId: string;
  platformId: string;
  subscription: {
    tier_index: number;
    tier_name: string;
    amount: string | number;
    frequency_ms: string | number;
    status: { variant: number };
    next_billing_ts?: string | number;
    total_paid?: string | number;
    payment_count?: number;
  };
  denomination: string;
}

export function SubscriptionsPage() {
  const client = useCurrentClient();
  const account = useCurrentAccount();
  const [activeTab, setActiveTab] = useState<string>("all");
  const [expandedSub, setExpandedSub] = useState<SubscriptionInfo | null>(null);

  const { data: accountObjects, isPending } = useQuery({
    queryKey: ["subscription-accounts", account?.address],
    queryFn: async () => {
      if (!account?.address) return [];
      const { objects } = await client.core.listOwnedObjects({
        owner: account.address,
        type: `${DEVNET_V2_PACKAGE_ID}::account::SubscriptionAccount`,
        limit: 10,
        include: { json: true },
      });
      return objects;
    },
    enabled: !!account?.address,
  });

  const subscriptions: SubscriptionInfo[] = [];

  if (accountObjects) {
    for (const obj of accountObjects) {
      if (obj instanceof Error) continue;
      const fields = obj.json as Record<string, unknown>;
      const subs = fields?.subscriptions as Record<string, unknown> | undefined;
      if (subs && typeof subs === "object") {
        const contents = (subs as any).contents || Object.entries(subs);
        for (const [platformId, sub] of Object.entries(contents as Record<string, unknown>)) {
          subscriptions.push({
            accountId: obj.objectId,
            capId: fields?.cap_id as string || "",
            platformId: typeof platformId === "string" ? platformId : "",
            subscription: sub as SubscriptionInfo["subscription"],
            denomination: fields?.denomination as string || "0x2::sui::SUI",
          });
        }
      }
    }
  }

  const filteredSubscriptions = subscriptions.filter((sub) => {
    if (activeTab === "all") return true;
    const symbol = sub.denomination.includes("usdc")
      ? "USDC"
      : sub.denomination.includes("usdsui")
      ? "USDSui"
      : "SUI";
    return symbol === activeTab;
  });

  if (!account) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Connect your wallet to view subscriptions</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscriptions</h1>
        <p className="text-muted-foreground">Manage your active subscriptions</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="SUI">SUI</TabsTrigger>
          <TabsTrigger value="USDC">USDC</TabsTrigger>
          <TabsTrigger value="USDSui">USDSui</TabsTrigger>
        </TabsList>
      </Tabs>

      {isPending ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SubscriptionCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredSubscriptions.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <NoSubscriptionsEmpty />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredSubscriptions.map((sub) => (
            <div key={`${sub.accountId}-${sub.platformId}`}>
              <SubscriptionCard
                accountId={sub.accountId}
                capId={sub.capId}
                platformId={sub.platformId}
                subscription={sub.subscription}
                denomination={sub.denomination}
                onExpand={() =>
                  setExpandedSub(expandedSub?.platformId === sub.platformId ? null : sub)
                }
              />
              {expandedSub?.platformId === sub.platformId && (
                <div className="mt-4">
                  <SubscriptionDetail
                    accountId={sub.accountId}
                    capId={sub.capId}
                    platformId={sub.platformId}
                    subscription={sub.subscription}
                    denomination={sub.denomination}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
