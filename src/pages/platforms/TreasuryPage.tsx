import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { useOwnedPlatforms } from "../../lib/platformDiscovery";
import { TreasuryManager } from "../../components/platform/TreasuryManager";

export function TreasuryPage() {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Treasury</h1>
        <p className="text-muted-foreground text-sm">
          Manage treasury settings for {platform.json.name}
        </p>
      </div>

      <TreasuryManager
        platformId={platform.objectId}
        currentTreasury={platform.json.treasury}
        pendingTreasury={platform.json.pending_treasury}
        pendingTreasuryChangeTime={platform.json.pending_treasury_change_time}
      />
    </div>
  );
}