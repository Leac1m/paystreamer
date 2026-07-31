[🏠 Root](../../README.md) > [📦 Apps](../README.md) > ⛽ Sponsor

# PayStreamer Gas Sponsor Service

The Sponsor service is a Node.js API backend that enables gasless transactions on the Sui network for PayStreamer users.

## Why Sponsored Transactions?

A major friction point in Web3 onboarding is requiring users to acquire native gas tokens (e.g., SUI) before they can interact with a smart contract. For a subscription protocol aiming to rival Web2 credit card UX, this is unacceptable.

Sui natively supports **Sponsored Transactions**. This backend service operates as a "Gas Station". When a user builds a subscription transaction in the `portal` or `checkout` app, they sign the transaction *without* paying gas, and forward that signature to this API. 

This backend takes their transaction, adds its own gas coin via a dedicated `SPONSOR_PRIVATE_KEY`, signs it, and broadcasts the fully sponsored transaction to the blockchain.

## Architecture

* **Framework:** Node.js + Express
* **Integration:** Interacts heavily with `@mysten/sui` and the PayStreamer SDK for transaction decoding and signature validation.

## Local Development

Ensure you have a funded testnet/devnet address configured in the root `.env` as `SPONSOR_PRIVATE_KEY`.

```bash
cd apps/sponsor
npm install
npm run dev
```
