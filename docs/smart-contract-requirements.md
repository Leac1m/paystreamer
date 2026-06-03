# Sui Subscriptions - Smart Contract Requirements Document

**Version**: 1.0.0
**Last Updated**: 2024
**Project**: Decentralized Subscription Payments on Sui Blockchain
**Audience**: SUI Smart Contract Engineers, Blockchain Developers
**Status**: Draft - Pending Implementation

---

## 1. Executive Summary

This document provides comprehensive requirements for the Sui Move smart contracts that power the Sui Subscriptions platform. The smart contract layer forms the foundational infrastructure enabling users to manage subscription payments through a secure, programmable account system built on Sui's object-capability model.

The subscription system consists of three primary smart contracts that manage the complete lifecycle of decentralized subscription payments. Users fund subscription accounts with stablecoins and define withdrawal policies that control when and how much platforms can automatically withdraw. The contracts enforce all policy constraints at the blockchain level, ensuring that platforms cannot exceed user-defined limits regardless of client-side logic or server implementations.

The design leverages Sui's unique features including shared objects for efficient concurrent access, object-capability security for fine-grained permissions, and gasless transaction sponsoring for a seamless user experience. All monetary operations handle stablecoin types (USDC and USDSui) with proper decimal handling and overflow protection.

---

## 2. System Architecture Overview

### 2.1 Contract Hierarchy

The smart contract system consists of three primary modules deployed as a single package under the package ID `0xSUBSCRIPTIONS`. Each module encapsulates specific domain logic while maintaining clear boundaries of responsibility. Cross-module communication occurs through well-defined interface functions that enforce all security constraints at the point of interaction.

The subscription account module serves as the central component managing user accounts, balances, and policy enforcement. The platform registry module handles platform registration, authorization, and withdrawal operations. The subscription manager module coordinates the lifecycle of individual subscriptions including creation, modification, and cancellation. Type definitions are distributed across modules rather than centralized.

### 2.2 Object Model

The object model follows Sui's object-capability pattern where objects contain both data and the authority to perform operations. Each object type has a corresponding capability object that grants specific permissions to holders. This design ensures that capabilities can be transferred independently from the objects they govern, enabling sophisticated permission delegation while maintaining strict security boundaries.

The `SubscriptionAccount` object serves as the primary user-facing object, storing the account balance, policy configuration, and list of authorized platforms. Each account object has an associated `AccountCap` capability that grants the holder authority to modify policies, authorize platforms, and manage the account. The `PlatformCap` capability grants platforms the authority to withdraw funds within the constraints defined by the account's policies.

Individual subscriptions are represented as child objects of the subscription account, with each subscription maintaining its own state including the platform reference, tier information, and billing schedule. This child object pattern ensures that subscription data remains bound to its parent account while enabling efficient enumeration and management operations.

### 2.3 Security Model

Security is enforced through multiple layers of protection. At the object level, capability objects control access to sensitive operations. At the function level, entry points verify caller permissions before executing state-changing operations. At the application level, policy validation ensures that all withdrawal operations respect user-defined constraints.

The principle of least privilege guides the security design, with each capability granting only the minimum permissions required for its intended use. Platform capabilities cannot modify policies or access account metadata. Account capabilities cannot initiate withdrawals on behalf of platforms. These restrictions are enforced by the smart contract code and cannot be bypassed through any client-side logic.

---

## 3. Module Specifications

### 3.1 Module: `subscription_account`

**Package**: `0xSUBSCRIPTIONS`
**Module ID**: `subscription_account`
**Purpose**: Core account management, balance operations, and policy enforcement

The subscription account module implements the foundational account infrastructure that enables users to manage their subscription payment funds. Each account maintains a balance in a specified stablecoin type, a complete policy configuration defining withdrawal constraints, and an authorization registry tracking which platforms have withdrawal permissions. The module enforces all policy constraints at the contract level, ensuring that no withdrawal operation can exceed the limits defined by the account owner.

**Local Types:**
- `USDC`, `USDSui` — stablecoin type tags for type-gated accounts
- `AccountStatus` — account lifecycle state (ACTIVE, PAUSED, CLOSED)
- `BillingFrequency` — billing cycle options (DAILY, WEEKLY, MONTHLY, etc.)
- Error constants for policy violations (E_POLICY_EXCEEDED_MONTHLY, etc.)

#### 3.1.1 Data Structures

The `SubscriptionAccount` shared object represents a single user's subscription account. This object is shared to enable concurrent access by both the account owner and authorized platforms during withdrawal operations. The object contains all account state including the balance, policy configuration, and authorization list.

```move
/// Represents a user's subscription account holding stablecoin funds and policy configuration.
/// This is a shared object enabling concurrent access for deposits and withdrawals.
public struct SubscriptionAccount has key, store {
    /// Unique identifier for this account
    id: UID,
    /// Supported stablecoin type (USDC or USDSui)
    stablecoin_type: StablecoinType,
    /// Current balance in smallest unit (6 decimals for USDC)
    balance: u64,
    /// Withdrawal policy configuration
    policies: PolicyConfig,
    /// List of authorized platform addresses
    authorized_platforms: vector<address>,
    /// Total withdrawn this calendar month (for policy enforcement)
    monthly_withdrawn: u64,
    /// Unix timestamp of current month start (reset point for monthly limits)
    current_month_start: u64,
    /// Account creation timestamp
    created_at: u64,
    /// Account status (active, paused, closed)
    status: AccountStatus,
}
```

The `owner` field is intentionally omitted — the account creator is derived from the transaction sender at creation time. Authorization is enforced via `AccountCap` capability objects, not by storing an owner address.

The `PolicyConfig` structure defines all withdrawal constraints for an account. These constraints are enforced by the smart contract on every withdrawal operation, providing guarantees that cannot be circumvented by any off-chain logic.

```move
/// Defines withdrawal constraints enforced by the smart contract
public struct PolicyConfig has store, drop {
    /// Maximum total withdrawal allowed per calendar month
    max_monthly_withdrawal: u64,
    /// Maximum amount allowed per single withdrawal transaction
    max_per_transaction: u64,
    /// Minimum balance that must remain in the account
    min_balance: u64,
    /// Frequency constraint: minimum days between withdrawals (0 = unlimited)
    min_frequency_days: u64,
    /// Last successful withdrawal timestamp (for frequency enforcement)
    last_withdrawal_time: u64,
}
```

The `AccountCap` capability object grants authority to manage the account. This capability can be transferred between addresses and enables the holder to modify policies, authorize platforms, and initiate deposits. The capability does not enable direct withdrawals, which requires separate platform authorization.

```move
/// Capability granting account management authority.
/// Transfer this capability to enable delegated account management.
public struct AccountCap has key, store {
    /// Unique identifier for this capability
    id: UID,
    /// Reference to the associated subscription account
    account_id: ID,
    /// Creation timestamp
    created_at: u64,
    /// Permission flags (bitfield for future extensibility)
    permissions: u8,
}
```

The `holder` field is omitted — the capability holder is determined by who owns the `AccountCap` object. Permission validation uses the capability's `account_id` to verify authorization, and `permissions` bitfield to control what operations are permitted.

#### 3.1.2 Function Specifications

**Entry Points (User-Facing Operations)**

```move
/// Creates a new subscription account for the caller.
/// The account starts with zero balance and default policies.
/// Returns the newly created account ID and the account capability.
public fun create_account<T: drop>(
    stablecoin_type: T,
    ctx: &mut TxContext
): (ID, AccountCap)
```

The `create_account` function initializes a new subscription account for the transaction sender. The function accepts a type parameter indicating the stablecoin type (USDC or USDSui), which creates a type-gated account that only accepts deposits of the specified coin type. The function generates a new account ID, initializes default policy values (unlimited monthly, $1000 per-transaction maximum, $10 minimum balance), and creates the account capability for the caller. The function emits a `AccountCreated` event with the account ID and owner address.

The default policy values should be: max_monthly_withdrawal = u64::MAX (unlimited), max_per_transaction = 1000000000 (approximately $1000 with 6 decimal precision), min_balance = 10000000 (approximately $10), min_frequency_days = 0 (unlimited frequency), last_withdrawal_time = 0. These defaults ensure that newly created accounts have reasonable starting parameters while allowing users to customize immediately after creation.

```move
/// Deposits stablecoins into the subscription account.
/// Requires a valid AccountCap capability.
/// Emits a Deposit event with amount and new balance.
public fun deposit<T: drop>(
    cap: &AccountCap,
    account: &mut SubscriptionAccount<T>,
    coin: Coin<T>,
    ctx: &mut TxContext
)
```

The `deposit` function accepts stablecoins and adds them to the account balance. The function verifies that the provided capability matches the account and that the coin type matches the account's stablecoin type. The coin value is merged into the account's internal balance, and the function emits a `Deposit` event containing the transaction sender, deposit amount, and new total balance. The function does not accept a separate amount parameter; the entire coin value is deposited.

Deposits are unrestricted in amount and do not require any policy checks. Users should deposit sufficient funds to cover their expected subscription costs plus the minimum balance requirement. The function will fail if the coin type does not match the account's stablecoin type, preventing accidental deposits of the wrong token type.

```move
/// Withdraws stablecoins from the account to a specified recipient.
/// Used by platforms to collect subscription payments.
/// Requires platform authorization through the PlatformCap.
/// Enforces all policy constraints before processing.
public fun withdraw<T: drop>(
    platform_cap: &PlatformCap<T>,
    account: &mut SubscriptionAccount<T>,
    amount: u64,
    recipient: address,
    ctx: &mut TxContext
): Coin<T>
```

The `withdraw` function processes platform withdrawal requests while enforcing all policy constraints. The function first verifies the platform capability is authorized for this account, then checks the amount against the per-transaction limit defined in the policy configuration. The function then checks whether the withdrawal would reduce the balance below the minimum balance requirement. Finally, the function validates the monthly withdrawal total against the monthly limit and the frequency constraint against the minimum days between withdrawals.

If all policy checks pass, the function deducts the amount from the account balance, adds to the monthly withdrawn total (resetting if the current month has changed since the last withdrawal), updates the last withdrawal timestamp, and mints a Coin object for the recipient. The function emits a `Withdrawal` event with platform ID, amount, remaining balance, and policy check results. The function returns the minted Coin object to be transferred to the recipient by the calling code.

**Admin Operations**

```move
/// Updates the account's withdrawal policy configuration.
/// Requires a valid AccountCap capability.
/// Emits a PolicyUpdated event with old and new policy values.
public fun update_policy<T: drop>(
    cap: &AccountCap,
    account: &mut SubscriptionAccount<T>,
    new_policies: PolicyConfig,
    ctx: &mut TxContext
)
```

The `update_policy` function allows the account holder to modify withdrawal constraints. The function validates the new policy values: max_monthly_withdrawal must be greater than 0, max_per_transaction must be greater than 0 and less than or equal to max_monthly_withdrawal, min_balance must be greater than 0 and less than the current balance, and min_frequency_days must be less than 32 (practical limit for billing cycles). The function updates the account's policy configuration and emits a `PolicyUpdated` event containing the old and new policy values for audit purposes.

```move
/// Authorizes a platform to withdraw from this account.
/// Requires a valid AccountCap capability.
/// Emits a PlatformAuthorized event.
public fun authorize_platform<T: drop>(
    cap: &AccountCap,
    account: &mut SubscriptionAccount<T>,
    platform_address: address,
    ctx: &mut TxContext
)
```

The `authorize_platform` function adds a platform to the account's authorization list, enabling the platform to initiate withdrawals up to the policy limits. The function checks that the platform address is not already authorized (preventing duplicates) and that the platform has a valid PlatformCap for this account type. The function emits a `PlatformAuthorized` event containing the platform address for audit and notification purposes.

```move
/// Revokes platform authorization to withdraw from this account.
/// Requires a valid AccountCap capability.
/// Emits a PlatformRevoked event.
/// Note: Does not affect active subscriptions, only prevents new withdrawals.
public fun revoke_platform<T: drop>(
    cap: &AccountCap,
    account: &mut SubscriptionAccount<T>,
    platform_address: address,
    ctx: &mut TxContext
)
```

The `revoke_platform` function removes a platform from the authorization list. After revocation, the platform cannot initiate new withdrawals, but any subscriptions associated with that platform remain in the subscription registry (they are not automatically cancelled). Users should separately cancel subscriptions if they wish to fully disengage from a platform. The function emits a `PlatformRevoked` event containing the platform address.

**View Functions**

```move
/// Returns the current account balance
public fun get_balance<T: drop>(
    account: &SubscriptionAccount<T>
): u64

/// Returns the current policy configuration
public fun get_policies<T: drop>(
    account: &SubscriptionAccount<T>
): PolicyConfig

/// Returns the list of authorized platform addresses
public fun get_authorized_platforms<T: drop>(
    account: &SubscriptionAccount<T>
): vector<address>

/// Returns account metadata (status, created_at)
public fun get_account_info<T: drop>(
    account: &SubscriptionAccount<T>
): (AccountStatus, u64, u64)

/// Checks if a specific withdrawal amount would pass policy checks
public fun check_withdrawal<T: drop>(
    account: &SubscriptionAccount<T>,
    amount: u64
): (bool, vector<u8>)
```

The `check_withdrawal` view function enables off-chain systems to verify whether a proposed withdrawal would succeed without executing the actual withdrawal. The function returns a boolean indicating whether the withdrawal would be allowed and a vector of error codes indicating which policy constraints would be violated (empty vector if allowed). This function is essential for platforms to display accurate feedback to users before attempting withdrawals.

---

### 3.2 Module: `platform_registry`

**Package**: `0xSUBSCRIPTIONS`
**Module ID**: `platform_registry`
**Purpose**: Platform registration, management, and withdrawal operations

The platform registry module handles all platform-related functionality in the subscription system. Platforms must register with the system and receive a PlatformCap capability that grants authority to withdraw from authorized user accounts. The module also manages platform metadata including name, description, category, and API endpoint for webhook integrations.

**Local Types:**
- `PlatformOwnerCap` — capability granting platform management authority
- `PlatformStatus` — platform lifecycle state (ACTIVE, SUSPENDED, DEPRECATED)
- Error constants for platform operations (E_UNAUTHORIZED_PLATFORM, E_PLATFORM_NOT_FOUND, etc.)

#### 3.2.1 Data Structures

```move
/// Represents a platform that accepts subscription payments.
/// Stored as a shared object to enable lookups by users.
public struct Platform has key, store {
    /// Unique identifier for this platform
    id: UID,
    /// Platform's controlling address (can be a multisig)
    owner: address,
    /// Human-readable platform name
    name: String,
    /// Platform description
    description: String,
    /// Platform category (streaming, software, etc.)
    category: String,
    /// API endpoint for webhook notifications
    webhook_url: Option<String>,
    /// Whether the platform has passed verification
    is_verified: bool,
    /// Total subscribers count (for discovery)
    subscriber_count: u64,
    /// Platform creation timestamp
    created_at: u64,
    /// Platform status (active, suspended, deprecated)
    status: PlatformStatus,
}
```

```move
/// Capability granting platform withdrawal authority for a specific account.
/// Each account-platform pair has a separate PlatformCap.
public struct PlatformCap has key, store {
    /// Unique identifier for this capability
    id: UID,
    /// Reference to the platform
    platform_id: ID,
    /// Reference to the authorized subscription account (type-gated)
    account_id: ID,
    /// Creation timestamp
    created_at: u64,
    /// Permission flags
    permissions: u8,
}
```

The `platform_address` field is omitted — validation uses the `PlatformCap` object's ownership (held by the platform operator) to verify authority.

```move
/// Platform subscription tier definition
public struct SubscriptionTier has store, drop {
    /// Tier name (Basic, Pro, Enterprise, etc.)
    name: String,
    /// Price per billing period in smallest unit
    amount: u64,
    /// Billing frequency (daily, weekly, monthly, yearly)
    frequency: BillingFrequency,
    /// Whether this tier is currently active
    is_active: bool,
}
```

#### 3.2.2 Function Specifications

**Platform Registration**

```move
/// Registers a new platform with the subscription system.
/// The registering address becomes the platform owner.
/// Emits a PlatformRegistered event.
public fun register_platform(
    name: String,
    description: String,
    category: String,
    webhook_url: Option<String>,
    ctx: &mut TxContext
): (Platform, PlatformOwnerCap)
```

The `register_platform` function creates a new platform entry in the registry. The function validates the input parameters: name must be between 1 and 100 characters, description must be between 0 and 1000 characters, category must be a valid category string, and webhook_url must be a valid URL format if provided. The function creates the Platform object as a shared object (enabling user lookups) and a PlatformOwnerCap that grants platform management permissions. The function emits a `PlatformRegistered` event with platform details for indexing.

```move
/// Updates platform metadata (owner only)
public fun update_platform(
    owner_cap: &PlatformOwnerCap,
    platform: &mut Platform,
    name: Option<String>,
    description: Option<String>,
    webhook_url: Option<String>,
    ctx: &mut TxContext
)
```

```move
/// Updates platform verification status (admin only, future governance)
public fun verify_platform(
    platform: &mut Platform,
    verified: bool,
    ctx: &mut TxContext
)
```

**Platform Subscription Management**

```move
/// Creates a subscription tier for this platform
public fun create_tier(
    owner_cap: &PlatformOwnerCap,
    platform: &mut Platform,
    name: String,
    amount: u64,
    frequency: BillingFrequency,
    ctx: &mut TxContext
)
```

The `create_tier` function adds a new subscription tier to the platform. Each platform can have up to 10 tiers, enforced by the function. Tier names must be unique within a platform. The function emits a `TierCreated` event with tier details.

```move
/// Updates an existing subscription tier
public fun update_tier(
    owner_cap: &PlatformOwnerCap,
    platform: &mut Platform,
    tier_index: u64,
    name: Option<String>,
    amount: Option<u64>,
    is_active: Option<bool>,
    ctx: &mut TxContext
)
```

```move
/// Removes a subscription tier (must have no active subscriptions)
public fun remove_tier(
    owner_cap: &PlatformOwnerCap,
    platform: &mut Platform,
    tier_index: u64,
    ctx: &mut TxContext
)
```

**Platform Withdrawal Operations**

```move
/// Processes a withdrawal from a user account (called by platform server)
/// Requires a valid PlatformCap for the specific account.
/// Handles the complete withdrawal flow including policy enforcement.
public fun process_withdrawal<T: drop>(
    platform_cap: &PlatformCap<T>,
    account: &mut SubscriptionAccount<T>,
    amount: u64,
    subscription_id: ID,
    ctx: &mut TxContext
)
```

The `process_withdrawal` function orchestrates the withdrawal operation from the platform's perspective. The function first retrieves the subscription details to validate the withdrawal amount against the subscription's tier pricing. It then calls the subscription account's withdraw function to process the actual transfer. Finally, it emits platform-specific events for the webhook notification system.

```move
/// Batch withdrawal processing for multiple accounts
/// Optimized for platform server efficiency
public fun batch_withdraw<T: drop>(
    platform_cap: &PlatformCap<T>,
    accounts: &mut vector<SubscriptionAccount<T>>,
    withdrawals: &vector<u64>,
    subscription_ids: &vector<ID>,
    ctx: &mut TxContext
)
```

The `batch_withdraw` function enables efficient processing of multiple withdrawals in a single transaction. The function validates that the number of accounts, amounts, and subscription IDs match, then processes each withdrawal sequentially. This function is essential for platforms with large subscriber bases to minimize transaction costs and processing time.

**View Functions**

```move
/// Returns platform metadata
public fun get_platform_info(
    platform: &Platform
): (String, String, String, bool, u64)

/// Returns all subscription tiers for a platform
public fun get_platform_tiers(
    platform: &Platform
): vector<SubscriptionTier>

/// Returns subscription count for a platform
public fun get_subscriber_count(
    platform: &Platform
): u64
```

---

### 3.3 Module: `subscription_manager`

**Package**: `0xSUBSCRIPTIONS`
**Module ID**: `subscription_manager`
**Purpose**: Subscription lifecycle management

The subscription manager module handles the complete lifecycle of individual subscriptions within the system. Each subscription represents a user's commitment to a specific platform tier and includes billing schedule information, status tracking, and payment history references.

**Local Types:**
- `SubscriptionStatus` — subscription state (ACTIVE, PAUSED, CANCELLED, PAYMENT_FAILED, EXPIRED)
- Error constants for subscription operations (E_INVALID_TIER_INDEX, E_SUBSCRIPTION_NOT_FOUND, etc.)

#### 3.3.1 Data Structures

```move
/// Represents an individual subscription to a platform tier
/// This is a child object of the parent SubscriptionAccount
public struct Subscription has key, store {
    /// Unique identifier for this subscription
    id: UID,
    /// Reference to parent subscription account
    account_id: ID,
    /// Reference to the platform
    platform_id: ID,
    /// Index into platform's tier list
    tier_index: u64,
    /// Tier name snapshot (for display even if tier changes)
    tier_name: String,
    /// Subscription amount snapshot (for display even if tier changes)
    tier_amount: u64,
    /// Billing frequency
    frequency: BillingFrequency,
    /// Current subscription status
    status: SubscriptionStatus,
    /// Next scheduled withdrawal timestamp (Unix epoch)
    next_withdrawal: u64,
    /// Subscription creation timestamp
    created_at: u64,
    /// Last successful payment timestamp
    last_payment: u64,
    /// Total amount paid over subscription lifetime
    total_paid: u64,
    /// Number of successful payments
    payment_count: u64,
    /// Subscription metadata (custom fields)
    metadata: String,
}
```

```move
/// Subscription status enumeration
public struct SubscriptionStatus has store, drop {
    variant: u8,
}
```

The status variants should be defined as constants:
- ACTIVE (0): Subscription is current and payments are being processed
- PAUSED (1): Subscription is paused by user, no automatic payments
- CANCELLED (2): Subscription has been cancelled by user
- PAYMENT_FAILED (3): Last payment attempt failed, awaiting retry
- EXPIRED (4): Subscription has reached its end date (if applicable)

#### 3.3.2 Function Specifications

**Subscription Creation**

```move
/// Creates a new subscription to a platform tier
/// Validates account authorization and sufficient balance
/// Emits a SubscriptionCreated event
public fun create_subscription<T: drop>(
    account_cap: &AccountCap,
    account: &mut SubscriptionAccount<T>,
    platform: &Platform,
    tier_index: u64,
    ctx: &mut TxContext
): Subscription
```

The `create_subscription` function initiates a new subscription for the user. The function first validates that the account has authorized the platform (required before subscription creation). It then retrieves the tier information from the platform to determine the billing amount and frequency. The function calculates the first withdrawal timestamp based on the frequency and creates the Subscription object as a child of the account. The function emits a `SubscriptionCreated` event with complete subscription details for indexing and notifications.

The function should also automatically process the first payment if the account balance is sufficient. If the balance is insufficient for the first payment, the subscription is created in PAYMENT_FAILED status and the user is notified to deposit funds.

```move
/// Creates a subscription with initial payment (atomic operation)
public fun subscribe_with_payment<T: drop>(
    account_cap: &AccountCap,
    account: &mut SubscriptionAccount<T>,
    platform: &Platform,
    platform_cap: &PlatformCap<T>,
    tier_index: u64,
    ctx: &mut TxContext
): Subscription
```

The `subscribe_with_payment` function combines subscription creation and the first payment in a single atomic operation. This is the preferred method for new subscriptions as it ensures the first payment is processed immediately, avoiding the need for the platform to retry payment collection.

**Subscription Modification**

```move
/// Updates subscription tier (upgrade/downgrade)
/// Effective immediately, proration handled off-chain
public fun update_subscription_tier<T: drop>(
    account_cap: &AccountCap,
    subscription: &mut Subscription,
    new_tier_index: u64,
    ctx: &mut TxContext
)
```

```move
/// Pauses subscription automatic payments
public fun pause_subscription<T: drop>(
    account_cap: &AccountCap,
    subscription: &mut Subscription,
    ctx: &mut TxContext
)
```

```move
/// Resumes paused subscription
public fun resume_subscription<T: drop>(
    account_cap: &AccountCap,
    subscription: &mut Subscription,
    ctx: &mut TxContext
)
```

**Subscription Cancellation**

```move
/// Cancels subscription immediately
/// Does not refund past payments
/// Emits a SubscriptionCancelled event
public fun cancel_subscription<T: drop>(
    account_cap: &AccountCap,
    subscription: &mut Subscription,
    ctx: &mut TxContext
)
```

The `cancel_subscription` function immediately terminates the subscription. The function sets the subscription status to CANCELLED and emits a `SubscriptionCancelled` event containing the subscription ID, cancellation timestamp, and reason. The function does not process any refund for the current period's payment; any refund logic must be handled through off-chain agreements or disputes.

```move
/// Scheduled cancellation (effective at period end)
public fun schedule_cancellation<T: drop>(
    account_cap: &AccountCap,
    subscription: &mut Subscription,
    ctx: &mut TxContext
)
```

The `schedule_cancellation` function sets a flag indicating the subscription should be cancelled at the end of the current billing period. The platform receives notification of the scheduled cancellation through the webhook system and can adjust their services accordingly.

**Payment Processing**

```move
/// Records a successful payment (called by platform after withdrawal)
public fun record_payment<T: drop>(
    platform_cap: &PlatformCap<T>,
    subscription: &mut Subscription,
    amount: u64,
    ctx: &mut TxContext
)
```

```move
/// Records a failed payment attempt
public fun record_failed_payment<T: drop>(
    platform_cap: &PlatformCap<T>,
    subscription: &mut Subscription,
    error_code: u8,
    ctx: &mut TxContext
)
```

```move
/// Updates next withdrawal timestamp (recalculate after payment)
public fun update_next_withdrawal<T: drop>(
    subscription: &mut Subscription,
    ctx: &mut TxContext
)
```

**View Functions**

```move
/// Returns subscription details
public fun get_subscription_info(
    subscription: &Subscription
): (ID, ID, String, u64, SubscriptionStatus, u64, u64, u64)

/// Returns subscription status
public fun get_subscription_status(
    subscription: &Subscription
): SubscriptionStatus

/// Returns time until next withdrawal
public fun get_next_withdrawal_time(
    subscription: &Subscription
): u64
```

---

## 4. Event Specifications

Events are emitted on all significant state changes to enable off-chain indexing, notifications, and audit trails. Events are defined in each module and follow a consistent naming and structure pattern.

### 4.1 Account Events

```move
/// Emitted when a new subscription account is created
public struct AccountCreated has copy, drop {
    account_id: ID,
    stablecoin_type: u8,
    timestamp: u64,
}
```

```move
/// Emitted on every successful deposit
public struct Deposit has copy, drop {
    account_id: ID,
    depositor: address,
    amount: u64,
    new_balance: u64,
    timestamp: u64,
}
```

```move
/// Emitted on every successful withdrawal
public struct Withdrawal has copy, drop {
    account_id: ID,
    platform_id: ID,
    platform_address: address,
    amount: u64,
    remaining_balance: u64,
    monthly_total: u64,
    policy_passed: vector<bool>,
    timestamp: u64,
}
```

```move
/// Emitted when policy configuration is updated
public struct PolicyUpdated has copy, drop {
    account_id: ID,
    old_max_monthly: u64,
    new_max_monthly: u64,
    old_max_per_tx: u64,
    new_max_per_tx: u64,
    old_min_balance: u64,
    new_min_balance: u64,
    timestamp: u64,
}
```

```move
/// Emitted when a platform is authorized
public struct PlatformAuthorized has copy, drop {
    account_id: ID,
    platform_id: ID,
    platform_address: address,
    timestamp: u64,
}
```

```move
/// Emitted when a platform authorization is revoked
public struct PlatformRevoked has copy, drop {
    account_id: ID,
    platform_id: ID,
    platform_address: address,
    timestamp: u64,
}
```

### 4.2 Platform Events

```move
/// Emitted when a platform registers
public struct PlatformRegistered has copy, drop {
    platform_id: ID,
    owner: address,
    name: String,
    category: String,
    timestamp: u64,
}
```

```move
/// Emitted when a platform tier is created
public struct TierCreated has copy, drop {
    platform_id: ID,
    tier_index: u64,
    tier_name: String,
    amount: u64,
    frequency: u8,
    timestamp: u64,
}
```

```move
/// Emitted when a platform tier is updated
public struct TierUpdated has copy, drop {
    platform_id: ID,
    tier_index: u64,
    changes: String,
    timestamp: u64,
}
```

### 4.3 Subscription Events

```move
/// Emitted when a new subscription is created
public struct SubscriptionCreated has copy, drop {
    subscription_id: ID,
    account_id: ID,
    platform_id: ID,
    tier_index: u64,
    tier_name: String,
    amount: u64,
    frequency: u8,
    first_payment_processed: bool,
    timestamp: u64,
}
```

```move
/// Emitted when a subscription is cancelled
public struct SubscriptionCancelled has copy, drop {
    subscription_id: ID,
    account_id: ID,
    platform_id: ID,
    cancelled_by: address,
    reason: String,
    effective_immediately: bool,
    timestamp: u64,
}
```

```move
/// Emitted when a subscription is paused
public struct SubscriptionPaused has copy, drop {
    subscription_id: ID,
    account_id: ID,
    platform_id: ID,
    timestamp: u64,
}
```

```move
/// Emitted when a subscription is resumed
public struct SubscriptionResumed has copy, drop {
    subscription_id: ID,
    account_id: ID,
    platform_id: ID,
    timestamp: u64,
}
```

```move
/// Emitted when a payment is successfully processed
public struct PaymentProcessed has copy, drop {
    subscription_id: ID,
    account_id: ID,
    platform_id: ID,
    amount: u64,
    payment_number: u64,
    timestamp: u64,
}
```

```move
/// Emitted when a payment fails
public struct PaymentFailed has copy, drop {
    subscription_id: ID,
    account_id: ID,
    platform_id: ID,
    attempt_number: u64,
    error_code: u8,
    timestamp: u64,
}
```

---

## 5. Security Requirements

### 5.1 Capability Validation

All entry points that modify account state must validate the caller's capability before executing any operations. The validation sequence is:

1. Verify the capability object exists in the transaction sender's address
2. Verify the capability's account_id matches the target account
3. Verify the capability's permissions include the required operation flag
4. Verify the capability has not been revoked (check revocation list if implemented)

Any capability validation failure should return a specific error code indicating which validation step failed, enabling precise error handling by clients.

### 5.2 Policy Enforcement

Policy constraints must be enforced at the smart contract level without relying on any off-chain validation. The enforcement order is:

1. Check per-transaction amount against max_per_transaction limit
2. Check withdrawal amount against current balance minus min_balance
3. Check monthly total plus withdrawal amount against max_monthly_withdrawal
4. Check time since last withdrawal against min_frequency_days

If any policy check fails, the withdrawal must revert with an appropriate error code. The policy check results should be included in the emitted event regardless of pass/fail for audit purposes.

### 5.3 Coin Type Safety

Accounts are type-gated to accept only the specified stablecoin type. All deposit and withdrawal operations must validate the coin type matches the account's type. This prevents users from accidentally funding the wrong account type and ensures platforms receive payments in the expected currency.

### 5.4 Reentrancy Prevention

The smart contracts must implement checks-effect-interactions pattern to prevent reentrancy attacks. Specifically:

- All state checks must complete before any state modifications
- External calls (Coin minting, event emission) must occur after state updates
- No callback mechanisms that could enable re-entering the contract

### 5.5 Overflow Protection

All arithmetic operations involving balances and amounts must use Sui's built-in arithmetic functions that revert on overflow. Alternatively, manual overflow checks should be implemented before arithmetic operations. The only exception is the monthly withdrawal total reset, which uses epoch-based logic that naturally prevents overflow accumulation.

### 5.6 Input Validation

All user-provided parameters must be validated before use:

- Addresses must be valid Sui addresses (32 bytes)
- Amounts must be positive and within reasonable bounds
- Strings must have length limits enforced
- Timestamps must be within acceptable ranges (no future dates beyond 1 year, no past dates before account creation)

---

## 6. Testing Requirements

### 6.1 Unit Test Coverage

Each module must achieve minimum 95% line coverage on unit tests. Critical functions (withdraw, create_subscription, cancel_subscription) must achieve 100% branch coverage.

```move
#[test]
fun test_create_account_success() {
    // Test successful account creation with default policies
}

#[test]
fun test_create_account_invalid_coin_type() {
    // Test that wrong coin type causes failure
}

#[test]
fun test_deposit_success() {
    // Test successful deposit increases balance
}

#[test]
fun test_deposit_invalid_cap() {
    // Test that invalid capability causes failure
}
```

### 6.2 Integration Test Scenarios

The following integration scenarios must be implemented and passing:

**Account Lifecycle**

- Create account → deposit funds → verify balance
- Create account → authorize platform → verify authorization list
- Create account → update policies → verify policy changes
- Create account → revoke platform → verify removal

**Withdrawal Scenarios**

- Authorized platform withdraws within all limits → success
- Unauthorized platform attempts withdrawal → failure
- Platform withdraws exceeding per-transaction limit → failure
- Platform withdraws exceeding monthly limit → failure
- Platform withdraws below min_balance → failure
- Platform withdraws violating frequency constraint → failure

**Subscription Lifecycle**

- Create subscription → verify subscription object created
- Create subscription → verify first payment processed
- Create subscription → update tier → verify tier change
- Create subscription → pause → verify status change
- Create subscription → resume → verify status change
- Create subscription → cancel → verify immediate cancellation
- Create subscription → schedule cancellation → verify end-of-period cancellation

### 6.3 Edge Case Testing

The following edge cases must be tested:

- Withdrawing the exact remaining balance (balance = min_balance + withdrawal)
- Withdrawing at month boundary (monthly reset timing)
- Rapid sequential withdrawals (frequency enforcement)
- Zero-amount operations (should fail)
- Negative amounts (should fail, type system should prevent)
- Extremely large amounts (overflow protection)
- Empty authorized platforms list
- Maximum number of authorized platforms (should have reasonable limit)
- Maximum number of subscriptions per account

### 6.4 Formal Verification

The Move Prover should be used to verify the following critical properties:

- Balance never goes negative
- Monthly totals correctly reset at month boundaries
- Only authorized platforms can withdraw
- Policy constraints cannot be bypassed
- Capability permissions are correctly enforced
- No reentrancy vulnerabilities

---

## 7. Gas Optimization

### 7.1 Object Layout

Minimize object size by using efficient type representations:

- Use `u8` for status enums instead of full struct
- Use `Option<String>` instead of `String` for optional fields
- Use `ID` references instead of full object references where possible

### 7.2 Batch Operations

Implement batch variants for operations that users may need to perform multiple times:

- Batch withdrawal processing for platforms
- Batch subscription cancellation for users
- Batch authorization updates

### 7.3 Read-Only Functions

Mark view functions as `public view` to enable efficient off-chain calls without transaction costs.

---

## 8. Upgrade Strategy

### 8.1 Version Compatibility

The initial deployment should use a versioning scheme that allows for future upgrades:

- Package version: `1.0.0` initial release
- Use capability objects with version fields for forward compatibility
- Maintain event compatibility for indexing systems

### 8.2 Migration Path

If upgrades are needed in the future:

1. Deploy new package version to a different package ID
2. Provide migration entry points that transfer state
3. Support both versions during transition period
4. Deprecate old version after sufficient time

---

## 9. Dependencies and External Integrations

### 9.1 Stablecoin Integration

The contracts interface with stablecoin Coin objects from the Sui framework. The expected interfaces are:

```move
// Coin package expected interface
module coin::Coin<T> {
    public fun value<T>(coin: &Coin<T>): u64;
    public fun split<T>(coin: &mut Coin<T>, amount: u64, ctx: &mut TxContext): Coin<T>;
    public fun merge<T>(coin: &mut Coin<T>, another: Coin<T>);
    public fun join<T>(coin: &mut Coin<T>, another: Coin<T>);
}

// Coin treasury expected interface (for withdrawal minting)
module coin::CoinTreasury {
    public fun mint<T>(treasury: &mut CoinTreasury, amount: u64, ctx: &mut TxContext): Coin<T>;
}
```

### 9.2 Clock Integration

For time-based operations (frequency enforcement, billing schedules), the contracts use the `clock::Clock` object from the Sui framework:

```move
module clock::Clock {
    public fun timestamp_ms(clock: &Clock): u64;
}
```

---

## 10. Deployment Checklist

Before mainnet deployment, ensure the following items are completed:

- [ ] All unit tests passing with 95%+ coverage
- [ ] All integration tests passing
- [ ] Formal verification complete with no critical findings
- [ ] Third-party security audit completed with all findings resolved
- [ ] Gas optimization reviewed and benchmarked
- [ ] Object layout optimized for storage costs
- [ ] Event schemas documented and indexed by event consumers
- [ ] Upgrade capability testing completed
- [ ] Migration scripts tested in staging environment

---

## 11. Appendix: Reference Implementations

### 11.1 Policy Validation Pseudocode

```
function validate_withdrawal(account, amount):
    // Per-transaction limit
    if amount > account.policies.max_per_transaction:
        return ERROR_POLICY_EXCEEDED_TRANSACTION

    // Minimum balance
    if account.balance - amount < account.policies.min_balance:
        return ERROR_POLICY_MIN_BALANCE_VIOLATION

    // Monthly limit
    if account.monthly_withdrawn + amount > account.policies.max_monthly_withdrawal:
        return ERROR_POLICY_EXCEEDED_MONTHLY

    // Frequency check
    if account.policies.min_frequency_days > 0:
        current_time = get_current_timestamp()
        time_since_last = current_time - account.policies.last_withdrawal_time
        min_interval = account.policies.min_frequency_days * 86400000  // Convert to milliseconds
        if time_since_last < min_interval:
            return ERROR_POLICY_FREQUENCY_VIOLATION

    return SUCCESS
```

### 11.2 Month Boundary Detection

```
function check_month_reset(account):
    current_timestamp = get_current_timestamp()
    current_month_start = get_month_start(current_timestamp)

    if account.current_month_start < current_month_start:
        // Month has changed, reset monthly tracking
        account.monthly_withdrawn = 0
        account.current_month_start = current_month_start
        return true
    return false
```

---

*Document Version: 1.0.0*
*Last Updated: 2024*
*Prepared by: Smart Contract Team*