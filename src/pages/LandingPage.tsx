import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle, Sparkles } from "lucide-react";
import NavBar from "../components/NavBar";
import HeroSection from "../components/HeroSection";
import IntegrationFlow from "../components/IntegrationFlow";
import EndUserExperience from "../components/EndUserExperience";
import CoreFeatures from "../components/CoreFeatures";
import SecuritySection from "../components/SecuritySection";
import { Button } from "../components/ui/button";

const PLATFORM_FEE_PERCENT = 3;

interface PlatformInfo {
  name: string;
  category: string;
}

const consumerTargets: PlatformInfo[] = [
  { name: "Decentralized Video Streaming", category: "Entertainment" },
  { name: "Seasonal Battle Passes", category: "GameFi" },
  { name: "Creator Content Vaults", category: "Media & Music" },
  { name: "VIP Guild Memberships", category: "Community" },
  { name: "Gated Editorial Access", category: "Publishing" },
  { name: "Token-Gated Paywalls", category: "Creator Economy" },
];

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const targets = consumerTargets;

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="noise" />
      <NavBar />
      {/* <GuidedDemoBanner /> */}

      <main>
        <HeroSection />

        {targets && targets.length > 0 && (
          <section className="relative py-16 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-bg-primary via-bg-secondary to-bg-primary" />

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 20 }}
                transition={{ duration: 0.6 }}
                className="text-center mb-8"
              >
                <div className="inline-flex items-center gap-2 glass-card px-4 py-2 mb-4 border border-white/10">
                  <Sparkles className="h-4 w-4 text-accent-primary animate-pulse" />
                  <span className="text-sm text-text-secondary font-medium">
                    Powering recurring monetization for next-generation Web3 consumer apps
                  </span>
                </div>

                <div className="flex flex-wrap justify-center gap-3 mt-6">
                  {targets.slice(0, 6).map((platform, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: mounted ? 1 : 0, scale: mounted ? 1 : 0.9 }}
                      transition={{ duration: 0.4, delay: 0.1 * index }}
                      className="glass-card px-4 py-2 flex items-center gap-2 border border-white/5 hover:border-white/15 transition-colors"
                    >
                      <div className="w-2 h-2 rounded-full bg-accent-success" />
                      <span className="text-sm font-medium text-white">{platform.name}</span>
                      <span className="text-xs text-text-secondary font-mono">({platform.category})</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </section>
        )}


        <EndUserExperience />

        <CoreFeatures />

        <IntegrationFlow />

        <SecuritySection />

        <section className="relative py-24 overflow-hidden">
          <div className="absolute inset-0 bg-bg-primary" />
          <div className="absolute inset-0 grid-pattern opacity-30" />

          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-block px-4 py-2 rounded-full bg-accent-success/10 text-accent-success text-sm font-medium mb-4">
                Simple Pricing
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
                PayStreamer takes <span className="gradient-text">{PLATFORM_FEE_PERCENT}%</span> per successful payment
              </h2>
              <p className="text-lg text-text-secondary mb-8 max-w-2xl mx-auto">
                2% to the Protocol Treasury, 1% to the decentralized Scheduler network. No hidden costs.
              </p>

              <div className="flex flex-wrap justify-center gap-6">
                {[
                  { icon: <CheckCircle size={20} className="text-accent-success" />, text: "Zero setup fees" },
                  { icon: <CheckCircle size={20} className="text-accent-success" />, text: "No monthly fees" },
                  { icon: <CheckCircle size={20} className="text-accent-success" />, text: "No hidden costs" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-text-secondary">
                    {item.icon}
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        <section className="relative py-24 overflow-hidden border-t border-white/5">
          <div className="absolute inset-0 bg-bg-secondary/30" />
          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-block px-4 py-2 rounded-full bg-accent-primary/10 text-accent-primary text-sm font-medium mb-4">
                Earn Yield
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
                Run a <span className="text-accent-primary">Scheduler</span>
              </h2>
              <p className="text-lg text-text-secondary mb-8 max-w-2xl mx-auto">
                Our decentralized execution layer allows anyone to execute due payments. Run a scheduler node and earn a 1% fee on every successful transaction you process.
              </p>
              <Button
                href="https://docs.usepaystreamer.xyz/scheduler"
                variant="outline"
                className="inline-flex items-center justify-center gap-2 text-md px-6 py-3 border-accent-primary/50 text-accent-primary hover:bg-accent-primary/10 transition-colors"
              >
                <span>Learn how to earn</span>
                <ArrowRight size={16} />
              </Button>
            </motion.div>
          </div>
        </section>

        <section className="relative py-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-bg-primary via-bg-secondary to-bg-primary" />
          <div className="orb orb-1 absolute -top-40 -left-40 w-[500px] h-[500px] opacity-20" />
          <div className="orb orb-2 absolute -bottom-40 -right-40 w-[400px] h-[400px] opacity-20" />

          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
                Ready to scale your recurring revenue on <span className="gradient-text">Web3?</span>
              </h2>
              <p className="text-text-secondary text-lg mb-10 max-w-2xl mx-auto">
                Join the leading platforms powering their subscriptions with Sui's trustless infrastructure.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    href="https://app.usepaystreamer.xyz"
                    className="flex items-center justify-center gap-2 text-lg px-8 py-4 w-full"
                    variant="gradient"
                  >
                    <span>Platform Portal</span>
                    <ArrowRight size={20} />
                  </Button>
                  <Button
                    href="https://docs.usepaystreamer.xyz"
                    variant="outline"
                    className="flex items-center justify-center gap-2 text-lg px-8 py-4 bg-transparent border-white/20 hover:bg-white/10 w-full"
                  >
                    <span>Documentation</span>
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-6 text-sm text-text-secondary">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent-success" />
                  <span>Zero setup fees</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent-success" />
                  <span>No chargebacks</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent-success" />
                  <span>Automated routing</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent-success" />
                  <span>Built on Sui</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

      </main>

      <footer className="relative py-16 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-8 mb-12">
            <div className="max-w-sm">
              <a href="#" className="flex items-center gap-3 mb-4">
                <img src="/logo.png" alt="PayStreamer Logo" className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(108,99,255,0.5)]" />
                <span className="text-xl font-bold text-white">PayStreamer</span>
              </a>
              <p className="text-sm text-text-secondary">
                Empowering users with full control over their subscription payments on the Sui blockchain.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-white/10 gap-4">
            <div className="text-sm text-text-secondary">
              © 2026 PayStreamer. Built on Sui Network.
            </div>

            <div className="flex items-center gap-4 text-sm">
              <a href="https://github.com/paystreamer" target="_blank" rel="noopener noreferrer" className="text-text-secondary hover:text-white transition-colors">GitHub</a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}