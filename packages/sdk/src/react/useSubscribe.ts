import { useState, useCallback } from "react";
import { useCurrentAccount, useCurrentClient } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import { usePayStreamerConfig } from "./provider";
import { buildSubscribeTx } from "../core/transactions";
import { useSponsoredTransaction } from "./useSponsoredTransaction";
import { usePlatform } from "./usePlatform";

export interface UseSubscribeParams {
  platformId: string;
  tierIndex: number | bigint;
  tierAmount?: bigint;
  tierFrequencyMs?: bigint;
  accountId?: string;
  accountCapId?: string;
  maxAttempts?: number;
}

export function useSubscribe(params: UseSubscribeParams) {
  const config = usePayStreamerConfig();
  const account = useCurrentAccount();
  const client = useCurrentClient();
  const { executeSponsored } = useSponsoredTransaction();
  const { data: platform, isLoading: isPlatformLoading } = usePlatform(params.platformId);

  const [isSubscribing, setIsSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isLoading = isPlatformLoading || isSubscribing;
  const hasAccount = !!params.accountId && !!params.accountCapId;

  const resolvedTierAmount = params.tierAmount ?? (platform?.tiers?.[Number(params.tierIndex)]?.amount ? BigInt(platform.tiers[Number(params.tierIndex)].amount) : 0n);
  const resolvedTierFrequencyMs = params.tierFrequencyMs ?? (platform?.tiers?.[Number(params.tierIndex)]?.frequency ? BigInt(platform.tiers[Number(params.tierIndex)].frequency) : 0n);

  // Calculate recommended deposit (e.g. 3 months worth)
  const THREE_MONTHS_MS = 90n * 24n * 60n * 60n * 1000n;
  let cyclesBuffer = 3n;
  if (resolvedTierFrequencyMs > 0n) {
    cyclesBuffer = THREE_MONTHS_MS / resolvedTierFrequencyMs;
    if (cyclesBuffer < 3n) cyclesBuffer = 3n;
    if (cyclesBuffer > 10n) cyclesBuffer = 10n;
  }
  const recommendedDeposit = resolvedTierAmount * cyclesBuffer;

  const subscribe = useCallback(
    async (depositAmount: bigint = 0n) => {
      if (!resolvedTierAmount || !resolvedTierFrequencyMs) {
        setError("Tier configuration not found or is still loading.");
        return null;
      }

      if (config.isMockMode) {
        setIsSubscribing(true);
        setError(null);
        return new Promise<string>((resolve) => {
          setTimeout(() => {
            setIsSubscribing(false);
            resolve("mock_digest_1234567890abcdef");
          }, 1500);
        });
      }

      if (!account) {
        setError("Wallet not connected");
        return null;
      }

      setIsSubscribing(true);
      setError(null);

      try {
        const resolvedPackageId = platform?.packageId || config.packageId;
        const resolvedCoinType = platform?.coinType || config.pusdType;

        if (!resolvedPackageId) {
          throw new Error("Could not resolve packageId for this platform.");
        }
        if (!resolvedCoinType) {
          throw new Error("Could not resolve denomination type for this platform.");
        }

        let coinsToUse: string[] = [];

        // Fetch coins if deposit is requested
        if (depositAmount > 0n) {
          if (!config.graphqlClient) throw new Error("GraphQL client not configured");
          
          const coinsQuery = `query GetCoins($owner: SuiAddress!, $type: String!) {
            address(address: $owner) {
              objects(first: 50, filter: { type: $type }) {
                nodes {
                  address
                  contents {
                    json
                  }
                }
              }
            }
          }`;

          const res = await config.graphqlClient.query({
            query: coinsQuery,
            variables: { owner: account.address, type: resolvedCoinType }
          });

          const nodes = (res.data as any)?.address?.objects?.nodes || [];
          let total = 0n;
          for (const node of nodes) {
            const balance = BigInt(node.contents?.json?.balance || 0);
            total += balance;
            coinsToUse.push(node.address);
            if (total >= depositAmount) break;
          }

          if (total < depositAmount) {
            throw new Error(`Insufficient balance for deposit. Found ${total.toString()}, required ${depositAmount.toString()}`);
          }
        }

        const tx = new Transaction();
        // tx.setGasBudget(100_000_000); // Usually automatically handled

        buildSubscribeTx({
          tx,
          packageId: resolvedPackageId,
          clockId: config.clockId,
          denomination: resolvedCoinType,
          platformId: params.platformId,
          tierIndex: params.tierIndex,
          tierAmount: resolvedTierAmount,
          tierFrequencyMs: resolvedTierFrequencyMs,
          maxAttempts: params.maxAttempts,
          accountId: params.accountId,
          accountCapId: params.accountCapId,
          depositAmount,
          coinsToUse,
        });

        const result = await executeSponsored(tx);
        
        if (result.error || result.status === "failure") {
          throw new Error(result.error || "Transaction failed");
        }

        return result.digest;
      } catch (err: any) {
        console.error("useSubscribe error:", err);
        setError(err.message || String(err));
        return null;
      } finally {
        setIsSubscribing(false);
      }
    },
    [account, client, config, params, executeSponsored, resolvedTierAmount, resolvedTierFrequencyMs, platform]
  );

  return {
    subscribe,
    isLoading,
    error,
    recommendedDeposit,
    hasAccount,
  };
}
