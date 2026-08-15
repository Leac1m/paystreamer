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
    PACKAGE_ID: "0x4889e6b34c694040dc1ff00314cd46b3ab067bc4dbe420f998e7f00808e8e81a",
    COIN_TYPE_REGISTRY_ID: "0x53c8fb7a0c8428a1236734a52d467ec9dc8b3b9f66789162322932c2f2c9c891",
    COIN_TYPE_REGISTRY_INIT_VERSION: 17023,
    PAYMENT_SCHEDULER_ID: "0x8ef16e72dd31f5eeb0a379afc13ef590ed0edabb09e23c18b35e41f5faf22a7b",
    PAYMENT_SCHEDULER_INIT_VERSION: 17023,
    ACCESS_CONTROL_ID: "",
    GRAPHQL_URL: "http://127.0.0.1:8000/graphql",
    PUSD_PACKAGE_ID: "0x10e6ef896712c96b6e1dbaab43f97bc4c909fa18a14ee29676e077ddfbb62b40",
    PUSD_TYPE_ARG: "0x10e6ef896712c96b6e1dbaab43f97bc4c909fa18a14ee29676e077ddfbb62b40::pusd::PUSD",
    PUSD_TREASURY_CAP_ID: "0xf963ab25f560f14383bac75239471c932e229105cc96f0096e280eb053910441",
    PUSD_TREASURY_CAP_INIT_VERSION: 17022,
    DEMO_PLATFORM_ID: "0x1cfc20db70bae368ce90fb1e7ce123019f10f65d83b985ed93f05b81946d6d50",
    DEMO_PLATFORM_INIT_VERSION: 21223,
  },
  devnet: {
    PACKAGE_ID: "0x057d4b882dceb17163576c25e09cca21057b08e25bfb83380a7e7fe95e40b942",
    COIN_TYPE_REGISTRY_ID: "0x7d5dbd15aece4485232c9aa53ec8d530f2bb2a26b720a7a2ec7650e43caa921f",
    COIN_TYPE_REGISTRY_INIT_VERSION: 398,
    PAYMENT_SCHEDULER_ID: "0x29843ec107acae1ed96b681bc678dfde7758f364452bddabdc39bdbb34c665b2",
    PAYMENT_SCHEDULER_INIT_VERSION: 398,
    ACCESS_CONTROL_ID: "",
    GRAPHQL_URL: "https://graphql.devnet.sui.io/graphql",
    PUSD_PACKAGE_ID: "0xb0ea0c061b7f5381a2f63fe6255d5a9c147fddcc3ea07d9e720324dcf493a11e",
    PUSD_TYPE_ARG: "0xb0ea0c061b7f5381a2f63fe6255d5a9c147fddcc3ea07d9e720324dcf493a11e::pusd::PUSD",
    PUSD_TREASURY_CAP_ID: "0xdffbba81072035dc936073de0a2511ebcb248f808c5dfe0e99952b3d8240d066",
    PUSD_TREASURY_CAP_INIT_VERSION: 397,
    DEMO_PLATFORM_ID: "0x70fd4f89965204a8cefa14c98af479d419b54e24fdd43f562cba97ccb1cd38fb",
    DEMO_PLATFORM_INIT_VERSION: 7043019,
  },
  testnet: {
    PACKAGE_ID: "0x0629dcd39ad2125f74710ee31c616fc57998a734da4180ae43280250a1a7315e",
    COIN_TYPE_REGISTRY_ID: "0x696fedebd1ab9e7e3fda620ad8d6041e5e98a13cfbd0f093e901b29e1d652262",
    COIN_TYPE_REGISTRY_INIT_VERSION: 943964686,
    PAYMENT_SCHEDULER_ID: "0x0ed004e349b422aa4a55df17f9842174da57687db2cc42acca13784877cfe2cd",
    PAYMENT_SCHEDULER_INIT_VERSION: 943964686,
    ACCESS_CONTROL_ID: "0x74f0ae4071bccf2c0cdcc9c827fb7ddca6fce9c30503ca4bf1420eb68225d92d",
    GRAPHQL_URL: "https://graphql.testnet.sui.io/graphql",
    PUSD_PACKAGE_ID: "0x74d11b1c40509335fd139b7b173328a1e1d55d2816a55b893861148d3724a61f",
    PUSD_TYPE_ARG: "0x74d11b1c40509335fd139b7b173328a1e1d55d2816a55b893861148d3724a61f::pusd::PUSD",
    PUSD_TREASURY_CAP_ID: "0xca02759942d7c917bb74166c1ea44336f9819e6e36b051ff92b43de6989bcba2",
    PUSD_TREASURY_CAP_INIT_VERSION: 349181682,
    DEMO_PLATFORM_ID: "0xe6baf886ac85627df84389d571761188fbe6559f8fea62b4689a40fc831eb1eb",
    DEMO_PLATFORM_INIT_VERSION: 978056639,
  }
};

const getEnvNetwork = () => {
  // @ts-ignore
  if (typeof process !== 'undefined' && process.env && process.env.VITE_NETWORK) return process.env.VITE_NETWORK;
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_NETWORK) return (import.meta as any).env.VITE_NETWORK;
  return null;
};
const getTestMode = () => {
  const procEnv = (globalThis as any).process?.env;
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
  return (procEnv && (procEnv.NODE_ENV === 'test' || procEnv.NEXT_PUBLIC_IS_TEST_MODE === 'true' || procEnv.VITEST)) ||
    (metaEnv && (metaEnv.MODE === 'test' || metaEnv.VITE_NETWORK === 'local'));
};
export const NETWORK = (getEnvNetwork() || (getTestMode() ? "local" : "testnet")) as SupportedNetwork;

export function getConfig(network?: SupportedNetwork | string): NetworkConfig {
  let targetNetwork = network || (NETWORK as string);
  if (targetNetwork === "localnet") targetNetwork = "local";
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
