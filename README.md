# PayStreamer | Accept Crypto Subscriptions on Autopilot

Stop losing MRR to manual payments. Let your customers connect their wallet once and get billed automatically in stablecoins on the [Sui](https://sui.io/) blockchain. Integrate in an afternoon.

PayStreamer is a Web3 billing infrastructure that allows digital platforms to accept, manage, and automate recurring cryptocurrency subscriptions seamlessly.

## v2 — what shipped recently

The `feature/v2-core` branch contains a clean rewrite of the contract suite. See [`docs/architecture-v2.md`](docs/architecture-v2.md) for the design and [`docs/v2-build-log.md`](docs/v2-build-log.md) for the build session.

- 10 Move modules (`move/subscriptions_v2/`) — OZ AccessControl + RateLimiter, on-chain permissionless scheduler, BalanceContainer seam for future confidential transfers, agentic-commerce permission seam
- 73 / 73 unit tests pass
- Published to Sui devnet (package `0xe4928343c89668936e3bac1daf786ca7ba1ab295489921caf4894f5a7a3694ca`)
- E2E script at `scripts/v2/e2e-payment-cycle.ts` exercises 4 of the 9 steps on devnet today (Step 3's enum-encoding issue is a known SDK gap, documented)

## v1 (this branch's `main`) — original MVP

The `main` branch is the original MVP that was published to devnet (package `0xd2ddd9bd521bde4137d6b27312c73216924b8661420b25c1c37737c4bc43b76e`).

## The Problem

Web3 businesses run on MRR, but blockchains weren't built for recurring payments. Stop making your users manually sign a transaction every 30 days. Stop losing 3% to traditional credit card processors or suffering massive churn because users forget to pay.

## How It Works

- **Connect:** Integrate our API and smart contracts into your existing platform.
- **Subscribe:** Customers approve a spending limit with a single wallet signature.
- **Collect:** Our automated scheduler executes the payments automatically every billing cycle.

## Key Benefits

- **One-Time Wallet Approval:** Users sign a contract once; payments are pulled automatically thereafter.
- **Stablecoin Settlement:** Subscriptions are priced and settled in USDC/USDSui.
- **Zero Chargebacks:** Transactions are final.
- **Global Reach:** Accept payments from anyone with a wallet, bypassing regional banking restrictions.

## Architecture

Two contract packages side by side:
1. **v1** (this README's content, `move/subscriptions/`) — the published MVP, 3 modules, custom capabilities.
2. **v2** (`move/subscriptions_v2/`, branch `feature/v2-core`) — the OZ-based refactor, 10 modules. See `docs/architecture-v2.md`.

Frontend dApp: React, Vite, Tailwind CSS v4, `@mysten/dapp-kit-react`.

---

## Setup and Installation

### Prerequisites

- [Node.js](https://nodejs.org/en/) & [pnpm](https://pnpm.io/)
- [Sui CLI](https://docs.sui.io/build/install)

### 1. Smart Contract Deployment

To run the application, you first need to deploy the Move contracts to a Sui network (Devnet is used by default).

```bash
# Setup a Devnet environment if you haven't already
sui client new-env --alias devnet --rpc https://fullnode.devnet.sui.io:443
sui client switch --env devnet

# Request test tokens
sui client faucet

# Publish the package
cd move/subscriptions
sui client publish --gas-budget 100000000 --skip-dependency-verification
```

Take note of the `"packageId"` in the output and update `src/constants.ts`:

```typescript
export const DEVNET_SUBSCRIPTIONS_PACKAGE_ID = "<YOUR_NEW_PACKAGE_ID>";
```

### 2. Frontend Setup

Install dependencies and start the development server:

```bash
pnpm install
pnpm dev
```

### 3. Running the Scheduler (For Platform Owners)

The off-chain scheduler automatically processes subscriptions that are due for billing.

1. Put a real `SCHEDULER_SECRET` value in the project root `.env` file.
2. Authorize the scheduler's wallet address in the Platform Owner Dashboard UI.
3. Run the scheduler:

```bash
npx ts-node scripts/scheduler.ts
```

---

## Customization

This template utilizes [Tailwind CSS v4](https://tailwindcss.com/) and patterns from [shadcn/ui](https://ui.shadcn.com/). You can modify components in `src/components/ui/` or add new ones to expand the application's functionality.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
