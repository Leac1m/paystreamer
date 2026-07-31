'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PayStreamerProvider, getConfig, CLOCK_OBJECT_ID } from '@paystreamer/sdk';
import { ReactNode } from 'react';
import { createPersistentBurnerWalletInitializer } from '../lib/persistentBurnerWallet';
import { DAppKitProvider, createDAppKit } from '@mysten/dapp-kit-react';
import { SuiGraphQLClient } from '@mysten/sui/graphql';

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  // Determine network from env, defaulting to localnet
  const defaultNetwork = (process.env.NEXT_PUBLIC_NETWORK || 'localnet') as any;
  const sdkConfig = getConfig(defaultNetwork);

  const dAppKit = createDAppKit({
    enableBurnerWallet: false,
    networks: ['localnet', 'testnet', 'mainnet'],
    defaultNetwork: defaultNetwork,
    createClient: (network: string) => {
      const url = network === 'localnet' 
        ? 'http://127.0.0.1:8000/graphql' 
        : `https://graphql.${network}.sui.io/graphql`;
      return new SuiGraphQLClient({ url, network });
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
              graphqlUrl: sdkConfig.GRAPHQL_URL
            }}
          >
            {children}
          </PayStreamerProvider>
      </DAppKitProvider>
    </QueryClientProvider>
  );
}
