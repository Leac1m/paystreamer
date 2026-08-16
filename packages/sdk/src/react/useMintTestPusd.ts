import { useState, useCallback } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { useQueryClient } from "@tanstack/react-query";
import { Transaction } from "@mysten/sui/transactions";
import { usePayStreamerConfig } from "./provider";
import { useSponsoredTransaction } from "./useSponsoredTransaction";

export interface UseMintTestPusdResult {
  mint: (amountMist?: bigint) => Promise<string | null>;
  isLoading: boolean;
  error: string | null;
}

export function useMintTestPusd(): UseMintTestPusdResult {
  const config = usePayStreamerConfig();
  const account = useCurrentAccount();
  const { executeSponsored } = useSponsoredTransaction();
  const queryClient = useQueryClient();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mint = useCallback(
    async (amountMist: bigint = 100000000000n) => { // Default to 100 PUSD
      if (config.isMockMode) {
        setIsLoading(true);
        setError(null);
        return new Promise<string>((resolve) => {
          setTimeout(() => {
            setIsLoading(false);
            resolve("mock_mint_digest_123");
          }, 1500);
        });
      }

      if (!account) {
        setError("Wallet not connected");
        return null;
      }

      const pusdPackageId = config.pusdPackageId;
      const treasuryCapId = config.pusdTreasuryCapId;
      const treasuryCapInitVersion = config.pusdTreasuryCapInitVersion;

      if (!pusdPackageId || !treasuryCapId || treasuryCapInitVersion === undefined) {
        setError("pusdPackageId, pusdTreasuryCapId, or pusdTreasuryCapInitVersion not configured");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const tx = new Transaction();
        tx.moveCall({
          target: `${pusdPackageId}::pusd::mint`,
          arguments: [
            // The PUSD TreasuryCap is a shared object (minting is gated by
            // AccessControl, not owned-object custody) — it must be
            // referenced as a shared object, not tx.object().
            tx.sharedObjectRef({
              objectId: treasuryCapId,
              initialSharedVersion: treasuryCapInitVersion,
              mutable: true,
            }),
            tx.pure.address(account.address),
            tx.pure.u64(amountMist),
          ],
        });

        const result = await executeSponsored(tx);

        if (result.error || result.status === "failure") {
          throw new Error(result.error || "Transaction failed");
        }

        await queryClient.invalidateQueries({ queryKey: ["paystreamer", "balance"] });

        return result.digest || null;
      } catch (err: any) {
        console.error("useMintTestPusd error:", err);
        setError(err.message || String(err));
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [account, config, executeSponsored, queryClient]
  );

  return {
    mint,
    isLoading,
    error,
  };
}
