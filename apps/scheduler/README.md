[🏠 Root](../../README.md) > [📦 Apps](../README.md) > ⏰ Scheduler

# PayStreamer Scheduler Worker

The Scheduler is a decentralized, permissionless Node.js backend worker that automates the execution of recurring payments on the Sui blockchain.

## Why is it needed?

Smart contracts on Sui (and most blockchains) cannot execute themselves automatically at intervals (like a cron job). They require an external transaction to trigger the logic. 

In the PayStreamer protocol, *anyone* can run a Scheduler. The Scheduler constantly queries the blockchain (via GraphQL) to find subscriptions that have passed their billing due date. It then submits a `process_due_payment` transaction to the smart contract. 

**Crucially, the Scheduler does NOT custody funds or hold private keys to user accounts.** It simply acts as a messenger telling the smart contract, "Hey, it's time to check if this user owes money." The smart contract independently verifies the OpenZeppelin `rate_limiter` policy before moving any tokens.

## Architecture

* **Environment:** Node.js (TypeScript)
* **On-Chain Querying:** Utilizes `@paystreamer/sdk` and `SuiGraphQLClient` to efficiently index active subscriptions.
* **Execution:** Signs transactions using a dedicated `SCHEDULER_PRIVATE_KEY` and broadcasts them via the Sui RPC.

## Deployment

The scheduler is designed to be deployed as a background worker on platforms like DigitalOcean App Platform or Render.

```bash
# In DigitalOcean App Platform, configure a Background Worker:
# Source Directory: /
# Build Command: npm i -g pnpm && pnpm install && pnpm --filter scheduler... build
# Run Command: pnpm --filter scheduler start
```

## Local Development

You must provide a `SCHEDULER_PRIVATE_KEY` in the root `.env` file to pay for the minimal gas fees required to submit the trigger transactions.

There is **no default key**, deliberately — a missing signing key stops the process rather than silently signing as somebody else. Generate and export one:

```sh
sui client new-address ed25519 my-scheduler
sui client switch --env testnet
sui keytool export --key-identity <address>
```

Put the resulting `suiprivkey1...` in the root `.env` and fund that address with a little SUI. Never commit it — `.env` is gitignored.

```bash
cd apps/scheduler
pnpm dev
```
