'use client';

import { useState } from 'react';
import { useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import dynamic from 'next/dynamic';

const ConnectButton = dynamic(
  () => import('@mysten/dapp-kit-react/ui').then((mod) => mod.ConnectButton),
  { ssr: false }
);
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  CheckCircle2, 
  ChevronRight, 
  CreditCard,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Activity
} from 'lucide-react';
import { 
  SetupSubscriptionModal, 
  useMintTestPusd, 
  usePusdBalance,
  useUserAccount,
  usePayStreamerConfig,
  getConfig
} from '@paystreamer/sdk';

export default function Home() {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const disconnect = () => dAppKit.disconnectWallet();
  const { data: balance, isLoading: isBalanceLoading } = usePusdBalance();
  const { userAccount, isLoading: isAccountLoading } = useUserAccount();
  const { mint: mintPusd, isLoading: isMinting } = useMintTestPusd();
  const config = usePayStreamerConfig();
  
  const [isSubscribeModalOpen, setIsSubscribeModalOpen] = useState(false);
  const [hasSubscribed, setHasSubscribed] = useState(false);

  // Use the DEMO_PLATFORM_ID from the SDK constants
  const platformId = getConfig(config.network as any).DEMO_PLATFORM_ID;
  const isZeroBalance = !balance || balance === 0n;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-yellow-300">
      {/* Navigation */}
      <nav className="border-b border-neutral-200/80 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-400 flex items-center justify-center shadow-md shadow-yellow-400/30 text-neutral-950">
              <Sparkles className="w-5 h-5 fill-neutral-950" />
            </div>
            <span className="text-xl font-black tracking-tight text-neutral-950">DemoSaaS</span>
          </div>
          
          <div className="flex items-center">
            <ConnectButton />
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-24">
        <AnimatePresence mode="wait">
          {!account ? (
            <motion.div 
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center max-w-3xl mx-auto mt-12"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-400/20 text-neutral-900 text-sm font-bold mb-8 border border-yellow-400/50 shadow-sm">
                <Zap className="w-4 h-4 fill-yellow-500 text-yellow-600" />
                Powered by PayStreamer
              </div>
              <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-tight text-neutral-950">
                Next-gen analytics for <br />
                <span className="px-3 py-1 bg-yellow-400 text-neutral-950 rounded-2xl inline-block shadow-sm transform -rotate-1 mt-2">
                  Web3 teams.
                </span>
              </h1>
              <p className="text-xl text-neutral-600 mb-12 leading-relaxed font-medium max-w-2xl mx-auto">
                Experience frictionless, gasless Web3 subscriptions. No browser extension required. Connect the persistent burner wallet to try the demo instantly.
              </p>
              
              <div className="p-8 rounded-3xl bg-white border border-neutral-200 shadow-2xl shadow-neutral-900/5 inline-block text-left max-w-md w-full">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-neutral-950">
                  <Activity className="w-5 h-5 text-yellow-500" />
                  Try the Live Demo
                </h3>
                <ul className="space-y-3 text-neutral-600 mb-8 font-medium">
                  <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-neutral-950 fill-yellow-400" /> Persistent Burner Wallet</li>
                  <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-neutral-950 fill-yellow-400" /> Gasless Transactions (Sponsored)</li>
                  <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-neutral-950 fill-yellow-400" /> Real-time Streaming Payments</li>
                </ul>
                <div className="flex justify-center">
                  <ConnectButton />
                </div>
              </div>
            </motion.div>
          ) : hasSubscribed ? (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-4xl mx-auto"
            >
              <div className="p-10 rounded-3xl bg-white border border-neutral-200 shadow-2xl shadow-neutral-900/5 text-center">
                <div className="w-20 h-20 rounded-2xl bg-yellow-400 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-yellow-400/30">
                  <ShieldCheck className="w-10 h-10 text-neutral-950" />
                </div>
                <h2 className="text-3xl font-black mb-3 text-neutral-950">Welcome to DemoSaaS Pro</h2>
                <p className="text-neutral-600 text-lg mb-10 max-w-xl mx-auto font-medium">
                  Your Web3 subscription is active. You are streaming PUSD in real-time securely on the Sui network.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                  <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-200/80">
                    <div className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Account ID</div>
                    <div className="font-mono text-sm font-semibold truncate text-neutral-900">{userAccount?.accountId || 'Loading...'}</div>
                  </div>
                  <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-200/80">
                    <div className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Current Balance</div>
                    <div className="font-mono text-xl font-black text-neutral-950">
                      ${((Number(userAccount?.balance || 0n)) / 1e9).toFixed(2)} <span className="text-xs text-neutral-500 font-normal">PUSD</span>
                    </div>
                  </div>
                  <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-200/80">
                    <div className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Status</div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-yellow-400/20 text-neutral-950 text-sm font-bold border border-yellow-400/40">
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-ping" />
                      Streaming
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="pricing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-lg mx-auto"
            >
              <div className="text-center mb-12">
                <h2 className="text-4xl font-black mb-4 text-neutral-950">Choose your plan</h2>
                <p className="text-neutral-600 text-lg font-medium">Unlock premium features with real-time streaming payments.</p>
              </div>

              <div className="p-8 rounded-3xl bg-white border-2 border-neutral-200 relative overflow-hidden group hover:border-yellow-400 transition-all duration-300 shadow-2xl shadow-neutral-900/5">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Sparkles className="w-32 h-32 text-neutral-950" />
                </div>
                
                <div className="relative z-10">
                  <div className="inline-block px-3 py-1 rounded-full bg-yellow-400/20 text-neutral-950 text-xs font-bold tracking-wide uppercase mb-4 border border-yellow-400/40">
                    Most Popular
                  </div>
                  <h3 className="text-2xl font-black mb-2 text-neutral-950">Pro Tier</h3>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-5xl font-black text-neutral-950">$10</span>
                    <span className="text-neutral-500 font-semibold">/mo</span>
                  </div>
                  
                  <ul className="space-y-4 mb-8">
                    {['Unlimited analytics', 'Custom dashboards', 'API Access', '24/7 Support'].map((feature) => (
                      <li key={feature} className="flex items-center gap-3 font-semibold text-neutral-700">
                        <CheckCircle2 className="w-5 h-5 text-neutral-950 fill-yellow-400 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {isBalanceLoading ? (
                    <div className="h-14 bg-neutral-100 rounded-xl animate-pulse" />
                  ) : isZeroBalance ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-yellow-400/10 border border-yellow-400/30 flex gap-3 text-neutral-800 text-sm font-medium">
                        <div className="shrink-0 mt-0.5"><Zap className="w-4 h-4 text-yellow-600 fill-yellow-500" /></div>
                        <p>Your wallet has 0 PUSD. Claim demo tokens to start streaming instantly.</p>
                      </div>
                      <button
                        onClick={() => mintPusd()}
                        disabled={isMinting}
                        className="w-full flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-neutral-950 font-extrabold py-4 px-6 rounded-xl transition-all shadow-md shadow-yellow-400/20 disabled:opacity-50 cursor-pointer text-base"
                      >
                        {isMinting ? 'Claiming...' : 'Claim 100 Demo PUSD'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsSubscribeModalOpen(true)}
                      className="w-full flex items-center justify-center gap-2 bg-neutral-950 hover:bg-neutral-800 text-yellow-400 font-extrabold py-4 px-6 rounded-xl transition-all shadow-lg shadow-neutral-950/10 cursor-pointer text-base"
                    >
                      Subscribe Now <ArrowRight className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Subscription Modal using SDK */}
      <SetupSubscriptionModal
        isOpen={isSubscribeModalOpen}
        onClose={() => setIsSubscribeModalOpen(false)}
        platformId={platformId}
        tierIndex={0} // Pro Tier
        onSuccess={() => {
          setIsSubscribeModalOpen(false);
          setHasSubscribed(true);
        }}
        theme={{
          primary: "#FACC15",
          background: "#FFFFFF",
          card: "#FFFFFF",
          border: "#E5E7EB"
        }}
      />
    </div>
  );
}
