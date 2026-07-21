# PayStreamer Agents

## Repo Structure

- `src/` — Vite + React frontend (TypeScript)
- `move/` — Move smart contracts
- `scripts/` — Deployment and test scripts

## Key Commands

```bash
# Frontend (Vite, not Next.js)
pnpm dev --port 5176 --host 0.0.0.0    # Dev server
pnpm build                                  # TypeScript + Vite build
pnpm codegen                               # Regenerate contract types

# Move contracts
sui move test

# Scripts
pnpm seed:demo    # Seed demo platform (idempotent)
pnpm e2e           # Run payment cycle test (Note: for all e2e tests use devnet unless said otherwise. deploy a fresh devnet instance if needed.)
```

## Critical SDK Patterns

### Vite (NOT Next.js)
- Use `import.meta.env.VITE_*` for environment variables, NOT `process.env`
- `.env` file in project root for Vite env vars

### Transaction Building
- **`build({ client, onlyTransactionKind: true })`** — Build without gas resolution (kind bytes only)
- **`Transaction.fromKind(kindBytes)`** — Reconstruct transaction from kind bytes
- **`transaction.build({ client })`** — Full build with gas resolution
- **`Transaction.from(fullBytes)`** — Works for full transaction bytes (NOT kind bytes)

### Signing
- **`keypair.signTransaction(bytes)`** — Returns `{ signature: string, bytes: Uint8Array }`
- **`keypair.signTransaction(bytes).signature`** — Extract the base64 signature string
- **dAppKit `signTransaction({ transaction })`** — Accepts Transaction object, NOT raw bytes

### Sponsor Keypair (Backend)
- Stored in `.env` as hex-encoded bech32 string: `SPONSOR_PRIVATE_KEY=73756970...`
- Decode with: `Buffer.from(hex, 'hex').toString('utf8')` → bech32 → `decodeSuiPrivateKey()`
- See `paystreamer-service/src/lib/sui.ts` for exact pattern

### Client Methods
- **`client.getCoins({ owner, coinType })`** — Returns coins with `coinObjectId` field (NOT `objectId`)
- **`client.executeTransactionBlock`** — Execute signed transaction (NOT `executeTransaction`)

## Deployment IDs (Devnet 2026-06-17)

| Item | ID |
|------|-----|
| Subscriptions | `0xf310efaea5adf4bba799c3628563f8c6e0c9677785dca6d7865744e4a3b80afb` |
| PUSD | `0x7b09f1813d3e96e7759983486e40b4ec4ac32dc802095cbe9ff384d421383160` |
| CoinTypeRegistry | `0x076e62b38cbe903413cb7ee9a177eef0c593a9bac40d0dcdbc7d46315af65639` |
| PaymentScheduler | `0x09d3b621355da923e9076fa95a8ff253331b44b8a0f4fa61b0ca51878b1d1c4e` |
| Demo Platform | `0x1240aa8e48d2df02ff25a359b3b83bc04c749aa6234a923419f5c0d9903d746` |

All IDs in `src/constants.ts` — update on redeployment.

## Persistent Burner Wallet

Burner wallet keypair persisted to LocalStorage (`paystreamer_burner_sk`):
- Dev: both random (unsafe) and persistent wallet shown
- Prod: only persistent wallet shown
- Auto-connects on page reload

See `src/lib/persistentBurnerWallet.ts`.

## Sponsored Transaction Flow

1. Frontend builds transaction, sets `gasOwner` to sponsor address
2. Frontend calls `dAppKit.signTransaction({ transaction: txObject })` 
3. Wallet rebuilds transaction internally (with gas resolution), signs
4. Frontend sends `{ bytes, userSignature, userAddress }` to backend `/sponsor`
5. Backend fetches sponsor's gas coin, builds full transaction with gas, signs with sponsor key
6. Backend executes with `executeTransactionBlock({ transactionBlock: bytes, signature: userSig + sponsorSig })`

## Common Errors

- **"Invalid typed array length"** — `Transaction.from()` on kind bytes fails; use `Transaction.fromKind()` instead
- **"Cannot find gas coin"** — Address balance gas model flaky; use explicit gas coin via `setGasPayment([{ objectId, digest, version }])`
- **"process is not defined"** — Using `process.env` in Vite browser code; use `import.meta.env.VITE_*`

## Skills Reference

Load relevant skills before Sui work:
```sh
npx skills https://github.com/MystenLabs/skills
```

Key skills: `sui-move`, `ptbs`, `frontend-apps`, `sui-object-model`, `sui-publish`

## E2E Testing Rule

All apps that interact with the blockchain must contain at least one E2E test that captures its flow, and it must be tested in the localnet docker environment. E2E tests must cover all new features as they are built.

## Testing Execution Protocol

When AI agents execute, modify, or verify tests, they **MUST** strictly adhere to the following rules to prevent false positives and missed compilation errors:

1. **Zero-Assumption Policy**: If a test times out, fails, or hangs, it must be treated as a hard code defect. Do not dismiss failures as "transient environment issues," "cached builds," or "slow startup times" without conclusive proof.
2. **Deep Log Inspection**: Always read test outputs top-to-bottom. Actively search for `TypeError`, `Module not found`, or `Error` markers occurring *before* the final timeout/failure status.
3. **Mandatory Build Verification**: Because dev servers evaluate code lazily, passing E2E tests against `pnpm dev` or `next dev` is insufficient. `pnpm build` (or `tsc --noEmit`) is a **mandatory** final validation step before considering a task complete for any affected package or app.
4. **Isolate Server vs. Test Issues**: If an E2E test times out while connecting to the local server, manually run the dev server in the background and explicitly inspect its startup output for crashes.
5. **Advocate Granular Testing**: Rather than relying exclusively on heavy browser E2E tests, proactively write isolated unit tests (e.g., React Testing Library, Vitest) for new UI components and hooks to catch compilation and import errors early.
6. **Prefer Automated UI Tests over Manual Testing**: When verifying UI states, Mock Mode behavior, or connection flows, DO NOT rely on manual UI testing via browser subagents or manual verification. Instead, enforce state correctness through Vitest (with React Testing Library) for component logic, and use Playwright for complete E2E interaction smoke tests.
