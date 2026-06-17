// PayStreamer v3 — Devnet deployment (2026-06-16)
// All deployment-specific IDs live here. Update on every redeployment.

export const SUBSCRIPTION_DEVNET_PACKAGE_ID = "0xf310efaea5adf4bba799c3628563f8c6e0c9677785dca6d7865744e4a3b80afb";
export const SUBSCRIPTION_TESTNET_PACKAGE_ID = undefined;
export const SUBSCRIPTION_MAINNET_PACKAGE_ID = undefined;


export const COIN_TYPE_REGISTRY_ID = "0x076e62b38cbe903413cb7ee9a177eef0c593a9bac40d0dcdbc7d46315af65639";
export const COIN_TYPE_REGISTRY_INIT_VERSION = 14;

export const PAYMENT_SCHEDULER_ID = "0x09d3b621355da923e9076fa95a8ff253331b44b8a0f4fa61b0ca51878b1d1c4e";
export const PAYMENT_SCHEDULER_INIT_VERSION = 14;

export const ACCESS_CONTROL_ID = "0x938eebde0b5cab85934b0875b34b1854181ceb62437de22af177880abe312a97";

export const NETWORK = "devnet";
export const GRAPHQL_URL = "https://fullnode.devnet.sui.io:443/graphql";
export const SUI_TYPE_ARG = "0x2::sui::SUI";
export const CLOCK_OBJECT_ID = "0x0000000000000000000000000000000000000000000000000000000000000006";

export const PUSD_DEVNET_PACKAGE_ID = "0x7b09f1813d3e96e7759983486e40b4ec4ac32dc802095cbe9ff384d421383160";
export const PUSD_TYPE_ARG = `${PUSD_DEVNET_PACKAGE_ID}::pusd::PUSD`;
export const PUSD_TREASURY_CAP_ID = "0xf04e1201cc50fa5401c2d3c37ac7284873282e7bfd3c6a7885f6f6989aebb68a";
export const PUSD_TREASURY_CAP_INIT_VERSION = 15;

// Demo-only: the set of denominations the UI is allowed to render.
export const DEMO_DENOMINATIONS: string[] = [PUSD_TYPE_ARG];

export const DEMO_PLATFORM_ID = "0x1240aa8e48d2df02ff25a359b3b83bc04c749aa6234a9234193f5c0d9903d746";
export const DEMO_PLATFORM_INIT_VERSION = 3233540;
