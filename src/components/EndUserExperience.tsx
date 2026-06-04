import { motion } from 'framer-motion';
import { Shield, CreditCard, Ban, Zap, Eye, ArrowRight } from 'lucide-react';

export default function EndUserExperience() {
  const features = [
    {
      icon: <Shield size={24} className="text-[#10b981]" />,
      title: 'User Controlled Limits',
      description: 'Users set their own max monthly withdrawal limits, eliminating the fear of being overcharged.'
    },
    {
      icon: <CreditCard size={24} className="text-[#6c63ff]" />,
      title: 'Predictable Pricing',
      description: 'Bill users in USDC or other stablecoins so they never have to worry about crypto market volatility.'
    },
    {
      icon: <Ban size={24} className="text-[#f59e0b]" />,
      title: 'One-Click Cancellations',
      description: 'Users can instantly revoke platform access on-chain. Zero friction builds long-term brand trust.'
    },
    {
      icon: <Zap size={24} className="text-[#3b82f6]" />,
      title: 'Gasless Onboarding',
      description: 'Sponsor your users\' transactions via sponsored PTBs so they don\'t even need SUI tokens to subscribe.'
    },
    {
      icon: <Eye size={24} className="text-[#ec4899]" />,
      title: 'Verifiable Billing',
      description: 'Users can see exactly when your platform is allowed to withdraw, ensuring complete transparency.'
    },
    {
      icon: <ArrowRight size={24} className="text-[#6c63ff]" />,
      title: 'Instant Access',
      description: 'Transactions settle in 300ms. Grant premium access instantly without waiting for confirmations.'
    }
  ];

  return (
    <section id="for-users" className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f] via-[#12121a] to-[#0a0a0f]" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-2 rounded-full bg-[#10b981]/10 text-[#10b981] text-sm font-medium mb-4">
            End User Experience
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            A Seamless Experience For <span className="gradient-text">Your Users</span>
          </h2>
          <p className="text-[#94a3b8] text-lg max-w-2xl mx-auto">
            Give your subscribers peace of mind with non-custodial subscriptions. Higher trust equals higher conversion rates and lower churn.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="glass-card p-6 group"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#12121a] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
              <p className="text-[#94a3b8] text-sm leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Demo Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 max-w-4xl mx-auto"
        >
          <div className="glass-card p-8">
            <h3 className="text-2xl font-semibold text-white text-center mb-8">The Subscriber Journey</h3>

            <div className="space-y-6">
              {/* Step 1 */}
              <div className="flex items-start gap-6">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6c63ff] to-[#3b82f6] flex items-center justify-center flex-shrink-0 text-white font-bold">
                  1
                </div>
                <div>
                  <h4 className="text-white font-medium mb-2">User Creates Account</h4>
                  <p className="text-[#94a3b8] text-sm mb-3">
                    Their wallet is initialized as a SubscriptionAccount. You can sponsor the gas for this setup.
                  </p>
                  <div className="code-snippet text-xs">
                    <code className="text-[#10b981]">subscription_account::create(ctx)</code>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-6">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6c63ff] to-[#3b82f6] flex items-center justify-center flex-shrink-0 text-white font-bold">
                  2
                </div>
                <div>
                  <h4 className="text-white font-medium mb-2">User Deposits Funds</h4>
                  <p className="text-[#94a3b8] text-sm mb-3">
                    They add USDC to their account and authorize your platform. The funds remain fully in their custody.
                  </p>
                  <div className="code-snippet text-xs">
                    <code className="text-[#10b981]">deposit(usdc, 500) // $500 balance</code>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-6">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6c63ff] to-[#3b82f6] flex items-center justify-center flex-shrink-0 text-white font-bold">
                  3
                </div>
                <div>
                  <h4 className="text-white font-medium mb-2">You Withdraw On Schedule</h4>
                  <p className="text-[#94a3b8] text-sm mb-3">
                    Your automated bot fetches due accounts and triggers withdrawals directly into your platform's treasury.
                  </p>
                  <div className="code-snippet text-xs">
                    <code className="text-[#10b981]">// Execute batch withdrawal to treasury</code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}