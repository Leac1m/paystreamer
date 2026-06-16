export const DEVNET_V3_PACKAGE_ID = "0x877e4310138665b821d0d03aa61efcf98e0bdfa32a4cc32674f58c2ac0c26473";
export const V3_PACKAGE_ID = DEVNET_V3_PACKAGE_ID;
export const TESTNET_V3_PACKAGE_ID = ""; // TODO: fill after testnet deployment
export const MAINNET_V3_PACKAGE_ID = undefined;
export const DEVNET_V2_PACKAGE_ID = "0xebe2028a1ebc2608f3968a5ef33533377f9284e007afb9f5267c0fd96de603b3";
export const V2_PACKAGE_ID = DEVNET_V2_PACKAGE_ID;
export const TESTNET_V2_PACKAGE_ID = "0xc1973975ba135ad9c1be3d36c518726e8bd61d06ecf4a06a5278171a35c240f1";
export const MAINNET_V2_PACKAGE_ID = undefined;

export const DEVNET_PAYMENT_SCHEDULER_ID = "0x68586ed1a6550ad68e03ed5d9acd9148572091156a685e788d261db6838dea6b";
export const V2_PAYMENT_SCHEDULER_ID = DEVNET_PAYMENT_SCHEDULER_ID;
export const DEVNET_PAYMENT_SCHEDULER_INIT_VERSION = 7;
export const V2_PAYMENT_SCHEDULER_INIT_VERSION = DEVNET_PAYMENT_SCHEDULER_INIT_VERSION;
export const DEVNET_COIN_TYPE_REGISTRY_ID = "0xa76da23119ccd31be762209068cb35e6bf817ac7dfbf4ac51de19dedc47fed77";
export const DEVNET_COIN_TYPE_REGISTRY_INIT_VERSION = 7;
export const DEVNET_ACCESS_CONTROL_ID = "0xb5ad97f909a765fa03c5989848fae4cf956cfaba2b36e933a36a5cdb793940b0";

export const TESTNET_PAYMENT_SCHEDULER_ID = "0x588b90fb769f96c086af23cfa6664c74396c63b3a9e5a2973e31ae97aca26be5";
export const TESTNET_COIN_TYPE_REGISTRY_ID = "0xab372a141068d9677bcc14996e95948c4b9c85686e0c04232885333dfdc917b6";
export const TESTNET_ACCESS_CONTROL_ID = "0xc47301608c8728efe3ba6b66eb719e0a780300dfcf83671e23d4bc4c577c88ad";

export const MAINNET_PAYMENT_SCHEDULER_ID = undefined;
export const MAINNET_COIN_TYPE_REGISTRY_ID = undefined;
export const MAINNET_ACCESS_CONTROL_ID = undefined;

export const GRAPHQL_URL = "https://fullnode.devnet.sui.io:443/graphql";
export const SUI_TYPE_ARG = "0x2::sui::SUI";
export const CLOCK_OBJECT_ID = "0x0000000000000000000000000000000000000000000000000000000000000006";

// PUSD stablecoin — deployed from move/stablecoin
export const PUSD_PACKAGE_ID = "0xc74cc40df740034795a0c27524b499c330e619e2406263f37d8b67b1f824f6fa";
export const PUSD_TYPE_ARG = `${PUSD_PACKAGE_ID}::pusd::PUSD`;

// Demo-only: the set of denominations the UI is allowed to render.
// PUSD is the only payment denomination in v3.
export const DEMO_DENOMINATIONS: string[] = [PUSD_TYPE_ARG];

export const DEVNET_COUNTER_PACKAGE_ID: string | undefined = undefined;
export const TESTNET_COUNTER_PACKAGE_ID: string | undefined = "0xb36f813e3c9f2b3d25461a9f0695dc44922cd99f94ca519c244778bbc75ec0c1";
export const MAINNET_COUNTER_PACKAGE_ID: string | undefined = undefined;

export const DEVNET_SUBSCRIPTIONS_PACKAGE_ID: string | undefined = "0xd2ddd9bd521bde4137d6b27312c73216924b8661420b25c1c37737c4bc43b76e";
export const TESTNET_SUBSCRIPTIONS_PACKAGE_ID: string | undefined = undefined;
export const MAINNET_SUBSCRIPTIONS_PACKAGE_ID: string | undefined = undefined;

// Populated by `pnpm seed:demo` (Phase 2.1). When undefined, the demo CTAs
// on the landing and explore pages are hidden.
export const DEMO_PLATFORM_ID: string | undefined = "0xb84f8a6d57a20e605581a29342124762f2ac10c8c6d9f305a83edca5e7440aec"; // populated by pnpm seed:demo // populated by pnpm seed:demo // populated by pnpm seed:demo
export const DEMO_PLATFORM_INIT_VERSION: number | undefined = 1491862; // populated by pnpm seed:demo // populated by pnpm seed:demo // populated by pnpm seed:demo
