// PayStreamer v3 — Devnet deployment (2026-06-16)
// All deployment-specific IDs live here. Update on every redeployment.

export const PACKAGE_ID = "0x877e4310138665b821d0d03aa61efcf98e0bdfa32a4cc32674f58c2ac0c26473";

export const COIN_TYPE_REGISTRY_ID = "0x2f7bc0af8c20cff6e772d3d411cc018550b958f1574f52d0d3c152f373ffd618";
export const COIN_TYPE_REGISTRY_INIT_VERSION = 254755;

export const PAYMENT_SCHEDULER_ID = "0x4d526187e4157fe58f2fc7111a733c3e9f419e7cd23dd528993d87e54a4eacda";
export const PAYMENT_SCHEDULER_INIT_VERSION = 254755;

export const ACCESS_CONTROL_ID = "0x5b1bb002d8133a91002ffab3f6b2f9118703931685c78cccd793b8e929339e60";

export const GRAPHQL_URL = "https://fullnode.devnet.sui.io:443/graphql";
export const SUI_TYPE_ARG = "0x2::sui::SUI";
export const CLOCK_OBJECT_ID = "0x0000000000000000000000000000000000000000000000000000000000000006";

export const PUSD_PACKAGE_ID = "0xc74cc40df740034795a0c27524b499c330e619e2406263f37d8b67b1f824f6fa";
export const PUSD_TYPE_ARG = `${PUSD_PACKAGE_ID}::pusd::PUSD`;

// Demo-only: the set of denominations the UI is allowed to render.
export const DEMO_DENOMINATIONS: string[] = [PUSD_TYPE_ARG];

export const DEMO_PLATFORM_ID = "0xb84f8a6d57a20e605581a29342124762f2ac10c8c6d9f305a83edca5e7440aec";
export const DEMO_PLATFORM_INIT_VERSION = 1491862;

// Legacy package IDs (used for reading historical data)
export const DEVNET_V2_PACKAGE_ID = "0xebe2028a1ebc2608f3968a5ef33533377f9284e007afb9f5267c0fd96de603b3";
export const TESTNET_V2_PACKAGE_ID = "0xc1973975ba135ad9c1be3d36c518726e8bd61d06ecf4a06a5278171a35c240f1";
export const MAINNET_V2_PACKAGE_ID = undefined;

// Counter package IDs
export const DEVNET_COUNTER_PACKAGE_ID: string | undefined = undefined;
export const TESTNET_COUNTER_PACKAGE_ID = "0xb36f813e3c9f2b3d25461a9f0695dc44922cd99f94ca519c244778bbc75ec0c1";
export const MAINNET_COUNTER_PACKAGE_ID: string | undefined = undefined;

// Subscriptions package IDs (legacy)
export const DEVNET_SUBSCRIPTIONS_PACKAGE_ID: string | undefined = "0xd2ddd9bd521bde4137d6b27312c73216924b8661420b25c1c37737c4bc43b76e";
export const TESTNET_SUBSCRIPTIONS_PACKAGE_ID: string | undefined = undefined;
export const MAINNET_SUBSCRIPTIONS_PACKAGE_ID: string | undefined = undefined;
