import { useQuery } from "@tanstack/react-query";
import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { GRAPHQL_URL } from "../constants";
import { queryPlatformsByOwner } from "./graphql";

export interface PlatformObject {
  objectId: string;
  initialSharedVersion: number;
  json: {
    owner: string;
    name: string;
    description: string;
    category: string;
    treasury: string;
    pending_treasury?: string;
    pending_treasury_change_time?: number;
    tiers: Array<{
      name: string;
      amount: string;
      frequency: string;
      subscriber_count: number;
      is_active: boolean;
    }>;
    subscriber_count: number;
    created_at: number;
  };
}

export async function discoverOwnedPlatforms(
  walletAddress: string
): Promise<PlatformObject[]> {
  const events = await queryPlatformsByOwner(walletAddress);
  const platformIds = Array.from(
    new Set(events.map((e) => e.platform_id).filter(Boolean))
  );

  if (platformIds.length === 0) return [];

  const client = new SuiGraphQLClient({
    url: GRAPHQL_URL,
    network: "devnet",
  });

  const res = await client.query({
    query: `
      query GetPlatforms($ids: [SuiAddress!]!) {
        objects(addresses: $ids) {
          address
          owner {
            ... on Shared {
              initialSharedVersion
            }
          }
          asMoveObject { contents { json } }
        }
      }
    `,
    variables: { ids: platformIds },
  });

  const objects: any[] = (res.data as any)?.objects ?? [];
  return objects.filter((obj: any) => !obj?.address?.startsWith("0x0")).map((obj: any) => ({
    objectId: obj.address,
    initialSharedVersion: obj.owner?.initialSharedVersion ?? 0,
    json: obj.asMoveObject?.contents?.json || {},
  })) as PlatformObject[];
}

export function useOwnedPlatforms(walletAddress: string | null) {
  return useQuery({
    queryKey: ["owned-platforms", walletAddress],
    queryFn: async () => {
      if (!walletAddress) return [];
      return discoverOwnedPlatforms(walletAddress);
    },
    enabled: !!walletAddress,
  });
}