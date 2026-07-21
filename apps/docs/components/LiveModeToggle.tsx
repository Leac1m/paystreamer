import React, { useState } from 'react';
import { useLiveMode } from '../lib/LiveModeContext';
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import dynamic from 'next/dynamic';

const ConnectModal = dynamic(
  () => import('@mysten/dapp-kit-react/ui').then((mod) => mod.ConnectModal),
  { ssr: false }
) as any;

export const LiveModeToggle = () => {
  const { isLive, setIsLive } = useLiveMode();
  const account = useCurrentAccount();
  const [modalOpen, setModalOpen] = useState(false);

  const toggleMode = () => {
    if (isLive) {
      setIsLive(false);
    } else {
      if (account) {
        setIsLive(true);
      } else {
        setModalOpen(true);
      }
    }
  };

  return (
    <>
      <button 
        onClick={toggleMode}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
        title={isLive ? "Live Mode: Interactions submit to blockchain" : "Mock Mode: UI preview without transactions"}
      >
        <span>Live</span>
        <div 
          className={`w-2.5 h-2.5 rounded-full ${isLive ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-600'}`} 
        />
      </button>
      
      <ConnectModal
        trigger={<span style={{ display: 'none' }}></span>}
        open={modalOpen}
        onOpenChange={(isOpen: boolean) => {
          setModalOpen(isOpen);
          // If closed and account exists, user successfully connected
          if (!isOpen && account) {
            setIsLive(true);
          }
        }}
      />
    </>
  );
};
