import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useCurrentClient, useCurrentAccount } from "@mysten/dapp-kit-react";
import { Button } from "../../components/ui/button";
import { Plus } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { SubscriptionCard } from "../../components/subscriptions/SubscriptionCard";
import { SubscriptionDetail } from "../../components/subscriptions/SubscriptionDetail";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { SubscriptionCardSkeleton } from "../../components/ui/skeleton";
import { NoSubscriptionsEmpty } from "../../components/ui/empty-state";


interface SubscriptionInfo {
  accountId: string;
  capId: string;
  platformId: string;
  platformInitVersion: number;
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

import { queryAccountCreatedEvents, queryPlatformInitialVersions } from "../../lib/graphql";

export function SubscriptionsPage() {
  const navigate = useNavigate();
  const client = useCurrentClient();
  const account = useCurrentAccount();
  const [activeTab, setActiveTab] = useState<string>("all");
  const [expandedSub, setExpandedSub] = useState<SubscriptionInfo | null>(null);

  const { data: accountObjects, isPending } = useQuery({
    queryKey: ["subscription-accounts", account?.address],
    queryFn: async () => {
      if (!account?.address) return [];
      
      const events = await queryAccountCreatedEvents(account.address);
      const capMap = new Map<string, string>();
      events.forEach(e => capMap.set(e.account_id, e.cap_id));
      const accountIds = Array.from(capMap.keys());
      
      if (accountIds.length === 0) return [];
      
      const results = await Promise.all(
        accountIds.map(id => client.core.getObject({
          objectId: id,
          include: { json: true },
        }))
      );
      
      return results.map(r => r.object ? {
        obj: r.object,
        capId: capMap.get(r.object.objectId) || ""
      } : null).filter(Boolean);
    },
    enabled: !!account?.address,
  });

  const subscriptionsRaw: SubscriptionInfo[] = [];

  if (accountObjects) {
    for (const item of accountObjects as any[]) {
      const { obj, capId } = item;
      if (obj instanceof Error) continue;
      const fields = obj.json as Record<string, unknown>;
      const subs = fields?.subscriptions as Record<string, unknown> | undefined;
      if (subs && typeof subs === "object") {
        const contents = Array.isArray((subs as any).contents) 
          ? (subs as any).contents 
          : (Array.isArray(subs) ? subs : Object.entries(subs).map(([k, v]) => ({ key: k, value: v })));
          
        for (const contentItem of contents) {
          const platformId = contentItem.key;
          const sub = contentItem.value?.fields || contentItem.value;
          subscriptionsRaw.push({
            accountId: obj.objectId,
            capId: capId,
            platformId: String(platformId),
            platformInitVersion: 0,
            subscription: sub as SubscriptionInfo["subscription"],
            denomination: fields?.denomination as string || "0x2::sui::SUI",
          });
        }
      }
    }
  }

  const { data: platformVersions } = useQuery({
    queryKey: ["platform-versions", subscriptionsRaw.map((s) => s.platformId).join(",")],
    queryFn: async () => {
      const ids = Array.from(new Set(subscriptionsRaw.map((s) => s.platformId).filter(Boolean)));
      if (ids.length === 0) return new Map<string, number>();
      const infos = await queryPlatformInitialVersions(ids);
      return new Map(infos.map((i) => [i.objectId, i.initialSharedVersion]));
    },
    enabled: subscriptionsRaw.length > 0,
  });

  const subscriptions: SubscriptionInfo[] = platformVersions
    ? subscriptionsRaw.map(sub => ({
        ...sub,
        platformInitVersion: platformVersions.get(sub.platformId) ?? 0,
      }))
    : subscriptionsRaw;

  const filteredSubscriptions = subscriptions.filter((sub) => {
    if (activeTab === "all") return true;
    const symbol = sub.denomination.includes("usdc")
      ? "USDC"
      : sub.denomination.includes("usdsui")
      ? "USDSui"
      : "SUI";
    return symbol === activeTab;
  });



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Subscriptions</h1>
          <p className="text-muted-foreground">Manage your active subscriptions</p>
        </div>
        <Button onClick={() => navigate("/explore")} className="gap-2">
          <Plus className="h-4 w-4" />
          Explore Platforms
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="SUI">SUI</TabsTrigger>
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
                platformInitVersion={sub.platformInitVersion}
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
