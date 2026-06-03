# Build plan, 2026-06-03T00:00:00Z

## Linked intent
.suiperpower/intent.md, summary: Build a Sui-native subscriptions system that holds user-stored stablecoins and enforces withdrawal policies on-chain so platforms can collect recurring payments without exceeding user-defined limits.

## Package layout
- Package name: `subscriptions`
- Single package (3 modules, no upgrade boundary justification needed)
- Move.toml dependencies:
  - Sui framework: pinned to `framework` rev (devnet/testnet compatible, exact rev TBD at build time — use `git_revision` or pinned tag)
  - No OZ Sui modules required for this design
  - No floating versions — all deps pinned

## Object model (per Object, forced ability decisions)

### SubscriptionAccount<T>
- Ownership: **shared** (concurrent access needed by owner and authorized platforms)
- Abilities: `key, store` — no `drop` (persistent), no `copy` (no duplication of accounts)
- Purpose: Holds stablecoin balance and enforces withdrawal policies for one coin type
- Created by: `subscription_account::create_account<T>`
- Mutated by: `subscription_account::deposit`, `subscription_account::withdraw`, `subscription_account::update_policy`, `subscription_account::authorize_platform`, `subscription_account::revoke_platform`
- Destroyed by: never (accounts persist; status drives lifecycle)

### Platform
- Ownership: **shared** (user lookups needed; platform operators update)
- Abilities: `key, store` — no `drop`, no `copy`
- Purpose: Registry entry for platforms accepting subscription payments
- Created by: `platform_registry::register_platform`
- Mutated by: `platform_registry::update_platform`, `platform_registry::create_tier`, `platform_registry::update_tier`, `platform_registry::remove_tier`
- Destroyed by: never (deprecated status, not deletion)

### AccountCap
- Ownership: **owned** (held by account controller; non-transferable per resolved choice)
- Abilities: `key, store` — no `drop`, no `copy`
- Purpose: Gates policy updates, platform authorization, and deposits
- Created by: `subscription_account::create_account<T>`
- Mutated by: never
- Destroyed by: never (burn function only if user deliberately exits)

### PlatformCap<T>
- Ownership: **owned** (held by platform operator per account-platform pair)
- Abilities: `key, store` — no `drop`, no `copy`
- Purpose: Gates withdrawal from a specific account for a specific coin type
- Created by: `subscription_account::authorize_platform`
- Mutated by: never
- Destroyed by: `subscription_account::revoke_platform` (removes from account's authorized list; object persists but is inert)

### PlatformOwnerCap
- Ownership: **owned** (held by platform admin)
- Abilities: `key, store` — no `drop`, no `copy`
- Purpose: Gates tier management, platform metadata updates
- Created by: `platform_registry::register_platform`
- Mutated by: never
- Destroyed by: never

### Subscription (child object)
- Ownership: **owned** (child of SubscriptionAccount, effectively controlled via AccountCap)
- Abilities: `key, store` — no `drop`, no `copy`
- Purpose: Tracks individual subscription lifecycle, billing schedule, payment history
- Created by: `subscription_manager::create_subscription` or `subscription_manager::subscribe_with_payment`
- Mutated by: `subscription_manager::update_subscription_tier`, `subscription_manager::pause_subscription`, `subscription_manager::resume_subscription`, `subscription_manager::cancel_subscription`, `subscription_manager::record_payment`
- Destroyed by: `subscription_manager::cancel_subscription` (immediate cancellation)

## Capabilities

### AccountCap
- Holder at init: transaction sender (module-internal creation, published to creator)
- Gates: `subscription_account::deposit`, `subscription_account::update_policy`, `subscription_account::authorize_platform`, `subscription_account::revoke_platform`, `subscription_manager::create_subscription`, `subscription_manager::subscribe_with_payment`, `subscription_manager::update_subscription_tier`, `subscription_manager::pause_subscription`, `subscription_manager::resume_subscription`, `subscription_manager::cancel_subscription`
- Transferability: non-transferable (resolved choice)

### PlatformCap<T>
- Holder at init: platform operator address (created by `authorize_platform`, transferred to platform)
- Gates: `subscription_account::withdraw`, `platform_registry::process_withdrawal`, `platform_registry::batch_withdraw`
- Transferability: transferable between platform operator addresses

### PlatformOwnerCap
- Holder at init: platform owner (transaction sender at registration)
- Gates: `platform_registry::update_platform`, `platform_registry::create_tier`, `platform_registry::update_tier`, `platform_registry::remove_tier`
- Transferability: transferable (platform admin can delegate)

## Modules

### subscription_account
- Purpose: Core account management, balance operations, policy enforcement
- Public entry functions: `create_account<T>`, `deposit<T>`, `withdraw<T>`, `update_policy<T>`, `authorize_platform<T>`, `revoke_platform<T>`
- Friend modules: none
- Stdlib dependencies: `sui::transfer`, `sui::object`, `sui::coin`, `sui::clock`, `sui::tx_context`

### platform_registry
- Purpose: Platform registration, tier management, withdrawal operations
- Public entry functions: `register_platform`, `update_platform`, `create_tier`, `update_tier`, `remove_tier`, `process_withdrawal<T>`, `batch_withdraw<T>`
- Friend modules: none
- Stdlib dependencies: `sui::transfer`, `sui::object`, `sui::coin`, `sui::tx_context`, `sui::vec_map` (if used for tier storage)

### subscription_manager
- Purpose: Subscription lifecycle management (creation, modification, cancellation)
- Public entry functions: `create_subscription<T>`, `subscribe_with_payment<T>`, `update_subscription_tier<T>`, `pause_subscription<T>`, `resume_subscription<T>`, `cancel_subscription<T>`, `record_payment<T>`, `record_failed_payment<T>`
- Friend modules: none
- Stdlib dependencies: `sui::transfer`, `sui::object`, `sui::clock`, `sui::tx_context`

## Public entry points

- `subscription_account::create_account<T>(stablecoin_type: T, ctx: &mut TxContext) -> (ID, AccountCap)` — anyone, gas: low, abort: never (creates shared object + transfers capability)
- `subscription_account::deposit<T>(cap: &AccountCap, account: &mut SubscriptionAccount<T>, coin: Coin<T>, ctx: &mut TxContext) -> ()` — AccountCap holder, gas: medium, abort: E_INVALID_CAP / E_COIN_TYPE_MISMATCH
- `subscription_account::withdraw<T>(platform_cap: &PlatformCap<T>, account: &mut SubscriptionAccount<T>, amount: u64, recipient: address, ctx: &mut TxContext) -> Coin<T>` — PlatformCap holder, gas: medium, abort: E_UNAUTHORIZED_PLATFORM / E_POLICY_* violations
- `subscription_account::update_policy<T>(cap: &AccountCap, account: &mut SubscriptionAccount<T>, new_policies: PolicyConfig, ctx: &mut TxContext) -> ()` — AccountCap holder, gas: low, abort: E_INVALID_POLICY
- `subscription_account::authorize_platform<T>(cap: &AccountCap, account: &mut SubscriptionAccount<T>, platform_address: address, ctx: &mut TxContext) -> ()` — AccountCap holder, gas: low, abort: E_ALREADY_AUTHORIZED
- `subscription_account::revoke_platform<T>(cap: &AccountCap, account: &mut SubscriptionAccount<T>, platform_address: address, ctx: &mut TxContext) -> ()` — AccountCap holder, gas: low, abort: E_NOT_FOUND

- `platform_registry::register_platform(name: String, description: String, category: String, webhook_url: Option<String>, ctx: &mut TxContext) -> (Platform, PlatformOwnerCap)` — anyone, gas: medium, abort: never
- `platform_registry::process_withdrawal<T>(platform_cap: &PlatformCap<T>, account: &mut SubscriptionAccount<T>, amount: u64, subscription_id: ID, ctx: &mut TxContext) -> ()` — PlatformCap holder, gas: medium, abort: E_WITHDRAWAL_FAILED
- `platform_registry::batch_withdraw<T>(platform_cap: &PlatformCap<T>, accounts: &mut vector<SubscriptionAccount<T>>, withdrawals: &vector<u64>, subscription_ids: &vector<ID>, ctx: &mut TxContext) -> ()` — PlatformCap holder, gas: high (per account), abort: E_BATCH_MISMATCH

- `subscription_manager::create_subscription<T>(account_cap: &AccountCap, account: &mut SubscriptionAccount<T>, platform: &Platform, tier_index: u64, ctx: &mut TxContext) -> Subscription` — AccountCap holder, gas: medium, abort: E_INVALID_TIER / E_PLATFORM_NOT_AUTHORIZED
- `subscription_manager::subscribe_with_payment<T>(account_cap: &AccountCap, account: &mut SubscriptionAccount<T>, platform: &Platform, platform_cap: &PlatformCap<T>, tier_index: u64, ctx: &mut TxContext) -> Subscription` — AccountCap holder, gas: medium-high, abort: E_INSUFFICIENT_BALANCE

## PTB shape
- Composability: **PTB chain across modules** — `subscribe_with_payment` chains account creation + subscription + first atomic payment in one tx; batch withdraw for platform efficiency
- Canonical PTB for subscribe-with-payment:
  1. `subscription_account::create_account<T>` → shared `SubscriptionAccount<T>`, transferred `AccountCap`
  2. `subscription_account::deposit<T>` → balance update
  3. `platform_registry::register_platform` (if platform doesn't exist yet)
  4. `subscription_account::authorize_platform<T>` → adds platform to authorized list
  5. `subscription_manager::subscribe_with_payment<T>` → creates Subscription + triggers first payment via `withdraw`
- Gas envelope expected (rough): subscribe-with-payment ~0.02–0.05 SUI on testnet; batch_withdraw per-account ~0.01–0.02 SUI

## Tests (one per intent.md success criterion)

- `test_create_account_and_deposit`: covers `create_account<T>`, `deposit<T>`, expected pass, ties to intent criterion #1
- `test_account_created_event_indexed`: covers `create_account<T>` event emission, expected `AccountCreated` event with correct fields, ties to criterion #1
- `test_deposit_event_indexed`: covers `deposit<T>` event emission, expected `Deposit` event with correct fields, ties to criterion #1
- `test_authorized_platform_withdraws`: covers `authorize_platform`, `withdraw<T>`, expected pass within policy, ties to intent criterion #2
- `test_withdrawal_event_indexed`: covers `withdraw<T>` event emission, expected `Withdrawal` event, ties to criterion #2
- `test_payment_processed_event_indexed`: covers `record_payment` event emission via `process_withdrawal` flow, expected `PaymentProcessed` event, ties to criterion #2
- `test_batch_withdraw_multiple_accounts`: covers `batch_withdraw<T>`, expected all withdrawals processed, events emitted per account, ties to intent criterion #3
- `test_unauthorized_platform_fails`: covers `withdraw<T>` without authorization, expected abort E_UNAUTHORIZED_PLATFORM, ties to criterion #2
- `test_policy_exceeded_per_tx`: covers `withdraw<T>` exceeding max_per_transaction, expected abort E_POLICY_EXCEEDED_TRANSACTION, ties to criterion #2
- `test_policy_exceeded_monthly`: covers `withdraw<T>` exceeding max_monthly_withdrawal, expected abort E_POLICY_EXCEEDED_MONTHLY, ties to criterion #2

Any success criterion without a test: **none** — all 3 criteria have test coverage.

## Frontend or off-chain pieces (if any)
- Stack: Next.js + dapp-kit (web primary)
- Routes / surfaces: account creation/deposit UI, platform discovery, subscription management dashboard, platform operator portal (withdrawal management)
- Auth: wallet adapter (Sui wallet); sponsored txs optional for onboarding
- Calls to chain: `create_account`, `deposit`, `authorize_platform`, `subscribe_with_payment`, `cancel_subscription`, `withdraw` (via platform server), `batch_withdraw` (via platform server), `register_platform`, `create_tier`, `update_tier`

## Sponsor integrations (load-bearing, with verification commitment)
- **None** — intent explicitly states no external sponsor integrations are load-bearing. Walrus and other storage services are decorative only.

## Network rollout
- Order: devnet → testnet → mainnet (stop at testnet for MVP/hackathon pilot)
- Per-network exit criterion:
  - **Devnet**: All unit tests pass; module compiles without warnings; basic object creation works
  - **Testnet**: All integration tests pass; all 3 success criteria observable via events; gas benchmarks captured; deploy script captures package ID
  - **Mainnet**: Deferred — requires formal verification, security audit, and multisig upgrade authority in place

## Upgrade authority
- Strategy: keep with single deployer key for now (change to multisig before mainnet, per resolved choice)
- Where the upgrade cap lives after publish: deployer's address (not burned)
- Package id capture: recorded in `deploy/<network>/package-info.json` emitted by deploy script; downstream skills read from there

## Risks and unknowns

- **Type-gated Coin<T> pattern**: Stablecoin types (USDC, USDSui) must be passed as empty type parameters. Need to confirm how these type tags are created and whether the coin::Coin<T> pattern works with custom type tags. Severity: medium, how we will resolve: prototype the `create_account<T>` flow on devnet first — if types don't work, we adjust the coin type handling approach.
- **Clock dependency for frequency enforcement**: Withdraw uses `sui::clock::Clock` for `min_frequency_days` enforcement. Need to ensure Clock is available in test environment. Severity: low, resolved by using test clock in tests.
- **Child object creation**: `Subscription` is a child of `SubscriptionAccount`. The child object pattern must be correctly implemented. Severity: medium, how we will resolve: review Sui documentation on child objects and test creation flow.
- **Batch withdraw gas estimation**: Processing many accounts in one PTB could exceed gas limits. Severity: medium, how we will resolve: benchmark with 10, 50, 100 accounts on devnet and adjust chunking strategy if needed.
- **Event indexing by off-chain services**: Success criterion #2 requires `PaymentProcessed` event to be indexed. Need to confirm indexer support. Severity: low, resolved by using standard Sui events which are indexed by default on testnet.

## Order of build

1. **Prototype `create_account<T>` and `deposit<T>` on devnet** — proves the type-gated coin pattern works; highest uncertainty
2. **Build `subscription_account` module in full** — create_account, deposit, withdraw, update_policy, authorize_platform, revoke_platform, all events
3. **Build `platform_registry` module** — register_platform, tier management, process_withdrawal, batch_withdraw
4. **Build `subscription_manager` module** — create_subscription, subscribe_with_payment, pause/resume/cancel, record_payment
5. **Integration test all three success criteria** — verify events are emitted and indexed
6. **Deploy to testnet and capture package ID** — for downstream skills and frontend integration

## What "done" looks like for this plan
- Observable outcome: On testnet, a user can create a `SubscriptionAccount<USDC>`, deposit USDC, authorize a platform, and subscribe to a platform tier — with `AccountCreated`, `Deposit`, `Withdrawal`, and `PaymentProcessed` events all indexed and queryable. Batch withdraw processes multiple accounts and emits per-account events. Gas costs documented.