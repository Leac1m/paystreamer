import '../styles/globals.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PayStreamerProvider } from '@paystreamer/sdk/react';
import { PayStreamerThemeProvider } from '@paystreamer/sdk/ui';
import { DAppKitProvider, createDAppKit } from "@mysten/dapp-kit-react";
import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { createPersistentBurnerWalletInitializer } from '../lib/persistentBurnerWallet';
import { createGraphqlClient } from '../lib/networkRouting';
const dAppKit = createDAppKit({
  enableBurnerWallet: true,
  networks: ["mainnet", "testnet", "devnet", "local"],
  defaultNetwork: "testnet",
  createClient: createGraphqlClient,
  walletInitializers: [createPersistentBurnerWalletInitializer()]
});

// Testnet Config for the Docs
const config = {
  packageId: "0x48c2c4ea663d95748ae53f3945f58433cf259b42c3aedfd62ba6a13ba4f2d38c",
  registryId: "0x48ccd75e970e510e6d94ca4fb94fb117c8c5ed760ef71e8594c311ebba23ca07",
  clockId: "0x0000000000000000000000000000000000000000000000000000000000000006",
  pusdType: "0x74d11b1c40509335fd139b7b173328a1e1d55d2816a55b893861148d3724a61f::pusd::PUSD",
  network: "testnet",
  sponsorApiUrl: "/api/sponsor",
  pusdPackageId: "0x74d11b1c40509335fd139b7b173328a1e1d55d2816a55b893861148d3724a61f",
  pusdTreasuryCapId: "0xca02759942d7c917bb74166c1ea44336f9819e6e36b051ff92b43de6989bcba2"
};

const queryClient = new QueryClient();

import { LiveModeProvider } from '../lib/LiveModeContext';

export default function App({ Component, pageProps }: any) {
  return (
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={dAppKit}>
        <PayStreamerProvider config={config as any}>
          <PayStreamerThemeProvider>
            <LiveModeProvider>
              <Component {...pageProps} />
            </LiveModeProvider>
          </PayStreamerThemeProvider>
        </PayStreamerProvider>
      </DAppKitProvider>
    </QueryClientProvider>
  )
}
