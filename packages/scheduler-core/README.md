# @paystreamer/scheduler-core

Runtime-agnostic PayStreamer scheduler logic: platform/subscription
discovery, due-payment billing, and the opt-in DeepBook routing decision.
Internal to this monorepo — not published to npm.

## Why it exists

The scheduling logic used to live in `apps/scheduler`, where `config.ts`,
`sui.ts`, and `routingConfig.ts` were **module-level singletons evaluated at
import time from `process.env`** (including a hard `throw` on a missing
key). That works for a Node service reading `.env` at startup, but it can't
serve a browser extension, whose config only resolves asynchronously from
`chrome.storage.local` *after* the module graph has loaded.

Every entry point here takes an explicit `SchedulerContext` instead, so the
same billing code drives both hosts and the routing rules never exist in two
drifting copies.

## Usage

```ts
import {
  createScheduler,
  parseRoutingAllowlist,
  parseSchedulerKeypair,
  type SchedulerContext,
} from '@paystreamer/scheduler-core';

const keypair = parseSchedulerKeypair(secret);

const context: SchedulerContext = {
  grpcClient,
  gqlClient,
  signer: keypair,
  senderAddress: keypair.toSuiAddress(),
  network: 'testnet',
  packageId,
  registryId,
  paymentSchedulerId,
  routingAllowlist: parseRoutingAllowlist(allowlistJson),
  deepCoinType,
};

const scheduler = createScheduler(context);
const result = await scheduler.runCycle();
```

`createScheduler` adds the single-flight guard the standalone service has
always had: a cycle still in flight when the next tick fires is declined
(`ran: false`) rather than run concurrently against the same accounts. Use
the bare `runCycle(ctx)` if the host manages its own concurrency.

`runCycle` returns a `CycleResult` — what was scanned, billed, skipped, and
what failed — rather than only logging. A Node service prints it; an
extension's service worker persists it so a popup can read it long after the
worker itself has been suspended.

## DeepBook routing is a separate entry point

`processRoutedPayment` / `createRoutedPaymentExecutor` live at
`@paystreamer/scheduler-core/routed-payment`, not in the main barrel,
because that module is the only one that pulls in `@mysten/deepbook-v3` (an
optional peer dependency). Re-exporting it from the root would drag DeepBook
into every consumer's bundle whether or not they route — the exact
regression the SDK's own subpath entry points were introduced to fix.

A host that wants routing assigns the executor after building its context
(the executor closes over the very context it attaches to):

```ts
import { createRoutedPaymentExecutor } from '@paystreamer/scheduler-core/routed-payment';

context.routedPaymentExecutor = createRoutedPaymentExecutor(context);
```

A host that leaves `routedPaymentExecutor` undefined has routed payments
**skipped**, never billed through the plain path — mispaying in the wrong
coin is the failure this whole classification exists to prevent.

## Known limits

- The DeepBook-routed path has structural/mocked coverage only. No real
  DeepBook liquidity pool exists for any PayStreamer token on any network
  (see `roadmap.md` Phase 3), so it has never executed against a live order
  book.
- `discoverPlatforms` re-queries the last 50 `PlatformRegistered` events and
  then walks every account each cycle. Fine at demo scale; not how this
  would work at real volume.
