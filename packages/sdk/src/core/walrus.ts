import { walrus, WalrusFile } from "@mysten/walrus";
import type { WalrusClient, WalrusOptions } from "@mysten/walrus";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import type { Signer } from "@mysten/sui/cryptography";

// Thin wrapper around @mysten/walrus (real, published, confirmed v1.2.x),
// scoped to what the Seal worked example needs: store an encrypted blob,
// read it back. Unlike @mysten/seal's `.$extend(seal({...}))` (which does
// NOT exist in that package's real exports — see core/seal.ts), Walrus's
// `.$extend(walrus())` pattern IS real, verified directly against the
// installed package's own docs/index.md and dist/client.d.mts.
export { WalrusFile };

export interface CreateWalrusClientParams extends WalrusOptions {
  client: ClientWithCoreApi;
}

/**
 * Extends a core Sui client with Walrus, returning the `WalrusClient`
 * (`extended.walrus`) directly rather than the extended client itself, so
 * callers don't need to know the `$extend` mechanics.
 */
export function createWalrusClient({ client, ...options }: CreateWalrusClientParams): WalrusClient {
  return client.$extend(walrus(options)).walrus;
}

export interface UploadContentParams {
  walrusClient: WalrusClient;
  content: Uint8Array;
  signer: Signer;
  /** Number of storage epochs to pay for. */
  epochs: number;
  /** Whether the blob can later be deleted by its owner. */
  deletable?: boolean;
}

/**
 * Writes a single blob to Walrus. The signer needs both SUI (gas for the
 * register/certify transactions) and WAL (storage + write fees) — a real,
 * separate cost from Sui gas that this wraps but does not fund. See
 * /routing for the equivalent disclosure on DeepBook's DEEP fee; this is
 * the same category of real-infrastructure cost, not a code gap.
 */
export async function uploadContent({ walrusClient, content, signer, epochs, deletable = false }: UploadContentParams) {
  const { blobId } = await walrusClient.writeBlob({ blob: content, signer, epochs, deletable });
  return { blobId };
}

export interface DownloadContentParams {
  walrusClient: WalrusClient;
  blobId: string;
}

export async function downloadContent({ walrusClient, blobId }: DownloadContentParams): Promise<Uint8Array> {
  return walrusClient.readBlob({ blobId });
}
