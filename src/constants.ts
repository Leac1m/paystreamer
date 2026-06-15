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

// USDC and USDSui are not yet registered on this network — selecting them
// will abort with ECoinTypeNotRegistered. Hidden in the UI for the demo.
// To re-enable: register the coin type via registry::register_coin_type<USDC>
// and replace the hex strings below with the real package::module::Type.
export const USDC_TYPE_ARG = "0x5d4b5a3d8c9f7b6e4a1c3d9e8f2a4b7c6d8e1f3a5b7c9d2e4f6a8b1c3d5e7f9::usdc::USDC"; // PLACEHOLDER — not registered
export const USDSUI_TYPE_ARG = "0x5d4b5a3d8c9f7b6e4a1c3d9e8f2a4b7c6d8e1f3a5b7c9d2e4f6a8b1c3d5e7f9::usdsui::USDSui"; // PLACEHOLDER — not registered

// Demo-only: the set of denominations the UI is allowed to render.
// USDC and USDSui are excluded because they are not registered on the
// target network (see comment above). To re-enable them, add their
// type-arg constants to this list once they are registered on chain.
export const DEMO_DENOMINATIONS: string[] = [SUI_TYPE_ARG];

export const DEVNET_COUNTER_PACKAGE_ID: string | undefined = undefined;
export const TESTNET_COUNTER_PACKAGE_ID: string | undefined = "0xb36f813e3c9f2b3d25461a9f0695dc44922cd99f94ca519c244778bbc75ec0c1";
export const MAINNET_COUNTER_PACKAGE_ID: string | undefined = undefined;

export const DEVNET_SUBSCRIPTIONS_PACKAGE_ID: string | undefined = "0xd2ddd9bd521bde4137d6b27312c73216924b8661420b25c1c37737c4bc43b76e";
export const TESTNET_SUBSCRIPTIONS_PACKAGE_ID: string | undefined = undefined;
export const MAINNET_SUBSCRIPTIONS_PACKAGE_ID: string | undefined = undefined;

// Populated by `pnpm seed:demo` (Phase 2.1). When undefined, the demo CTAs
// on the landing and explore pages are hidden.
export const DEMO_PLATFORM_ID: string | undefined = "0xbacdef263862483c96eaafc38441d892e49d8ac3ee40557523e52a90c71f7ee0"; // populated by pnpm seed:demo // populated by pnpm seed:demo
export const DEMO_PLATFORM_INIT_VERSION: number | undefined = 254751; // populated by pnpm seed:demo // populated by pnpm seed:demo
