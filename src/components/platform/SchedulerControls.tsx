import { useState } from "react";
import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import { Pause, Play, AlertTriangle, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { V2_PACKAGE_ID, V2_PAYMENT_SCHEDULER_ID } from "../../constants";
import { getErrorMessage } from "../../lib/errors";

interface SchedulerControlsProps {
  isPaused: boolean;
  initialSharedVersion: number;
  lastProcessedAtMs?: number;
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function formatRelativeTimestamp(ms?: number): string {
  if (!ms || ms <= 0) return "Never";
  const diffSeconds = Math.round((ms - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);
  if (abs < 60) return rtf.format(diffSeconds, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSeconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSeconds / 3600), "hour");
  return rtf.format(Math.round(diffSeconds / 86400), "day");
}

export function SchedulerControls({ isPaused, initialSharedVersion, lastProcessedAtMs }: SchedulerControlsProps) {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pauseScheduler() {
    if (!account) return;

    setIsPending(true);
    setError(null);

    const tx = new Transaction();
    tx.moveCall({
      target: `${V2_PACKAGE_ID}::scheduler::pause`,
      arguments: [
        tx.sharedObjectRef({
          objectId: V2_PAYMENT_SCHEDULER_ID,
          initialSharedVersion,
          mutable: true,
        }),
      ],
    });

    try {
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result.$kind === "FailedTransaction") {
        throw new Error(
          result.FailedTransaction.status.error?.message ?? "Transaction failed"
        );
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsPending(false);
    }
  }

  async function resumeScheduler() {
    if (!account) return;

    setIsPending(true);
    setError(null);

    const tx = new Transaction();
    tx.moveCall({
      target: `${V2_PACKAGE_ID}::scheduler::unpause`,
      arguments: [
        tx.sharedObjectRef({
          objectId: V2_PAYMENT_SCHEDULER_ID,
          initialSharedVersion,
          mutable: true,
        }),
      ],
    });

    try {
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result.$kind === "FailedTransaction") {
        throw new Error(
          result.FailedTransaction.status.error?.message ?? "Transaction failed"
        );
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Scheduler</CardTitle>
        <CardDescription>
          Control global payment processing across all platforms
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`h-3 w-3 rounded-full ${isPaused ? "bg-amber-500" : "bg-green-500"}`}
            />
            <span className="font-medium">
              Status: {isPaused ? "Paused" : "Active"}
            </span>
          </div>
          <Badge variant={isPaused ? "secondary" : "default"}>
            {isPaused ? (
              <Pause className="h-3 w-3 mr-1" />
            ) : (
              <Play className="h-3 w-3 mr-1" />
            )}
            {isPaused ? "Paused" : "Active"}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Last processed: {formatRelativeTimestamp(lastProcessedAtMs)}</span>
        </div>

        {isPaused && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-sm font-medium">Payments are currently paused</p>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          {isPaused ? (
            <Button onClick={resumeScheduler} disabled={!account || isPending} loading={isPending}>
              <Play className="h-4 w-4 mr-1" />
              Resume Payments
            </Button>
          ) : (
            <Button variant="outline" onClick={pauseScheduler} disabled={!account || isPending} loading={isPending}>
              <Pause className="h-4 w-4 mr-1" />
              Pause All Payments
            </Button>
          )}
        </div>

        <div className="rounded-lg bg-muted p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600" />
            <p className="text-sm text-muted-foreground">
              Pausing stops ALL payments across ALL platforms. Use this for emergency situations only.
            </p>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}