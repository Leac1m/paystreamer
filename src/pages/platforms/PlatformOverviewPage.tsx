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
          <p className="text-muted-foreground mb-4">
            You don't own any platforms yet.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            A platform is your application or business that wants to accept recurring crypto payments. Create one to get started!
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

      <Card className="bg-gradient-to-r from-[#6c63ff]/10 to-[#3b82f6]/10 border-[#6c63ff]/20">
        <CardContent className="py-6">
          <h3 className="text-lg font-semibold text-white mb-4">Getting Started</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[#10b981] flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Register your platform</p>
                <p className="text-xs text-[#94a3b8]">Platform registered</p>
              </div>
            </div>
            <a href="/platforms/tiers" className="flex items-start gap-3 hover:bg-white/5 rounded-lg p-2 -m-2 transition-colors">
              <div className="w-6 h-6 rounded-full border border-[#6c63ff] flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs text-[#6c63ff]">2</span>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Create your first tier</p>
                <p className="text-xs text-[#94a3b8]">Set up pricing</p>
              </div>
            </a>
            <a href="/platforms/scheduler" className="flex items-start gap-3 hover:bg-white/5 rounded-lg p-2 -m-2 transition-colors">
              <div className="w-6 h-6 rounded-full border border-[#6c63ff] flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs text-[#6c63ff]">3</span>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Configure scheduler</p>
                <p className="text-xs text-[#94a3b8]">Set payment timing</p>
              </div>
            </a>
            <a href={`/subscribe/${activePlatform.objectId}`} target="_blank" className="flex items-start gap-3 hover:bg-white/5 rounded-lg p-2 -m-2 transition-colors">
              <div className="w-6 h-6 rounded-full border border-[#6c63ff] flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs text-[#6c63ff]">4</span>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Share your platform</p>
                <p className="text-xs text-[#94a3b8]">Grow subscribers</p>
              </div>
            </a>
          </div>
        </CardContent>
      </Card>

      <PlatformOwnerOverview platform={activePlatform} />
      <RegisterPlatformModal open={registerModalOpen} onClose={() => setRegisterModalOpen(false)} />
    </div>
  );
}