import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Play, Users, Zap, Shield } from 'lucide-react';
import { Button } from './ui/button';

export default function HeroSection() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState({ transactions: 0, volume: 0, subscriptions: 0 });

  useEffect(() => {
    setMounted(true);
    animateNumbers();
  }, []);

  const animateNumbers = () => {
    const targets = { transactions: 12500000, volume: 3600000000, subscriptions: 850000 };
    const duration = 2000;
    const steps = 60;
    const interval = duration / steps;

    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const easeOut = 1 - Math.pow(1 - progress, 3);

      setStats({
        transactions: Math.floor(targets.transactions * easeOut),
        volume: Math.floor(targets.volume * easeOut),
        subscriptions: Math.floor(targets.subscriptions * easeOut),
      });

      if (step >= steps) clearInterval(timer);
    }, interval);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-12">
      {/* Background Elements */}
      <div className="absolute inset-0 grid-pattern" />
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 30 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <div className="inline-flex items-center gap-2 glass-card px-4 py-2 mb-6">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
              <span className="text-sm text-[#94a3b8]">Built on Sui Blockchain</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              <span className="text-white">Accept Crypto Subscriptions Automatically — </span>
              <span className="gradient-text">No More Chasing Payments</span>
            </h1>

            <p className="text-lg text-[#94a3b8] mb-8 max-w-xl leading-relaxed">
              Stop losing MRR to manual payments. Your customers connect their wallet once, approve a spending limit, and never worry about billing again. Most integrations are live same-day.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <Button
                onClick={() => navigate('/explore')}
                variant="gradient"
                size="lg"
                className="text-lg"
              >
                <span>Explore Platforms</span>
                <ArrowRight size={20} />
              </Button>
              <a href="#how-it-works">
                <Button variant="secondary" size="lg" className="text-lg">
                  <Play size={20} />
                  <span>Read the Docs</span>
                </Button>
              </a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 20 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="text-center sm:text-left"
              >
                <div className="text-2xl sm:text-3xl font-bold text-white stat-number">
                  {formatNumber(stats.transactions)}
                </div>
                <div className="text-sm text-[#94a3b8]">Transactions Processed</div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 20 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="text-center sm:text-left"
              >
                <div className="text-2xl sm:text-3xl font-bold text-white stat-number">
                  ${formatNumber(stats.volume)}
                </div>
                <div className="text-sm text-[#94a3b8]">Treasury Volume</div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 20 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="text-center sm:text-left"
              >
                <div className="text-2xl sm:text-3xl font-bold text-white stat-number">
                  {formatNumber(stats.subscriptions)}
                </div>
                <div className="text-sm text-[#94a3b8]">Active Platforms</div>
              </motion.div>
            </div>
          </motion.div>

          {/* Right - Subscription Demo */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: mounted ? 1 : 0, x: mounted ? 0 : 50 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative lg:scale-95 origin-right"
          >
            <div className="glass-card p-6 relative">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6c63ff] to-[#3b82f6] flex items-center justify-center">
                    <Shield size={20} className="text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">Your Platform Treasury</div>
                    <div className="text-xs text-[#94a3b8] font-mono">0x4a9b...2f1c</div>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-[#10b981]/20 text-[#10b981] text-xs font-medium">
                  Verified
                </span>
              </div>

              {/* Balance */}
              <div className="bg-black/40 rounded-xl p-4 mb-6">
                <div className="text-sm text-[#94a3b8] mb-2">Total Revenue</div>
                <div className="text-3xl font-bold text-white mb-1">$45,250.00</div>
                <div className="text-sm text-[#94a3b8]">USDC on Sui</div>
              </div>

              {/* Policies */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-[#94a3b8]">Monthly Churn Rate</span>
                    <span className="text-[#10b981] font-medium">-2.4%</span>
                  </div>
                  <div className="policy-bar" style={{ '--withdraw-percent': '15%' } as React.CSSProperties} />
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-[#94a3b8]">Next Automated Batch</span>
                    <span className="text-white font-medium">in 45 mins</span>
                  </div>
                  <div className="bg-black/40 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[#3b82f6]/20 flex items-center justify-center">
                          <Zap size={16} className="text-[#3b82f6]" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">Pro Tier Billing</div>
                          <div className="text-xs text-[#94a3b8]">1,240 users</div>
                        </div>
                      </div>
                      <span className="text-xs text-[#94a3b8] text-[#10b981]">+$12,400</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Subscriptions List */}
              <div className="mt-6 pt-6 border-t border-white/10">
                <div className="text-sm text-[#94a3b8] mb-3">Recent Subscribers</div>
                {[
                  { name: '0x8f...3d', tier: 'Pro Tier', amount: '+$10.00', color: '#10b981' },
                  { name: '0x1a...9c', tier: 'Basic Tier', amount: '+$5.00', color: '#10b981' },
                  { name: '0x4c...2a', tier: 'Pro Tier', amount: '+$10.00', color: '#10b981' },
                ].map((sub, i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: '#ffffff10' }}>
                        <div className="w-full h-full rounded-lg flex items-center justify-center text-white">
                          <Users size={14} />
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-mono text-white">{sub.name}</div>
                        <div className="text-xs text-[#94a3b8]">{sub.tier}</div>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-[#10b981]">{sub.amount}</span>
                  </div>
                ))}
              </div>

              {/* Trust Badge */}
              <div className="absolute -bottom-4 -right-4 glass-card px-4 py-2">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-[#6c63ff]" />
                  <span className="text-xs text-[#94a3b8]">12.5M+ Users</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: mounted ? 1 : 0 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-6 h-10 rounded-full border-2 border-white/30 flex justify-center pt-2"
        >
          <div className="w-1.5 h-3 bg-white/50 rounded-full" />
        </motion.div>
      </motion.div>
    </section>
  );
}