# Intent, 2026-06-03T00:00:00Z

## One-sentence summary
Build a Web3 billing infrastructure on Sui that allows digital platforms to accept, manage, and automate recurring stablecoin subscriptions seamlessly, eliminating manual payment churn.

## Problem and audience
- Problem: Web3 businesses lose MRR because blockchains don't natively support automated "pull" payments, forcing users to manually sign transactions every month. This causes massive accidental churn or reliance on expensive traditional payment rails.
- Audience: Web3 SaaS platforms, infrastructure providers, and founders who need a trustless, automated billing infrastructure to secure predictable MRR without the liability of holding user funds.
- Core valuable shape: A type-gated, capability-secured subscription protocol that abstracts smart-contract complexity, allowing platforms to implement true "autopay" where users approve spending limits once and smart contracts execute scheduled withdrawals automatically.

## On-chain shape
- User-held Objects: none (users hold `AccountCap` capability objects to manage accounts; `Subscription` child objects are effectively owned/controlled via `AccountCap` holders).
- Protocol-held shared Objects: `SubscriptionAccount<T>` (shared object per user account), `Platform` (shared registry objects for platforms).
- Capabilities:
  - `AccountCap`: held by the account controller (user or delegate); gates policy updates, authorizations, deposits, subscription creation.
  - `PlatformCap<T>`: held by platform operator; gates withdrawals and platform-side operations for a specific account and coin type.
  - `PlatformOwnerCap`: held by platform admin; gates tier and metadata management.
- Move modules expected: 3 modules — `subscription_account`, `platform_registry`, `subscription_manager` (as described in the requirements).
- PTB composability: supports single-tx atomic flows for subscribe-with-payment and batch withdrawals; platform batch flows expected for efficiency.

## Off-chain shape
- Frontend: Next.js web (primary), with standard wallet adapter integration; mobile is optional later.
- Auth: Wallet adapter (Sui wallet); optional sponsored txs for onboarding (sponsor posture: support sponsoring but not mandatory for MVP).
- Off-chain services: Indexer/service that consumes events and runs webhooks for platform notifications; platform servers call withdrawal APIs and manage retries/off-chain reconciliation.

## Sponsor integrations (load-bearing only)
- No external sponsor integrations are strictly load-bearing in the current design. `Walrus` or other storage services are not required for core payment flows and are considered decorative unless the user specifies a blob lifecycle (cancelled).

## Network and upgrade authority
- Target network at launch: devnet / testnet for development and integration tests; aim for mainnet after audits and formal verification.
- Upgrade authority intent: keep with a multisig (recommended) during staging and mainnet launch; avoid burning upgrade cap until after audit & community review.
- Package id capture plan: record package IDs emitted at deploy time in deployment scripts and `deploy/` metadata for indexers to consume.

## Success criteria
1. On testnet: users can create a `SubscriptionAccount<T>`, deposit the correct stablecoin, and observe `Deposit` and `AccountCreated` events for their account.
2. On testnet: an authorized platform with a `PlatformCap` can perform a `withdraw` within policy limits and the `Withdrawal` and `PaymentProcessed` events are emitted and indexed.
3. Integration: batch withdraw flow processes multiple accounts in a single transaction and results are observable via events and platform webhooks.

## Out of scope
- Fiat on/off ramp integrations and payment card processing.
- Off-chain dispute resolution and refunds handling (must be handled by platform agreements).
- Complex KYC and platform verification flows (verification flag is recorded but not a full verification pipeline).

## Constraints
- Deadline: none provided; assume hackathon/testnet pilot timelines. Prioritize testnet/demo readiness for Sui Overflow if requested.
- Risk tolerance: testnet pilot / hackathon demo by default; production deployment requires formal verification and audit.
- Existing assets: the requirements doc in [docs/smart-contract-requirements.md](docs/smart-contract-requirements.md) is the reference spec.

## Resolved choices
- Stablecoin types: both USDC and USDSui (supported initially).
- Upgrade authority: single deployer key for now (change to multisig later recommended before mainnet).
- Platform subscriber discovery: on-chain subscriber counts and discovery required.
- Walrus/storage integrations: no, not required for now.

## Resolved choice (AccountCap)
- `AccountCap` transferability: non-transferable by default (restricted delegation model).

---
Generated from: [docs/smart-contract-requirements.md](docs/smart-contract-requirements.md)
