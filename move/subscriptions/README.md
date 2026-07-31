# PayStreamer Subscriptions Package

This package (`subscriptions`) contains the core smart contracts for the PayStreamer decentralized subscription protocol on the Sui network. 

## Module Breakdown

The contract is broken down into several distinct modules to separate concerns, facilitate testing, and ensure secure state management:

### 1. `account` (`subscriptions::account`)
Manages `SubscriptionAccount<T>` objects, which hold deposited funds (Coins of type `T`) on behalf of a user. It handles deposits, withdrawals, pausing/resuming the account, and applying limits/policies. Accounts are shared objects, but administrative actions require the matching `AccountCap`.

### 2. `platform` (`subscriptions::platform`)
Manages `Platform` objects which represent a business or merchant. Platforms contain the `SubscriptionTier` configurations (prices, billing cycles) and the treasury address where collected funds are sent.

### 3. `subscription` (`subscriptions::subscription`)
Defines the core `Subscription` data structure that tracks the state of an individual user's subscription to a specific tier (start time, next billing cycle, tier index). It also manages recording successful and failed payments.

### 4. `registry` (`subscriptions::registry`)
The protocol-level registry that tracks protocol fees, global state, and acts as the central router for processing due payments between `SubscriptionAccount` and `Platform` treasuries.

### 5. `scheduler` (`subscriptions::scheduler`)
Manages `PaymentScheduler` objects, which are authorized capabilities used by off-chain backend workers to submit `process_due_payment` transactions. This ensures only whitelisted node operators can trigger automated billing cycles.

### 6. `payment` (`subscriptions::payment`)
Internal logic for managing the atomic routing of funds from a subscriber's account to a platform's treasury and the protocol fee pool, using hot potatoes (`RoutingPotato`) to ensure funds are never lost in transit.

### 7. `policies` (`subscriptions::policies`)
Defines the `PolicySet` and `PolicyLimiters` structures that allow users to define strict spending limits (e.g. max spend per epoch) and merchant whitelists/blacklists to protect their deposited funds.

## Key Transaction Flows

- **Creating an Account**: A user deposits funds into a new `SubscriptionAccount<T>` and receives an `AccountCap`.
- **Subscribing**: A user calls `setup_subscription` using their `AccountCap` to create a `Subscription` record linked to a `Platform` and a `SubscriptionTier`.
- **Billing**: The off-chain scheduler calls `process_due_payment`. The contract checks if the subscription is due, calculates the required payment, deducts it from the `SubscriptionAccount`, routes it to the `Platform` treasury (minus protocol fees), and updates the next billing cycle.

## Notes
*This package uses the 2024 Move edition.*
