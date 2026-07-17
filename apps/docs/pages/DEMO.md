# PayStreamer — 5-Minute Demo Script

> A line-by-line script for presenting PayStreamer to judges, investors, or
> anyone who has 5 minutes and no prior context. Read it almost verbatim;
> the timings in section headers are guides, not constraints.

## Before the demo

- [ ] `pnpm install` and `pnpm dev` running (or have the deployed URL ready)
- [ ] `pnpm seed:demo` run, `DEMO_PLATFORM_ID` filled in `src/constants.ts`
- [ ] Devnet faucet open in a tab: <https://faucet.sui.io/?network=devnet>
- [ ] Sui Wallet (or Suiet) installed and set to the **devnet** network
- [ ] Wallet funded with a few devnet SUI (a presenter's worst moment is
      getting rate-limited by the faucet live on stage)
- [ ] Subscribe to the demo platform once, in advance, so the 60-second
      billing window is already running when you open the page

## The script

### 1. (0:00) The problem — 30 seconds

"Most Web3 businesses run on MRR — monthly recurring revenue. But
blockchains weren't built for subscriptions. Every 30 days, your user has
to manually sign a transaction. They forget. You churn. Stripe takes 3%.
There's a better way."

### 2. (0:30) The product — 30 seconds

"PayStreamer is Stripe Billing, but for stablecoins on Sui. Your customer
approves a spending limit once. Our smart contracts pull the payment on
schedule, forever, with zero chargebacks. We charge a 2.5% flat fee, taken
on chain in the same stablecoin — no off-platform reconciliation."

### 3. (1:00) The live demo — 3 minutes

[Open the landing page → click **Try the live demo**]

"Here's a real platform on Sui devnet. Let me subscribe."

[Click **Connect Wallet**, then **Subscribe**]

"One signature. That's it. The user has authorized this subscription; the
contract now owns the right to pull from their pre-funded billing account
on schedule."

[Open the dashboard, show the active subscription card]

"Now here's the kicker — the **Process Now** button. It's permissionless.
Anyone can click it. No Stripe, no API key, no monthly fee, no operator
key. Just smart contracts. The scheduler is a shared object on chain; the
authority to bill comes from the platform's pre-authorized scheduler role,
not from whoever submits the transaction."

[Click **Process Now**]
[Wait for the tx to confirm — should be <10 seconds]

"Done. The balance dropped, the platform's treasury grew, and a
`PaymentProcessed` event was emitted. That was a real Sui transaction —
you can click the digest and see it on SuiVision."

[Optional: open SuiVision in a new tab to show the event log]

### 4. (4:00) The architecture — 30 seconds

"Three Move modules in `move/subscriptions/`, plus a shared on-chain
payment scheduler. OpenZeppelin's AccessControl for every authority, OZ
RateLimiter at every boundary. No off-chain cron, no signing key, no
custodian. The 2.5% fee is the only business logic we'd need to add for
mainnet — everything else is generic infrastructure."

### 5. (4:30) The ask — 30 seconds

"We're targeting B2B SaaS and creator-economy platforms who already accept
crypto but want automation. Looking for: design partners to integrate,
audit partners for the production release, and feedback on the developer
SDK we're building.

Try it yourself: <https://github.com/Leac1m/paystreamer>.
The repo has a one-command seed, the demo script, and the contracts."

## FAQ (just in case)

- **Q: "Is this live on mainnet?"**
  A: "Devnet only. Testnet is the next milestone. Mainnet follows the
  audit."
- **Q: "What's the 2.5% fee?"**
  A: "Taken in the contract, denominated in the same stablecoin. No
  additional gas overhead for the platform, and no separate off-chain
  settlement step."
- **Q: "What if my user runs out of balance?"**
  A: "The payment fails on chain, the subscription is marked as a failed
  attempt, and the schedule doesn't advance. The user tops up; the next
  `process_due_payment` call resumes. No surprise charges, no overdraft,
  no auto-retry that drains an empty account."
- **Q: "How is this different from Superfluid or LlamaPay?"**
  A: "Those are streaming — tokens flow per second, forever, until you
  cancel. PayStreamer is billing — discrete charges on a schedule, with a
  subscription object the platform owns, retries, failed-attempt state,
  and rate limits the user controls. The unit of money is a subscription,
  not a flow rate."
- **Q: "What's your competitive moat?"**
  A: "Two things no one else has together. First, the on-chain
  permissionless scheduler — anyone can submit, no operator key, global
  rate limiter as the circuit breaker. Second, the `BalanceContainer`
  abstraction in v2.1 — the same account object can hold public balances
  today and confidential balances tomorrow without a migration. The
  confidential-transfer extension plugs into the same interface."
- **Q: "Where does the demo's 60-second billing come from?"**
  A: "From the demo tier preset. A production tier is normally 30 days.
  We expose a `<1 minute` frequency only on the demo platform so the loop
  fits in a presentation."
- **Q: "Who can pause the scheduler?"**
  A: "A multisig with `PLATFORM_GLOBAL_ADMIN_ROLE` can flip the global
  pause flag. Individual platforms can revoke the `PLATFORM_SCHEDULER_ROLE`
  on their own platform to stop just their billings. Both are on-chain
  events; the off-chain indexer just observes them."

## If the demo breaks

- **"Process Now" returns `ENotDue`** — the tier frequency is longer than
  60 seconds. Re-subscribe to the demo tier preset, or wait out the
  current cycle.
- **`EInsufficientBalance`** — the billing account is empty. Use the
  in-UI **Top Up** action or the devnet faucet; deposits settle
  immediately.
- **Wallet on the wrong network** — the **Process Now** button is hidden
  by the network guard. Switch the wallet to devnet and refresh.
- **Page is blank** — `pnpm dev` is not running, or the build failed.
  Check the terminal output.
- **`DEMO_PLATFORM_ID` is `undefined` in `src/constants.ts`** — the seed
  script has not been run. Run `pnpm seed:demo`, copy the printed ID and
  `initialSharedVersion` into `src/constants.ts`, restart `pnpm dev`.
