[🏠 Root](../../README.md) > [⛓️ Move Smart Contracts](../README.md) > 💵 Stablecoin

# PayStreamer PUSD Stablecoin

This package contains the `PUSD` (PayStreamer USD) Move smart contract. 

## Purpose

The `PUSD` package is a basic implementation of a Sui `Coin<T>`. It is strictly used for testing and for the Live Demo platform on Testnet/Devnet. 

Because PayStreamer is token-agnostic, users can subscribe to platforms using any supported asset (e.g., USDC, USDT, SUI). However, to provide a frictionless live demo without requiring users to acquire real testnet USDC, we created `PUSD` so the frontend apps and test scripts can mint infinite demo tokens on demand.

## Architecture

* **Treasury Cap:** Upon publishing, a `TreasuryCap<PUSD>` is created and made publicly shared, allowing anyone to mint `PUSD` for testing purposes via the SDK's `mintDemoPUSD` function.
* **Coin Metadata:** Registers the name, symbol (PUSD), and decimals for the coin.
