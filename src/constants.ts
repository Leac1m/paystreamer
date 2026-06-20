// PayStreamer v3 — Devnet deployment (2026-06-16)
// All deployment-specific IDs live here. Update on every redeployment.

export type SupportedNetwork = "devnet" | "testnet" | "mainnet";

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
  devnet: {
    PACKAGE_ID: "0xf310efaea5adf4bba799c3628563f8c6e0c9677785dca6d7865744e4a3b80afb",
    COIN_TYPE_REGISTRY_ID: "0x076e62b38cbe903413cb7ee9a177eef0c593a9bac40d0dcdbc7d46315af65639",
    COIN_TYPE_REGISTRY_INIT_VERSION: 14,
    PAYMENT_SCHEDULER_ID: "0x09d3b621355da923e9076fa95a8ff253331b44b8a0f4fa61b0ca51878b1d1c4e",
    PAYMENT_SCHEDULER_INIT_VERSION: 14,
    ACCESS_CONTROL_ID: "0x938eebde0b5cab85934b0875b34b1854181ceb62437de22af177880abe312a97",
    GRAPHQL_URL: "https://graphql.devnet.sui.io/graphql",
    PUSD_PACKAGE_ID: "0x7b09f1813d3e96e7759983486e40b4ec4ac32dc802095cbe9ff384d421383160",
    PUSD_TYPE_ARG: "0x7b09f1813d3e96e7759983486e40b4ec4ac32dc802095cbe9ff384d421383160::pusd::PUSD",
    PUSD_TREASURY_CAP_ID: "0xf04e1201cc50fa5401c2d3c37ac7284873282e7bfd3c6a7885f6f6989aebb68a",
    PUSD_TREASURY_CAP_INIT_VERSION: 15,
    DEMO_PLATFORM_ID: "0x452a39d1656c16331bb5c4b53ed83f51842cd08f006a9a87c547b29215e3daa7",
    DEMO_PLATFORM_INIT_VERSION: 5413211,
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
    DEMO_PLATFORM_ID: "0x68852b06587a12277f26f17acf06f6d000bbd3598f796ca3f3abb6e97afa5abb",
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
export const NETWORK = getEnvNetwork() || "testnet";

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
