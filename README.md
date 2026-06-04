# PayStreamer

PayStreamer is a decentralized subscription and payment streaming platform built on the [Sui](https://sui.io/) blockchain. It enables users to browse subscription platforms, manage active subscriptions, and empowers platform owners to register their services, define pricing tiers, and securely schedule automated withdrawals to their designated treasuries.

## Features

- **Platform Discovery**: Browse registered platforms on the Sui network using an event-based indexing approach.
- **My Subscriptions Dashboard**: Track active subscriptions, next billing dates, and overall spending directly from your wallet context.
- **Platform Owner Dashboard**: 
  - Register new platforms and categorize them.
  - Define custom subscription tiers (Daily, Weekly, Monthly, Yearly).
  - Configure a platform treasury address for routing funds.
  - Authorize third-party schedulers to trigger batch withdrawals automatically.
- **Off-Chain Schedulers**: A robust Node.js script that polls the network, processes due subscriptions, and executes secure batch withdrawals via delegated `SchedulerCap` objects.

## Architecture

The project is divided into two primary components:
1. **Frontend dApp**: Built with React, Vite, Tailwind CSS v4, and `@mysten/dapp-kit-react`.
2. **Move Smart Contracts**: Located in `move/subscriptions`, handling on-chain logic, policy configurations, balance holds, and secure fund routing.

### Key Smart Contract Concepts

- **SubscriptionAccount**: A shared object holding the user's stablecoin balance, withdrawal policies, and a `VecMap` of active subscriptions.
- **Platform**: A shared object containing metadata, tiers, and the designated `treasury` address.
- **PlatformOwnerCap / SchedulerCap**: Capability objects used to authorize management updates and trigger withdrawals.

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
