import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentClient } from "@mysten/dapp-kit-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { ChevronDown, ChevronUp, Wallet } from "lucide-react";

interface AccountCardProps {
  accountId: string;
  capId: string;
  denomination: string;
  onManage?: (accountId: string) => void;
}

function formatBalance(balance: number | string, denomination: string): string {
  const raw = typeof balance === "string" ? parseInt(balance) : balance;
  const normalized = raw / 1_000_000_000;
  const symbol = denomination.includes("usdc")
    ? "USDC"
    : denomination.includes("usdsui")
    ? "USDSui"
    : "SUI";
  return `${normalized.toFixed(4)} ${symbol}`;
}

export function AccountCard({ accountId, capId, denomination, onManage }: AccountCardProps) {
  const client = useCurrentClient();
  const [expanded, setExpanded] = useState(false);

  const { data: account, isPending } = useQuery({
    queryKey: ["subscription-account", accountId],
    queryFn: async () => {
      const { object } = await client.core.getObject({
        objectId: accountId,
        include: { json: true },
      });
      return object;
    },
    enabled: !!accountId,
  });

  const fields = account?.json as Record<string, unknown> | undefined;
  const balance = fields?.balance as number | undefined;
  const subscriptions = fields?.subscriptions as Array<{ key: string; value: unknown }> | undefined;
  const status = (fields?.status as { variant?: number })?.variant;

  const symbol = denomination.includes("usdc")
    ? "USDC"
    : denomination.includes("usdsui")
    ? "USDSui"
    : "SUI";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Account</CardTitle>
              <CardDescription className="font-mono text-xs break-all">
                {accountId.slice(0, 8)}...{accountId.slice(-4)}
              </CardDescription>
            </div>
          </div>
          <Badge variant={status === 0 ? "default" : status === 1 ? "secondary" : "destructive"}>
            {status === 0 ? "Active" : status === 1 ? "Paused" : "Closed"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Balance</p>
            <p className="text-2xl font-bold">
              {isPending ? "..." : balance ? formatBalance(balance, denomination) : `0 ${symbol}`}
            </p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>Subscriptions: {subscriptions?.length || 0}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? (
              <>
 Hide Details <ChevronUp className="h-4 w-4 ml-1" />
              </>
            ) : (
              <>
                Manage <ChevronDown className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
          {onManage && (
            <Button variant="secondary" size="sm" onClick={() => onManage(accountId)}>
              View Details
            </Button>
          )}
        </div>

        {expanded && (
          <div className="pt-4 border-t space-y-2">
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account ID:</span>
                <span className="font-mono">{accountId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cap ID:</span>
                <span className="font-mono">{capId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Denomination:</span>
                <span>{symbol}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
