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
import { DEVNET_V2_PACKAGE_ID } from "../../constants";

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
  const normalized = raw / 1_000_000_000;
  const symbol = denomination.includes("usdc")
    ? "USDC"
    : denomination.includes("usdsui")
    ? "USDSui"
    : "SUI";
  return `${normalized.toFixed(4)} ${symbol}`;
}

function getFrequencyLabel(ms: string | number): string {
  const raw = typeof ms === "string" ? parseInt(ms) : ms;
  if (raw === 86400000) return "Daily";
  if (raw === 604800000) return "Weekly";
  if (raw === 2592000000) return "Monthly";
  if (raw === 31536000000) return "Yearly";
  if (raw < 86400000) return `${Math.round(raw / 86400000)} days`;
  return `${Math.round(raw / 86400000)} days`;
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
      const res = await fetch("https://fullnode.devnet.sui.io:443", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "suix_queryEvents",
          params: [
            {
              MoveEventType: `${DEVNET_V2_PACKAGE_ID}::payment::PaymentProcessed`,
              sender: account.address,
            },
            null,
            50,
            true,
          ],
        }),
      });
      const data = await res.json();
      return (data.result?.data || []).filter((e: any) => {
        const parsed = e.parsedJson;
        return parsed?.account_id === accountId && parsed?.platform_id === platformId;
      });
    },
    enabled: !!account?.address,
  });

  const platformFields = platform?.json as Record<string, unknown> | undefined;
  const platformName = String(platformFields?.name ?? "Unknown Platform");
  const platformDescription = String(platformFields?.description ?? "No description");

  const statusVariant =
    subscription.status.variant === 0
      ? "default"
      : subscription.status.variant === 1
      ? "secondary"
      : "destructive";

  const statusLabel =
    subscription.status.variant === 0
      ? "Active"
      : subscription.status.variant === 1
      ? "Paused"
      : "Cancelled";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle>{platformName}</CardTitle>
              <Badge variant={statusVariant}>{statusLabel}</Badge>
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
                {formatAmount(subscription.amount, denomination)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Frequency</p>
              <p className="font-medium">
                {getFrequencyLabel(subscription.frequency_ms)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Next Billing</p>
              <p className="font-medium">
                {subscription.next_billing_ts
                  ? new Date(Number(subscription.next_billing_ts)).toLocaleDateString()
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
                        {formatAmount(event.parsedJson.amount, denomination)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(event.timestamp / 1_000_000).toLocaleString()}
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
