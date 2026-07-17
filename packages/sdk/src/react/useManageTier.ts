import { useState, useCallback } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import { usePayStreamerConfig } from "./provider";
import { buildActivateTierTx, buildDeactivateTierTx } from "../core/transactions";
import { useSponsoredTransaction } from "./useSponsoredTransaction";

export interface UseManageTierParams {
  platformId: string;
  initialSharedVersion: number;
}

export function useManageTier(params: UseManageTierParams) {
  const config = usePayStreamerConfig();
  const account = useCurrentAccount();
  const { executeSponsored } = useSponsoredTransaction();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activateTier = useCallback(
    async (tierIndex: number) => {
      if (!account) {
        setError("Wallet not connected");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const tx = new Transaction();

        buildActivateTierTx({
          tx,
          packageId: config.packageId,
          platformId: params.platformId,
          platformInitVersion: params.initialSharedVersion,
          tierIndex,
        });

        const result = await executeSponsored(tx);

        if (result.error || result.status === "failure") {
          throw new Error(result.error || "Transaction failed");
        }

        return result.digest;
      } catch (err: any) {
        console.error("useManageTier.activateTier error:", err);
        setError(err.message || String(err));
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [account, config, params, executeSponsored]
  );

  const deactivateTier = useCallback(
    async (tierIndex: number) => {
      if (!account) {
        setError("Wallet not connected");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const tx = new Transaction();

        buildDeactivateTierTx({
          tx,
          packageId: config.packageId,
          platformId: params.platformId,
          platformInitVersion: params.initialSharedVersion,
          tierIndex,
        });

        const result = await executeSponsored(tx);

        if (result.error || result.status === "failure") {
          throw new Error(result.error || "Transaction failed");
        }

        return result.digest;
      } catch (err: any) {
        console.error("useManageTier.deactivateTier error:", err);
        setError(err.message || String(err));
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [account, config, params, executeSponsored]
  );

  return {
    activateTier,
    deactivateTier,
    isLoading,
    error,
  };
}
