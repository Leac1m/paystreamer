[🏠 Root](../README.md) > ⛓️ Move Smart Contracts

# PayStreamer Smart Contracts (`/move`)

This directory contains the core on-chain logic for PayStreamer, written in Sui Move (2024 Edition).

## Directory Map

* 🔗 **[Subscriptions Protocol (`/move/subscriptions`)](./subscriptions/README.md)**: The core PayStreamer subscription protocol, implementing the OpenZeppelin rate limiter to enforce time-based billing policies safely.
* 🔗 **[Stablecoin (`/move/stablecoin`)](./stablecoin/README.md)**: A mock `PUSD` fungible token package used strictly for end-to-end testing and the live demo environment.

This directory contains the Move smart contracts for the PayStreamer decentralized subscription protocol on the Sui network.

## Package Architecture

The protocol is built using a highly modular architecture that splits responsibilities across the core package:

- **`subscriptions`**: The primary smart contract package that handles platforms, subscription tiers, subscriber accounts, payment processing, billing logic, and protocol registries.

## Core Concepts

The architecture relies heavily on Sui's object-centric model:

1. **Platform Objects (`Platform`)**: Shared objects that represent a merchant or SaaS company. They store `SubscriptionTier` configurations and treasury details.
2. **Subscription Accounts (`SubscriptionAccount<T>`)**: Shared objects owned by the subscriber (via `AccountCap`), holding deposited funds (Coins of type `T`) and their individual `Subscription` records.
3. **Schedulers (`PaymentScheduler`)**: Authorized backend services that can trigger payments when they are due.
4. **Registry (`Registry`)**: The central protocol registry that routes and tracks funds, including protocol fees.

## Build and Test

```bash
# To test the contracts:
cd subscriptions
sui move test

# To build the contracts:
sui move build
```
