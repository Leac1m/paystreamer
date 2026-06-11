import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentClient, useCurrentAccount, useDAppKit, useWalletConnection } from "@mysten/dapp-kit-react";

import { Transaction } from "@mysten/sui/transactions";
import { ConnectModal } from "@mysten/dapp-kit-react/ui";
import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, X, Wallet, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { TxStatusToast, TxStatus } from "../components/TxStatusToast";
import { NetworkBanner } from "../components/dashboard/NetworkBanner";
import { queryAccountCreatedEvents, queryAccount } from "../lib/graphql";
import { parseMoveError } from "../lib/errors";
import {
  DEVNET_V2_PACKAGE_ID,
  DEVNET_COIN_TYPE_REGISTRY_ID,
  CLOCK_OBJECT_ID,
  SUI_TYPE_ARG,
} from "../constants";

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
  const dAppKit = useDAppKit();
  const { isConnecting } = useWalletConnection();
  const modalRef = useRef<any>(null);
  const queryClient = useQueryClient();

  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txMessage, setTxMessage] = useState("");
  const [txDigest, setTxDigest] = useState<string | undefined>();
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [pendingTier, setPendingTier] = useState<{ index: number; name: string; amount: bigint; frequency: bigint } | null>(null);
  const [subscriptionSuccess, setSubscriptionSuccess] = useState(false);
  const [nextBillingDate, setNextBillingDate] = useState<string | null>(null);

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

  const handleSubscribe = async (tierIndex: number, tierName: string, tierAmount: bigint, tierFrequency: bigint) => {
    if (!account) {
      modalRef.current?.show();
      return;
    }

    if (!accountId || !accountCapId) {
      setPendingTier({ index: tierIndex, name: tierName, amount: tierAmount, frequency: tierFrequency });
      setShowCreateAccountModal(true);
      return;
    }

    if (isSubscribed) {
      return;
    }

    await executeSubscription(tierIndex, tierAmount, tierFrequency);
  };

  const executeSubscription = async (tierIndex: number, tierAmount: bigint, tierFrequency: bigint) => {
    if (!account || !accountId || !accountCapId) return;

    setTxStatus("pending");
    setTxMessage("Creating subscription...");

    const tx = new Transaction();
    tx.setGasBudget(50_000_000);

    const accountType = tx.moveCall({
      target: `${DEVNET_V2_PACKAGE_ID}::registry::from_u8`,
      arguments: [tx.pure.u8(0)],
    });

    tx.moveCall({
      target: `${DEVNET_V2_PACKAGE_ID}::billing::create_subscription`,
      typeArguments: [SUI_TYPE_ARG],
      arguments: [
        tx.object(accountCapId),
        tx.object(accountId),
        tx.pure.id(platformId!),
        tx.pure.u64(BigInt(tierIndex)),
        tx.pure.u64(tierAmount),
        tx.pure.u64(tierFrequency),
        accountType,
        tx.object(CLOCK_OBJECT_ID),
      ],
    });

    try {
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });

      if (result.$kind === "FailedTransaction") {
        throw new Error(result.FailedTransaction.status.error?.message ?? "Transaction failed");
      }

      await client.core.waitForTransaction({ digest: result.Transaction.digest });
      setTxDigest(result.Transaction.digest);
      setTxStatus("success");
      setTxMessage("You're subscribed!");
      setSubscriptionSuccess(true);

      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 30);
      setNextBillingDate(nextDate.toLocaleDateString());

      await queryClient.invalidateQueries({ queryKey: ["platform", platformId] });
      await queryClient.invalidateQueries({ queryKey: ["subscription-accounts", account.address] });
    } catch (err) {
      setTxStatus("error");
      setTxMessage(parseMoveError(err));
    }
  };

  const handleCreateAccount = async () => {
    if (!account) return;

    setTxStatus("pending");
    setTxMessage("Creating account...");

    const tx = new Transaction();
    tx.setGasBudget(50_000_000);

    const initialPolicies = tx.moveCall({
      target: `${DEVNET_V2_PACKAGE_ID}::account::empty_policy_set`,
    });

    const [accountObj, cap] = tx.moveCall({
      target: `${DEVNET_V2_PACKAGE_ID}::account::create_account`,
      typeArguments: [SUI_TYPE_ARG],
      arguments: [
        tx.object(DEVNET_COIN_TYPE_REGISTRY_ID),
        initialPolicies,
        tx.object(CLOCK_OBJECT_ID),
      ],
    });

    tx.moveCall({
      target: `${DEVNET_V2_PACKAGE_ID}::account::share_account`,
      typeArguments: [SUI_TYPE_ARG],
      arguments: [accountObj, cap],
    });

    try {
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });

      if (result.$kind === "FailedTransaction") {
        throw new Error(result.FailedTransaction.status.error?.message ?? "Transaction failed");
      }

      await client.core.waitForTransaction({ digest: result.Transaction.digest });
      setTxDigest(result.Transaction.digest);
      setTxStatus("success");
      setTxMessage("Account created!");

      await queryClient.invalidateQueries({ queryKey: ["subscription-accounts", account.address] });
      await queryClient.invalidateQueries({ queryKey: ["account-caps", account.address] });
    } catch (err) {
      setTxStatus("error");
      setTxMessage(parseMoveError(err));
    }
  };

  useEffect(() => {
    if (accountId && accountCapId && pendingTier) {
      setShowCreateAccountModal(false);
      executeSubscription(pendingTier.index, pendingTier.amount, pendingTier.frequency);
      setPendingTier(null);
    }
  }, [accountId, accountCapId, pendingTier, executeSubscription]);

  const isPending = txStatus === "pending";

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
                      <p className="text-[#94a3b8] mb-6">Next billing date: {nextBillingDate}</p>
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
                        ) : !accountId ? (
                          <Button
                            onClick={() => {
                              const frequencyMs = getFrequencyMs(tier);
                              setPendingTier({
                                index,
                                name: tier.name,
                                amount: BigInt(tier.amount),
                                frequency: frequencyMs,
                              });
                              setShowCreateAccountModal(true);
                            }}
                            className="w-full"
                          >
                            Create Account First
                          </Button>
                        ) : (
                          <Button
                            onClick={() => {
                              const frequencyMs = getFrequencyMs(tier);
                              handleSubscribe(index, tier.name, BigInt(tier.amount), frequencyMs);
                            }}
                            disabled={isPending}
                            loading={isPending}
                            className="w-full"
                          >
                            Subscribe
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
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

      <AnimatePresence>
        {showCreateAccountModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => !isPending && setShowCreateAccountModal(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative glass-card p-6 max-w-md w-full"
            >
              <button
                onClick={() => !isPending && setShowCreateAccountModal(false)}
                className="absolute top-4 right-4 text-[#94a3b8] hover:text-white"
                disabled={isPending}
              >
                <X size={20} />
              </button>

              <h3 className="text-xl font-bold text-white mb-4">Create Account</h3>
              <p className="text-[#94a3b8] mb-6">
                You need to create a subscription account before you can subscribe to this platform.
              </p>

              {txStatus === "error" && (
                <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {txMessage}
                </div>
              )}

              <Button
                onClick={handleCreateAccount}
                disabled={isPending}
                loading={isPending}
                className="w-full"
              >
                {isPending ? "Creating..." : "Create Account"}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <TxStatusToast
        status={txStatus}
        message={txMessage}
        digest={txDigest}
        onClose={() => setTxStatus("idle")}
      />
    </div>
  );
}