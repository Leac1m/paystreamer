import { createContext, useContext, ReactNode } from 'react';

export interface PayStreamerConfig {
  packageId?: string;
  registryId?: string;
  clockId: string;
  pusdType?: string;
  pusdPackageId?: string;
  pusdTreasuryCapId?: string;
  pusdTreasuryCapInitVersion?: number;
  sponsorApiUrl?: string;
  network?: string; // "devnet", "testnet", "mainnet", "local"
  isMockMode?: boolean; // Used for UI playgrounds
}

import { Context } from 'react';

const globalKey = Symbol.for("PayStreamerContext");
export const PayStreamerContext: Context<PayStreamerConfig | undefined> = (globalThis as any)[globalKey] || ((globalThis as any)[globalKey] = createContext<PayStreamerConfig | undefined>(undefined));

export interface PayStreamerProviderProps {
  config: PayStreamerConfig;
  children: ReactNode;
}

/**
 * Carries PayStreamer's contract addresses and config for the target
 * network. Must be nested inside dApp Kit's `DAppKitProvider` — hooks read
 * the live, connected client via `useCurrentClient()` rather than managing
 * their own, so wallet network switches are picked up automatically.
 */
export function PayStreamerProvider({ config, children }: PayStreamerProviderProps) {
  return (
    <PayStreamerContext.Provider value={config}>
      {children}
    </PayStreamerContext.Provider>
  );
}

export function usePayStreamerConfig(): PayStreamerConfig {
  const context = useContext(PayStreamerContext);
  if (!context) {
    throw new Error('usePayStreamerConfig must be used within a PayStreamerProvider');
  }
  return context;
}
