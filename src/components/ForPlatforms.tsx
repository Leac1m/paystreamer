import { motion } from 'framer-motion';
import { Code2, DollarSign, Clock, ShieldCheck, Zap, BarChart3 } from 'lucide-react';

export default function ForPlatforms() {
  const benefits = [
    {
      icon: <DollarSign size={24} className="text-[#10b981]" />,
      title: 'Guaranteed Revenue',
      description: 'Smart contracts enforce payment policies. Get paid automatically without chasing invoices.'
    },
    {
      icon: <Clock size={24} className="text-[#6c63ff]" />,
      title: 'Automated Collections',
      description: 'Set it and forget it. Our system tracks subscription schedules and retries failed payments.'
    },
    {
      icon: <Code2 size={24} className="text-[#3b82f6]" />,
      title: 'Simple Integration',
      description: 'One API call to withdraw. We handle policy verification, scheduling, and retries.'
    },
    {
      icon: <ShieldCheck size={24} className="text-[#f59e0b]" />,
      title: 'Fraud Protection',
      description: 'Users must pre-fund accounts and set policies. No chargebacks, no disputes.'
    },
    {
      icon: <Zap size={24} className="text-[#ec4899]" />,
      title: 'Instant Settlement',
      description: 'Receive funds in 300ms. No waiting for bank transfers or payment processor delays.'
    },
    {
      icon: <BarChart3 size={24} className="text-[#6c63ff]" />,
      title: 'Real-time Analytics',
      description: 'Track subscription metrics, churn, and revenue with built-in dashboards.'
    }
  ];

  return (
    <section id="for-platforms" className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#0a0a0f]" />
      <div className="absolute inset-0 grid-pattern opacity-30" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-2 rounded-full bg-[#3b82f6]/10 text-[#3b82f6] text-sm font-medium mb-4">
            For Platforms
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Accept Subscriptions <span className="gradient-text">Effortlessly</span>
          </h2>
          <p className="text-[#94a3b8] text-lg max-w-2xl mx-auto">
            Integrate once and accept recurring payments from any user on Sui. No billing infrastructure needed.
          </p>
        </motion.div>

        {/* Benefits Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {benefits.map((benefit, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="glass-card p-6"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#12121a] flex items-center justify-center mb-5">
                {benefit.icon}
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">{benefit.title}</h3>
              <p className="text-[#94a3b8] text-sm leading-relaxed">{benefit.description}</p>
            </motion.div>
          ))}
        </div>

        {/* API Demo */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="max-w-4xl mx-auto"
        >
          <div className="glass-card overflow-hidden">
            {/* Code Header */}
            <div className="flex items-center gap-3 px-6 py-4 bg-black/30 border-b border-white/10">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-sm text-[#94a3b8] ml-4 font-mono">platform_integration.ts</span>
            </div>

            {/* Code Content */}
            <div className="p-6 font-mono text-sm">
              <pre className="text-[#94a3b8] leading-relaxed overflow-x-auto">
{`// 1. Register as a subscription platform
await subscription.registerPlatform({
  name: "Streaming+",
  apiKey: "sk_live_xxx",
  withdrawalSchedule: "monthly"
});

// 2. User subscribes to your service
const subscription = await userAccount.subscribe({
  platformId: "Streaming+",
  amount: 999, // $9.99 in USDC cents
  frequency: "monthly"
});

// 3. Automatically withdraw on schedule
const result = await subscription.withdraw({
  subscriptionId: subscription.id,
  userAddress: "0x7a3f...9b2c"
});

// Result: { success: true, txHash: "0x...", amount: "9.99 USDC" }

// 4. Handle failed withdrawals gracefully
if (result.status === "insufficient_funds") {
  await subscription.notifyUser({
    user: "0x7a3f...9b2c",
    message: "Please fund your subscription account",
    daysUntilCancel: 7
  });
}`}
              </pre>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16"
        >
          {[
            { value: '2,500+', label: 'Platforms Integrated' },
            { value: '99.9%', label: 'Collection Success Rate' },
            { value: '<$0.01', label: 'Transaction Fee' },
            { value: '300ms', label: 'Settlement Time' }
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl font-bold gradient-text mb-2">{stat.value}</div>
              <div className="text-sm text-[#94a3b8]">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}