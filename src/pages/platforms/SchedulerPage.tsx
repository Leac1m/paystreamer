import { useQuery } from "@tanstack/react-query";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { useOwnedPlatforms } from "../../lib/platformDiscovery";
import { queryPaymentScheduler } from "../../lib/graphql";
import { SchedulerControls } from "../../components/platform/SchedulerControls";
import { V2_PAYMENT_SCHEDULER_ID } from "../../constants";

export function SchedulerPage() {
  const account = useCurrentAccount();
  const { data: platforms, isPending: platformsPending } = useOwnedPlatforms(account?.address ?? null);

  const { data: scheduler, isPending: schedulerPending } = useQuery({
    queryKey: ["scheduler", V2_PAYMENT_SCHEDULER_ID],
    queryFn: () => queryPaymentScheduler(V2_PAYMENT_SCHEDULER_ID),
  });

  if (platformsPending || schedulerPending) {
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

  if (!scheduler) {
    return (
      <div className="text-center py-12 text-red-500">
        Failed to load scheduler.
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

      <SchedulerControls 
        isPaused={scheduler.is_paused} 
        initialSharedVersion={scheduler.initialSharedVersion}
        lastProcessedAt={Math.floor(Date.now() / 1000) - 3600} 
      />
    </div>
  );
}