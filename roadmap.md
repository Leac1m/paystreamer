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
- [ ] Pin and publish a compatibility matrix (SDK / dApp Kit / Sui CLI /
      node versions actually tested together)
- [ ] Test against real testnet, not just localnet (scheduled run of
      `apps/example`'s suite against testnet)

## Phase 2 — Harden against real developer failure modes

- [ ] Audit SDK hooks/provider for silently-swallowed errors
- [ ] Apply `E2E_TESTING_RULES.md`'s loading/empty-state rigor to the SDK's
      own exported components
- [ ] Keep a demo platform reliably alive on testnet for docs "try it live"
      links

## Phase 3 — Deferred features (only after Phase 1–2 are solid)

- [ ] DeepBook routing (`routing.mdx`) — currently undocumented-as-fiction;
      no `DeepBook`/`DepositCap` anywhere in Move or the SDK. Needs real
      scoping before it's built.
- [ ] Seal/Walrus integration (`integration.mdx`) — one read-only helper
      exists; rest is aspirational. Same rule: don't advertise until there's
      a working reference.
- [ ] Mark both docs pages "Coming soon" in the interim
