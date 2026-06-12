# PayStreamer UI Proposal — v2 Frontend

**Version:** 1.0.0
**Date:** 2026-06-10
**Status:** Draft for review
**Purpose:** Define the production frontend interface for PayStreamer v2, bridging the gap between the working smart contract demo and a shippable product.

---

## 1. Executive Summary

The v2 PayStreamer contract is complete and deployed on devnet. The frontend is a demo that calls v1 contract APIs. This document defines the production frontend: what screens it needs, what each screen does, and how data flows from the blockchain into each UI element.

The frontend serves three distinct user groups:

| User | Goal | Primary Interface |
|------|------|-----------------|
| **Subscriber** | Pay for platforms automatically | Subscriber Dashboard |
| **Platform Owner** | Collect recurring revenue | Platform Owner Portal |
| **Platform Customer** | Subscribe to a platform | PayStreamer Hosted Subscribe Page |

This document covers all three, with detailed interface descriptions, recommended UX decisions, and the rationale for each product choice.

---

## 2. Product Structure

### 2.1 URL Map

```
/ → Landing page (public)
/dashboard → Subscriber dashboard (wallet required)
/dashboard/accounts → Account management
/dashboard/subscriptions    → Subscription management
/dashboard/activity         → Payment history
/dashboard/settings         → Account settings
/platforms → Platform owner portal (wallet required)
/platforms/overview         → Revenue dashboard
/platforms/tiers            → Tier management
/platforms/subscribers       → Subscriber list
/platforms/treasury         → Treasury management
/platforms/settings         → Platform settings
/platforms/scheduler        → Global scheduler controls
/subscribe/:platformId     → Public hosted subscription page (no wallet required to view)
```

###2.2 Route Protection

| Route | Access |
|-------|--------|
| `/dashboard/*` | Wallet connected + `AccountCap` found or prompt to create account |
| `/platforms/*` | Wallet connected + wallet address matches `Platform.owner` for at least one platform |
| `/subscribe/:platformId` | Public — no wallet required to view tiers and platform info |

---

## 3. Landing Page

**File:** `src/pages/LandingPage.tsx`

### 3.1 Sections

**Hero Section**
- Headline: "Recurring Crypto Payments. Zero Friction."
- Subheadline: "Let your users pay with one wallet signature. Get billed automatically every cycle."
- Primary CTA: "Connect Wallet" → triggers dapp-kit `ConnectModal`
- Secondary CTA: "See How It Works" → scrolls to explanation section
- After wallet connected: CTA changes to "Go to Dashboard" (for users with accounts) or "Create Account" (for new users)

**Social Proof**
- Query `PlatformRegistered` events from the last 30 days
- Display: "X platforms accepting payments" + platform name logos/categories
- If no platforms exist yet: hide this section

**For Platforms Section**
- Headline: "Accept Subscriptions in Minutes"
- 3-step visual: Register Platform → Create Tiers → Get Paid Automatically
- CTA: "Start Accepting Payments" → routes to `/platforms` (wallet required)

**For Subscribers Section**
- Headline: "One Signature. Never Pay Manually Again."
- 3-step visual: Connect Wallet → Approve Spending → Done
- CTA: "Get Started" → routes to `/dashboard`

**Features Grid**
- Keep existing `CoreFeatures` section
- Add pricing section below it:
  - "PayStreamer takes X% per successful payment"
  - "No setup fees. No monthly fees. No hidden costs."
  - "First90 days:0% fee for early adopters." (if applicable)

**Security Section**
- Keep existing `SecuritySection`

**Footer**
- Keep existing `Footer`
- Add: Privacy Policy, Terms of Service, Contact

### 3.2 Network Indicator

Persistent banner below navbar when on devnet:
```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Testnet — No real money. Transactions are for testing only. │
└─────────────────────────────────────────────────────────────┘
```
Color: amber/yellow. Dismissible per session but reappears on reload.

---

## 4. Subscriber Dashboard

**Base path:** `/dashboard`
**Wallet requirement:** Yes — must have connected wallet

### 4.1 Account Management (`/dashboard/accounts`)

**Purpose:** Let users create and manage their `SubscriptionAccount` objects.

**Account List View:**

```
┌─────────────────────────────────────────────────────────────┐
│ My Accounts                                           [+ Create Account] │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐    │
│ │ ● USDC Account245.00 USDC │ │
│ │   3 active subscriptions [Manage] │    │
│ └─────────────────────────────────────────────────────┘    │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ ● SUI Account 12.50 SUI │    │
│ │   1 active subscription                        [Manage] │    │
│ └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Each account card shows:**
- Denomination badge (USDC/USDSui/SUI) with coin icon
- Total balance (formatted with decimals: `245.00 USDC`)
- Active subscription count
- "Manage" button → expands inline or navigates to account detail

**Create Account Flow (modal or dedicated page):**

Step 1 — Select Denomination:
```
┌─────────────────────────────────────────────────────────────┐
│ Create Subscription Account                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Which token do you want to subscribe with?                  │
│                                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │    [SUI]     │ │   [USDC]     │  │  [USDSui]    │   │
│  │   SUI Token │  │  USDC Coin   │  │ USDSui Coin  │   │
│  │              │  │              │  │              │   │
│  │  ⚠️ Volatile │  │  ✓ Stable    │  │  ✓ Stable │   │
│  └───────────────┘  └───────────────┘  └───────────────┘ │
│                                                             │
│                                    [Cancel]  [Next →]        │
└─────────────────────────────────────────────────────────────┘
```

- SUI card shows amber "Volatile" warning badge
- USDC and USDSui cards show green "Stable" badge
- Only denominations registered in `CoinTypeRegistry` are shown

Step 2 — Set Policies (optional, can skip with defaults):
```
┌─────────────────────────────────────────────────────────────┐
│ Set Spending Limits (Optional)                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  These protect your account from unexpected charges.         │
│  You can change these anytime.                              │
│                                                             │
│  Max per transaction      [___________] USDC              │
│  Max per month            [___________] USDC              │
│  Minimum balance          [___________] USDC              │
│  Min time between charges [___________] days │
│                                                             │
│                        [Skip for now]  [Create Account →]  │
└─────────────────────────────────────────────────────────────┘
```

- All fields optional; defaults are0 (no limits)
- Real-time validation: min balance cannot exceed what user is about to deposit

Step 3 — Deposit Funds:
```
┌─────────────────────────────────────────────────────────────┐
│ Deposit Funds │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  How much do you want to deposit?                           │
│  (This funds your subscription payments)                   │
│                                                             │
│  [1.00 ] SUI                                             │
│                                                             │
│  Available:12.50 SUI                                       │
│                                                             │
│  [← Back]              [Deposit& Create Account →]         │
└─────────────────────────────────────────────────────────────┘
```

- Uses `Transaction.splitCoins` to split from gas coin
- Shows available balance from wallet
- Transaction: `account::create_account` + `account::share_account` + `account::deposit` in one PTB

**Account Detail View (expanded from card or separate page):**

```
┌─────────────────────────────────────────────────────────────┐
│ USDC Account                                    [Edit Policies] │
├─────────────────────────────────────────────────────────────┤
│ Balance: 245.00 USDC                         [+ Deposit]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Subscriptions (3)                                           │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Netflix Premium                                       │    │
│ │ 9.99 USDC/month · Next billing in 12 days             │    │
│ │ ● Active  [Pause] [Cancel]                          │    │
│ └─────────────────────────────────────────────────────┘    │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Spotify Basic                                        │    │
│ │ 4.99 USDC/month · Next billing in 3 days             │    │
│ │ ● Active  [Pause] [Cancel]                          │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ Recent Activity                                             │
│ Jun 5  Netflix Premium  -9.99 USDC  ✓ Paid                  │
│ Jun 1  Spotify Basic    -4.99 USDC  ✓ Paid                  │
│ May 29 Deposit          +50.00 USDC ✓                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Subscription Management (`/dashboard/subscriptions`)

**Purpose:** Unified view of all subscriptions across all accounts.

**Subscription Card:**
```
┌─────────────────────────────────────────────────────────────┐
│ [Netflix Logo]  Netflix Premium                             │
│ USDC Account · Active                         Jun 15, 2026  │
├─────────────────────────────────────────────────────────────┤
│ 9.99 USDC/month                                             │
│                                                             │
│ Next payment: Jun 15, 2026 (12 days)                         │
│ Total paid: 29.97 USDC (3 payments)                          │
│                                                             │
│ [Pause Billing]  [Cancel Subscription]                     │
└─────────────────────────────────────────────────────────────┘
```

**Pause Billing Flow:**
1. User clicks "Pause Billing"
2. Confirmation modal: "Pause billing for Netflix Premium? You can resume anytime. Your subscription will not be cancelled — you'll still be subscribed, but no payments will be processed while paused."
3. On confirm: calls `billing::pause_subscription`
4. Card updates: status badge changes to "Paused", next billing shows "Paused"

**Cancel Subscription Flow:**
1. User clicks "Cancel Subscription"
2. Confirmation modal: "Cancel Netflix Premium? This cannot be undone. You will need to subscribe again if you want to continue."
3. On confirm: calls `billing::cancel_subscription`
4. Card updates: status badge changes to "Cancelled", actions hidden

**Subscription Detail (expanded):**
- Payment history for this specific subscription
- Policy limits that apply to this subscription
- Platform info (name, description, tier details)

### 4.3 Activity Feed (`/dashboard/activity`)

**Purpose:** Unified transaction history for all accounts.

**Activity Types:**
| Icon | Type | Description |
|------|------|-------------|
| ↓ | Deposit | Funds added to account |
| ✓ | PaymentProcessed | Subscription payment succeeded |
| ✗ | PaymentFailed | Subscription payment failed |
| ⏸ | AccountPaused | Account paused |
| ⏸ | SubscriptionPaused | Individual subscription paused |
| ⚙ | PoliciesUpdated | Spending limits changed |

**Activity Table:**
```
┌─────────────────────────────────────────────────────────────┐
│ Activity                                        [Export CSV] │
├─────────────────────────────────────────────────────────────┤
│ [All] [Payments] [Deposits] [Alerts]     Filter: [This month ▼] │
├─────────────────────────────────────────────────────────────┤
│ Jun 10  14:32  ✓ PaymentProcessed  Netflix Premium  -9.99 USDC │
│ Jun 10  14:32  ✓ PaymentProcessed  Spotify Basic   -4.99 USDC │
│ Jun 5   09:11  ✓ PaymentProcessed  Netflix Premium  -9.99 USDC │
│ Jun 1   08:55  ✓ PaymentProcessed  Spotify Basic   -4.99 USDC │
│ May 29  16:20  ↓ Deposit           USDC Account     +50.00 USDC │
│ May 20  11:03  ✗ PaymentFailed    Netflix Premium  -9.99 USDC │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Failed Payment Display:**
- Red highlight row
- Expandable to show failure reason (from `PaymentFailed.reason` event field)
- Message: "Payment failed. This usually resolves automatically on the next billing cycle. Your subscription is still active."

### 4.4 Settings (`/dashboard/settings`)

**Sections:**
- **Display Name** — optional display name for the account (stored locally, not on-chain)
- **Notifications** — toggle for email/wallet alerts on payment failure
- **Danger Zone:**
  - "Close Account" — calls `account::close_account`. Warning: "This permanently closes your account. Any remaining balance will stop funding subscriptions. This cannot be undone."

---

## 5. Platform Owner Portal

**Base path:** `/platforms`
**Wallet requirement:** Yes — wallet must match `Platform.owner` for at least one registered platform

### 5.1 Discovery Flow

If wallet has no `PlatformOwnerCap` equivalent (v2 uses `platform.owner` field):

1. User navigates to `/platforms`
2. Query all `PlatformRegistered` events
3. Filter to platforms where `owner === connectedWallet`
4. If no platforms owned: show "Register Your First Platform" card
5. If platforms exist: show platform selector/tabs

**Note:** In v2, there is no `PlatformOwnerCap` — ownership is determined by the `owner` field on the `Platform` object. The frontend should query owned platforms by filtering events by sender address.

### 5.2 Overview Dashboard (`/platforms/overview`)

**Metrics Cards (top row):**
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ MRR         │  │ Subscribers │  │ This Month  │  │ Churn Rate │
│ $1,247.00   │  │    142      │  │ $342.50     │  │   2.1%     │
│ ↑ 12% vs last│  │ ↑ 8 new    │  │ 23 payments│  │            │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
```

**MRR Calculation:**
- Sum of `(tier.amount × subscriber_count)` for all active tiers
- Converted to USD using on-chain price feed (or displayed in native token with USD estimate)

**Revenue Chart:**
- Last 6 months bar chart
- Each bar = total `PaymentProcessed` amounts received
- Query: `PaymentProcessed` events filtered by `platformId` owned by current user

**Recent Activity Feed:**
```
Recent Activity
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Jun 10  New subscriber: 0x1234...abcd (Basic Tier)
Jun 9   Payment failed: 0x5678...efgh (insufficient balance)
Jun 8   Tier updated: Basic Tier → $9.99/mo
Jun 5   New subscriber: 0x9abc...ijkl (Premium Tier)
```

### 5.3 Tier Management (`/platforms/tiers`)

**Tier List:**
```
┌─────────────────────────────────────────────────────────────┐
│ Subscription Tiers                            [+ Add Tier]   │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Basic Tier                    12 subscribers         │    │
│ │ $4.99/USDC/month              [Edit] [Deactivate]   │    │
│ └─────────────────────────────────────────────────────┘    │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Premium Tier                  8 subscribers         │    │
│ │ $14.99/USDC/month             [Edit] [Deactivate]   │    │
│ └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Add/Edit Tier Modal:**
```
┌─────────────────────────────────────────────────────────────┐
│ Add Subscription Tier                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tier Name          [Basic Tier        ]                   │
│  Amount             [$  4.99         ]  per               │
│  Billing Cycle      [Monthly ▼]                            │
│  Denomination       [USDC ▼]                                │
│                                                             │
│  Preview: $4.99 USDC/month                                 │
│                                                             │
│                              [Cancel]  [Create Tier →]      │
└─────────────────────────────────────────────────────────────┘
```

- Billing cycle dropdown: Daily, Weekly, Monthly, Yearly, Custom (seconds input)
- Calls `platform::create_tier` or `platform::update_tier`

**Deactivate Tier:**
- Does NOT cancel existing subscriptions — existing subscribers keep their tier reference
- Sets `tier.is_active = false` — new subscribers cannot select this tier
- Visual: greyed out card with "Deactivated" badge

### 5.4 Subscriber List (`/platforms/subscribers`)

**Table:**
```
┌─────────────────────────────────────────────────────────────┐
│ Subscribers (142)                               [Export CSV] │
├─────────────────────────────────────────────────────────────┤
│ Wallet          │ Tier       │ Status   │ Since    │ Total  │
│ ────────────────────────────────────────────────────────────│
│ 0x1234...abcd  │ Basic Tier │ ● Active │ May 2026 │ $24.95 │
│ 0x5678...efgh  │ Premium    │ ● Active │ Apr 2026 │ $59.96 │
│ 0x9abc...ijkl  │ Basic Tier │ ⏸ Paused │ May 2026 │ $14.97 │
│ ...            │            │          │          │        │
└─────────────────────────────────────────────────────────────┘
```

**Subscriber Row Actions (view only):**
- Click row → expand to show payment history for that subscriber
- No mutating actions — subscribers control their own accounts

**Privacy:** Wallet addresses shown as truncated (0x1234...abcd) with copy button. Full address on hover tooltip.

### 5.5 Treasury (`/platforms/treasury`)

**Treasury Display:**
```
┌─────────────────────────────────────────────────────────────┐
│ Treasury                                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Current Treasury Address                                  │
│  0x472083c45f28f6fed624f1f252966a753332111a931127f047a9759800 │
│  [Copy] [View on Explorer]                                 │
│                                                             │
│  Total Received (all time): 1,247.00 USDC                 │
│                                                             │
│  ─────────────────────────────────────────────────────    │
│                                                             │
│  Change Treasury Address                                   │
│  [ 0x...                                  ] [Propose →]    │
│                                                             │
│  ⚠️ Security: Treasury changes take 48 hours to take effect │
│     after proposal. You can cancel during this window.     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Propose Treasury Change Flow:**
1. User enters new address, clicks "Propose"
2. Calls `platform::propose_treasury_change(new_address)`
3. UI updates to show pending state:
```
┌─────────────────────────────────────────────────────────────┐
│ Pending Treasury Change                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  New address: 0xabc123...                                   │
│  Proposed: Jun 12, 2026 14:32 (in 47h 28m)                │
│                                                             │
│  ⏳ Pending — takes effect in 47 hours 28 minutes           │
│                                                             │
│  [Cancel Change]                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

4. After 48h: "Accept Change" button appears → calls `platform::accept_treasury_change`
5. During pending window: "Cancel Change" button → calls `platform::cancel_treasury_change`

**Timelock Communication:** Always show the explanation ("takes 48 hours to take effect") — this is a security feature that users need to understand and trust.

### 5.6 Platform Settings (`/platforms/settings`)

**Settings Form:**
```
┌─────────────────────────────────────────────────────────────┐
│ Platform Settings                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Platform Name      [PayStreamer Test        ]             │
│  Description        [A test platform...      ]             │
│  Category           [Streaming ▼]                          │
│  Webhook URL        [https://...           ] (optional)   │
│                                                             │
│  [Save Changes]                                            │
│                                                             │
│  ─────────────────────────────────────────────────────    │
│                                                             │
│  Platform ID: 0x...abc123...                                │
│  Created: Jun 1, 2026                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

- Calls `platform::update_platform`
- Webhook URL: stored on-chain for payment event notifications to platform backend

### 5.7 Scheduler Controls (`/platforms/scheduler`)

**Purpose:** Allow platform owners to pause/resume the global scheduler during emergencies.

```
┌─────────────────────────────────────────────────────────────┐
│ Payment Scheduler                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Status: ● Active                                          │
│                                                             │
│  The scheduler processes payments automatically.            │
│  Use pause during maintenance or dispute resolution.         │
│                                                             │
│  Last processed: Jun 10, 2026 14:32                         │
│                                                             │
│  [Pause All Payments]                                      │
│                                                             │
│  ─────────────────────────────────────────────────────    │
│                                                             │
│  ⚠️ Pausing stops ALL payments across ALL platforms.       │
│     Resume when ready.                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

- Shows `PaymentScheduler.pause_flag` state
- "Pause All Payments" → calls `scheduler::pause`
- "Resume Payments" → calls `scheduler::unpause`
- Only shown if wallet is authorized (in practice, the pause functionality is for the PayStreamer team / multisig, but for v1 we expose it to platform owners for their own platforms)

---

## 6. Hosted Subscribe Page

**Path:** `/subscribe/:platformId`
**Wallet requirement:** No wallet required to view; wallet required to subscribe

### 6.1 Public View (no wallet)

```
┌─────────────────────────────────────────────────────────────┐
│ [PayStreamer Logo]                              [Connect Wallet] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Platform Logo]  Netflix                                    │
│  [Verify badge if is_verified] │
│                                                             │
│  Description: Stream unlimited movies and TV shows...        │
│  Category: Streaming │
│                                                             │
│  ─────────────────────────────────────────────────────    │
│                                                             │
│  Subscribe to Netflix │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Basic Tier │   │
│  │ $4.99 / month                                       │   │
│  │ [Subscribe] │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Premium Tier │   │
│  │ $14.99 / month │   │
│  │ [Subscribe]                                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

- Queries `Platform` object by `platformId`
- Shows all active tiers
- Tiers with `is_active = false` are hidden
- "Connect Wallet" button in header → connects wallet but does not navigate

### 6.2 Subscribe Flow (wallet connected)

**Case 1: User has no account for this denomination**
1. User clicks "Subscribe" on a tier
2. Prompt: "You need a USDC account to subscribe. Create one now?"
3. If yes: inline create account + deposit flow (same as dashboard create account)
4. Then: subscription creation transaction

**Case2: User has account but no subscription to this platform**
1. User clicks "Subscribe" on a tier
2. Transaction: `billing::create_subscription`
3. Success: show confirmation screen:
```
┌─────────────────────────────────────────────────────────────┐
│ ✓ Subscribed! │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  You're now subscribed to Netflix                           │
│  Tier: Premium ($14.99/month)                              │
│                                                             │
│  Your first payment will be processed on Jun 15, 2026       │
│                                                             │
│  [View My Subscriptions] [Back to Platform]                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Case 3: User already subscribed**
1. "Subscribe" button shows "Already Subscribed" (disabled)
2. Below tier: "You're subscribed to this tier. [Manage Subscription]"

---

## 7. Component Inventory

### 7.1 New Components Needed

| Component | Purpose | File |
|-----------|---------|------|
| `AccountCard` | Display account with balance, sub count | `src/components/subscriptions/AccountCard.tsx` |
| `CreateAccountModal` | Multi-step account creation | `src/components/subscriptions/CreateAccountModal.tsx` |
| `DenominationSelector` | USDC/USDSui/SUI selection | `src/components/subscriptions/DenominationSelector.tsx` |
| `PolicyEditor` | Spending limit configuration | `src/components/subscriptions/PolicyEditor.tsx` |
| `SubscriptionCard` | Display subscription with actions | `src/components/subscriptions/SubscriptionCard.tsx` |
| `SubscriptionDetail` | Expanded subscription view | `src/components/subscriptions/SubscriptionDetail.tsx` |
| `ActivityFeed` | Unified payment history | `src/components/subscriptions/ActivityFeed.tsx` |
| `PlatformOwnerOverview` | MRR dashboard | `src/components/platform/PlatformOwnerOverview.tsx` |
| `TierCard` | Tier display with actions | `src/components/platform/TierCard.tsx` |
| `TierModal` | Add/edit tier form | `src/components/platform/TierModal.tsx` |
| `SubscriberTable` | Platform subscriber list | `src/components/platform/SubscriberTable.tsx` |
| `TreasuryManager` | Treasury + timelock UI | `src/components/platform/TreasuryManager.tsx` |
| `SchedulerControls` | Pause/resume scheduler | `src/components/platform/SchedulerControls.tsx` |
| `SubscribePage` | Public hosted subscribe page | `src/pages/SubscribePage.tsx` |
| `NetworkBanner` | Devnet/testnet warning | `src/components/NetworkBanner.tsx` |
| `TxStatusToast` | Blockchain tx status notifications | `src/components/TxStatusToast.tsx` |

### 7.2 Components to Refactor

| Current File | Changes |
|-------------|---------|
| `CreateAccount.tsx` | Replace with `CreateAccountModal` (multi-step) |
| `PlatformOwnerDashboard.tsx` | Split into `PlatformOwnerOverview`, `TierModal`, `TreasuryManager`, `SchedulerControls` |
| `PlatformBrowser.tsx` | Migrate to GraphQL, update event types, becomes `/subscribe/:platformId` |
| `MySubscriptionAccount.tsx` | Split into `SubscriptionCard` list + `SubscriptionDetail` |
| `Deposit.tsx` | Integrate into `CreateAccountModal` and inline deposit on account cards |
| `UpdatePolicy.tsx` | Become `PolicyEditor` component |
| `SubscribeToPlatform.tsx` | Become part of `SubscribePage` |
| `NavBar.tsx` | Add network indicator, proper routing |

### 7.3 Routing

Replace `window.location.pathname` manual routing with React Router:
```typescript
// src/router.tsx
<BrowserRouter>
  <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/dashboard/*" element={<DashboardLayout />}>
      <Route path="accounts" element={<AccountsPage />} />
      <Route path="subscriptions" element={<SubscriptionsPage />} />
      <Route path="activity" element={<ActivityPage />} />
      <Route path="settings" element={<SettingsPage />} />
    </Route>
    <Route path="/platforms/*" element={<PlatformPortalLayout />}>
      <Route path="overview" element={<OverviewPage />} />
      <Route path="tiers" element={<TiersPage />} />
      <Route path="subscribers" element={<SubscribersPage />} />
      <Route path="treasury" element={<TreasuryPage />} />
      <Route path="settings" element={<PlatformSettingsPage />} />
      <Route path="scheduler" element={<SchedulerPage />} />
    </Route>
    <Route path="/subscribe/:platformId" element={<SubscribePage />} />
  </Routes>
</BrowserRouter>
```

---

## 8. Data Flow

### 8.1 Queries

| Query | Source | Used In |
|-------|--------|---------|
| `AccountCap` objects by owner | `client.core.listOwnedObjects` | App.tsx restore, dashboard |
| `SubscriptionAccount` by ID | `client.core.getObject` | Account detail, subscription detail |
| `Platform` by ID | `client.core.getObject` | Subscribe page, platform portal |
| `PlatformRegistered` events | GraphQL event query | Landing page, platform discovery |
| `AccountCreated` events | GraphQL event query | Account discovery |
| `SubscriptionCreated` events | GraphQL event query | Subscription discovery |
| `PaymentProcessed` events | GraphQL event query | Activity feed, revenue chart |
| `PaymentFailed` events | GraphQL event query | Activity feed (failed section) |
| `CoinTypeRegistry` object | `client.core.getObject` | Denomination selector |

### 8.2 GraphQL vs JSON-RPC

Migrate from JSON-RPC event queries to GraphQL (matching the e2e script pattern):
```typescript
// GraphQL query pattern
const res = await client.query({
  query: `
    query GetPlatform($id: SuiAddress!) {
      object(address: $id) {
        asMoveObject {
          contents { json }
        }
        owner { ... on Shared { initialSharedVersion } }
      }
    }
  `,
  variables: { id: platformId },
});
```

### 8.3 Shared Object Versions

When passing shared objects to PTBs, the frontend must track `initialSharedVersion`:

```typescript
// Shared object config
const SHARED_OBJECTS = {
  paymentScheduler: {
    id: '0xf475cb554d3d6f367085f6bdf9eb38effe590503dc6a9cd14ae611b8be2c8c26',
    initialVersion: 2824956, // captured at publish time
  },
  coinTypeRegistry: {
    id: '0x51de469c0f465c4b789520451cb2249bacbcfc7ee441977b564d564cc6a2d0e2',
    initialVersion: 2824956,
  },
};
```

The `initialSharedVersion` for `Platform` is discovered from the `PlatformRegistered` event's `initialSharedVersion` field at creation time. Store this in component state or context after platform creation.

---

## 9. Error Handling

### 9.1 Error Code Mapping

Map v2 abort codes to human-readable messages:

| Code | Constant | User Message |
|------|----------|-------------|
| `0x01001` | `EInvalidCap` | "This account cap doesn't match your account. Try refreshing the page." |
| `0x01003` | `EAccountClosed` | "This account is closed. Create a new account to continue." |
| `0x01005` | `EInsufficientBalance` | "Insufficient balance. Deposit more funds to continue." |
| `0x01006` | `ECoinTypeNotRegistered` | "This token type isn't supported. Contact support." |
| `0x06003` | `ESubscriptionAlreadyExists` | "You're already subscribed to this platform." |
| `0x06004` | `ESubscriptionNotActive` | "This subscription is not active." |
| `0x06006` | `EAccountPaused` | "Your account is paused. Resume it to continue." |
| `0x08002` | `EInvalidTier` | "This tier doesn't exist or has been deactivated." |
| `0x09001` | `ENotDue` | "This subscription isn't due for billing yet." |
| `0x09003` | `EInsufficientBalance` | "Insufficient balance for this payment." |
| `0x0A001` | `EGlobalRateLimited` | "Payment processing is temporarily paused. Try again in a few minutes." |
| `0x0A002` | `ESchedulerPaused` | "Payments are paused by the administrator." |

### 9.2 Transaction Status UI

Every blockchain transaction should show status:
```
Pending → Confirming → Confirmed ✓
                    └→ Failed ✗ (with error message)
```

Use a toast notification system (`TxStatusToast`) that shows:
1. Transaction submitted (pending) — "Confirming transaction..."
2. Transaction confirmed — "Transaction confirmed" (auto-dismiss 3s)
3. Transaction failed — "Transaction failed: [human-readable error]" (persistent until dismissed)

---

## 10. Open Questions — Recommended Answers

Below are my recommended answers with rationale. These should be confirmed or adjusted based on your product priorities.

### Q1: Multi-denomination UX — one combined dashboard or separate tabs per denomination?

**Recommendation: Separate tabs per denomination**

Rationale: USDC, USDSui, and SUI are fundamentally different assets. A user holding100 USDC and 0.5 SUI should not see these as interchangeable. Separate tabs with distinct balances makes it immediately clear which account they're managing. This also matches how exchanges and wallets present multi-token accounts.

**Alternative considered:** Single tab with all subscriptions grouped by denomination. Rejected because the account is the unit of denomination isolation — showing subscriptions from different denominations in one list would obscure which account funds each payment.

### Q2: Tier frequency display — human-readable labels or precise durations?

**Recommendation: Human-readable labels with exact duration in tooltip**

Example: "Monthly" with tooltip "Every 30 days (2,592,000 ms)"

Rationale: "Monthly" is immediately comprehensible. The exact millisecond value is useful for power users and for debugging, but shouldn't be the primary display. This matches how subscription services everywhere present billing cycles.

### Q3: Subscriber privacy — full wallet addresses or truncated?

**Recommendation: Truncated (0x1234...abcd) with copy button, full address on hover tooltip**

Rationale: Full addresses are unwieldy in tables. Truncated addresses are standard practice across Etherscan, Sui Explorer, and all blockchain UIs. The copy button handles the case where the full address is needed. Hover tooltip shows full address without requiring a click.

### Q4: Treasury timelock communication — explain it or just show countdown?

**Recommendation: Always explain it**

Rationale: The 48h timelock is a security feature, not a UX inconvenience. Users who understand why it's there are more likely to trust the product. The explanation should be brief ("Takes 48 hours to take effect for security") but always present when a treasury change is pending.

### Q5: Payment failure visibility — who sees failures and how?

**Recommendation: Both subscriber and platform owner see failures, surfaced in activity feeds**

- **Subscriber side:** Failed payments appear in `/dashboard/activity` with red highlight and expandable reason. The subscription remains active — the next billing cycle will retry automatically.
- **Platform owner side:** Failed payments appear in `/platforms/overview` activity feed with reason. Platform owner cannot fix the failure (subscriber controls the account) but is informed.
- **No email/webhook notifications for v1** — too complex for initial launch. Activity feed is sufficient.

### Q6: Hosted subscription page vs. API-only?

**Recommendation: Hosted page for v1 (`/subscribe/:platformId`), API for later**

Rationale: Platforms need a way to get their customers subscribed without building their own UI. A hosted page is the fastest path to adoption. The API/SDK approach is better for platforms with large existing user bases, but requires more integration work. Ship the hosted page first, expose a clean API later.

### Q7: Platform branding — customizable subscription pages?

**Recommendation: Out of scope for v1**

Rationale: Custom branding adds significant complexity (logo upload, color theming, custom domains). For v1, the hosted page should be PayStreamer-branded with the platform's name and description pulled from the `Platform` object. This is sufficient for platforms to test the product. Custom branding can be a v2 feature.

---

## 11. Implementation Phases

### Phase 1: Foundation (Week1-2)
- React Router setup replacing manual routing
- GraphQL client setup (migrate from JSON-RPC)
- v2 contract constants (package ID, shared object IDs per network)
- Network banner component
- Transaction status toast system
- Error code mapping utility

### Phase 2: Subscriber Dashboard (Week 2-3)
- Account list and creation flow
- Denomination selector
- Policy editor
- Deposit flow
- Subscription list and management
- Activity feed

### Phase 3: Platform Owner Portal (Week 3-4)
- Platform discovery (owned platforms)
- Overview dashboard with metrics
- Tier management
- Subscriber list
- Treasury management with timelock UI
- Platform settings

### Phase 4: Public Pages (Week 4-5)
- Hosted subscribe page (`/subscribe/:platformId`)
- Landing page improvements (social proof, pricing)
- Network indicator refinements

### Phase 5: Polish (Week 5-6)
- Empty states and loading skeletons
- Error boundaries and graceful degradation
- Mobile responsiveness pass
- Export CSV functionality
- Empty state CTAs

---

## 12. Out of Scope for v1

These features are documented but not included in the v1 frontend build:

| Feature | Rationale |
|---------|-----------|
| Email notifications | Requires backend infrastructure |
| Webhook configuration UI | Webhook URL field exists on Platform; testing/debugging comes later |
| Custom platform branding | Logo upload, color theming adds complexity |
| Delegated AccountCap management UI | `mint_delegated_cap` exists but agentic commerce is future roadmap |
| Confidential balance UI | `BalanceContainer` seam exists but confidential transfers not shipped |
| Mobile native app | Web-first; React Native or native wrappers are v2+ |
| Multi-sig wallet support | Complex UX; single wallet for v1 |
| Fiat on/off ramp | Out of scope per architecture doc |

---

*Document Version: 1.0.0*
*Last Updated: 2026-06-10*
*Status: Draft for product review*
