import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Transaction } from "@mysten/sui/transactions";
import { useCurrentClient, useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { parseMoveError } from "../../lib/errors";
import { TxStatusToast } from "../TxStatusToast";
import { TxStatus } from "../TxStatusToast";
import { Pause, Play, X, Zap } from "lucide-react";
import {
  DEVNET_V2_PACKAGE_ID,
  DEVNET_PAYMENT_SCHEDULER_ID,
  DEVNET_PAYMENT_SCHEDULER_INIT_VERSION,
  CLOCK_OBJECT_ID,
  SUI_TYPE_ARG,
} from "../../constants";

interface SubscriptionCardProps {
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
 onExpand?: () => void;
}

function formatAmount(amount: string | number, denomination: string): string {
  const raw = typeof amount === "string" ? parseInt(amount) : amount;
  const safeRaw = Number.isNaN(raw) || !raw ? 0 : raw;
  const normalized = safeRaw / 1_000_000_000;
  const symbol = denomination.includes("usdc")
    ? "USDC"
    : denomination.includes("usdsui")
    ? "USDSui"
    : "SUI";
  return `${normalized.toFixed(4)} ${symbol}`;
}

function getFrequencyLabel(ms: string | number): string {
  const raw = typeof ms === "string" ? parseInt(ms) : ms;
  const safeRaw = Number.isNaN(raw) || !raw ? 0 : raw;
  if (safeRaw === 0) return "Unknown";
  if (safeRaw === 86400000) return "Daily";
  if (safeRaw === 604800000) return "Weekly";
  if (safeRaw === 2592000000) return "Monthly";
  if (safeRaw === 31536000000) return "Yearly";
  if (safeRaw < 3600000) return `${Math.round(safeRaw / 60000)} mins`;
  if (safeRaw < 86400000) return `${Math.round(safeRaw / 3600000)} hours`;
  return `${Math.round(safeRaw / 86400000)} days`;
}

export function SubscriptionCard({
  accountId,
  capId,
  platformId,
  platformInitVersion,
  subscription,
  denomination,
  onExpand,
}: SubscriptionCardProps) {
  const client = useCurrentClient();
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();

  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txMessage, setTxMessage] = useState("");
  const [txDigest, setTxDigest] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const { data: platform } = useQuery({
    queryKey: ["platform", platformId],
    queryFn: async () => {
      const { object } = await client.core.getObject({
        objectId: platformId,
        include: { json: true },
      });
      return object;
    },
    enabled: !!platformId,
  });

  const platformFields = platform?.json as Record<string, unknown> | undefined;
  const platformName = String(platformFields?.name ?? "Unknown Platform");

  const statusRaw = subscription?.status as any;
  const statusVariant = typeof statusRaw === 'number' 
    ? statusRaw 
    : (statusRaw?.variant ?? 0);

  const statusType =
    statusVariant === 0
      ? "default"
      : statusVariant === 1
      ? "secondary"
      : "destructive";

  const statusLabel =
    statusVariant === 0
      ? "Active"
      : statusVariant === 1
      ? "Paused"
      : "Cancelled";

  const nextBillingRaw = (subscription as any).next_billing_ts ?? (subscription as any).next_billing_time;
  const nextBillingMs = nextBillingRaw != null ? Number(nextBillingRaw) : null;
  const isDue = statusVariant === 0 && nextBillingMs != null && nextBillingMs <= Date.now();
  const isSui = denomination === SUI_TYPE_ARG;

  async function pauseSubscription() {
    if (!account) return;
    setIsPending(true);
    setError(null);
    setTxStatus("pending");
    setTxMessage("Pausing subscription...");

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${DEVNET_V2_PACKAGE_ID}::billing::pause_subscription`,
        typeArguments: [denomination],
        arguments: [
          tx.object(capId),
          tx.object(accountId),
          tx.pure.id(platformId),
          tx.object(CLOCK_OBJECT_ID),
        ],
      });

      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result.$kind === "FailedTransaction") {
        throw new Error(result.FailedTransaction.status.error?.message ?? "Transaction failed");
      }

      setTxStatus("success");
      setTxMessage("Subscription paused");
      setTxDigest(result.Transaction.digest);
      await client.core.waitForTransaction({ digest: result.Transaction.digest });
      await queryClient.invalidateQueries({ queryKey: ["subscription-account", accountId] });
    } catch (err) {
      setTxStatus("error");
      setTxMessage("Failed to pause");
      setError(parseMoveError(err));
    } finally {
      setIsPending(false);
    }
  }

  async function resumeSubscription() {
    if (!account) return;
    setIsPending(true);
    setError(null);
    setTxStatus("pending");
    setTxMessage("Resuming subscription...");

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${DEVNET_V2_PACKAGE_ID}::billing::resume_subscription`,
        typeArguments: [denomination],
        arguments: [
          tx.object(capId),
          tx.object(accountId),
          tx.pure.id(platformId),
          tx.object(CLOCK_OBJECT_ID),
        ],
      });

      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result.$kind === "FailedTransaction") {
        throw new Error(result.FailedTransaction.status.error?.message ?? "Transaction failed");
      }

      setTxStatus("success");
      setTxMessage("Subscription resumed");
      setTxDigest(result.Transaction.digest);
      await client.core.waitForTransaction({ digest: result.Transaction.digest });
      await queryClient.invalidateQueries({ queryKey: ["subscription-account", accountId] });
    } catch (err) {
      setTxStatus("error");
      setTxMessage("Failed to resume");
      setError(parseMoveError(err));
    } finally {
      setIsPending(false);
    }
  }

  async function cancelSubscription() {
    if (!account) return;
    setIsPending(true);
    setError(null);
    setTxStatus("pending");
    setTxMessage("Cancelling subscription...");

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${DEVNET_V2_PACKAGE_ID}::billing::cancel_subscription`,
        typeArguments: [denomination],
        arguments: [
          tx.object(capId),
          tx.object(accountId),
          tx.pure.id(platformId),
          tx.object(CLOCK_OBJECT_ID),
        ],
      });

      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result.$kind === "FailedTransaction") {
        throw new Error(result.FailedTransaction.status.error?.message ?? "Transaction failed");
      }

      setTxStatus("success");
      setTxMessage("Subscription cancelled");
      setTxDigest(result.Transaction.digest);
      await client.core.waitForTransaction({ digest: result.Transaction.digest });
      await queryClient.invalidateQueries({ queryKey: ["subscription-account", accountId] });
    } catch (err) {
      setTxStatus("error");
      setTxMessage("Failed to cancel");
      setError(parseMoveError(err));
    } finally {
      setIsPending(false);
    }
  }

  async function processPayment() {
    if (!account) return;
    if (!platformInitVersion) {
      setTxStatus("error");
      setTxMessage("Platform version unavailable");
      setError("Could not load the platform's shared-object version. Please refresh and try again.");
      return;
    }
    setIsPending(true);
    setError(null);
    setTxStatus("pending");
    setTxMessage("Processing payment...");

    try {
      const tx = new Transaction();
      const limiters = tx.moveCall({
        target: `${DEVNET_V2_PACKAGE_ID}::policies::empty_limiters`,
        arguments: [tx.object(CLOCK_OBJECT_ID)],
      });
      tx.moveCall({
        target: `${DEVNET_V2_PACKAGE_ID}::policies::ensure_initialized`,
        typeArguments: [denomination],
        arguments: [tx.object(accountId), limiters, tx.object(CLOCK_OBJECT_ID)],
      });
      tx.moveCall({
        target: `${DEVNET_V2_PACKAGE_ID}::scheduler::process_due_payment`,
        typeArguments: [denomination],
        arguments: [
          tx.sharedObjectRef({
            objectId: DEVNET_PAYMENT_SCHEDULER_ID,
            initialSharedVersion: DEVNET_PAYMENT_SCHEDULER_INIT_VERSION,
            mutable: true,
          }),
          tx.sharedObjectRef({
            objectId: platformId,
            initialSharedVersion: platformInitVersion,
            mutable: true,
          }),
          tx.object(accountId),
          limiters,
          tx.object(CLOCK_OBJECT_ID),
        ],
      });

      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result.$kind === "FailedTransaction") {
        throw new Error(result.FailedTransaction.status.error?.message ?? "Transaction failed");
      }

      setTxStatus("success");
      setTxMessage("Payment processed");
      setTxDigest(result.Transaction.digest);
      await client.core.waitForTransaction({ digest: result.Transaction.digest });
      await queryClient.invalidateQueries({ queryKey: ["subscription-account", accountId] });
      await queryClient.invalidateQueries({ queryKey: ["subscription-accounts", account.address] });
    } catch (err) {
      setTxStatus("error");
      setTxMessage("Failed to process payment");
      setError(parseMoveError(err));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <Card className="cursor-pointer" onClick={onExpand}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">{platformName}</CardTitle>
              <CardDescription>{subscription.tier_name}</CardDescription>
            </div>
            <Badge variant={statusType}>{statusLabel}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Amount</p>
              <p className="text-lg font-semibold">
                {formatAmount((subscription as any).amount || (subscription as any).tier_amount, denomination)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Frequency</p>
              <p className="text-lg font-semibold">
                {getFrequencyLabel((subscription as any).frequency_ms || (subscription as any).tier_frequency_ms || (subscription as any).schedule_frequency_ms)}
              </p>
            </div>
          </div>

          {((subscription as any).next_billing_ts || (subscription as any).next_billing_time) && statusVariant === 0 && (
            <div>
              <p className="text-sm text-muted-foreground">Next billing</p>
              <p className="text-sm">
                {new Date(Number((subscription as any).next_billing_ts || (subscription as any).next_billing_time)).toLocaleDateString()}
              </p>
            </div>
          )}

          {error && (
            <div className="p-2 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
              {error}
            </div>
          )}

{statusVariant !== 2 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {statusVariant === 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    pauseSubscription();
                  }}
                  disabled={isPending}
                  loading={isPending}
                >
                  <Pause className="h-4 w-4 mr-1" />
                  Pause Billing
                </Button>
              ) : statusVariant === 1 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    resumeSubscription();
                  }}
                  disabled={isPending}
                  loading={isPending}
                >
                  <Play className="h-4 w-4 mr-1" />
                  Resume Billing
                </Button>
              ) : null}
              <Button
                variant="default"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  processPayment();
                }}
                disabled={isPending || !isDue || !isSui || !platformInitVersion}
                loading={isPending}
                title={
                  !isSui
                    ? "Demo only supports SUI denominations."
                    : !isDue
                    ? "This subscription isn't due yet."
                    : undefined
                }
              >
                <Zap className="h-4 w-4 mr-1" />
                Process Now
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  cancelSubscription();
                }}
                disabled={isPending}
                loading={isPending}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel Subscription
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <TxStatusToast
        status={txStatus}
        message={txMessage}
        digest={txDigest}
        onClose={() => setTxStatus("idle")}
      />
    </>
  );
}
