// PayStreamer v3 — Devnet deployment (2026-06-16)
// All deployment-specific IDs live here. Update on every redeployment.

export const SUBSCRIPTION_DEVNET_PACKAGE_ID = "0x877e4310138665b821d0d03aa61efcf98e0bdfa32a4cc32674f58c2ac0c26473";
export const SUBSCRIPTION_TESTNET_PACKAGE_ID = undefined;
export const SUBSCRIPTION_MAINNET_PACKAGE_ID = undefined;


export const COIN_TYPE_REGISTRY_ID = "0x2f7bc0af8c20cff6e772d3d411cc018550b958f1574f52d0d3c152f373ffd618";
export const COIN_TYPE_REGISTRY_INIT_VERSION = 254755;

export const PAYMENT_SCHEDULER_ID = "0x4d526187e4157fe58f2fc7111a733c3e9f419e7cd23dd528993d87e54a4eacda";
export const PAYMENT_SCHEDULER_INIT_VERSION = 254755;

export const ACCESS_CONTROL_ID = "0x5b1bb002d8133a91002ffab3f6b2f9118703931685c78cccd793b8e929339e60";

export const NETWORK = "devnet";
export const GRAPHQL_URL = "https://fullnode.devnet.sui.io:443/graphql";
export const SUI_TYPE_ARG = "0x2::sui::SUI";
export const CLOCK_OBJECT_ID = "0x0000000000000000000000000000000000000000000000000000000000000006";

export const PUSD_DEVNET_PACKAGE_ID = "0xc74cc40df740034795a0c27524b499c330e619e2406263f37d8b67b1f824f6fa";
export const PUSD_TYPE_ARG = `${PUSD_DEVNET_PACKAGE_ID}::pusd::PUSD`;

// Demo-only: the set of denominations the UI is allowed to render.
export const DEMO_DENOMINATIONS: string[] = [PUSD_TYPE_ARG];

export const DEMO_PLATFORM_ID = "0xb84f8a6d57a20e605581a29342124762f2ac10c8c6d9f305a83edca5e7440aec";
export const DEMO_PLATFORM_INIT_VERSION = 1491862;
