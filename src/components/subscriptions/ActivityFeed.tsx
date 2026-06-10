import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { DEVNET_V2_PACKAGE_ID } from "../../constants";
import {
  CheckCircle,
  XCircle,
  ArrowDownCircle,
  Download,
  AlertTriangle,
} from "lucide-react";

type FilterTab = "all" | "payments" | "deposits" | "alerts";

interface EventRow {
  type: "payment" | "deposit" | "alert";
  timestamp: number;
  description: string;
  amount: number;
  status: "success" | "failed";
  reason?: string;
  digest: string;
}

function formatAmount(amount: number, denomination: string): string {
  const normalized = amount / 1_000_000_000;
  const symbol = denomination.includes("usdc")
    ? "USDC"
    : denomination.includes("usdsui")
    ? "USDSui"
    : "SUI";
  return `${normalized.toFixed(4)} ${symbol}`;
}

export function ActivityFeed() {
  const account = useCurrentAccount();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data: events, isPending } = useQuery({
    queryKey: ["activity-events", account?.address],
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
            100,
            true,
          ],
        }),
      });
      const data = await res.json();
      return data.result?.data || [];
    },
    enabled: !!account?.address,
  });

  const { data: depositEvents } = useQuery({
    queryKey: ["deposit-events", account?.address],
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
              MoveEventType: `${DEVNET_V2_PACKAGE_ID}::account::Deposit`,
              sender: account.address,
            },
            null,
            100,
            true,
          ],
        }),
      });
      const data = await res.json();
      return data.result?.data || [];
    },
    enabled: !!account?.address,
  });

  const { data: failedEvents } = useQuery({
    queryKey: ["failed-events", account?.address],
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
              MoveEventType: `${DEVNET_V2_PACKAGE_ID}::payment::PaymentFailed`,
              sender: account.address,
            },
            null,
            100,
            true,
          ],
        }),
      });
      const data = await res.json();
      return data.result?.data || [];
    },
    enabled: !!account?.address,
  });

  const allRows: EventRow[] = [
    ...(events || []).map((e: any) => ({
      type: "payment" as const,
      timestamp: e.timestamp,
      description: `Payment to ${e.parsedJson.platform_id?.slice(0, 8)}...`,
      amount: Number(e.parsedJson.amount),
      status: "success" as const,
      digest: e.txDigest,
    })),
    ...(depositEvents || []).map((e: any) => ({
      type: "deposit" as const,
      timestamp: e.timestamp,
      description: "Account deposit",
      amount: Number(e.parsedJson.amount),
      status: "success" as const,
      digest: e.txDigest,
    })),
    ...(failedEvents || []).map((e: any) => ({
      type: "alert" as const,
      timestamp: e.timestamp,
      description: `Payment failed to ${e.parsedJson.platform_id?.slice(0, 8)}...`,
      amount: Number(e.parsedJson.amount),
      status: "failed" as const,
      reason: e.parsedJson.reason,
      digest: e.txDigest,
    })),
  ]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 100);

  const filteredRows = allRows.filter((row) => {
    if (activeTab === "all") return true;
    if (activeTab === "payments") return row.type === "payment";
    if (activeTab === "deposits") return row.type === "deposit";
    if (activeTab === "alerts") return row.type === "alert";
    return true;
  });

  function exportCSV() {
    const headers = ["Timestamp", "Type", "Description", "Amount", "Status", "Digest"];
    const rows = filteredRows.map((r) => [
      new Date(r.timestamp / 1_000_000).toISOString(),
      r.type,
      r.description,
      r.amount.toString(),
      r.status,
      r.digest,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleExpand(digest: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(digest)) {
        next.delete(digest);
      } else {
        next.add(digest);
      }
      return next;
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <CardTitle>Activity</CardTitle>
          <div className="flex items-center gap-2">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="payments">Payments</TabsTrigger>
                <TabsTrigger value="deposits">Deposits</TabsTrigger>
                <TabsTrigger value="alerts">Alerts</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : filteredRows.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No activity yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground sticky left-0 bg-card">
                    Timestamp
                  </th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Type</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Description</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">Amount</th>
                  <th className="text-center py-3 px-2 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.digest} className="border-b">
                    <td className="py-3 px-2 font-mono text-xs sticky left-0 bg-card">
                      {new Date(row.timestamp / 1_000_000).toLocaleString()}
                    </td>
                    <td className="py-3 px-2">
                      {row.type === "payment" && (
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          Payment
                        </span>
                      )}
                      {row.type === "deposit" && (
                        <span className="inline-flex items-center gap-1 text-blue-600">
                          <ArrowDownCircle className="h-4 w-4" />
                          Deposit
                        </span>
                      )}
                      {row.type === "alert" && (
                        <span className="inline-flex items-center gap-1 text-red-600">
                          <XCircle className="h-4 w-4" />
                          Alert
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <button
                        onClick={() => toggleExpand(row.digest)}
                        className="hover:underline text-left"
                      >
                        {row.description}
                      </button>
                      {expandedRows.has(row.digest) && row.reason && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {row.reason}
                        </p>
                      )}
                    </td>
                    <td className={`py-3 px-2 text-right font-mono ${row.type === "deposit" ? "text-blue-600" : "text-foreground"}`}>
                      {row.type === "deposit" ? "+" : "-"}
                      {formatAmount(row.amount, "SUI")}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <Badge variant={row.status === "success" ? "default" : "destructive"}>
                        {row.status === "success" ? "Success" : "Failed"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
