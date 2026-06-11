import { useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { Plus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { PlatformOwnerOverview } from "../../components/platform/PlatformOwnerOverview";
import { RegisterPlatformModal } from "../../components/platform/RegisterPlatformModal";
import { useOwnedPlatforms } from "../../lib/platformDiscovery";

export function PlatformOverviewPage() {
  const account = useCurrentAccount();
  const { data: platforms, isPending } = useOwnedPlatforms(account?.address ?? null);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);

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
          <Button onClick={() => setRegisterModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Register Your First Platform
          </Button>
          <RegisterPlatformModal open={registerModalOpen} onClose={() => setRegisterModalOpen(false)} />
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
        <Button onClick={() => setRegisterModalOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Register Platform
        </Button>
      </div>

      <PlatformOwnerOverview platform={activePlatform} />
      <RegisterPlatformModal open={registerModalOpen} onClose={() => setRegisterModalOpen(false)} />
    </div>
  );
}