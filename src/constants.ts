// PayStreamer v3 — Devnet deployment (2026-06-16)
// All deployment-specific IDs live here. Update on every redeployment.

export type SupportedNetwork = "local" | "devnet" | "testnet" | "mainnet";

export interface NetworkConfig {
  PACKAGE_ID: string;
  COIN_TYPE_REGISTRY_ID: string;
  COIN_TYPE_REGISTRY_INIT_VERSION: number;
  PAYMENT_SCHEDULER_ID: string;
  PAYMENT_SCHEDULER_INIT_VERSION: number;
  ACCESS_CONTROL_ID: string;
  GRAPHQL_URL: string;
  PUSD_PACKAGE_ID: string;
  PUSD_TYPE_ARG: string;
  PUSD_TREASURY_CAP_ID: string;
  PUSD_TREASURY_CAP_INIT_VERSION: number;
  DEMO_PLATFORM_ID: string;
  DEMO_PLATFORM_INIT_VERSION: number;
}

export const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  local: {
    PACKAGE_ID: "0xa455b80e6948b725ab7c355e5a4d7dac2e4c5625e5170d3b610f15c72e652c6c",
    COIN_TYPE_REGISTRY_ID: "0x3048eaf02a309aa0655556ba5b15c0b4a5a819c2d3b179597757ac90603031a2",
    COIN_TYPE_REGISTRY_INIT_VERSION: 790893,
    PAYMENT_SCHEDULER_ID: "0xbf8d05e652938a4377d624b5dce3351ecf04362f0b82644cf833a0b81fe47235",
    PAYMENT_SCHEDULER_INIT_VERSION: 790893,
    ACCESS_CONTROL_ID: "",
    GRAPHQL_URL: "http://127.0.0.1:8000/graphql",
    PUSD_PACKAGE_ID: "0xe6f8b6be30ea5ed93f409dd1abd6e795139543143adaeef5c13955c10cd8dbfb",
    PUSD_TYPE_ARG: "0xe6f8b6be30ea5ed93f409dd1abd6e795139543143adaeef5c13955c10cd8dbfb::pusd::PUSD",
    PUSD_TREASURY_CAP_ID: "0xc0d77643510304919f36437c2ff67612c3abdd0abe11c66614e85d8c830d1ace",
    PUSD_TREASURY_CAP_INIT_VERSION: 790892,
    DEMO_PLATFORM_ID: "0x8e8793ad667dc2a92c9f358dd4aca313267c6fb146ee97c9183f716359b6c634",
    DEMO_PLATFORM_INIT_VERSION: 798734,
  },
  devnet: {
    PACKAGE_ID: "0x0808b08199b07c7786c65fdbca996b2a2a0ccae29de8bd467d36225d2a7a9d73",
    COIN_TYPE_REGISTRY_ID: "0x211eeac09d39bac8553147c08f1c33701dcdf106a6886e7b852c5edc84e0e583",
    COIN_TYPE_REGISTRY_INIT_VERSION: 12,
    PAYMENT_SCHEDULER_ID: "0xae8bf7bb2a43da9aa303c353097c5ad23ae590f47a26fbebb5803bbec21dd02f",
    PAYMENT_SCHEDULER_INIT_VERSION: 12,
    ACCESS_CONTROL_ID: "0x872a025c83c65d1d7b66e3d2667eaf617c6624ddfefcced813da89d42eb368cf",
    GRAPHQL_URL: "https://graphql.devnet.sui.io/graphql",
    PUSD_PACKAGE_ID: "0x6fbabf6db1daa7343e34c01a10c196bc6fa324500114c51172547305c5181107",
    PUSD_TYPE_ARG: "0x6fbabf6db1daa7343e34c01a10c196bc6fa324500114c51172547305c5181107::pusd::PUSD",
    PUSD_TREASURY_CAP_ID: "0x2881d13216f36561b41a44a8d39de77f47b972953417904c71b60cdb5d345e48",
    PUSD_TREASURY_CAP_INIT_VERSION: 13,
    DEMO_PLATFORM_ID: "0xa9d5aa6ac94c1508a2a7f93d1498e881f117fd017c5e6932ad4e3045d070403a",
    DEMO_PLATFORM_INIT_VERSION: 6340321,
  },
  testnet: {
    PACKAGE_ID: "0x48c2c4ea663d95748ae53f3945f58433cf259b42c3aedfd62ba6a13ba4f2d38c",
    COIN_TYPE_REGISTRY_ID: "0x48ccd75e970e510e6d94ca4fb94fb117c8c5ed760ef71e8594c311ebba23ca07",
    COIN_TYPE_REGISTRY_INIT_VERSION: 349181685,
    PAYMENT_SCHEDULER_ID: "0xaad10a547fa266be39fabec779149784884f64f0202a103c69787124dacca223",
    PAYMENT_SCHEDULER_INIT_VERSION: 349181685,
    ACCESS_CONTROL_ID: "0x9cfde1ce446211229e8553bdb78265767a3a7514534450371ed17e363586779d",
    GRAPHQL_URL: "https://graphql.testnet.sui.io/graphql",
    PUSD_PACKAGE_ID: "0x74d11b1c40509335fd139b7b173328a1e1d55d2816a55b893861148d3724a61f",
    PUSD_TYPE_ARG: "0x74d11b1c40509335fd139b7b173328a1e1d55d2816a55b893861148d3724a61f::pusd::PUSD",
    PUSD_TREASURY_CAP_ID: "0xca02759942d7c917bb74166c1ea44336f9819e6e36b051ff92b43de6989bcba2",
    PUSD_TREASURY_CAP_INIT_VERSION: 349181682,
    DEMO_PLATFORM_ID: "0x1743834955aca50bc3c79dffbf93531ba2bbfa38c9f124f57afcee3d61d4b0ee",
    DEMO_PLATFORM_INIT_VERSION: 909612921,
  }
};

const getEnvNetwork = () => {
  // @ts-ignore
  if (typeof process !== 'undefined' && process.env && process.env.VITE_NETWORK) return process.env.VITE_NETWORK;
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_NETWORK) return import.meta.env.VITE_NETWORK;
  return null;
};
export const NETWORK = getEnvNetwork() || "devnet";

export function getConfig(network?: SupportedNetwork): NetworkConfig {
  const targetNetwork = network || (NETWORK as SupportedNetwork);
  return NETWORK_CONFIGS[targetNetwork] || NETWORK_CONFIGS.testnet!;
}

const fallbackConfig = getConfig();

export const SUBSCRIPTION_DEVNET_PACKAGE_ID = fallbackConfig.PACKAGE_ID;
export const SUBSCRIPTION_TESTNET_PACKAGE_ID = NETWORK_CONFIGS.testnet?.PACKAGE_ID;
export const SUBSCRIPTION_MAINNET_PACKAGE_ID = undefined;

export const COIN_TYPE_REGISTRY_ID = fallbackConfig.COIN_TYPE_REGISTRY_ID;
export const COIN_TYPE_REGISTRY_INIT_VERSION = fallbackConfig.COIN_TYPE_REGISTRY_INIT_VERSION;

export const PAYMENT_SCHEDULER_ID = fallbackConfig.PAYMENT_SCHEDULER_ID;
export const PAYMENT_SCHEDULER_INIT_VERSION = fallbackConfig.PAYMENT_SCHEDULER_INIT_VERSION;

export const ACCESS_CONTROL_ID = fallbackConfig.ACCESS_CONTROL_ID;

export const GRAPHQL_URL = fallbackConfig.GRAPHQL_URL;
export const SUI_TYPE_ARG = "0x2::sui::SUI";
export const CLOCK_OBJECT_ID = "0x0000000000000000000000000000000000000000000000000000000000000006";

export const PUSD_DEVNET_PACKAGE_ID = fallbackConfig.PUSD_PACKAGE_ID;
export const PUSD_TYPE_ARG = fallbackConfig.PUSD_TYPE_ARG;
export const PUSD_TREASURY_CAP_ID = fallbackConfig.PUSD_TREASURY_CAP_ID;
export const PUSD_TREASURY_CAP_INIT_VERSION = fallbackConfig.PUSD_TREASURY_CAP_INIT_VERSION;

export const DEMO_DENOMINATIONS: string[] = [fallbackConfig.PUSD_TYPE_ARG];

export const DEMO_PLATFORM_ID = fallbackConfig.DEMO_PLATFORM_ID;
export const DEMO_PLATFORM_INIT_VERSION = fallbackConfig.DEMO_PLATFORM_INIT_VERSION;
