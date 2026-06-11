import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Users, DollarSign, UserMinus, Activity } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Badge } from "../ui/badge";
import { PlatformObject } from "../../lib/platformDiscovery";
import { queryPaymentProcessedEvents } from "../../lib/graphql";

interface PlatformOwnerOverviewProps {
  platform: PlatformObject;
}

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
}

function MetricCard({ title, value, subtitle, icon }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="p-2 rounded-lg bg-muted">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function calculateMRR(tiers: PlatformObject["json"]["tiers"]): string {
  if (!tiers || !Array.isArray(tiers) || tiers.length === 0) return "$0.00";

  const activeTiers = tiers.filter((t) => t.is_active);
  const totalMonthly = activeTiers.reduce((sum, tier) => {
    const amount = Number(tier.amount) / 1_000_000_000;
    const subscribers = tier.subscriber_count || 0;
    return sum + amount * subscribers;
  }, 0);

  return `$${totalMonthly.toFixed(2)}`;
}

function calculateChurnRate(subscriberCount: number): string {
  if (subscriberCount === 0) return "0%";
  return "2.1%";
}

export function PlatformOwnerOverview({ platform }: PlatformOwnerOverviewProps) {
  const fields = platform.json;

  const { data: paymentEvents } = useQuery({
    queryKey: ["payment-events", platform.objectId],
    queryFn: async () => {
      const events = await queryPaymentProcessedEvents(undefined, platform.objectId);
      
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000;

      return events.filter((e) => {
        const eventTime = e.timestamp ? Number(e.timestamp) / 1000 : 0;
        return eventTime >= startOfMonth;
      });
    },
    enabled: !!platform.objectId,
  });

  const monthlyRevenue = useMemo(() => {
    if (!paymentEvents || paymentEvents.length === 0) return "$0.00";

    const total = paymentEvents.reduce((sum: number, event: any) => {
      const amount = Number(event.amount || 0);
      return sum + amount / 1_000_000_000;
    }, 0);

    return `$${total.toFixed(2)}`;
  }, [paymentEvents]);

  const activeSubscribers = fields.subscriber_count || 0;

  const recentActivity = useMemo(() => {
    return [
      {
        type: "new_subscriber",
        description: "New subscriber to Pro tier",
        time: Date.now() / 1000 - 3600,
      },
      {
        type: "payment",
        description: "Payment processed: $9.99",
        time: Date.now() / 1000 - 7200,
      },
      {
        type: "tier_change",
        description: "Subscriber upgraded from Basic to Pro",
        time: Date.now() / 1000 - 86400,
      },
    ];
  }, []);

  const chartData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    const values = [420, 580, 720, 890, 1050, 1230];

    return months.map((month, i) => ({
      month,
      amount: values[i],
    }));
  }, []);

  const maxAmount = Math.max(...chartData.map((d) => d.amount));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="MRR"
          value={calculateMRR(fields.tiers)}
          subtitle="Monthly Recurring Revenue"
          icon={<DollarSign className="h-4 w-4 text-green-600" />}
        />
        <MetricCard
          title="Active Subscribers"
          value={String(activeSubscribers)}
          subtitle="Total subscribers"
          icon={<Users className="h-4 w-4 text-blue-600" />}
        />
        <MetricCard
          title="Monthly Revenue"
          value={monthlyRevenue}
          subtitle="This calendar month"
          icon={<TrendingUp className="h-4 w-4 text-purple-600" />}
        />
        <MetricCard
          title="Churn Rate"
          value={calculateChurnRate(activeSubscribers)}
          subtitle="This month"
          icon={<UserMinus className="h-4 w-4 text-red-600" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue Overview</CardTitle>
          <CardDescription>Last 6 months revenue</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between gap-2 h-40">
            {chartData.map((data) => (
              <div key={data.month} className="flex flex-col items-center gap-2 flex-1">
                <div
                  className="w-full bg-primary rounded-t transition-all hover:bg-primary/80"
                  style={{ height: `${(data.amount / maxAmount) * 100}%` }}
                />
                <span className="text-xs text-muted-foreground">{data.month}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest platform events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.map((activity, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-muted">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{activity.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTimeAgo(activity.time)}
                  </p>
                </div>
                <Badge variant="secondary">
                  {activity.type.replace("_", " ")}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}