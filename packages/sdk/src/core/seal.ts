import { SealClient, SessionKey } from "@mysten/seal";
import type { KeyServerConfig, SealCompatibleClient } from "@mysten/seal";
import type { Signer } from "@mysten/sui/cryptography";

// Thin wrapper around @mysten/seal for platforms implementing the pattern
// documented at /integration — PayStreamer doesn't publish its own
// seal_approve module, so this only handles the client-side encrypt/decrypt
// calls; the on-chain policy lives in the integrating platform's own
// package. Re-exports SealClient/SessionKey directly so callers who need
// more than these thin helpers aren't blocked by them.
export { SealClient, SessionKey };

export interface CreateSealClientParams {
  suiClient: SealCompatibleClient;
  serverConfigs: KeyServerConfig[];
  verifyKeyServers?: boolean;
  timeout?: number;
}

export function createSealClient({
  suiClient,
  serverConfigs,
  verifyKeyServers,
  timeout,
}: CreateSealClientParams): SealClient {
  return new SealClient({ suiClient, serverConfigs, verifyKeyServers, timeout });
}

export interface EncryptForPolicyParams {
  client: SealClient;
  /** The Move package ID whose `seal_approve` function will gate decryption. */
  packageId: string;
  /**
   * The identity to encrypt under, following the namespace-prefix
   * convention your `seal_approve` policy checks (see /integration) —
   * typically `[platform_id][nonce]`.
   */
  id: string;
  data: Uint8Array;
  /** Number of key servers required to reconstruct the decryption key. */
  threshold: number;
}

export async function encryptForPolicy({ client, packageId, id, data, threshold }: EncryptForPolicyParams) {
  return client.encrypt({ packageId, id, data, threshold });
}

export interface CreateSealSessionKeyParams {
  address: string;
  packageId: string;
  ttlMin: number;
  signer?: Signer;
  suiClient: SealCompatibleClient;
}

export async function createSealSessionKey(params: CreateSealSessionKeyParams): Promise<SessionKey> {
  return SessionKey.create(params);
}

export interface DecryptWithPolicyParams {
  client: SealClient;
  data: Uint8Array;
  sessionKey: SessionKey;
  /**
   * Serialized bytes of a transaction that calls the target platform's
   * `seal_approve` function — build this with a plain `Transaction`
   * targeting `${packageId}::${module}::seal_approve` and the arguments
   * your specific policy expects (e.g. the `id`, a `SubscriptionAccount<T>`
   * object reference). Seal's key servers dry-run it to decide access.
   */
  txBytes: Uint8Array;
}

export async function decryptWithPolicy({ client, data, sessionKey, txBytes }: DecryptWithPolicyParams) {
  return client.decrypt({ data, sessionKey, txBytes });
}
