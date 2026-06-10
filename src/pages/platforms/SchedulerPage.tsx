import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { useOwnedPlatforms } from "../../lib/platformDiscovery";
import { SchedulerControls } from "../../components/platform/SchedulerControls";

export function SchedulerPage() {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scheduler Controls</h1>
        <p className="text-muted-foreground text-sm">
          Global payment scheduler management
        </p>
      </div>

      <SchedulerControls isPaused={false} lastProcessedAt={Math.floor(Date.now() / 1000) - 3600} />
    </div>
  );
}