import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { PlatformOwnerOverview } from "../../components/platform/PlatformOwnerOverview";
import { useOwnedPlatforms } from "../../lib/platformDiscovery";

export function PlatformOverviewPage() {
  const account = useCurrentAccount();
  const navigate = useNavigate();
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
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground mb-6">
            You don't own any platforms yet.
          </p>
          <Button onClick={() => navigate("/platforms/tiers")}>
            <Plus className="h-4 w-4 mr-1" />
            Register Your First Platform
          </Button>
        </CardContent>
      </Card>
    );
  }

  const activePlatform = platforms[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{activePlatform.json.name}</h1>
          <p className="text-muted-foreground text-sm">
            Platform Overview
          </p>
        </div>
      </div>

      <PlatformOwnerOverview platform={activePlatform} />
    </div>
  );
}