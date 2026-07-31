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
    PACKAGE_ID: "0xe3eafda79cf9963f1e5df5d752bd6da9c69e28ca79136465e90948ff0640bc5d",
    COIN_TYPE_REGISTRY_ID: "0x507328ab1a1d267df6d0abe4d2e6d5a237b1cefd4457a24547146da5dd179e58",
    COIN_TYPE_REGISTRY_INIT_VERSION: 45420,
    PAYMENT_SCHEDULER_ID: "0xa1d26f31aaeefbb5faaaee90b01514563dbadbffcab0c4fa10aace3f4ea4b911",
    PAYMENT_SCHEDULER_INIT_VERSION: 45420,
    ACCESS_CONTROL_ID: "",
    GRAPHQL_URL: "http://127.0.0.1:8000/graphql",
    PUSD_PACKAGE_ID: "0x275567ed754f8bbb77c5128cd6e43ea820f217dcd596a111e89ce9e19e962e7d",
    PUSD_TYPE_ARG: "0x275567ed754f8bbb77c5128cd6e43ea820f217dcd596a111e89ce9e19e962e7d::pusd::PUSD",
    PUSD_TREASURY_CAP_ID: "0x2c079c05f1adf51d0fe2f1840aa1166d7accd9c22560d13808606c561c68e95d",
    PUSD_TREASURY_CAP_INIT_VERSION: 45419,
    DEMO_PLATFORM_ID: "0x50a58eaed271251b702e8a61a35b0aadd15889be5bd5869d5f4aa4ac639eaff2",
    DEMO_PLATFORM_INIT_VERSION: 443838,
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
    DEMO_PLATFORM_ID: "0x6db491b67eb3cae7e25699a4bd52aad263c06223e86117bdb8acca91bf4bedce",
    DEMO_PLATFORM_INIT_VERSION: 909612921,
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
