# @paystreamer/sdk

The official TypeScript/React SDK for [PayStreamer](https://usepaystreamer.xyz), providing non-custodial recurring subscriptions and billing infrastructure on the Sui blockchain.

## Features

- ⚡ **Core Client**: PTB builders and chain queries for the full subscription lifecycle — accounts, tiers, payments, treasury management.
- ⚛️ **React Hooks**: Pre-built hooks (`useSubscribe`, `usePlatform`, `useUserAccount`, `usePusdBalance`, `useSponsoredTransaction`, etc.).
- 🎨 **UI Components**: Turnkey components including `SetupSubscriptionModal` and `TestnetFaucetButton`.
- ⛽ **Sponsored Transactions**: Gas station integration for gasless user transactions.
- 🔀 **Multi-Token Routing**: Pay or bill in any token via DeepBook, converted to the platform's settlement currency in the same PTB (`@paystreamer/sdk/core/deepbook`, optional peer dependency).
- 🔒 **Seal & Walrus**: Helpers for gating decrypted content on real subscription status (`@paystreamer/sdk/core/seal`, `@paystreamer/sdk/core/walrus`, optional peer dependencies).

## Compatibility

Tested against this exact combination — other versions may work but aren't verified:

| Package | Version |
| --- | --- |
| `@mysten/sui` | `2.23.1` |
| `@mysten/dapp-kit-react` | `2.1.10` |
| `@mysten/dapp-kit-core` | `1.6.8` |
| `@tanstack/react-query` | `^5.90.16` |
| `react` / `react-dom` | `^18.2.0 \|\| ^19.0.0` |
| Node.js | `20+` |
| Sui CLI (for local dev) | `1.75.x` |

`@mysten/sui`, `@mysten/dapp-kit-react`, and `@tanstack/react-query` are peer
dependencies — install them alongside the SDK, and keep them at the versions
above until a new compatibility matrix is published here.

## Installation

```bash
pnpm add @paystreamer/sdk @mysten/sui@2.23.1 @mysten/dapp-kit-react@2.1.10 @tanstack/react-query
```

## Quick Start

### 1. React Setup

PayStreamer sits on top of [dApp Kit](https://sdk.mystenlabs.com/dapp-kit)'s
`createDAppKit`/`DAppKitProvider`, which manages the wallet connection and
the Sui client. Wrap that with `PayStreamerProvider`, which carries the
PayStreamer-specific contract addresses for whichever network you target.

```tsx
import { createDAppKit, DAppKitProvider } from "@mysten/dapp-kit-react";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PayStreamerProvider, getConfig, CLOCK_OBJECT_ID } from "@paystreamer/sdk";

const queryClient = new QueryClient();
const sdkConfig = getConfig("testnet");

const dAppKit = createDAppKit({
  networks: ["testnet"],
  defaultNetwork: "testnet",
  createClient: (network) =>
    new SuiGrpcClient({
      network,
      baseUrl: `https://fullnode.${network}.sui.io:443`,
    }),
});

function App({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={dAppKit}>
        <PayStreamerProvider
          config={{
            network: "testnet",
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
```

### 2. Open Subscription Modal

```tsx
import { useState } from 'react';
import { SetupSubscriptionModal } from '@paystreamer/sdk/ui';

export function SubscribeButton({ platformId }: { platformId: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>
        Subscribe Now
      </button>

      <SetupSubscriptionModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        platformId={platformId}
        tierIndex={0}
        onSuccess={(digest) => {
          console.log('Subscription created!', digest);
        }}
      />
    </>
  );
}
```

## Modular Exports

- `@paystreamer/sdk` — Main bundle entry point (re-exports `core` + `react` + `ui`)
- `@paystreamer/sdk/core` — PTB builders, chain queries, and event queries
- `@paystreamer/sdk/react` — React hooks and context providers
- `@paystreamer/sdk/ui` — React UI components and modal dialogs
- `@paystreamer/sdk/core/seal`, `@paystreamer/sdk/core/deepbook`, `@paystreamer/sdk/core/walrus` — optional integrations, each behind its own optional peer dependency. These are deliberately **not** re-exported from `@paystreamer/sdk/core` — importing any of them there would make every consumer's bundler resolve `@mysten/seal`/`@mysten/deepbook-v3`/`@mysten/walrus` even if unused, which broke real builds before this split existed. Install only the peer dependency you actually need.

## Documentation

Full guides at [docs.usepaystreamer.xyz](https://docs.usepaystreamer.xyz), including a complete [Core API Reference](https://docs.usepaystreamer.xyz/core/transactions) and a generated [TypeDoc reference](https://docs.usepaystreamer.xyz/typedoc/) for exact type signatures.

## License

MIT
