import { useQuery } from "@tanstack/react-query";
import { useCurrentClient } from "@mysten/dapp-kit-react";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useState } from "react";

interface SubscriptionDetailProps {
  accountId: string;
  capId: string;
  platformId: string;
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
  return `${Math.round(safeRaw / 86400000)} days`;
}

export function SubscriptionDetail({
  accountId,
  platformId,
  subscription,
  denomination,
}: SubscriptionDetailProps) {
  const client = useCurrentClient();
  const account = useCurrentAccount();
  const [expanded, setExpanded] = useState(true);

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

  const { data: paymentEvents } = useQuery({
    queryKey: ["payment-events", accountId, platformId],
    queryFn: async () => {
      if (!account?.address) return [];
      const { queryPaymentProcessedEvents } = await import("../../lib/graphql");
      const events = await queryPaymentProcessedEvents(accountId, platformId);
      return events;
    },
    enabled: !!account?.address,
  });

  const platformFields = platform?.json as Record<string, unknown> | undefined;
  const platformName = String(platformFields?.name ?? "Unknown Platform");
  const platformDescription = String(platformFields?.description ?? "No description");

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

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle>{platformName}</CardTitle>
              <Badge variant={statusType}>{statusLabel}</Badge>
            </div>
            <CardDescription>{platformDescription}</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Tier</p>
              <p className="font-medium">{subscription.tier_name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Amount</p>
              <p className="font-medium">
                {formatAmount((subscription as any).amount || (subscription as any).tier_amount, denomination)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Frequency</p>
              <p className="font-medium">
                {getFrequencyLabel((subscription as any).frequency_ms || (subscription as any).tier_frequency_ms || (subscription as any).schedule_frequency_ms)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Next Billing</p>
              <p className="font-medium">
                {((subscription as any).next_billing_ts || (subscription as any).next_billing_time)
                  ? new Date(Number((subscription as any).next_billing_ts || (subscription as any).next_billing_time)).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Paid</p>
              <p className="font-medium">
                {subscription.total_paid
                  ? formatAmount(subscription.total_paid, denomination)
                  : `0 ${denomination.includes("usdc") ? "USDC" : denomination.includes("usdsui") ? "USDSui" : "SUI"}`}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Payment Count</p>
              <p className="font-medium">{subscription.payment_count || 0}</p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">Payment History</p>
              <a
                href={`https://suivision.xyz/account/${accountId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                View on Explorer
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            {paymentEvents && paymentEvents.length > 0 ? (
              <div className="space-y-2">
                {paymentEvents.slice(0, 10).map((event: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                    <div>
                      <p className="font-medium">
                        {formatAmount(event.amount, denomination)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(Number(event.timestamp)).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="default">Paid</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No payment history yet</p>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
