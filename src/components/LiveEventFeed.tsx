import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity,
  CheckCircle,
  UserPlus,
  CreditCard,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import {
  queryRecentEventsByType,
} from "../lib/graphql";
import { SUBSCRIPTION_DEVNET_PACKAGE_ID } from "../constants";
import { formatTimeAgo, cn } from "../lib/utils";

const EVENT_TYPES = {
  PlatformRegistered: `${SUBSCRIPTION_DEVNET_PACKAGE_ID}::platform::PlatformRegistered`,
  PaymentProcessed: `${SUBSCRIPTION_DEVNET_PACKAGE_ID}::payment::PaymentProcessed`,
  SubscriptionCreated: `${SUBSCRIPTION_DEVNET_PACKAGE_ID}::billing::SubscriptionCreated`,
} as const;

type EventTab = keyof typeof EVENT_TYPES;

const TAB_LABELS: Record<EventTab, string> = {
  PlatformRegistered: "Platforms",
  PaymentProcessed: "Payments",
  SubscriptionCreated: "Subscriptions",
};

const REFETCH_INTERVAL_MS = 15000;
const MAX_EVENTS_PER_TAB = 8;

interface FeedEvent {
  id: string;
  transactionDigest: string;
  timestamp: number;
  json: Record<string, unknown>;
}

function truncate(value: string | undefined, head: number = 6, tail: number = 4): string {
  if (!value) return "—";
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function renderEventSummary(tab: EventTab, json: Record<string, unknown>): {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
} {
  if (tab === "PlatformRegistered") {
    const name = (json.name as string) || "Unnamed Platform";
    const category = (json.category as string) || "General";
    return {
      title: `${name} registered`,
      subtitle: category,
      icon: <UserPlus className="h-4 w-4 text-[#10b981]" />,
    };
  }

  if (tab === "PaymentProcessed") {
    const amountRaw = json.amount as string | undefined;
    const amountSui = amountRaw ? Number(amountRaw) / 1_000_000_000 : 0;
    const platformId = json.platform_id as string | undefined;
    return {
      title: `Payment of ${amountSui.toFixed(4)} SUI processed`,
      subtitle: `Platform ${truncate(platformId)}`,
      icon: <CheckCircle className="h-4 w-4 text-[#10b981]" />,
    };
  }

  // SubscriptionCreated
  const amountRaw = json.amount as string | undefined;
  const amountSui = amountRaw ? Number(amountRaw) / 1_000_000_000 : 0;
  const platformId = json.platform_id as string | undefined;
  return {
    title: `New subscription · ${amountSui.toFixed(4)} SUI`,
    subtitle: `Platform ${truncate(platformId)}`,
    icon: <CreditCard className="h-4 w-4 text-[#6c63ff]" />,
  };
}

function suivisionTxUrl(digest: string): string {
  return `https://suivision.xyz/txblock/${digest}?network=devnet`;
}

export function LiveEventFeed() {
  const [activeTab, setActiveTab] = useState<EventTab>("PlatformRegistered");

  const { data, isPending, isError, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["live-event-feed", activeTab],
    queryFn: () => queryRecentEventsByType(EVENT_TYPES[activeTab], MAX_EVENTS_PER_TAB),
    refetchInterval: REFETCH_INTERVAL_MS,
    staleTime: REFETCH_INTERVAL_MS - 1000,
  });

  const events: FeedEvent[] = data ?? [];

  return (
    <section className="relative py-20 overflow-hidden">
      <div className="absolute inset-0 bg-[#0a0a0f]" />
      <div className="absolute inset-0 grid-pattern opacity-20" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="inline-flex items-center gap-2 glass-card px-4 py-2">
              <Activity className="h-4 w-4 text-[#10b981]" />
              <span className="text-sm text-[#94a3b8]">Live on Devnet</span>
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  isFetching ? "bg-yellow-400" : "bg-[#10b981] animate-pulse"
                )}
              />
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white text-center mb-2">
            On-chain activity, in real time
          </h2>
          <p className="text-sm text-[#94a3b8] text-center mb-8 max-w-2xl mx-auto">
            Every platform registration, subscription, and payment on PayStreamer is public on the Sui blockchain.
          </p>

          <div className="glass-card p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as EventTab)}
              >
                <TabsList>
                  {Object.keys(EVENT_TYPES).map((key) => (
                    <TabsTrigger key={key} value={key}>
                      {TAB_LABELS[key as EventTab]}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <div className="text-xs text-[#94a3b8]">
                {dataUpdatedAt
                  ? `Updated ${formatTimeAgo(dataUpdatedAt)}`
                  : "Loading…"}
              </div>
            </div>

            {isError ? (
              <div className="text-center py-12 text-[#94a3b8]">
                <p className="text-sm">
                  Could not load live activity. Refresh to try again.
                </p>
              </div>
            ) : isPending && events.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-[#94a3b8]">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span className="text-sm">Loading latest activity…</span>
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#10b981]/10 text-[#10b981] mb-4">
                  <Activity className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">
                  No {TAB_LABELS[activeTab].toLowerCase()} yet
                </h3>
                <p className="text-sm text-[#94a3b8] max-w-sm mx-auto">
                  No platform activity yet. Be the first to register.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {events.map((event) => {
                  const { title, subtitle, icon } = renderEventSummary(activeTab, event.json);
                  return (
                    <li
                      key={`${event.transactionDigest}-${event.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="p-2 rounded-lg bg-white/5 shrink-0">{icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{title}</p>
                        <p className="text-xs text-[#94a3b8] truncate">{subtitle}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-[#94a3b8] hidden sm:inline">
                          {formatTimeAgo(event.timestamp)}
                        </span>
                        <a
                          href={suivisionTxUrl(event.transactionDigest)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-[#6c63ff] hover:text-[#8b83ff] transition-colors"
                          aria-label="View on SuiVision"
                        >
                          <span className="hidden sm:inline">SuiVision</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
