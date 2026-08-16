'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PayStreamerProvider, getConfig, CLOCK_OBJECT_ID } from '@paystreamer/sdk';
import { ReactNode } from 'react';
import { createPersistentBurnerWalletInitializer } from '../lib/persistentBurnerWallet';
import { DAppKitProvider, createDAppKit } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  // Default to testnet for live demo usage, and localnet only during automated test runs
  const isTestMode = process.env.NODE_ENV === 'test' || process.env.NEXT_PUBLIC_IS_TEST_MODE === 'true';
  const defaultNetwork = (process.env.NEXT_PUBLIC_NETWORK || (isTestMode ? 'localnet' : 'testnet')) as any;
  const sdkConfig = getConfig(defaultNetwork === 'localnet' ? 'local' : defaultNetwork);

  const dAppKit = createDAppKit({
    enableBurnerWallet: false,
    networks: ['localnet', 'testnet', 'mainnet'],
    defaultNetwork: defaultNetwork,
    createClient: (network: string) => {
      const baseUrl = network === 'localnet'
        ? 'http://127.0.0.1:9000'
        : `https://fullnode.${network}.sui.io:443`;
      return new SuiGrpcClient({ baseUrl, network: network as any });
    },
    walletInitializers: [createPersistentBurnerWalletInitializer() as any]
  });

  return (
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={dAppKit}>
          {/* PayStreamer Configuration */}
          <PayStreamerProvider 
            config={{
              network: defaultNetwork,
              sponsorApiUrl: "/api/sponsor",
              packageId: sdkConfig.PACKAGE_ID,
              registryId: sdkConfig.COIN_TYPE_REGISTRY_ID,
              clockId: CLOCK_OBJECT_ID,
              pusdPackageId: sdkConfig.PUSD_PACKAGE_ID,
              pusdType: sdkConfig.PUSD_TYPE_ARG,
              pusdTreasuryCapId: sdkConfig.PUSD_TREASURY_CAP_ID,
              pusdTreasuryCapInitVersion: sdkConfig.PUSD_TREASURY_CAP_INIT_VERSION,
            }}
          >
            {children}
          </PayStreamerProvider>
      </DAppKitProvider>
    </QueryClientProvider>
  );
}
