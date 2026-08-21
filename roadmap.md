# PayStreamer Developer Integration Roadmap

North star: a developer can integrate PayStreamer into their platform on
testnet, stress it, and it just works. Every item below — including the two
deferred features — is prioritized against that, not as an independent
feature checklist.

## Phase 0 — Foundation

- [x] Fix broken quickstart provider example (`createDAppKit`/`DAppKitProvider`
      + `PayStreamerProvider` didn't match any exports that actually exist)
- [x] Verify hooks/components docs match real SDK exports
- [x] Confirm `apps/example` is the canonical, currently-working integration
      reference

## Phase 1 — Make the testnet integration path solid

- [x] Close the GraphQL/gRPC split in `PayStreamerProvider` and its hooks —
      the provider and hooks are still wired to `SuiGraphQLClient` while
      portal, sponsor, and the seed/e2e scripts have moved to `SuiGrpcClient`
      — hooks now read the live client via dApp Kit's `useCurrentClient()`
      (transport-agnostic — works whether an app wires gRPC or GraphQL) and
      `core/graphql.ts` was rewritten as `core/chain.ts` against gRPC. Also
      fixed a real bug found along the way: `useMintTestPusd` referenced the
      shared PUSD TreasuryCap as an owned object. Verified via SDK test
      suite (37 passed) and a live localnet smoke test through the portal
      dashboard (wallet connect, platform/account fetch — zero console
      errors).
- [x] Dogfood the quickstart end to end from a cold start, testnet only —
      installed the real published `@paystreamer/sdk@0.2.0` from npm into a
      fresh Vite app (outside this monorepo) and followed the quickstart
      verbatim. **Blocking finding: it doesn't compile.** The corrected
      quickstart's config uses `pusdTreasuryCapInitVersion`, which only
      exists in this session's unpublished local fixes — 0.2.0 on npm still
      has the old broken provider/hooks. A real developer following today's
      docs against today's published package gets a TS2353 on step 2.
      Separately, even with that field removed to match 0.2.0's actual
      shape, the subscribe modal fetched a real testnet platform (verified
      the object exists on-chain via a raw GraphQL query) but rendered
      "Tier Amount 0.00 PUSD" — a live bug in the published hooks, already
      fixed by this session's gRPC migration but not yet released. Also
      confirmed a fresh `npm install` today pulls `@mysten/sui@2.24.0` /
      `@mysten/dapp-kit-react@2.1.16`, newer than what this repo pins
      (`2.23.1` / `2.1.10`) — feeds directly into the next item.
      **Conclusion: none of Phase 0/1's fixes reach real developers until a
      new version is published to npm. This is now the single blocking
      action for the north star.**
- [ ] Publish a new `@paystreamer/sdk` version with this session's fixes
      (deliberately held for now — continuing other Phase 1 items locally
      first; publishing needs explicit go-ahead when the time comes)
- [x] Pin and publish a compatibility matrix (SDK / dApp Kit / Sui CLI /
      node versions actually tested together) — the dogfood run found the
      root cause: `@mysten/dapp-kit-react`, `@mysten/sui`, and
      `@tanstack/react-query` were regular `dependencies` in the SDK's
      package.json (loose caret ranges), not `peerDependencies`, so a fresh
      `npm install` had no reason to resolve the versions this repo actually
      tests against (pinned via `pnpm-workspace.yaml` overrides but never
      propagated to the published package). Moved them to
      `peerDependencies` pinned to the workspace's actual tested versions
      (`@mysten/sui@2.23.1`, `@mysten/dapp-kit-react@2.1.10`), published a
      compatibility matrix table in the SDK README (the first thing a
      developer sees on the npm page) and the docs quickstart, and pinned
      the install command's peer versions explicitly. Also fixed the SDK
      README's own quickstart example — `<PayStreamerProvider
      network="devnet">` didn't match any real prop and skipped
      `DAppKitProvider` entirely, the same class of bug as the docs-site
      quickstart. Verified: clean build, `tsc --noEmit`, and SDK test suite
      (35/38 — the 3 localnet-only tests need a fresh chain deploy to
      re-verify, unrelated to this change, see PR notes).
- [x] Test against real testnet, not just localnet (scheduled run of
      `apps/example`'s suite against testnet) — added
      `.github/workflows/testnet-e2e.yml` (daily cron + manual dispatch).
      Fixed `apps/example/playwright.config.ts`, which hardcoded
      `NEXT_PUBLIC_NETWORK: 'localnet'` unconditionally, clobbering any
      externally-set value — now respects an existing env var. The job
      checks out and builds the actual workspace SDK (via `workspace:*`),
      so it validates this session's real fixes against real testnet,
      independent of the still-open publish gap (item above).
      **Needs one manual step to actually run**: add a
      `TESTNET_SPONSOR_PRIVATE_KEY` repo secret — an Ed25519 keypair funded
      with testnet SUI (a few SUI is plenty; it only pays gas for the demo
      mint/subscribe flow). I can't provision or fund a wallet myself, so
      the workflow will fail on `E2E_PRIVATE_KEY missing` until this secret
      is added. Generate a keypair (e.g. `sui client new-address ed25519`
      against testnet), fund it via `sui client faucet`, and add its
      `suiprivkey...` export as the secret.

**Phase 1 status**: closed out. 3 of 4 items done and verified; the 4th
(publish) is intentionally on hold, not forgotten — it's a one-command
action (`npm publish` after a version bump) whenever there's a go-ahead.
Everything needed to ship is already committed on this branch.

## Phase 2 — Harden against real developer failure modes

- [x] Audit SDK hooks/provider for silently-swallowed errors — swept every
      `catch` block in `packages/sdk/src` (5 total). `useSubscribe`,
      `useMintTestPusd`, `useSponsoredTransaction` already log and surface
      correctly. Found the real gap one level up: **`SetupSubscriptionModal`
      — the SDK's flagship exported component — destructured `usePlatform`'s
      `data`/`isLoading` but completely discarded `error`/`isError`.** On a
      failed platform fetch it silently rendered a $0.00 tier with an
      *enabled* Subscribe button instead of any error — a real gap, though
      the last item below found the Phase 1 dogfood run's actual root cause
      was a step earlier (bad tier data, not a fetch failure). Fixed: added
      a dedicated error/empty state using the SDK's own
      (previously unused) `ErrorState` component with a working Retry
      button, and disabled the Subscribe path entirely until real tier data
      loads. Also added a `console.error` to `TestnetFaucetButton`'s catch,
      which silently dropped errors when no `onError` handler was passed.
      Added a regression test proving the fix (fetch fails → error shown,
      no $0.00, no clickable button → retry recovers real data). Also
      cleared three stale `graphqlClient`/GraphQL references left behind
      in the hook docs from before this session's gRPC migration.
- [x] Apply `E2E_TESTING_RULES.md`'s loading/empty-state rigor to the SDK's
      own exported components — same fix as above satisfies this directly
      (explicit error state, not a silent stuck/wrong render). Audited the
      only other data-fetching UI export (`TestnetFaucetButton`) — already
      surfaces its `error` state in the UI.
- [x] Keep a demo platform reliably alive on testnet for docs "try it live"
      links — built a health check (`test/testnet-demo-health.test.ts`,
      wired into the Phase-1 testnet workflow, no secret needed since it's
      read-only) that queries `DEMO_PLATFORM_ID` on testnet and asserts it
      has a real, active, non-zero tier. Running it immediately caught a
      **real, pre-existing bug — the actual root cause of the Phase 1
      dogfood run's "Tier Amount 0.00 PUSD"**: `tiers` is a Move
      `VecMap<u64, SubscriptionTier>`, whose on-chain JSON shape is
      `{ contents: [{ key, value }] }`, not a plain array. Neither
      `usePlatform` nor `core/chain.ts`'s `queryPlatform` ever unwrapped it
      — confirmed this predates this session's gRPC migration (the original
      GraphQL code had the identical bug, faithfully carried over). Fixed
      both, mapping the on-chain `frequency_ms` field to `frequency` (what
      `SetupSubscriptionModal`/`buildSubscribeTx` actually call `BigInt()`
      on), while staying tolerant of an already-flat array so the existing
      mock-based tests didn't need to change. Verified against real
      testnet data (failed before the fix, passes after) and confirmed zero
      regressions across the full mocked suite (36/39 — same 2 pre-existing
      localnet-only failures, unrelated) and `tsc --noEmit` on the SDK and
      portal.

**Phase 2 status**: closed out, all 3 items done and verified. Between
Phase 1 and 2, the dogfood run's original "Tier Amount 0.00 PUSD" finding
is now fully explained and fixed at its real root cause, plus the SDK
degrades gracefully (visible error + retry, not a misleading render) the
next time something like this slips through.

## Phase 3 — Deferred features (only after Phase 1–2 are solid)

Scoped and planned (see `~/.claude/plans/linked-conjuring-dream.md` for the
full plan). Direct research — reading the Move contracts and the official
Seal/DeepBook sources — found that the actual building blocks for both
features already exist on-chain. The gap is almost entirely in the
SDK/scheduler/docs layer, not new Move engineering, and **neither feature
needs a contract change or redeploy** given the scope decisions below.

Decisions locked in before planning:
- DeepBook: build both the recurring (scheduler-driven) and onboarding
  (pay-with-any-token-to-subscribe) flows; the swap leg is mocked/stubbed
  in tests since **no real DeepBook liquidity pool exists for PUSD** (a
  demo-only token) on any network — a hard blocker on live end-to-end
  demoing, not a code problem.
- Seal: document the integration pattern only. PayStreamer does not publish
  its own `seal_approve` module — platforms write their own, calling
  PayStreamer's existing `has_active_subscription`. Zero new contract
  surface.
- Recurring DeepBook routing is **opt-in per platform** (a scheduler-side
  allowlist), not automatic — enforced off-chain, since the existing
  `RoutingPotato` mechanism only produces value if the scheduler chooses to
  call it.

### DeepBook routing (`routing.mdx`)

- [x] **On-chain, already done — no changes needed.**
      `move/subscriptions/sources/payment.move:99-103` (`RoutingPotato<phantom FundingCoin, phantom PlatformCoin>`),
      `:230-285` (`withdraw_for_route`, runs the same `can_bill`/policy
      checks as normal billing and withdraws up to `max_spend` of
      `FundingCoin`), `:290-365` (`process_routed_payment`, consumes the
      potato plus the swap output, requires the *exact* amount, refunds
      change, distributes fees with the same 1%/2%/97% split as normal
      payments). `scheduler.move:138-186` already exposes both publicly.
- [x] SDK: `buildProcessRoutedPaymentTx` in `packages/sdk/src/core/transactions.ts`
      (same `tx.sharedObjectRef` pattern as the existing
      `buildProcessPaymentTx` in that file) — chains
      `policies::empty_limiters` → `policies::ensure_initialized` →
      `scheduler::withdraw_for_route` → caller's `performSwap` callback
      (receives the withdrawn `FundingCoin` tx-argument, returns
      `{platformCoin, fundingChange}`) → `scheduler::process_routed_payment`
      in one PTB. Structural test in `test/routedPayment.test.ts` (via
      `vi.spyOn(tx, 'moveCall')`, since `tx.getData()` needs resolved
      object refs) asserts call order and that the exact potato returned
      by `withdraw_for_route` is the one consumed by
      `process_routed_payment`.
- [x] SDK: `packages/sdk/src/core/deepbook.ts`, a thin `@mysten/deepbook-v3`
      wrapper (real, published, v1.6.4) behind a mockable interface, added
      as a **peerDependency** (not a regular dependency — Phase 1 already
      paid for that exact mistake once with `@mysten/sui`/`dapp-kit-react`).
      `swapExactQuantity` wraps the real curried
      `client.deepBook.swapExactQuantity(params)(tx)` call, which returns a
      3-tuple `[baseCoinResult, quoteCoinResult, deepCoinResult]` (verified
      against DeepBook's actual TS source, not guessed) — picks the correct
      output coin based on `isBaseToCoin` direction. Also surfaces that a
      real DEEP-token fee coin (`deepAmount`/`deepCoin`) is required for
      every swap, a real cost the original fictional docs omitted entirely.
      3 mock-based tests in `test/deepbook.test.ts`. **Corrected during
      Milestone 4's execution wiring:** read the real installed package's
      `dist/transactions/deepbook.mjs` directly and found the leg my
      wrapper was dropping (`baseCoinResult` when swapping base→quote, or
      vice versa) is not always zero — if you pass your own `baseCoin`/
      `quoteCoin` argument (the composition case this whole feature exists
      for), that coin's entire value becomes DeepBook's input regardless
      of `amount`, and any unfilled leftover comes back through the
      dropped leg. Since `Coin<T>` has no `drop`, silently discarding a
      possibly-nonzero result would abort the PTB. Renamed it
      `inputChange` and now return it; `amount`'s real, narrower meaning
      (only used to auto-fund an input coin when none is supplied) is
      documented on the type. 2 tests updated to assert on it.
- [x] SDK: `buildOnboardWithSwapTx` — swap → existing `buildCreateAccountTx`
      → existing `buildSubscribeTx` in one PTB. No Move dependency, no
      scheduler trust, could ship independently ahead of the recurring flow.
      Composed via a new optional `depositCoin` param on `buildSubscribeTx`
      (bypasses the existing owned-coin merge/split logic when the coin is
      a fresh swap-output tx-argument rather than something the caller
      already owns) rather than duplicating deposit logic in a new
      function. 2 tests in `test/onboardWithSwap.test.ts` cover call order
      (`performSwap` runs before any PayStreamer call) and that the
      deposited coin is exactly `performSwap`'s output.
- [x] Scheduler: opt-in routing support. `discovery.ts` now reads each
      account's tier_index/tier_amount (already in the on-chain
      `Subscription` struct, just never extracted before) and, once per
      platform per cycle, the platform's `SubscriptionTier.denomination`
      for that index via a new `getPlatformTierDenominations` — confirmed
      live against the real testnet demo platform
      (`0xe6baf886...eb1eb`) that gRPC encodes a `TypeName` field as a
      plain fully-qualified type string (e.g.
      `"0x74d1...::pusd::PUSD"`), not a nested object — grounded in real
      data, not assumed. `routing.ts`'s `classifyPayment` (pure, 4 tests
      in `test/routing.test.ts`) is the actual behavior change: same
      currency → `direct` (the untouched existing path, i.e. every demo
      platform today); mismatched but not in
      `ROUTING_ALLOWLIST_JSON` → `unroutable`, now explicitly *skipped*
      in `payment.ts` instead of falling through to the plain path, which
      would otherwise silently credit the platform in the wrong coin
      (`process_due_payment` never checks the account's coin type against
      the tier's declared denomination on-chain — a real, previously
      undocumented gap); mismatched and opted in → `routed`, executed by
      the new `routedPayment.ts` via `buildProcessRoutedPaymentTx` +
      `swapExactQuantity`, using DeepBook's own published
      `testnetCoins`/`testnetPools` registries rather than inventing a
      pool schema. The allowlist (`routingConfig.ts`, `ROUTING_ALLOWLIST_JSON`
      env var) requires the operator to set `maxSpend` explicitly per
      platform+funding-currency pair — there's no price oracle here to
      derive a FundingCoin bound from the tier's PlatformCoin amount, the
      same reason `withdraw_for_route` itself takes `max_spend` as a
      caller-supplied bound rather than computing one on-chain. The swap
      leg is UNTESTED against live liquidity (still no real DeepBook pool
      for any PayStreamer token, on any network) — only structural
      wiring, documented inline in `routedPayment.ts`'s module comment.
- [x] Docs: rewrote `routing.mdx` — dropped the fictional `DepositCap`
      example and wrong `swapExactBaseForQuote` call signature entirely.
      Documents the real `RoutingPotato<FundingCoin, PlatformCoin>`
      (`payment.move:99-103`), both on-chain functions with file:line
      citations, and the exact-amount requirement (with a callout
      explaining why, since it's the least intuitive part). Two full
      working code samples against the real, now-committed SDK builders:
      `buildOnboardWithSwapTx` for one-shot onboarding, and
      `buildProcessRoutedPaymentTx` for the scheduler's recurring path,
      including the `inputChange`/`deepChange` consumption the on-chain
      hot-potato and `Coin<T>`'s missing `drop` ability both demand.
      Documents `ROUTING_ALLOWLIST_JSON`/`DEEP_COIN_TYPE` for operators.
      Opens with an upfront `Callout` disclosing the liquidity blocker
      rather than burying it. `next build` passes, `/routing` compiles
      clean (7.02 kB).
- [x] Tests: `payment_tests.move` had only the happy path
      (`test_process_routed_payment_succeeds`) for the routed flow — no
      abort coverage. Added `test_process_routed_payment_wrong_amount_fails`
      (`EZeroAmount`, the exact-payment-required check) and
      `test_process_routed_payment_wrong_account_fails` (`EInvalidPotato`,
      settling against an account the potato wasn't minted for). Full
      suite: 42/42 passing (was 40, zero Move source changes — test-only
      additions). SDK: 6 mock-based tests across `deepbook.test.ts` /
      `routedPayment.test.ts` (Milestones 1-2). Scheduler: 9 tests across
      `discovery.test.ts` (tier-index/settlement-denomination extraction,
      including a live-shaped mock and an RPC-failure-returns-empty-map
      case) and `routing.test.ts` (all 4 `classifyPayment` branches). No
      live testnet swap coverage exists or can exist until real DeepBook
      liquidity does — `routedPayment.ts`'s execution wiring itself has no
      dedicated test file, since mocking `@mysten/deepbook-v3`'s real
      curried API convincingly enough to be worth more than the SDK-level
      `swapExactQuantity` tests already provide wasn't judged worth the
      churn; it's covered structurally by `payment.ts` routing through the
      already-tested classifier plus a clean `tsc --noEmit` across the
      whole call chain.

### Seal integration (`integration.mdx`) — docs-only

- [x] **On-chain: nothing to build.**
      `move/subscriptions/sources/account.move:543-562`'s
      `has_active_subscription<T>(account, platform_id): bool` is already
      the exact primitive needed (doc-commented for this purpose at line
      541).
- [x] Docs: fixed `integration.mdx`'s Move example — the old
      `use seal::policy::{Self, SealPolicy}; public fun verify_access(...): bool`
      was fictional. Replaced with the real Seal contract shape (sourced
      directly from Seal's own official example,
      github.com/MystenLabs/seal/blob/main/move/patterns/sources/subscription.move,
      fetched and verified live): `entry fun seal_approve(id: vector<u8>, ...)`
      — no return value, aborts via `assert!` on denial, `id` follows a
      namespace-prefix convention. Docs now show a real sample a platform
      integrator would write, delegating to `has_active_subscription`, plus
      an explicit callout that PayStreamer doesn't publish its own module
      (the locked-in scope decision).
- [x] Tests: added `move/subscriptions/tests/seal_policy_example_tests.move`
      — the exact sample shown in the docs, compiled and tested for real
      (active/paused/wrong-platform/wrong-namespace-prefix cases, 4 tests,
      all passing). This is what makes the docs page trustworthy instead of
      just plausible-looking; the whole point of this roadmap has been
      docs describing things that don't actually work. Full suite:
      40/40 passing, zero warnings.
- [x] SDK: `packages/sdk/src/core/seal.ts` — thin wrapper (`createSealClient`,
      `encryptForPolicy`, `createSealSessionKey`, `decryptWithPolicy`) around
      `@mysten/seal` (real, published, v1.4.0). Built against the package's
      actual shipped type declarations, not its prose docs — the docs.md
      bundled in the npm package shows a `client.$extend(seal({...}))`
      pattern that **doesn't exist in the real exports** (confirmed: no
      `seal()` extend function anywhere in `dist/index.d.mts`); the real,
      type-checked API is a plain `new SealClient({ suiClient,
      serverConfigs, ... })` constructor. `SealCompatibleClient` is the same
      `ClientWithExtensions<{ core: CoreClient }>` shape as the rest of this
      SDK's transport-agnostic client handling, so it slots in directly
      wherever `useCurrentClient()` is already used. Added `@mysten/seal` as
      an **optional peerDependency** (`peerDependenciesMeta.optional`,
      matching the Phase-1 dependency-hygiene fix — most SDK consumers don't
      need Seal). Mock-based unit tests added (`test/seal.test.ts`, 4
      passing). Verified: clean build, `tsc --noEmit` clean across the SDK
      and all 4 downstream apps, full SDK suite 40/44 (same 2 pre-existing
      localnet-infra failures, 2 pre-existing skips, unrelated).
- [x] Worked example: `apps/example/src/app/gated-content/` — encrypt with
      Seal, upload the ciphertext to Walrus, then gate decryption on a real
      client-side `has_active_subscription`-shaped check before even
      attempting the Seal dry-run (the actual security boundary is the
      on-chain `seal_approve` call itself; the client check is a UX
      convenience, documented as such in the page). `packages/sdk/src/core/walrus.ts`
      is a new thin `@mysten/walrus` wrapper (real, published, v1.2.14,
      `.$extend(walrus())` verified against the installed package's own
      `docs/index.md` — unlike Seal, this pattern IS real for Walrus),
      4 mock-based tests in `test/walrus.test.ts`. The decrypt flow parses
      the `id` back out of the downloaded ciphertext via `@mysten/seal`'s
      `EncryptedObject.parse()` rather than threading it through component
      state, so publish and unlock are independently correct (matches the
      real-world case where you only ever have a blobId). Signing bridges
      through `@mysten/dapp-kit-core`'s `CurrentAccountSigner` — a real
      `Signer` subclass wrapping the connected wallet, found while tracing
      how to satisfy Walrus's `writeBlob({signer})` without a raw keypair.
      **Won't run end-to-end out of the box** (disclosed on the page
      itself): needs a `seal_approve` policy module actually deployed on
      testnet (the sample from `seal_policy_example_tests.move` works),
      the two example Seal testnet key servers from `@mysten/seal`'s own
      docs actually responding, and a wallet funded with testnet WAL to
      pay Walrus storage fees — the same category of disclosed
      infrastructure blocker as DeepBook's liquidity gap, not a code
      problem. No dedicated test for the page's local subscription-status
      helper (mirrors already-tested VecMap-parsing logic from
      `chain.ts`/the scheduler's `discovery.ts`; not worth extracting for
      one call site).

      **Found and fixed a real bug while building this**: `core/index.ts`
      was doing `export * from './seal'` / `'./deepbook'` / `'./walrus'`
      — unconditionally re-exporting three *optional* peerDependency
      wrappers from the main barrel. Verified live this breaks real
      builds two different ways: (1) Next.js/Turbopack — importing
      anything from `@paystreamer/sdk`'s root (as every app's top-level
      provider does) pulled Walrus's WASM loader into the SSR bundle even
      though only one client-only page used it, crashing with an ENOENT
      on a Turbopack-virtualized path; (2) Vite — confirmed the portal
      app, which uses *none* of Seal/DeepBook/Walrus, was pre-bundling
      all three anyway. Fixed by giving each its own subpath entry point
      (`@paystreamer/sdk/core/seal`, `.../core/deepbook`, `.../core/walrus`)
      and removing them from the `core`/root barrels; updated every call
      site (`routedPayment.ts`, `GatedContentDemo.tsx`, `routing.mdx`).
      Re-verified: portal's Vite dep cache no longer contains any of the
      three after a clean re-optimize, and `/gated-content` went from a
      500 to a clean 200 on Next.js dev. This was a latent regression from
      the DeepBook and Seal milestones earlier in Phase 3 — undetected
      until an actual dev server was run against a page that imports the
      SDK's root barrel, since `tsc --noEmit` alone can't catch it.
- Note: no CI-level integration testing is possible against Seal's live
  key-server network (a separate MPC system) — inherently manual/demo-verified.

**Sequencing**: after the still-held SDK npm publish (Phase 1's last item),
since both features' SDK pieces build on the already-fixed provider/hooks.
Seal (docs-only) is the faster win and could ship first; DeepBook has more
moving parts (scheduler bot changes) and a disclosed liquidity blocker on
full live verification.

**Status: done.** `@paystreamer/sdk@0.3.0` published to npm, TypeDoc live
at docs.usepaystreamer.xyz/typedoc.

## Phase 4 — Two new verticals (planning)

Two independent initiatives, both still at the planning stage — nothing
below is implemented yet.

### 4a. Creator/content subscription platform (Fundsui-inspired)

Researched [CheatCodeSam/WAL-Hackathon](https://github.com/CheatCodeSam/WAL-Hackathon)
("Fundsui") directly — cloned and read all three of its Move modules
(`channel.move`, `podcast.move`, `seal_policy.move`), not just the README.
It's a decentralized podcast-subscription platform: creators run a
`Channel` (subscription price, max duration), upload `Podcast`s (Walrus
blob reference + a Seal encryption nonce + a back-reference to the
channel), and `seal_policy::seal_approve_subscription` gates decryption on
`channel.is_address_subscription_active(sender, clock)`.

**Key finding: the access-control shape is already solved by PayStreamer,
almost identically.** Fundsui's `seal_approve_subscription` — check the id
matches the content's nonce, check the subscription is active, abort
otherwise — is structurally the same pattern already documented and
Move-tested in `/integration` (`seal_policy_example_tests.move`), just
with `has_active_subscription` instead of `is_address_subscription_active`.

This isn't a coincidence — confirmed directly with the user: Fundsui is
their own prior project, co-built before PayStreamer, and PayStreamer was
built specifically to solve the recurring-payment limitation Fundsui's
own contract has (prepay-N-weeks, manual renewal, no auto-billing). This
Phase is that fix landing back in its origin project, not a speculative
integration exercise.

**Decision: fork Fundsui, don't build fresh.** Pull the actual
CheatCodeSam/WAL-Hackathon codebase (Next.js/tRPC/Drizzle/Postgres,
channels/podcasts/upload/dashboard already built and working) into this
monorepo, and replace `channel.move`'s payment/subscription logic with
calls into PayStreamer's existing `account`/`platform`/`scheduler`
modules — keeping `podcast.move`'s content-metadata shape and
`seal_policy.move`'s access-control pattern largely as-is, since both
already match PayStreamer's primitives closely (see above). This reuses
real, working UI instead of rebuilding channels/upload/dashboard from
scratch, at the cost of inheriting a Postgres+tRPC stack this monorepo
doesn't otherwise use.

**Where the two protocols genuinely differ:**

| | Fundsui | PayStreamer |
|---|---|---|
| Billing model | Prepay N weeks (`payment_amount ÷ weekly_price`); no auto-renewal, user must manually repurchase before expiry | True recurring — `scheduler::process_due_payment` auto-deducts every cycle from a pre-funded balance, no user action needed |
| Currency | Hardcoded `Coin<SUI>` | Any denomination via `SubscriptionAccount<T>` generics (PUSD by default) |
| Fee split | 2% platform + 1% frontend host, taken once at purchase | 1% scheduler + 2% protocol + 97% platform, taken every cycle |
| User subscription state | Scattered per-`Channel`, keyed by address in an `ObjectTable` | Unified per-user `SubscriptionAccount` holding balance + every platform's subscription in one `VecMap` |
| Frontend decentralization | Built-in: `frontend_address` param at subscribe time gets a revenue cut — anyone can host a frontend and earn from it | Not present |

PayStreamer's recurring auto-billing is strictly the harder problem and
already solved; Fundsui's frontend-revenue-share is a real idea
PayStreamer doesn't have. Fundsui also uses Walrus's HTTP
publisher/aggregator endpoints for upload/download (simpler, fewer round
trips) rather than direct storage-node connections — worth adding as an
option to `core/walrus.ts` regardless of this vertical, since it's a
legitimate simpler mode for a browser client.

**Scope:**
- The forked app, with its existing channels/podcast upload/browse/
  dashboard UI, backed by PayStreamer's actual protocol instead of
  `channel.move`'s own payment logic: `buildRegisterPlatformTx` (channel = platform),
  `buildCreateTierTx` (subscription price = tier), `core/seal.ts` +
  `core/walrus.ts` for encrypt-on-upload and gated fetch (both already
  built this session, currently only exercised by the minimal
  `/gated-content` smoke test in `apps/example`).
- A thin new Move module for content metadata only (title, description,
  Walrus blob ref, Seal nonce, platform-id back-reference) — mirroring
  Fundsui's `Podcast` struct. Payment/subscription state stays entirely on
  PayStreamer's existing `account`/`platform` modules; this module doesn't
  reimplement anything PayStreamer already has.
- A `seal_approve` policy for this new module, following `/integration`'s
  documented pattern exactly (delegating to `has_active_subscription`).

**Still open:**
- Generalize past podcasts (any Walrus-hosted content) from day one, or
  ship the podcast-specific version first?
- Adopt Fundsui's frontend-revenue-share incentive model, or leave that
  out of scope for the initial fork?
- Where the fork lives in this monorepo (`apps/fundsui`? a top-level
  sibling checkout?), and whether it joins the pnpm workspace directly or
  stays a separate install given its own Postgres/Drizzle dependency.

### 4b. Scheduler browser extension

`/scheduler`'s docs already floated this ("schedulers can easily be
packaged as lightweight web extensions... automatically earn 1% fees in
the background") but it was never built. Checked `apps/scheduler`'s
actual code against that claim: `discovery.ts`, `payment.ts`, and `sui.ts`
are already built entirely on `@mysten/sui`'s isomorphic APIs
(`SuiGrpcClient`, `Ed25519Keypair`, `SuiGraphQLClient`) — nothing Node-only
in the actual scheduling logic itself, only in its dev tooling
(`dotenv`, `tsx`).

**Confirmed with the user: wanted**, with an explicit priority on good UX
for the person earning the fee — not just a bare technical proof that it
can run in a service worker. The popup/earnings surface below isn't an
afterthought; it's the point.

**What genuinely needs to change for a Manifest V3 extension:**
- **Polling loop**: `setInterval` (current, 10s via `SCHEDULER_INTERVAL_MS`)
  doesn't survive an MV3 service worker being suspended when idle — needs
  `chrome.alarms`, whose minimum granularity is 1 minute. A real,
  disclosed tradeoff: the extension can't poll as tightly as the
  standalone service.
- **Key management**: currently `SCHEDULER_PRIVATE_KEY` from a `.env` file
  (a trusted server-side secret). An extension has no equivalent — needs
  first-run keypair generation or import into `chrome.storage.local`,
  with clear UX for funding it with a small amount of gas.
- **Packaging**: a new Vite-based app producing a proper
  `manifest.json` + background service worker + popup — this monorepo
  already uses Vite everywhere else, so a Vite + CRX-plugin (or `wxt`)
  setup fits the existing tooling rather than introducing a new build
  system.
- **UI surface**: a popup for status/earnings-to-date, an options page for
  the private key and an opt-in platform allowlist (mirroring
  `apps/scheduler`'s own opt-in routing allowlist pattern from Phase 3).

**Open questions for the user:**
- Chrome (Manifest V3) only, or also Firefox (different manifest/extension
  APIs, meaningfully more work)?
- Publish to the Chrome Web Store (requires a developer account and goes
  through Google's review process — outside what I can do myself), or
  distribute as an unpacked/sideloaded extension for now?
- Reuse `apps/scheduler`'s discovery/payment logic via a shared internal
  package, or fork-and-adapt directly inside the new extension app? A
  shared package avoids drift between the two; a fork is faster to ship
  and doesn't risk destabilizing the working standalone service.

Both 4a and 4b are genuinely independent and could ship in either order —
4b is the smaller, more contained piece if a quicker win is preferred; 4a
is the bigger, more product-shaped effort.
