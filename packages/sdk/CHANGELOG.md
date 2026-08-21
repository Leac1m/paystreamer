# Changelog

All notable changes to `@paystreamer/sdk` are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## 0.3.0

### Added
- Multi-token routing via DeepBook (`@paystreamer/sdk/core/deepbook`): `createDeepBookClient`, `swapExactQuantity`, plus `buildProcessRoutedPaymentTx` and `buildOnboardWithSwapTx` transaction builders. Lets accounts pay or bill in a token other than the platform's settlement currency, converted in the same PTB.
- Seal integration (`@paystreamer/sdk/core/seal`): `createSealClient`, `encryptForPolicy`, `createSealSessionKey`, `decryptWithPolicy` — for platforms gating decrypted content on real on-chain subscription status via `account::has_active_subscription`.
- Walrus integration (`@paystreamer/sdk/core/walrus`): `createWalrusClient`, `uploadContent`, `downloadContent`.
- `SetupSubscriptionModal` now has an inline "Mint Test PUSD" action when the connected wallet's balance is insufficient, instead of leaving the user stuck.
- A full TypeDoc reference, generated from source and published at [docs.usepaystreamer.xyz/typedoc](https://docs.usepaystreamer.xyz/typedoc).
- Comprehensive documentation: a Core API Reference for all transaction builders and chain queries, a Register Your Platform guide, a Gas Sponsorship service reference, and a full Move error-code reference — most of `@paystreamer/sdk/core`'s surface area had no documentation at all before this release.

### Fixed
- `queryPlatform`/`usePlatform` now correctly unwrap the Move `VecMap` shape for a platform's `tiers` (`{ contents: [...] }`, not a plain array) — this was silently showing $0.00 tier amounts.
- `querySubscriptionCreatedEvents`, `...ByPlatform`, and `querySubscriptionUpdatedEventsByPlatform` queried a `billing::` module that no longer exists in the contract — they always silently returned an empty array. Now correctly query `subscription::SubscriptionCreated`/`SubscriptionUpdated`.
- `useMintTestPusd` uses `tx.sharedObjectRef(...)` for the PUSD `TreasuryCap` (a shared object) instead of `tx.object(...)`.
- Peer dependencies (`@mysten/sui`, `@mysten/dapp-kit-react`, `@tanstack/react-query`) are now pinned to a tested, published compatibility matrix (see README) instead of loose ranges that could silently resolve untested versions.
- All data fetching migrated from GraphQL to gRPC (`SuiGrpcClient`) — `getGraphQLClient` and related GraphQL-based query functions are gone.

### Changed
- **Potentially breaking if you imported the optional integrations early**: `core/seal.ts`, `core/deepbook.ts`, and `core/walrus.ts` are no longer re-exported from `@paystreamer/sdk/core`. Each is its own subpath (`@paystreamer/sdk/core/seal`, `.../core/deepbook`, `.../core/walrus`) behind its own optional peer dependency. Importing any of them from the shared `core` barrel made every consumer's bundler resolve `@mysten/seal`/`@mysten/deepbook-v3`/`@mysten/walrus` even when unused — this broke real production builds. If you were importing these (only possible against an unpublished/local build, since this split landed before this package version was ever published), update the import path.
- `@mysten/deepbook-v3` and `@mysten/walrus` added as optional peer dependencies, alongside the existing optional `@mysten/seal`.

## 0.2.0
Peer dependency pinning and README/compatibility-matrix updates.

## 0.1.1
Initial README and version housekeeping.

## 0.1.0
First published release.
