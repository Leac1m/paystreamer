import { motion } from 'framer-motion';
import { Ban, AlertTriangle, CreditCard } from 'lucide-react';

export default function EndUserExperience() {
  const features = [
    {
      icon: <Ban size={24} className="text-[#ef4444]" />,
      title: 'Manual Transactions',
      description: 'Stop making users manually sign a transaction every 30 days just to stay subscribed.'
    },
    {
      icon: <AlertTriangle size={24} className="text-[#f59e0b]" />,
      title: 'Accidental Churn',
      description: 'You lose hard-earned subscribers every month simply because they forgot to pay on time.'
    },
    {
      icon: <CreditCard size={24} className="text-[#6c63ff]" />,
      title: 'High Payment Fees',
      description: 'Stop losing 2.9% + 30¢ to traditional credit card processors and fighting cross-border friction.'
    }
  ];

  return (
    <section id="for-users" className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f] via-[#12121a] to-[#0a0a0f]" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-2 rounded-full bg-[#ef4444]/10 text-[#ef4444] text-sm font-medium mb-4">
            The Status Quo
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            The Problem With <span className="gradient-text">Web3 Payments</span>
          </h2>
          <p className="text-[#94a3b8] text-lg max-w-2xl mx-auto">
            Web3 businesses run on MRR, but blockchains weren't built for recurring payments. The current billing flow is actively hurting your growth.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="glass-card p-6 group border border-white/5 hover:border-white/10"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#12121a] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
              <p className="text-[#94a3b8] text-sm leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}