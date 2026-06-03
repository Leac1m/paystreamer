import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet,
  Coins,
  Settings,
  CheckCircle,
  Building2,
  XCircle,
  Zap,
  Lock,
  RefreshCw,
  X
} from 'lucide-react';

interface StepProps {
  number: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  code?: string;
  delay: number;
}

function FlowStep({ number, icon, title, description, code, delay }: StepProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [delay]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 30 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="flex-1 min-w-[280px] max-w-[320px]"
    >
      <div className="glass-card p-6 h-full relative">
        {/* Connector Line */}
        {number < 4 && (
          <div className="hidden lg:block absolute top-1/2 -right-[calc(50%-160px)] w-[calc(100%-320px)] h-0.5 bg-gradient-to-r from-[#6c63ff] to-[#3b82f6] opacity-30" />
        )}

        {/* Step Number */}
        <div className="absolute -top-3 left-6">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6c63ff] to-[#3b82f6] flex items-center justify-center text-sm font-bold text-white">
            {number}
          </div>
        </div>

        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6c63ff]/20 to-[#3b82f6]/20 flex items-center justify-center mb-4 mt-4">
          {icon}
        </div>

        {/* Content */}
        <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
        <p className="text-[#94a3b8] text-sm mb-4">{description}</p>

        {/* Code Snippet */}
        {code && (
          <div className="code-snippet text-xs mt-auto">
            <code className="text-[#10b981]">{code}</code>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function UserFlow() {
  const [showTraditional, setShowTraditional] = useState(false);

  const steps = [
    {
      icon: <Wallet size={28} className="text-[#6c63ff]" />,
      title: 'Connect & Fund',
      description: 'Connect your Sui wallet and deposit stablecoins into your subscription account (a shared object).',
      code: 'deposit(usdc, 1000)'
    },
    {
      icon: <Settings size={28} className="text-[#6c63ff]" />,
      title: 'Set Policies',
      description: 'Define withdrawal limits, frequency, and which platforms can access your funds.',
      code: 'set_policy(limit: 50/mo)'
    },
    {
      icon: <Building2 size={28} className="text-[#6c63ff]" />,
      title: 'Platform Withdraws',
      description: 'Platforms automatically withdraw within your defined policies. You maintain full control.',
      code: 'withdraw(platform, 9.99)'
    },
    {
      icon: <CheckCircle size={28} className="text-[#10b981]" />,
      title: 'Instant Settlement',
      description: 'Transactions settle in 300ms with sub-cent fees. Cancel anytime with one click.',
      code: 'cancel(subscription_id)'
    }
  ];

  return (
    <section id="how-it-works" className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#0a0a0f]" />
      <div className="absolute inset-0 grid-pattern opacity-50" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-2 rounded-full bg-[#6c63ff]/10 text-[#6c63ff] text-sm font-medium mb-4">
            How It Works
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Subscription Flow on <span className="gradient-text">Sui</span>
          </h2>
          <p className="text-[#94a3b8] text-lg max-w-2xl mx-auto">
            A secure, user-controlled subscription system powered by Sui's shared objects and programmable policies.
          </p>
        </motion.div>

        {/* Comparison Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex justify-center mb-12"
        >
          <div className="glass-card p-1 inline-flex">
            <button
              onClick={() => setShowTraditional(false)}
              className={`px-6 py-3 rounded-lg text-sm font-medium transition-all ${
                !showTraditional ? 'bg-gradient-to-r from-[#6c63ff] to-[#3b82f6] text-white' : 'text-[#94a3b8]'
              }`}
            >
              Sui Subscriptions
            </button>
            <button
              onClick={() => setShowTraditional(true)}
              className={`px-6 py-3 rounded-lg text-sm font-medium transition-all ${
                showTraditional ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-[#94a3b8]'
              }`}
            >
              Traditional
            </button>
          </div>
        </motion.div>

        {/* Comparison Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="grid md:grid-cols-2 gap-6 mb-16 max-w-4xl mx-auto"
        >
          {/* Traditional Problems */}
          <div className="glass-card p-6 border-red-500/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <XCircle size={20} className="text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Traditional Subscriptions</h3>
            </div>
            <ul className="space-y-3">
              {[
                'Credit card on file = risk',
                'Cancel via phone/chat only',
                'Recurring billing surprises',
                'Platform controls withdrawals',
                'Hidden cancellation fees'
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-[#94a3b8]">
                  <X size={16} className="text-red-400 flex-shrink-0" />
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Sui Benefits */}
          <div className="glass-card p-6 border-[#10b981]/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#10b981]/20 flex items-center justify-center">
                <CheckCircle size={20} className="text-[#10b981]" />
              </div>
              <h3 className="text-lg font-semibold text-white">Sui Subscriptions</h3>
            </div>
            <ul className="space-y-3">
              {[
                'You control the funds always',
                'Cancel instantly on-chain',
                'Transparent withdrawal policies',
                'Smart contracts enforce rules',
                'No middlemen, no surprises'
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-[#94a3b8]">
                  <CheckCircle size={16} className="text-[#10b981] flex-shrink-0" />
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>

        {/* Flow Steps */}
        <div className="flex flex-col lg:flex-row gap-6 justify-between items-stretch lg:items-center">
          {steps.map((step, index) => (
            <FlowStep
              key={index}
              number={index + 1}
              icon={step.icon}
              title={step.title}
              description={step.description}
              code={step.code}
              delay={index * 150}
            />
          ))}
        </div>

        {/* Visual Flow Diagram */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-20 glass-card p-8 max-w-4xl mx-auto"
        >
          <h3 className="text-xl font-semibold text-white text-center mb-8">The Complete Flow</h3>
          <div className="flex flex-wrap justify-center items-center gap-4">
            {[
              { icon: <Wallet size={20} />, label: 'User Wallet', color: '#6c63ff' },
              { icon: <Coins size={20} />, label: 'Deposit Stablecoins', color: '#3b82f6' },
              { icon: <Lock size={20} />, label: 'Shared Object', color: '#10b981' },
              { icon: <Settings size={20} />, label: 'Set Policies', color: '#f59e0b' },
              { icon: <Building2 size={20} />, label: 'Platform', color: '#ec4899' },
              { icon: <Zap size={20} />, label: 'Auto Withdraw', color: '#6c63ff' },
              { icon: <RefreshCw size={20} />, label: 'Settle 300ms', color: '#10b981' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: item.color + '20', color: item.color }}
                >
                  {item.icon}
                </div>
                <span className="text-sm text-[#94a3b8] hidden sm:inline">{item.label}</span>
                {i < 6 && <span className="text-[#6c63ff] ml-2 hidden sm:inline">→</span>}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}