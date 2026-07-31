[🏠 Root](../../README.md) > [📦 Apps](../README.md) > 🌐 Portal

# PayStreamer Portal

The Portal is the flagship decentralized application (DApp) for the PayStreamer ecosystem. It acts as a dual-sided marketplace dashboard for both consumers (subscribers) and businesses (creators/platforms).

## Features

### For Consumers (Subscribers)
- **Dashboard:** View all active, paused, and cancelled subscriptions across the ecosystem.
- **Deposit/Withdraw:** Fund their universal `SubscriptionAccount` with supported stablecoins or withdraw excess balance.
- **Manage Policies:** Modify or revoke time-based subscription policies to guarantee platforms cannot overcharge them.

### For Platforms (Creators/Businesses)
- **Registration:** Register a new platform on-chain to start accepting PayStreamer subscriptions.
- **Tier Management:** Define pricing tiers (e.g., "$10/month Basic", "$30/month Pro").
- **Treasury:** View total revenue pulled from subscribers and manually withdraw funds from the platform treasury if needed (though the Scheduler usually handles this).

## Architecture

* **Framework:** Next.js (App Router) + React
* **Styling:** Tailwind CSS + shadcn/ui components
* **Wallet Connection:** `@mysten/dapp-kit` integration configured to support sponsored transactions.
* **Smart Contract Interactions:** Strictly utilizes `@paystreamer/sdk` for all blockchain queries and transactions. The portal does not use raw Sui RPC calls or custom GraphQL schemas; everything is abstracted by the SDK.

## Development

```bash
cd apps/portal
pnpm dev
```
