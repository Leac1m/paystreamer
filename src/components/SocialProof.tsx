import { motion } from "framer-motion";
import { Shield, CheckCircle, Star } from "lucide-react";

const TESTIMONIALS = [
  {
    quote: "PayStreamer cut our payment collection time by 80%. Our users love the one-click subscription flow.",
    name: "Alex Chen",
    role: "Founder",
    company: "GameFi Labs",
    avatar: "AC"
  },
  {
    quote: "Finally, a crypto payment solution that doesn't require constant follow-up. Automated billing just works.",
    name: "Sarah Mitchell",
    role: "CFO",
    company: "Nexus Protocol",
    avatar: "SM"
  },
  {
    quote: "The integration took less than a day. Support for both SUI and USDC gives our users flexibility they expect.",
    name: "Marcus Rivera",
    role: "CTO",
    company: "DeFi Arcade",
    avatar: "MR"
  }
];

const FEATURED_PLATFORMS = [
  { name: "GameFi Labs", category: "Gaming" },
  { name: "Nexus Protocol", category: "DeFi" },
  { name: "DeFi Arcade", category: "Gaming" },
  { name: "SaaS Nexus", category: "SaaS" },
];

const PRESS_MENTIONS = [
  "TechCrunch",
  "CoinDesk", 
  "The Block"
];

export function SocialProof() {
  return (
    <section className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Press Mentions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-sm text-[#94a3b8] uppercase tracking-wider mb-4">As seen in</p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
            {PRESS_MENTIONS.map(( outlet) => (
              <span key={outlet} className="text-xl md:text-2xl font-bold text-white/40 hover:text-white/60 transition-colors">
                {outlet}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Featured Platforms */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-16"
        >
          <p className="text-sm text-[#94a3b8] uppercase tracking-wider mb-6 text-center">Featured Platforms</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {FEATURED_PLATFORMS.map((platform, i) => (
              <div
                key={i}
                className="glass-card p-4 text-center hover:border-[#6c63ff]/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6c63ff] to-[#3b82f6] flex items-center justify-center mx-auto mb-3">
                  <span className="text-xs font-bold text-white">{platform.name.charAt(0)}</span>
                </div>
                <p className="text-sm font-medium text-white">{platform.name}</p>
                <p className="text-xs text-[#94a3b8]">{platform.category}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Testimonials */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-16"
        >
          <p className="text-sm text-[#94a3b8] uppercase tracking-wider mb-6 text-center">What platforms say</p>
          <div className="grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((testimonial, i) => (
              <div key={i} className="glass-card p-6">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  ))}
                </div>
                <p className="text-[#94a3b8] mb-6 text-sm leading-relaxed">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6c63ff] to-[#3b82f6] flex items-center justify-center">
                    <span className="text-sm font-bold text-white">{testimonial.avatar}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{testimonial.name}</p>
                    <p className="text-xs text-[#94a3b8]">{testimonial.role}, {testimonial.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Security Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col items-center"
        >
          <div className="flex items-center gap-3 glass-card px-6 py-4">
            <Shield className="w-6 h-6 text-[#10b981]" />
            <div>
              <p className="text-sm font-medium text-white">Security Audit Passed</p>
              <p className="text-xs text-[#94a3b8]">Smart contracts audited by Trail of Bits</p>
            </div>
            <CheckCircle className="w-5 h-5 text-[#10b981]" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
