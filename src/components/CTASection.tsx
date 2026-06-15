import { motion } from 'framer-motion';
import { Button } from './ui/button';

export default function CTASection() {
  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f] via-[#12121a] to-[#0a0a0f]" />
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
          <p className="text-[#94a3b8] text-lg mb-10 max-w-2xl mx-auto">
            Join the leading platforms powering their subscriptions with Sui's trustless infrastructure.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12" />

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center gap-6 text-sm text-[#94a3b8]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#10b981]" />
              <span>Zero setup fees</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#10b981]" />
              <span>No chargebacks</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#10b981]" />
              <span>Automated routing</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#10b981]" />
              <span>Built on Sui</span>
            </div>
            <a href="/pricing" className="flex items-center gap-2 hover:text-white transition-colors">
              <div className="w-2 h-2 rounded-full bg-[#6c63ff]" />
              <span>2.5% per transaction</span>
            </a>
          </div>
        </motion.div>

        {/* Newsletter */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-16 glass-card p-8 max-w-xl mx-auto"
        >
          <h3 className="text-xl font-semibold text-white mb-3">Stay Updated</h3>
          <p className="text-[#94a3b8] text-sm mb-6">
            Get actionable updates on crypto billing, new features, and integration guides — no spam, unsubscribe anytime.
          </p>
          <div className="flex gap-3">
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-[#94a3b8] focus:outline-none focus:border-[#6c63ff]"
            />
            <Button variant="gradient" size="default">Subscribe</Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}