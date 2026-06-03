import { useState, useEffect } from 'react';

interface WalletState {
  isConnected: boolean;
  address: string;
  truncatedAddress: string;
}

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>({
    isConnected: false,
    address: '',
    truncatedAddress: ''
  });

  // Check localStorage for persisted connection
  useEffect(() => {
    const stored = localStorage.getItem('sui_wallet_connection');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setWallet(parsed);
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);

  const connect = async () => {
    // Simulate wallet connection
    await new Promise(resolve => setTimeout(resolve, 2000));

    const fakeAddress = '0x' + Array.from({ length: 40 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');

    const newState = {
      isConnected: true,
      address: fakeAddress,
      truncatedAddress: `${fakeAddress.slice(0, 6)}...${fakeAddress.slice(-4)}`
    };

    setWallet(newState);
    localStorage.setItem('sui_wallet_connection', JSON.stringify(newState));
  };

  const disconnect = () => {
    setWallet({ isConnected: false, address: '', truncatedAddress: '' });
    localStorage.removeItem('sui_wallet_connection');
  };

  return {
    wallet,
    connect,
    disconnect,
    isConnecting: false
  };
}