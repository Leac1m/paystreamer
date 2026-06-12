import { useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { Plus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { TierCard } from "../../components/platform/TierCard";
import { TierModal } from "../../components/platform/TierModal";
import { useOwnedPlatforms } from "../../lib/platformDiscovery";

export function TiersPage() {
  const account = useCurrentAccount();
  const { data: platforms, isPending } = useOwnedPlatforms(account?.address ?? null);
  const [addModalOpen, setAddModalOpen] = useState(false);

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
            You need to own a platform to manage tiers.
          </p>
        </CardContent>
      </Card>
    );
  }

  const platform = platforms[0];
  const tiers = Array.isArray(platform.json.tiers) ? platform.json.tiers : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Subscription Tiers</h1>
          <p className="text-muted-foreground text-sm">
            Manage pricing tiers for {platform.json.name}
          </p>
        </div>
        <Button onClick={() => setAddModalOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Tier
        </Button>
      </div>

      {tiers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No tiers created yet.</p>
            <p className="text-sm text-muted-foreground mb-4">Create your first tier to start monetizing. Example: $9.99/month Basic tier</p>
            <Button onClick={() => setAddModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Your First Tier
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tiers.map((tier, index) => (
            <TierCard
              key={`${tier.name}-${index}`}
              platformId={platform.objectId}
              initialSharedVersion={platform.initialSharedVersion}
              tier={tier}
              tierIndex={index}
            />
          ))}
        </div>
      )}

      <TierModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        platformId={platform.objectId}
        initialSharedVersion={platform.initialSharedVersion}
      />
    </div>
  );
}