import { createDAppKit } from "@mysten/dapp-kit-react";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import {
  DEVNET_COUNTER_PACKAGE_ID,
  TESTNET_COUNTER_PACKAGE_ID,
  MAINNET_COUNTER_PACKAGE_ID,
  DEVNET_SUBSCRIPTIONS_PACKAGE_ID,
  TESTNET_SUBSCRIPTIONS_PACKAGE_ID,
  MAINNET_SUBSCRIPTIONS_PACKAGE_ID,
} from "./constants.ts";

const GRPC_URLS = {
  mainnet: "https://fullnode.mainnet.sui.io:443",
  testnet: "https://fullnode.testnet.sui.io:443",
  devnet: "https://fullnode.devnet.sui.io:443",
};

function makeMvrOverrides(pkgIds: Record<string, string | undefined>) {
  const pkgs: Record<string, string> = {};
  if (pkgIds.counter) pkgs["@local-pkg/counter"] = pkgIds.counter;
  if (pkgIds.subscriptions) pkgs["@local-pkg/subscriptions"] = pkgIds.subscriptions;
  return Object.keys(pkgs).length > 0 ? { packages: pkgs } : undefined;
}

export const dAppKit = createDAppKit({
  enableBurnerWallet: import.meta.env.DEV,
  networks: ["mainnet", "testnet", "devnet"],
  defaultNetwork: "devnet",
  createClient(network) {
    const mvr = makeMvrOverrides({
      counter: GRPC_URLS[network] === GRPC_URLS.mainnet
        ? MAINNET_COUNTER_PACKAGE_ID
        : GRPC_URLS[network] === GRPC_URLS.testnet
        ? TESTNET_COUNTER_PACKAGE_ID
        : DEVNET_COUNTER_PACKAGE_ID,
      subscriptions: GRPC_URLS[network] === GRPC_URLS.mainnet
        ? MAINNET_SUBSCRIPTIONS_PACKAGE_ID
        : GRPC_URLS[network] === GRPC_URLS.testnet
        ? TESTNET_SUBSCRIPTIONS_PACKAGE_ID
        : DEVNET_SUBSCRIPTIONS_PACKAGE_ID,
    });
    return new SuiGrpcClient({
      network,
      baseUrl: GRPC_URLS[network],
      ...(mvr ? { mvr: { overrides: mvr } } : {}),
    });
  },
});

// global type registration necessary for the hooks to work correctly
declare module "@mysten/dapp-kit-react" {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}