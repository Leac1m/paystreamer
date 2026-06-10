import { useQuery } from "@tanstack/react-query";
import { useCurrentClient } from "@mysten/dapp-kit-react";
import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { V2_PACKAGE_ID } from "../constants";

export interface PlatformObject {
  objectId: string;
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
  const response = await fetch("https://fullnode.devnet.sui.io:443", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "suix_queryEvents",
      params: [
        {
          MoveEventType: `${V2_PACKAGE_ID}::platform::PlatformRegistered`,
          sender: walletAddress,
        },
        null,
        50,
        true,
      ],
    }),
  });

  const data = await response.json();
  const events = data.result?.data || [];
  const platformIds = Array.from(
    new Set(events.map((e: any) => e.parsedJson?.platform_id as string).filter(Boolean))
  ) as string[];

  if (platformIds.length === 0) return [];

  const client = new SuiGraphQLClient({
    url: "https://fullnode.devnet.sui.io:443/graphql",
    network: "devnet",
  });

  const res = await client.query({
    query: `
      query GetPlatforms($ids: [SuiAddress!]!) {
        objects(addresses: $ids) {
          address
          asMoveObject { contents { json } }
        }
      }
    `,
    variables: { ids: platformIds },
  });

  const objects: any[] = (res.data as any)?.objects ?? [];
  return objects.filter((obj: any) => !obj?.address?.startsWith("0x0")).map((obj: any) => ({
    objectId: obj.address,
    json: obj.asMoveObject?.contents?.json || {},
  })) as PlatformObject[];
}

export function useOwnedPlatforms(walletAddress: string | null) {
  const client = useCurrentClient();

  return useQuery({
    queryKey: ["owned-platforms", walletAddress],
    queryFn: async () => {
      if (!walletAddress) return [];

      const response = await fetch("https://fullnode.devnet.sui.io:443", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "suix_queryEvents",
          params: [
            {
              MoveEventType: `${V2_PACKAGE_ID}::platform::PlatformRegistered`,
              sender: walletAddress,
            },
            null,
            50,
            true,
          ],
        }),
      });

      const data = await response.json();
      const events = data.result?.data || [];
      const platformIds = Array.from(
        new Set(
          events
            .map((e: any) => e.parsedJson?.platform_id as string)
            .filter(Boolean)
        )
      ) as string[];

      if (platformIds.length === 0) return [];

      const result = await client.core.getObjects({
        objectIds: platformIds,
        include: { json: true },
      });

      const validPlatforms = result.objects
        .filter((obj: any): obj is any => !(obj instanceof Error))
        .filter(
          (obj: any) =>
            (obj.json as Record<string, unknown>)?.owner === walletAddress
        );

      return validPlatforms as PlatformObject[];
    },
    enabled: !!walletAddress,
  });
}