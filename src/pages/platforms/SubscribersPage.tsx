import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { useOwnedPlatforms } from "../../lib/platformDiscovery";
import { SubscriberTable } from "../../components/platform/SubscriberTable";

export function SubscribersPage() {
  const account = useCurrentAccount();
  const { data: platforms, isPending } = useOwnedPlatforms(account?.address ?? null);

  if (isPending) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!platforms || platforms.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>You don't own any platforms.</p>
      </div>
    );
  }

  const platform = platforms[0];
  const subscribers = (platform.json.tiers || []).flatMap((tier: any) =>
    Array.from({ length: tier.subscriber_count || 0 }, () => ({
      wallet: `0x${Math.random().toString(16).slice(2, 66).padStart(64, "0")}`,
      tier: tier.name,
      status: "active" as const,
      since: Date.now() / 1000 - Math.random() * 86400 * 30,
      totalPaid: String(Math.floor(Math.random() * 100) * 1_000_000_000),
      paymentHistory: [
        { date: "2024-01-15", amount: tier.amount, status: "success" },
        { date: "2024-02-15", amount: tier.amount, status: "success" },
      ],
    }))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscribers</h1>
        <p className="text-muted-foreground text-sm">
          Manage subscribers for {platform.json.name}
        </p>
      </div>

      <SubscriberTable platformId={platform.objectId} subscribers={subscribers} />
    </div>
  );
}