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
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-indigo-500/30">
      {/* Navigation */}
      <nav className="border-b border-slate-800/60 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">DemoSaaS</span>
          </div>
          
          <div className="flex items-center gap-4">
            {account && (
              <button 
                onClick={() => disconnect()}
                className="text-xs text-slate-400 hover:text-white transition"
              >
                Disconnect
              </button>
            )}
            <ConnectButton className="!bg-indigo-500 !text-white !font-semibold !rounded-xl !px-6 !py-2.5 hover:!bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20" />
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
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-sm font-medium mb-8 border border-indigo-500/20">
                <Zap className="w-4 h-4" />
                Powered by PayStreamer
              </div>
              <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
                Next-gen analytics for <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
                  Web3 teams.
                </span>
              </h1>
              <p className="text-xl text-slate-400 mb-12 leading-relaxed">
                Experience frictionless, gasless Web3 subscriptions. No browser extension required. Connect the persistent burner wallet to try the demo instantly.
              </p>
              
              {/* Note: The user clicks the ConnectButton in the nav to start, but we can also guide them here */}
              <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl inline-block text-left">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-400" />
                  Try the Live Demo
                </h3>
                <ul className="space-y-3 text-slate-400 mb-6">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Persistent Burner Wallet</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Gasless Transactions (Sponsored)</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Real-time Streaming Payments</li>
                </ul>
                <div className="flex justify-center">
                  <ConnectButton className="!w-full !justify-center !bg-white !text-slate-900 !font-bold !rounded-xl !px-6 !py-3 hover:!bg-slate-200 transition-all" />
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
              <div className="p-8 rounded-3xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 text-center">
                <div className="w-20 h-20 rounded-2xl bg-emerald-500 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/20">
                  <ShieldCheck className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-bold mb-4">Welcome to DemoSaaS Pro</h2>
                <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
                  Your Web3 subscription is active. You are streaming PUSD in real-time securely on the Sui network.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                  <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                    <div className="text-sm text-slate-400 mb-1">Account ID</div>
                    <div className="font-mono text-sm truncate">{userAccount?.accountId || 'Loading...'}</div>
                  </div>
                  <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                    <div className="text-sm text-slate-400 mb-1">Current Balance</div>
                    <div className="font-mono text-lg font-semibold text-emerald-400">
                      ${((Number(userAccount?.balance || 0n)) / 1e9).toFixed(2)} PUSD
                    </div>
                  </div>
                  <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                    <div className="text-sm text-slate-400 mb-1">Status</div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-sm font-medium">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
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
                <h2 className="text-3xl font-bold mb-4">Choose your plan</h2>
                <p className="text-slate-400">Unlock premium features with real-time streaming payments.</p>
              </div>

              <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 relative overflow-hidden group hover:border-indigo-500/50 transition-colors">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Sparkles className="w-32 h-32 text-indigo-500" />
                </div>
                
                <div className="relative z-10">
                  <h3 className="text-2xl font-bold mb-2">Pro Tier</h3>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-extrabold">$10</span>
                    <span className="text-slate-400">/mo</span>
                  </div>
                  
                  <ul className="space-y-4 mb-8">
                    {['Unlimited analytics', 'Custom dashboards', 'API Access', '24/7 Support'].map((feature) => (
                      <li key={feature} className="flex items-center gap-3 text-slate-300">
                        <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {isBalanceLoading ? (
                    <div className="h-12 bg-slate-800 rounded-xl animate-pulse" />
                  ) : isZeroBalance ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3 text-amber-200 text-sm">
                        <div className="shrink-0 mt-0.5"><Zap className="w-4 h-4" /></div>
                        <p>Your wallet has 0 PUSD. Mint some testnet tokens to continue.</p>
                      </div>
                      <button
                        onClick={() => mintPusd()}
                        disabled={isMinting}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-3.5 px-6 rounded-xl transition-all disabled:opacity-50"
                      >
                        {isMinting ? 'Minting...' : 'Claim 100 Demo PUSD'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsSubscribeModalOpen(true)}
                      className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-200 text-slate-900 font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-white/10"
                    >
                      Subscribe Now <ArrowRight className="w-4 h-4" />
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
          primary: "#6366f1",
          background: "#090d16",
          card: "#0f172a",
          border: "#1e293b"
        }}
      />
    </div>
  );
}
