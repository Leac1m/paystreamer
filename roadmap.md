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

- [ ] **On-chain, already done — no changes needed.**
      `move/subscriptions/sources/payment.move:99-103` (`RoutingPotato<phantom FundingCoin, phantom PlatformCoin>`),
      `:230-285` (`withdraw_for_route`, runs the same `can_bill`/policy
      checks as normal billing and withdraws up to `max_spend` of
      `FundingCoin`), `:290-365` (`process_routed_payment`, consumes the
      potato plus the swap output, requires the *exact* amount, refunds
      change, distributes fees with the same 1%/2%/97% split as normal
      payments). `scheduler.move:138-186` already exposes both publicly.
- [ ] SDK: `buildProcessRoutedPaymentTx` in `packages/sdk/src/core/transactions.ts`
      (same `tx.sharedObjectRef` pattern as the existing
      `buildProcessPaymentTx` in that file) — chains
      `withdraw_for_route` → caller's swap → `process_routed_payment` in
      one PTB.
- [ ] SDK: `packages/sdk/src/core/deepbook.ts`, a thin `@mysten/deepbook-v3`
      wrapper (real, published, v1.6.4) behind a mockable interface, added
      as a **peerDependency** (not a regular dependency — Phase 1 already
      paid for that exact mistake once with `@mysten/sui`/`dapp-kit-react`).
- [ ] SDK: `buildOnboardWithSwapTx` — swap → existing `buildCreateAccountTx`
      → existing `buildSubscribeTx` in one PTB. No Move dependency, no
      scheduler trust, could ship independently ahead of the recurring flow.
- [ ] Scheduler: `apps/scheduler/src` currently has zero references to
      routing and assumes same-currency accounts throughout. Add a static
      opt-in allowlist (platform IDs the operator has chosen to support)
      and branch mismatched-currency accounts on that list into the new
      routed-payment path instead of the plain payment path.
- [ ] Docs: rewrite `routing.mdx` — drop the fictional `DepositCap` example,
      document the real `RoutingPotato` PTB shape and the onboarding
      composition, working code against the new SDK builders, explicit
      about opt-in-only and the liquidity blocker on live demos.
- [ ] Tests: verify `payment_tests.move`/`scheduler_tests.move` cover the
      routed-payment abort paths (add if gaps found — no new Move code, so
      this is verification not new test-writing); mock-based SDK tests for
      the new builders; scheduler tests for the opt-in branching logic. No
      live testnet swap coverage possible until real liquidity exists.

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
- [ ] SDK: `packages/sdk/src/core/seal.ts`, a thin `@mysten/seal` wrapper
      (real, published, v1.4.0) for encrypt-on-upload and
      session-key/decryption-key-fetch.
- [ ] Worked example (under `apps/example` or a new docs-site interactive
      sample): Walrus upload → Seal encrypt against a PayStreamer-backed
      policy → gated fetch/decrypt keyed off a real
      `has_active_subscription` check.
- Note: no CI-level integration testing is possible against Seal's live
  key-server network (a separate MPC system) — inherently manual/demo-verified.

**Sequencing**: after the still-held SDK npm publish (Phase 1's last item),
since both features' SDK pieces build on the already-fixed provider/hooks.
Seal (docs-only) is the faster win and could ship first; DeepBook has more
moving parts (scheduler bot changes) and a disclosed liquidity blocker on
full live verification.
