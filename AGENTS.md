# PayStreamer Agents

## Repo Structure

- `src/` — Vite + React frontend (TypeScript)
- `move/` — Move smart contracts
- `paystreamer-service/` — Node.js backend for sponsored transactions (separate Express service)
- `scripts/` — Deployment and test scripts
- `suiperpower/build-context.md` — Current deployment IDs and verified PTB signatures (keep updated)

## Key Commands

```bash
# Frontend (Vite, not Next.js)
pnpm dev --port 5176 --host 0.0.0.0    # Dev server
pnpm build                                  # TypeScript + Vite build
pnpm codegen                               # Regenerate contract types

# Backend service
cd paystreamer-service && npm run build && npm start

# Move contracts
cd move/subscriptions && sui move build
cd move/subscriptions && sui move test

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
