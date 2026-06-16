import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentClient, useCurrentAccount, useWalletConnection } from "@mysten/dapp-kit-react";

import { ConnectModal } from "@mysten/dapp-kit-react/ui";
import { useRef } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Wallet, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { NetworkBanner } from "../components/dashboard/NetworkBanner";
import { SetupSubscriptionModal } from "../components/subscriptions/SetupSubscriptionModal";
import { queryAccountCreatedEvents, queryAccount } from "../lib/graphql";
import { DEMO_PLATFORM_ID } from "../constants";

const FREQUENCY_LABELS = ["Daily", "Weekly", "Monthly", "Yearly"];

function formatAmount(amount: bigint, decimals: number = 9): string {
  const value = Number(amount) / Math.pow(10, decimals);
  return value.toFixed(2);
}

interface TierInfo {
  name: string;
  amount: string;
  frequency_ms?: string;
  frequency?: string | { variant: number };
  is_active: boolean;
}

function formatFrequency(tier: TierInfo): string {
  const freq = tier.frequency_ms || tier.frequency;
  if (typeof freq === "object" && freq !== null && "variant" in freq) {
    return FREQUENCY_LABELS[freq.variant] || "Unknown";
  }
  const fStr = String(freq);
  if (fStr === "86400000") return "Daily";
  if (fStr === "604800000") return "Weekly";
  if (fStr === "2592000000") return "Monthly";
  if (fStr === "31536000000") return "Yearly";
  if (fStr === "daily" || fStr === "weekly" || fStr === "monthly" || fStr === "yearly") {
    return fStr.charAt(0).toUpperCase() + fStr.slice(1);
  }
  
  const ms = parseInt(fStr);
  if (!Number.isNaN(ms) && ms > 0) {
    if (ms < 3600000) return `${Math.round(ms / 60000)} mins`;
    if (ms < 86400000) return `${Math.round(ms / 3600000)} hours`;
    return `${Math.round(ms / 86400000)} days`;
  }
  return "Unknown";
}

function getFrequencyMs(tier: TierInfo): bigint {
  const freq = tier.frequency_ms || tier.frequency;
  if (typeof freq === "object" && freq !== null && "variant" in freq) {
    return BigInt(freq.variant === 0 ? 86400000 : freq.variant === 1 ? 604800000 : 2592000000);
  }
  const fStr = String(freq);
  if (fStr === "daily") return BigInt(86400000);
  if (fStr === "weekly") return BigInt(604800000);
  if (fStr === "monthly") return BigInt(2592000000);
  if (fStr === "yearly") return BigInt(31536000000);
  return BigInt(fStr || "2592000000");
}

interface PlatformJson {
  name?: string;
  description?: string;
  category?: string;
  is_verified?: boolean;
  tiers?: TierInfo[];
  subscribers?: Array<{ account_id: string }>;
}

export default function SubscribePage() {
  const { platformId } = useParams<{ platformId: string }>();
  const client = useCurrentClient();
  const account = useCurrentAccount();
  const { isConnecting } = useWalletConnection();
  const modalRef = useRef<any>(null);
  const queryClient = useQueryClient();
  const [subscriptionSuccess, setSubscriptionSuccess] = useState(false);
  const [nextBillingDate, setNextBillingDate] = useState<string | null>(null);

  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [selectedTierParams, setSelectedTierParams] = useState<{
    index: number;
    amount: bigint;
    frequencyMs: bigint;
  } | null>(null);

  const { data: platform, isPending: platformLoading } = useQuery({
    queryKey: ["platform", platformId],
    queryFn: async () => {
      if (!platformId) return null;
      const { object } = await client.core.getObject({
        objectId: platformId,
        include: { json: true },
      });
      return object;
    },
    enabled: !!platformId && platformId.length >= 66,
  });

  const { data: accountCreatedEvents } = useQuery({
    queryKey: ["account-created-events", account?.address],
    queryFn: async () => {
      if (!account?.address) return [];
      return await queryAccountCreatedEvents(account.address);
    },
    enabled: !!account?.address,
  });

  const uniqueAccounts = (accountCreatedEvents || [])
    .filter((acc, idx, arr) => arr.findIndex((a) => a.account_id === acc.account_id) === idx)
    .map((e) => ({
      accountId: e.account_id,
      capId: e.cap_id,
      denomination: (e as any).denomination || "0x2::sui::SUI",
    }));

  const accountId = uniqueAccounts[0]?.accountId;
  const accountCapId = uniqueAccounts[0]?.capId;

  const platformJson = platform?.json as PlatformJson | undefined;
  const tiersJson = platformJson?.tiers as any;
  const tiersList = Array.isArray(tiersJson) 
    ? tiersJson 
    : (Array.isArray(tiersJson?.contents) 
        ? tiersJson.contents 
        : []);
  const mappedTiers = tiersList.map((t: any) => t.value || t);
  const activeTiers = mappedTiers.filter((t: any) => t.is_active !== false);

  const { data: accountObj } = useQuery({
    queryKey: ["subscription-account-details", accountId],
    queryFn: async () => {
      if (!accountId) return null;
      return await queryAccount(accountId);
    },
    enabled: !!accountId,
  });

  const accountJson = accountObj as any;
  const accountSubscriptions = Array.isArray(accountJson?.subscriptions) 
    ? accountJson.subscriptions 
    : (Array.isArray(accountJson?.subscriptions?.contents) ? accountJson.subscriptions.contents : []);

  const isSubscribed = accountSubscriptions.some((s: any) => {
    const key = s.key || s.platform_id || (s.value && s.value.platform_id);
    return key === platformId;
  });

  const handleSubscribeClick = (tierIndex: number, tierAmount: bigint, tierFrequency: bigint) => {
    if (!account) {
      modalRef.current?.show();
      return;
    }

    if (isSubscribed) {
      return;
    }

    setSelectedTierParams({
      index: tierIndex,
      amount: tierAmount,
      frequencyMs: tierFrequency,
    });
    setIsSetupModalOpen(true);
  };



  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="noise" />
      <NetworkBanner />

      <header className="glass py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <a href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6c63ff] to-[#3b82f6] flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white" fillOpacity="0.9" />
                  <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-xl font-bold text-white">PayStreamer</span>
            </a>

            {account ? (
              <div className="flex items-center gap-2 text-sm text-[#94a3b8]">
                <span className="font-mono">
                  {account.address.slice(0, 6)}...{account.address.slice(-4)}
                </span>
              </div>
            ) : isConnecting ? (
              <Button disabled>
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                Connecting...
              </Button>
            ) : (
              <Button onClick={() => modalRef.current?.show()}>
                <Wallet size={16} className="mr-2" />
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {platformLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#6c63ff]" />
          </div>
        ) : !platform || !platformJson ? (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold text-white mb-4">Platform Not Found</h2>
            <p className="text-[#94a3b8]">This platform does not exist or has been removed.</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-12">
              <div className="flex items-center justify-center gap-3 mb-4">
                {platformJson.is_verified && (
                  <Badge variant="default" className="bg-[#10b981]/20 text-[#10b981] border-[#10b981]/30">
                    Verified
                  </Badge>
                )}
                {platformId && platformId === DEMO_PLATFORM_ID && (
                  <Badge className="bg-[#6c63ff]/20 text-[#a78bfa] border-[#6c63ff]/30">
                    Featured Demo
                  </Badge>
                )}
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
                {platformJson.name ?? "Unnamed Platform"}
              </h1>
              {platformJson.description && (
                <p className="text-lg text-[#94a3b8] max-w-2xl mx-auto mb-4">
                  {platformJson.description}
                </p>
              )}
              {platformJson.category && (
                <p className="text-sm text-[#94a3b8]">{platformJson.category}</p>
              )}
            </div>

            {!subscriptionSuccess && activeTiers.length > 0 && (
              <div className="mb-8">
                <p className="text-sm text-[#94a3b8] mb-4 text-center">How subscription works:</p>
                <div className="flex items-center justify-center gap-2 text-sm">
                  <div className={`flex items-center gap-2 ${account ? "text-[#10b981]" : "text-white"}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${account ? "bg-[#10b981]" : "bg-[#6c63ff]"}`}>
                      {account ? <CheckCircle className="w-4 h-4 text-white" /> : "1"}
                    </div>
                    <span>Connect Wallet</span>
                  </div>
                  <div className="w-8 h-px bg-white/20" />
                  <div className="flex items-center gap-2 text-white">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs bg-[#6c63ff]">2</div>
                    <span>Subscribe</span>
                  </div>
                </div>
              </div>
            )}

            {subscriptionSuccess ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md mx-auto"
              >
                <Card className="border-[#10b981]/30 bg-[#10b981]/5">
                  <CardContent className="pt-6 text-center">
                    <CheckCircle className="h-16 w-16 text-[#10b981] mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">You're subscribed!</h2>
                    {nextBillingDate && (
                      <p className="text-[#94a3b8] mb-6">Next billing: {nextBillingDate}</p>
                    )}
                    <div className="flex flex-col gap-3">
                      <Button onClick={() => window.location.href = "/"} className="w-full">
                        Back to Home
                      </Button>
                      <Button variant="secondary" onClick={() => window.location.href = "/dashboard"} className="w-full">
                        Go to Dashboard
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : activeTiers.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-[#94a3b8]">This platform has no active subscription tiers yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div>
                {activeTiers.length > 1 && (
                  <div className="mb-8 overflow-x-auto">
                    <h3 className="text-lg font-semibold text-white mb-4 text-center">Compare Plans</h3>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-3 px-4 text-[#94a3b8] font-medium text-sm">Feature</th>
                          {activeTiers.map((tier: any, index: number) => (
                            <th key={index} className="text-center py-3 px-4 text-white font-semibold text-sm">
                              {tier.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-white/10">
                          <td className="py-3 px-4 text-[#94a3b8] text-sm">Price</td>
                          {activeTiers.map((tier: any, index: number) => (
                            <td key={index} className="py-3 px-4 text-center text-white font-medium">
                              ${formatAmount(BigInt(tier.amount))}/{formatFrequency(tier)}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b border-white/10">
                          <td className="py-3 px-4 text-[#94a3b8] text-sm">Billing</td>
                          {activeTiers.map((tier: any, index: number) => (
                            <td key={index} className="py-3 px-4 text-center text-white text-sm capitalize">
                              {formatFrequency(tier)}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-3 px-4 text-[#94a3b8] text-sm">Automatic renewals</td>
                          {activeTiers.map((_: any, index: number) => (
                            <td key={index} className="py-3 px-4 text-center">
                              <CheckCircle className="h-5 w-5 text-[#10b981] mx-auto" />
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {activeTiers.map((tier: any, index: number) => {


                    return (
                      <Card key={index} className="relative overflow-hidden">
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between">
                            <span>{tier.name}</span>
                            {isSubscribed && (
                              <Badge variant="secondary" className="text-[#10b981]">Subscribed</Badge>
                            )}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="text-2xl font-bold text-white">
                            ${formatAmount(BigInt(tier.amount))}
                            <span className="text-sm font-normal text-[#94a3b8]">
                              {" "}/ {formatFrequency(tier)}
                            </span>
                          </div>

                          {isSubscribed ? (
                            <Button disabled className="w-full" variant="secondary">
                              Already Subscribed
                            </Button>
                          ) : !account ? (
                            <Button
                              onClick={() => modalRef.current?.show()}
                              className="w-full"
                            >
                              Connect to Subscribe
                            </Button>
                          ) : (
                            <div className="space-y-2">
                              <Button
                                onClick={() => {
                                  const frequencyMs = getFrequencyMs(tier);
                                  handleSubscribeClick(index, BigInt(tier.amount), frequencyMs);
                                }}
                                className="w-full"
                                variant="gradient"
                              >
                                {isSubscribed ? "Current Plan" : "Subscribe"}
                              </Button>
                              <p className="text-xs text-center text-[#94a3b8] mt-2">
                                Cancel anytime. Secure smart contract.
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-white/10 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6c63ff] to-[#3b82f6] flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white" fillOpacity="0.9" />
                  <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-sm text-[#94a3b8]">PayStreamer on Sui</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-[#94a3b8]">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>

      <ConnectModal ref={modalRef} />

      {selectedTierParams && (
        <SetupSubscriptionModal
          isOpen={isSetupModalOpen}
          onClose={() => {
            setIsSetupModalOpen(false);
            setSelectedTierParams(null);
          }}
          platformId={platformId!}
          tierIndex={selectedTierParams.index}
          tierAmount={selectedTierParams.amount}
          tierFrequencyMs={selectedTierParams.frequencyMs}
          accountId={accountId ?? undefined}
          accountCapId={accountCapId ?? undefined}
          currentBalance={accountJson?.balance?.value ? BigInt(accountJson.balance.value) : 0n}
          onSuccess={() => {
            setIsSetupModalOpen(false);
            setSubscriptionSuccess(true);
            const nextDate = new Date();
            nextDate.setTime(nextDate.getTime() + Number(selectedTierParams.frequencyMs));
            setNextBillingDate(nextDate.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
            queryClient.invalidateQueries({ queryKey: ["platform", platformId] });
            queryClient.invalidateQueries({ queryKey: ["account-created-events", account?.address] });
          }}
        />
      )}

    </div>
  );
}
