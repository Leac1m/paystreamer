import React, { useState, useEffect } from 'react';
import { useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import dynamic from 'next/dynamic';

const ConnectButton = dynamic(
  () => import('@mysten/dapp-kit-react/ui').then((mod) => mod.ConnectButton),
  { ssr: false }
) as any;

export function DocsDemoWrapper({ children }: { children: React.ReactNode }) {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const disconnect = () => dAppKit.disconnectWallet();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="p-8 mt-4 border rounded-xl bg-slate-50 dark:bg-slate-900 animate-pulse h-32 w-full" />;
  }

  if (!account) {
    return (
      <div className="p-8 mt-4 border border-dashed rounded-xl flex flex-col items-center justify-center gap-4 bg-slate-50/50 dark:bg-slate-900/50 text-center w-full">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Connect your wallet to interact with this live component.
        </p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="p-6 mt-4 border rounded-xl flex flex-col items-center justify-center gap-6 bg-slate-50 dark:bg-slate-900 w-full relative">
      <div className="w-full flex justify-center">
        {children}
      </div>
      
      {/* Inline Disconnect Button */}
      <button 
        onClick={() => disconnect()}
        className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition underline decoration-dotted"
      >
        Disconnect Wallet ({account.address.slice(0, 4)}...{account.address.slice(-4)})
      </button>
    </div>
  );
}
