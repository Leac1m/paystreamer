# PayStreamer UX Upgrade Implementation Plan

**Based on:** UX_AUDIT_REPORT.md (dated June 12, 2026)  
**Last Updated:** June 12, 2026

---

## Overview

This plan implements the 10 prioritized recommendations from the UX audit. Estimated total impact: **+40-60% improvement in key conversion metrics**.

### Sprint Organization

| Sprint | Duration | Focus |
|--------|----------|-------|
| Sprint 1 | 1-2 weeks | Quick Wins (high impact, low effort) |
| Sprint 2 | 2-3 weeks | Strategic Improvements |
| Sprint 3 | 3-4 weeks | Longer Term / Complex Changes |

---

## Sprint 1: Quick Wins

### 🔴 REC-001: Standardize Brand Name to "PayStreamer"
**Priority:** 1 | **Impact:** 4 | **Effort:** 1 | **Category:** Copy

**Files to Edit:**
- `src/components/NavBar.tsx` — line 53: "Sui Subscriptions" → "PayStreamer"
- `src/components/Footer.tsx` — line 32: "Sui Subscriptions" → "PayStreamer"
- `src/pages/LandingPage.tsx` — line 270: "Sui Subscriptions" → "PayStreamer"

**Changes:**
```diff
- <span className="text-xl font-bold text-white">Sui Subscriptions</span>
+ <span className="text-xl font-bold text-white">PayStreamer</span>
```

**Subagent Phrase:** `"brand-standardization"`

---

### 🔴 REC-002: Fix Hero CTA to Prevent Confusion
**Priority:** 2 | **Impact:** 5 | **Effort:** 2 | **Category:** UX Pattern

**Files to Edit:**
- `src/components/HeroSection.tsx` — line 77: Change navigation target
- `src/pages/LandingPage.tsx` — line 204: Change navigation target

**Changes:**
1. Change `navigate('/platforms')` to `navigate('/explore')`
2. Change button text from "Start for Free" to "Explore Platforms"

```diff
- <button onClick={() => navigate('/platforms')} className="btn-primary...">
-   <span>Start for Free</span>
+ <button onClick={() => navigate('/explore')} className="btn-primary...">
+   <span>Explore Platforms</span>
```

**Subagent Phrase:** `"hero-cta-fix"`

---

### 🟡 REC-005: Add Pricing Page
**Priority:** 3 | **Impact:** 4 | **Effort:** 2 | **Category:** Copy

**Files to Create:**
- `src/pages/PricingPage.tsx` — new file

**Files to Edit:**
- `src/router.tsx` — add route for `/pricing`
- `src/components/NavBar.tsx` — add "Pricing" link
- `src/components/CTASection.tsx` — link to pricing page

**Requirements:**
1. Create `/pricing` route
2. Pricing content: 2.5% per transaction, no setup fees, no monthly fees
3. FAQ section with common objections
4. Comparison table: PayStreamer vs traditional payment processors
5. Trust badges: "No credit card required", "Cancel anytime"

**Subagent Phrase:** `"pricing-page"`

---

### 🟡 REC-006: Improve Empty States with Actionable Guidance
**Priority:** 4 | **Impact:** 3 | **Effort:** 2 | **Category:** UX Pattern

**Files to Edit:**
- `src/components/ui/empty-state.tsx` — update EmptyState component
- `src/pages/ExplorePage.tsx` — lines 43-45: Update empty state message
- `src/pages/platforms/PlatformOverviewPage.tsx` — lines 27-28: Add tooltip
- `src/pages/platforms/TiersPage.tsx` — lines 56-57: Add tier guidance
- `src/pages/dashboard/AccountsPage.tsx` — lines 61-62: Add account explanation

**Changes:**

1. **ExplorePage empty state:**
```diff
- <p className="text-muted-foreground">
-   There are currently no registered platforms on the network.
- </p>
+ <p className="text-muted-foreground">
+   Be the first platform to accept crypto subscriptions! Register your platform to start collecting.
+ </p>
```

2. **PlatformOverviewPage empty state:**
```diff
- <p className="text-muted-foreground mb-6">
-   You don't own any platforms yet.
- </p>
+ <p className="text-muted-foreground mb-6">
+   A platform is your application or business that wants to accept recurring crypto payments. Create one to get started!
+ </p>
```

3. **TiersPage empty state:**
```diff
- <p className="text-muted-foreground mb-4">No tiers created yet.</p>
+ <p className="text-muted-foreground mb-4">Create your first tier to start monetizing. Example: $9.99/month Basic tier</p>
```

4. **AccountsPage empty state:**
```diff
- <p className="text-muted-foreground mb-4">No accounts yet. Create one to get started.</p>
+ <p className="text-muted-foreground mb-4">A subscription account stores your payment preferences on-chain. Create one to subscribe to platforms.</p>
```

**Subagent Phrase:** `"empty-states"`

---

### 🟡 REC-009: Add Error Recovery Guidance
**Priority:** 5 | **Impact:** 3 | **Effort:** 2 | **Category:** Flow

**Files to Edit:**
- `src/lib/errors.ts` — improve error message parsing
- `src/components/TxStatusToast.tsx` — add help links

**Changes:**

1. **lib/errors.ts** — Add user-friendly error mappings:
```typescript
const ERROR_MESSAGES: Record<string, string> = {
  'InsufficientGas': 'Insufficient SUI balance for transaction. Please add funds to your wallet.',
  'AccountNotFound': 'Subscription account not found. Please create one first.',
  'TierNotActive': 'This subscription tier is no longer active. Please select a different tier.',
  'AlreadySubscribed': 'You are already subscribed to this platform.',
  // ... add more mappings
};
```

2. **TxStatusToast.tsx** — Add action links:
- "View on Sui Explorer" link
- "Need help?" link
- "Copy error details" button

**Subagent Phrase:** `"error-recovery"`

---

## Sprint 2: Strategic Improvements

### 🟠 REC-003: Add Real Social Proof to Homepage
**Priority:** 6 | **Impact:** 5 | **Effort:** 3 | **Category:** Trust

**Files to Create:**
- `src/components/SocialProof.tsx` — new component

**Files to Edit:**
- `src/components/HeroSection.tsx` — replace fake stats with real metrics
- `src/components/CoreFeatures.tsx` — update stats section

**Requirements:**
1. Remove fake animated stats (12.5M+ transactions, $3.6B+ volume)
2. Add "Featured Platforms" section with real platform logos
3. Add customer testimonials (name, company, photo, quote)
4. Add security audit certification badge
5. Add "As seen in" press mentions section

**Note:** This requires gathering real testimonials and platform partnerships first. Placeholder content can be used initially.

**Subagent Phrase:** `"social-proof"`

---

### 🟠 REC-007: Add Tier Comparison on Subscribe Page
**Priority:** 8 | **Impact:** 4 | **Effort:** 3 | **Category:** UX Pattern

**Files to Edit:**
- `src/pages/SubscribePage.tsx` — add comparison table

**Changes:**
1. Add comparison table above tier cards showing features
2. Highlight "Most Popular" tier with badge
3. Add checkmarks/X for feature inclusion

**Subagent Phrase:** `"tier-comparison"`

---

### 🟠 REC-010: Add Onboarding Tooltips for First-Time Platform Owners
**Priority:** 9 | **Impact:** 4 | **Effort:** 3 | **Category:** UX Pattern

**Files to Create:**
- `src/components/onboarding/GettingStartedChecklist.tsx` — new component

**Files to Edit:**
- `src/pages/platforms/PlatformOverviewPage.tsx` — add checklist
- `src/pages/platforms/TiersPage.tsx` — add contextual tooltips
- `src/components/platform/TierModal.tsx` — add tier templates

**Changes:**
1. Add "Getting Started" checklist on /platforms/overview:
   - Step 1: Register your platform ✓
   - Step 2: Create your first tier (with link)
   - Step 3: Configure scheduler (with link)
   - Step 4: Share your platform link

2. Add tier templates in TierModal:
   - "Basic" preset: $9.99/month, monthly billing
   - "Pro" preset: $29.99/month, monthly billing
   - "Enterprise" preset: $99.99/month, monthly billing

**Subagent Phrase:** `"onboarding"`

---

## Sprint 3: Longer Term

### 🔵 REC-004: Simplify Subscription Flow
**Priority:** 7 | **Impact:** 5 | **Effort:** 4 | **Category:** Flow

**Files to Edit:**
- `src/pages/SubscribePage.tsx` — add progress indicator
- Smart contract changes required (out of scope for frontend-only)

**Changes:**
1. Add progress indicator: Step 1 of 3: Connect Wallet → Step 2: Set Up Billing → Step 3: Subscribe
2. Change "Create Account First" to "Set Up Billing Account"
3. Add explanatory tooltip: "Your billing account stores your payment preferences on-chain"
4. Add "What happens after I subscribe?" FAQ section

**Note:** Combines account creation and subscription into single transaction — requires smart contract changes.

**Subagent Phrase:** `"subscription-flow"`

---

### 🔵 REC-008: Standardize Button Styles
**Priority:** 10 | **Impact:** 3 | **Effort:** 3 | **Category:** Visual Design

**Files to Edit:**
- `src/components/ui/button.tsx` — add gradient variant
- `src/components/HeroSection.tsx` — use Button component
- `src/components/CTASection.tsx` — use Button component
- `src/index.css` — remove .btn-primary/.btn-secondary classes

**Changes:**
1. Add `variant="gradient"` to Button component
2. Replace custom `.btn-primary` and `.btn-secondary` classes with Button component
3. Remove legacy styles from index.css

**Subagent Phrase:** `"button-standardization"`

---

## To-Do List

### Sprint 1 Checklist

- [ ] **REC-001** Brand standardization (NavBar, Footer, LandingPage)
  - [ ] NavBar.tsx: "Sui Subscriptions" → "PayStreamer"
  - [ ] Footer.tsx: "Sui Subscriptions" → "PayStreamer"
  - [ ] LandingPage.tsx: "Sui Subscriptions" → "PayStreamer"
  - [ ] Verify no other instances remain

- [ ] **REC-002** Hero CTA fix (HeroSection, LandingPage)
  - [ ] Change navigate('/platforms') to navigate('/explore')
  - [ ] Change "Start for Free" to "Explore Platforms"
  - [ ] Update any secondary CTAs pointing to /platforms

- [ ] **REC-005** Pricing page
  - [ ] Create src/pages/PricingPage.tsx
  - [ ] Add /pricing route to router.tsx
  - [ ] Add "Pricing" link to NavBar
  - [ ] Link from CTASection
  - [ ] Add FAQ section
  - [ ] Add comparison table
  - [ ] Add trust badges

- [ ] **REC-006** Empty state improvements
  - [ ] ExplorePage: "No platforms found" → opportunity framing
  - [ ] PlatformOverviewPage: Add "what is a platform" explanation
  - [ ] TiersPage: Add tier naming guidance
  - [ ] AccountsPage: Add account explanation
  - [ ] Update EmptyState component with action guidance

- [ ] **REC-009** Error recovery guidance
  - [ ] lib/errors.ts: Add user-friendly error mappings
  - [ ] TxStatusToast.tsx: Add "View on Sui Explorer" link
  - [ ] TxStatusToast.tsx: Add "Need help?" link
  - [ ] TxStatusToast.tsx: Add "Copy error details" button

### Sprint 2 Checklist

- [ ] **REC-003** Social proof
  - [ ] Create SocialProof component
  - [ ] Remove fake animated stats from HeroSection
  - [ ] Add platform logos section
  - [ ] Add testimonials section (placeholder)
  - [ ] Add security audit badge
  - [ ] Update CoreFeatures stats

- [ ] **REC-007** Tier comparison
  - [ ] Add comparison table to SubscribePage
  - [ ] Add "Most Popular" badge to recommended tier
  - [ ] Add feature checkmarks/X

- [ ] **REC-010** Onboarding tooltips
  - [ ] Create GettingStartedChecklist component
  - [ ] Add checklist to PlatformOverviewPage
  - [ ] Add tier templates to TierModal
  - [ ] Add contextual tooltips

### Sprint 3 Checklist

- [ ] **REC-004** Subscription flow simplification
  - [ ] Add progress indicator to SubscribePage
  - [ ] Change "Create Account First" → "Set Up Billing Account"
  - [ ] Add explanatory tooltip
  - [ ] Add "What happens after I subscribe?" FAQ
  - [ ] (Requires contract changes for single-transaction flow)

- [ ] **REC-008** Button style standardization
  - [ ] Add gradient variant to Button component
  - [ ] Replace .btn-primary in HeroSection
  - [ ] Replace .btn-primary in CTASection
  - [ ] Remove legacy styles from index.css

---

## Subagent Assignment Phrases

Use these phrases to assign tasks to subagents:

| Phrase | Task | Priority |
|--------|------|----------|
| `"brand-standardization"` | REC-001: Standardize brand name to PayStreamer | P1 |
| `"hero-cta-fix"` | REC-002: Fix Hero CTA navigation and text | P1 |
| `"pricing-page"` | REC-005: Create pricing page with FAQ | P2 |
| `"empty-states"` | REC-006: Improve empty state messages | P2 |
| `"error-recovery"` | REC-009: Add error recovery guidance | P2 |
| `"social-proof"` | REC-003: Add social proof components | P3 |
| `"tier-comparison"` | REC-007: Add tier comparison table | P3 |
| `"onboarding"` | REC-010: Add onboarding checklists | P3 |
| `"subscription-flow"` | REC-004: Simplify subscription flow | P4 |
| `"button-standardization"` | REC-008: Standardize button styles | P4 |

---

## A/B Test Queue

Once implementations are live, run these tests:

| Test ID | Description | Metric |
|---------|-------------|--------|
| AB-001 | Hero headline: "Autopilot" vs "Automatically — No More Chasing Payments" | CTA click rate |
| AB-002 | CTA: "Start for Free" vs "Explore Platforms" | Subscription start rate |
| AB-003 | Brand: "Sui Subscriptions" vs "PayStreamer" | Brand recall |
| AB-004 | Empty state: Problem vs Opportunity framing | Platform registration rate |
| AB-005 | CTA: "Create Account First" vs "Set Up Billing Account" | Account creation rate |
| AB-006 | Subheadline: "Integrate in an afternoon" vs "Most integrations are live same-day" | Bounce rate |
| AB-007 | Newsletter: Vague vs Value-stated copy | Newsletter sign-up rate |
| AB-008 | Subscribe page: Cards only vs Cards + comparison table | Average tier selected |
| AB-009 | Dashboard: No checklist vs Getting Started checklist | 7-day activation rate |
| AB-010 | Errors: Technical vs User-friendly messages | Retry rate |

---

## Definition of Done

Each recommendation is complete when:
- [ ] All specified files are edited
- [ ] No TypeScript errors introduced
- [ ] All changes are responsive (mobile + desktop)
- [ ] Copy changes match the approved rewrites in the audit report
- [ ] WCAG AA accessibility maintained
- [ ] A/B test is queued (if applicable)

---

## Notes

- **REC-004 (Subscription Flow)** requires smart contract changes — coordinate with blockchain team
- **REC-003 (Social Proof)** requires real testimonials — content team to gather
- All changes should maintain the dark theme aesthetic (#0a0a0f background)
- Use the design tokens from UX_AUDIT_REPORT.md Section 1C
