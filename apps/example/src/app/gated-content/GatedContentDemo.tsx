'use client';

import { useState } from 'react';
import { useCurrentAccount, useDAppKit, useCurrentClient } from '@mysten/dapp-kit-react';
import { CurrentAccountSigner } from '@mysten/dapp-kit-core';
import dynamic from 'next/dynamic';
import { Transaction } from '@mysten/sui/transactions';
import { fromHex, toHex, normalizeSuiAddress } from '@mysten/sui/utils';
import {
  useUserAccount,
  usePayStreamerConfig,
  getConfig,
} from '@paystreamer/sdk';
import {
  createSealClient,
  encryptForPolicy,
  createSealSessionKey,
  decryptWithPolicy,
} from '@paystreamer/sdk/core/seal';
import { createWalrusClient, uploadContent, downloadContent } from '@paystreamer/sdk/core/walrus';
import { EncryptedObject } from '@mysten/seal';
import type { KeyServerConfig } from '@mysten/seal';

const ConnectButton = dynamic(
  () => import('@mysten/dapp-kit-react/ui').then((mod) => mod.ConnectButton),
  { ssr: false }
);

// Mysten's own published testnet key servers, as shown in @mysten/seal's
// bundled docs — not something this demo invented. Whether they're live
// right now hasn't been independently verified here; swap in your own if
// they don't respond. See /integration for the on-chain seal_approve side.
const DEFAULT_KEY_SERVERS: KeyServerConfig[] = [
  {
    objectId: '0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98',
    aggregatorUrl: 'https://seal-aggregator-testnet.mystenlabs.com',
    weight: 1,
  },
  { objectId: '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75', weight: 1 },
];
const THRESHOLD = 2;

/** Reads the account's on-chain subscription status for one platform — same VecMap-unwrapping shape used by apps/scheduler and packages/sdk/src/core/chain.ts. */
async function fetchSubscriptionStatus(client: any, accountId: string, platformId: string): Promise<'active' | 'inactive' | 'unknown'> {
  try {
    const res = await client.core.getObject({ objectId: accountId, include: { json: true } });
    const json = res.object?.json as any;
    const contents = json?.subscriptions?.contents ?? [];
    const entry = contents.find((e: any) => (e?.key ?? e?.fields?.key) === platformId);
    if (!entry) return 'inactive';
    const value = entry.value ?? entry.fields?.value;
    const status = typeof value?.status === 'object' ? value.status?.variant : value?.status;
    return Number(status) === 0 ? 'active' : 'inactive';
  } catch {
    return 'unknown';
  }
}

export default function GatedContentDemo() {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const client = useCurrentClient();
  const config = usePayStreamerConfig();
  const { userAccount } = useUserAccount();

  const networkConfig = getConfig(config.network as any);
  const [platformId, setPlatformId] = useState(networkConfig.DEMO_PLATFORM_ID);
  const [policyPackageId, setPolicyPackageId] = useState('');
  const [moduleName, setModuleName] = useState('content_policy');

  const [plaintext, setPlaintext] = useState('This is a subscriber-only message, encrypted with Seal and stored on Walrus.');
  const [blobId, setBlobId] = useState('');
  const [publishState, setPublishState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [publishError, setPublishError] = useState('');

  const [unlockedText, setUnlockedText] = useState('');
  const [unlockState, setUnlockState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [unlockError, setUnlockError] = useState('');
  const [subStatus, setSubStatus] = useState<'unchecked' | 'active' | 'inactive' | 'unknown'>('unchecked');

  const canPublish = !!account && !!userAccount;
  const canUnlock = !!account && !!userAccount && !!policyPackageId && !!blobId;

  async function handlePublish() {
    if (!account) return;
    setPublishState('busy');
    setPublishError('');
    try {
      const sealClient = createSealClient({ suiClient: client, serverConfigs: DEFAULT_KEY_SERVERS });

      // Namespace the id under this platform's own address bytes, per the
      // `is_namespaced_to_platform` convention documented in /integration —
      // the policy checks the id starts with `[platform_id]` before it
      // ever consults subscription status.
      const nonce = crypto.getRandomValues(new Uint8Array(8));
      const idBytes = new Uint8Array([...fromHex(normalizeSuiAddress(platformId)), ...nonce]);
      const idHex = toHex(idBytes);

      const { encryptedObject } = await encryptForPolicy({
        client: sealClient,
        packageId: policyPackageId,
        id: idHex,
        data: new TextEncoder().encode(plaintext),
        threshold: THRESHOLD,
      });

      const walrusClient = createWalrusClient({ client });
      const signer = new CurrentAccountSigner(dAppKit);
      const { blobId: newBlobId } = await uploadContent({
        walrusClient,
        content: encryptedObject,
        signer,
        epochs: 3,
        deletable: true,
      });

      setBlobId(newBlobId);
      setPublishState('done');
    } catch (err: any) {
      setPublishError(err?.message || String(err));
      setPublishState('error');
    }
  }

  async function handleUnlock() {
    if (!account || !userAccount) return;
    setUnlockState('busy');
    setUnlockError('');
    try {
      const status = await fetchSubscriptionStatus(client, userAccount.accountId, platformId);
      setSubStatus(status);

      const walrusClient = createWalrusClient({ client });
      const ciphertext = await downloadContent({ walrusClient, blobId });

      // The id used at encryption time is embedded in the ciphertext's own
      // BCS header (EncryptedObject.id) — decoding it here decouples
      // unlock from publish, matching the real-world case where you only
      // ever have the blobId, not the encrypting session's local state.
      const { id: idHex } = EncryptedObject.parse(ciphertext);

      const sealClient = createSealClient({ suiClient: client, serverConfigs: DEFAULT_KEY_SERVERS });
      const signer = new CurrentAccountSigner(dAppKit);

      const sessionKey = await createSealSessionKey({
        address: account.address,
        packageId: policyPackageId,
        ttlMin: 10,
        signer,
        suiClient: client,
      });

      const tx = new Transaction();
      tx.moveCall({
        target: `${policyPackageId}::${moduleName}::seal_approve`,
        typeArguments: [networkConfig.PUSD_TYPE_ARG],
        arguments: [
          tx.pure.vector('u8', fromHex(idHex)),
          tx.object(userAccount.accountId),
        ],
      });
      const txBytes = await tx.build({ client, onlyTransactionKind: true });

      const decrypted = await decryptWithPolicy({ client: sealClient, data: ciphertext, sessionKey, txBytes });
      setUnlockedText(new TextDecoder().decode(decrypted));
      setUnlockState('done');
    } catch (err: any) {
      setUnlockError(err?.message || String(err));
      setUnlockState('error');
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <nav className="border-b border-neutral-200/80 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
          <span className="text-xl font-black tracking-tight text-neutral-950">Gated Content Demo</span>
          <ConnectButton />
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-16 space-y-8">
        <div className="p-6 rounded-2xl bg-yellow-400/10 border border-yellow-400/40 text-neutral-800 text-sm leading-relaxed">
          <p className="font-bold mb-2">What this demonstrates</p>
          <p className="mb-2">
            The full Seal + Walrus loop from <a href="/integration" className="underline font-semibold">/integration</a>: encrypt content with Seal, store the ciphertext on Walrus, then gate decryption on a real <code className="bg-yellow-400/20 px-1 rounded">has_active_subscription</code> check — all client-side code, no PayStreamer contract changes.
          </p>
          <p>
            <strong>This won&apos;t run end-to-end out of the box.</strong> It needs: (1) your own <code className="bg-yellow-400/20 px-1 rounded">seal_approve</code> policy module deployed on testnet (the sample in <code className="bg-yellow-400/20 px-1 rounded">move/subscriptions/tests/seal_policy_example_tests.move</code> works — deploy it and paste its package ID below), (2) the Seal testnet key servers below actually responding, and (3) your wallet holding testnet WAL to pay Walrus storage fees. Same category of disclosed blocker as /routing&apos;s DeepBook liquidity gap — real code, missing live infrastructure.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white border border-neutral-200 space-y-4">
          <h2 className="font-bold text-lg">Configuration</h2>
          <label className="block text-sm font-semibold text-neutral-600">
            Policy package ID (your deployed content_policy module)
            <input
              value={policyPackageId}
              onChange={(e) => setPolicyPackageId(e.target.value)}
              placeholder="0x..."
              className="mt-1 w-full px-3 py-2 rounded-lg border border-neutral-300 font-mono text-sm"
            />
          </label>
          <label className="block text-sm font-semibold text-neutral-600">
            Module name
            <input
              value={moduleName}
              onChange={(e) => setModuleName(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-neutral-300 font-mono text-sm"
            />
          </label>
          <label className="block text-sm font-semibold text-neutral-600">
            Platform ID
            <input
              value={platformId}
              onChange={(e) => setPlatformId(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-neutral-300 font-mono text-sm"
            />
          </label>
        </div>

        <div className="p-6 rounded-2xl bg-white border border-neutral-200 space-y-4">
          <h2 className="font-bold text-lg">1. Publish encrypted content</h2>
          <textarea
            value={plaintext}
            onChange={(e) => setPlaintext(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm"
          />
          <button
            onClick={handlePublish}
            disabled={!canPublish || publishState === 'busy'}
            className="px-5 py-2.5 rounded-xl bg-neutral-950 text-yellow-400 font-bold disabled:opacity-40"
          >
            {publishState === 'busy' ? 'Encrypting & uploading…' : 'Encrypt & Upload to Walrus'}
          </button>
          {!account && <p className="text-sm text-neutral-500">Connect a wallet to publish.</p>}
          {publishState === 'done' && (
            <p className="text-sm font-mono break-all bg-neutral-50 border border-neutral-200 p-3 rounded-lg">blobId: {blobId}</p>
          )}
          {publishState === 'error' && <p className="text-sm text-red-600">{publishError}</p>}
        </div>

        <div className="p-6 rounded-2xl bg-white border border-neutral-200 space-y-4">
          <h2 className="font-bold text-lg">2. Unlock content</h2>
          <input
            value={blobId}
            onChange={(e) => setBlobId(e.target.value)}
            placeholder="Walrus blob ID"
            className="w-full px-3 py-2 rounded-lg border border-neutral-300 font-mono text-sm"
          />
          {subStatus !== 'unchecked' && (
            <p className="text-sm">
              Subscription status:{' '}
              <span className={subStatus === 'active' ? 'text-green-600 font-bold' : 'text-neutral-500 font-bold'}>{subStatus}</span>
              {' — '}the badge above is a client-side convenience read; the real gate is the on-chain{' '}
              <code className="bg-neutral-100 px-1 rounded">seal_approve</code> dry-run Seal&apos;s key servers perform below.
            </p>
          )}
          <button
            onClick={handleUnlock}
            disabled={!canUnlock || unlockState === 'busy'}
            className="px-5 py-2.5 rounded-xl bg-yellow-400 text-neutral-950 font-bold disabled:opacity-40"
          >
            {unlockState === 'busy' ? 'Fetching & decrypting…' : 'Fetch & Decrypt'}
          </button>
          {unlockState === 'done' && (
            <p className="text-sm bg-green-50 border border-green-200 p-3 rounded-lg">{unlockedText}</p>
          )}
          {unlockState === 'error' && <p className="text-sm text-red-600">{unlockError}</p>}
        </div>
      </main>
    </div>
  );
}
