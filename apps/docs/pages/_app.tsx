import '../styles/globals.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PayStreamerProvider } from '@paystreamer/sdk/react';
import { PayStreamerThemeProvider } from '@paystreamer/sdk/ui';
import { DAppKitProvider, createDAppKit } from "@mysten/dapp-kit-react";
import { SuiGraphQLClient } from "@mysten/sui/graphql";

const dAppKit = createDAppKit({
  networks: ["local"],
  defaultNetwork: "local",
  createClient(network) {
    return new SuiGraphQLClient({
      network: "local",
      url: "http://127.0.0.1:9000"
    });
  }
});

// Mock Network Config for the Docs
const config = {
  packageId: "0x0000000000000000000000000000000000000000000000000000000000000001",
  registryId: "0x0000000000000000000000000000000000000000000000000000000000000002",
  clockId: "0x0000000000000000000000000000000000000000000000000000000000000006",
  pusdType: "0x0000000000000000000000000000000000000000000000000000000000000003::pusd::PUSD",
  network: "local"
};

const queryClient = new QueryClient();

export default function App({ Component, pageProps }: any) {
  return (
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={dAppKit}>
        <PayStreamerProvider config={config as any}>
          <PayStreamerThemeProvider>
            <Component {...pageProps} />
          </PayStreamerThemeProvider>
        </PayStreamerProvider>
      </DAppKitProvider>
    </QueryClientProvider>
  )
}
