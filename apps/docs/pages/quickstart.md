# Quickstart

This guide will walk you through setting up the PayStreamer SDK in your React application.

## 1. Installation

Install the PayStreamer SDK alongside its peer dependencies (`@mysten/dapp-kit-react`, `@mysten/sui`, and `@tanstack/react-query`).

```bash
npm install @paystreamer/sdk @mysten/dapp-kit-react @mysten/sui @tanstack/react-query
```

## 2. Setup the Provider

Wrap your application in the `PayStreamerProvider` along with the standard `SuiClientProvider` and `WalletProvider` from dApp Kit.

```tsx
import React from "react";
import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PayStreamerProvider } from "@paystreamer/sdk/react";

const queryClient = new QueryClient();

const payStreamerConfig = {
  // `packageId` and `pusdType` are automatically discovered on-chain if you omit them!
  clockId: "0x6",
  network: "mainnet", // or "testnet" / "local"
};

export default function App({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={{ devnet: { url: "https://fullnode.devnet.sui.io:443" } }}>
        <WalletProvider>
          <PayStreamerProvider config={payStreamerConfig}>
            {children}
          </PayStreamerProvider>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
```

## 3. Drop in a Component

With the provider configured, you can import drop-in UI components or use headless hooks. Here is how to easily render a subscription modal.

```tsx
import { useState } from "react";
import { SetupSubscriptionModal } from "@paystreamer/sdk/ui";

export function SubscribeSection() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setIsOpen(true)}>Subscribe Now</button>
      
      <SetupSubscriptionModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        platformId="0xYOUR_PLATFORM_ID"
        tierIndex={0}
        // tierAmount and tierFrequencyMs are automatically fetched from the contract!
        onSuccess={(digest) => console.log("Subscribed!", digest)}
      />
    </div>
  );
}
```

<Callout type="info">
  **Not a Developer?** If you are an end-user simply looking to manage your PayStreamer subscriptions, you do not need to build a custom dApp! Head over to the [PayStreamer Portal](/portal) to manage your account natively.
</Callout>
