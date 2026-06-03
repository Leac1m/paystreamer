import { useState, createContext, useContext, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, AlertCircle, Loader2 } from 'lucide-react';

interface WalletState {
  isConnected: boolean;
  address: string;
  truncatedAddress: string;
}

interface WalletContextType {
  wallet: WalletState;
  connect: () => Promise<void>;
  disconnect: () => void;
  isConnecting: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    return {
      wallet: { isConnected: false, address: '', truncatedAddress: '' },
      connect: async () => {},
      disconnect: () => {},
      isConnecting: false
    };
  }
  return context;
}

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [wallet, setWallet] = useState<WalletState>({
    isConnected: false,
    address: '',
    truncatedAddress: ''
  });
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = async () => {
    setIsConnecting(true);
    // Simulate wallet connection
    await new Promise(resolve => setTimeout(resolve, 2000));

    const fakeAddress = '0x' + Array.from({ length: 40 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');

    setWallet({
      isConnected: true,
      address: fakeAddress,
      truncatedAddress: `${fakeAddress.slice(0, 6)}...${fakeAddress.slice(-4)}`
    });
    setIsConnecting(false);
  };

  const disconnect = () => {
    setWallet({ isConnected: false, address: '', truncatedAddress: '' });
  };

  return (
    <WalletContext.Provider value={{ wallet, connect, disconnect, isConnecting }}>
      {children}
    </WalletContext.Provider>
  );
}

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { connect, isConnecting } = useWallet();

  const handleConnect = async () => {
    await connect();
    onClose();
  };

  const wallets = [
    { name: 'Sui Wallet', icon: 'S', color: '#6c63ff' },
    { name: 'Martian DAO', icon: 'M', color: '#10b981' },
    { name: 'Ethos Wallet', icon: 'E', color: '#f59e0b' },
    { name: 'Coming Soon', icon: '?', color: '#94a3b8' }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md glass-card p-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6c63ff] to-[#3b82f6] flex items-center justify-center">
                  <Wallet size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Connect Wallet</h2>
                  <p className="text-sm text-[#94a3b8]">Choose your wallet provider</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} className="text-[#94a3b8]" />
              </button>
            </div>

            {/* Wallet List */}
            <div className="space-y-3">
              {wallets.map((wallet, i) => (
                <button
                  key={i}
                  onClick={handleConnect}
                  disabled={isConnecting || wallet.name === 'Coming Soon'}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-transparent hover:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold"
                    style={{ backgroundColor: wallet.color + '20', color: wallet.color }}
                  >
                    {wallet.icon}
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-white font-medium">{wallet.name}</div>
                    {wallet.name === 'Coming Soon' && (
                      <div className="text-xs text-[#94a3b8]">Coming soon</div>
                    )}
                  </div>
                  {isConnecting && i === 0 && (
                    <Loader2 size={20} className="text-[#6c63ff] animate-spin" />
                  )}
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-6 pt-6 border-t border-white/10">
              <div className="flex items-start gap-3 text-sm text-[#94a3b8]">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <p>
                  By connecting, you agree to the Terms of Service and acknowledge that you have read the Privacy Policy.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}