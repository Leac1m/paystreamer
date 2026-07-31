[🏠 Root](../../README.md) > [📦 Apps](../README.md) > 🛒 Checkout

# PayStreamer Checkout Widget

The Checkout app is a highly optimized, lightweight Next.js application designed to be embedded into third-party websites (via iframe) or used as a standalone redirect page.

## Purpose

Instead of forcing a third-party developer to integrate the entire `@paystreamer/sdk` and handle wallet connections directly on their own site, they can simply redirect their users to `checkout.usepaystreamer.xyz/?platformId=...&tierId=...`.

The Checkout app handles:
1. Connecting the user's Sui wallet (or utilizing gasless sponsored transactions).
2. Verifying the user has a sufficient `SubscriptionAccount` balance.
3. Building and executing the subscription PTB (Programmable Transaction Block).
4. Redirecting the user back to the platform's success URL.

## Architecture

* **Framework:** Next.js (App Router) + React
* **Dependencies:** `@paystreamer/sdk` for all transaction building logic.
* **Wallet Context:** Connects to `@mysten/dapp-kit` for wallet lifecycle management.

## Development

```bash
cd apps/checkout
pnpm dev
```
