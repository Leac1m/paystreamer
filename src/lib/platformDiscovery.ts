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

  const query = `
    query GetPlatforms {
      ${platformIds.map((id, index) => `
        obj${index}: object(address: "${id}") {
          address
          owner {
            ... on Shared {
              initialSharedVersion
            }
          }
          asMoveObject { contents { json } }
        }
      `).join("\n")}
    }
  `;

  const res = await client.query({ query });
  const objects = Object.values(res.data || {}).filter(Boolean) as any[];

  return objects.map((obj: any) => {
    const json = obj.asMoveObject?.contents?.json || {};
    let parsedTiers = [];

    if (json.tiers && Array.isArray(json.tiers)) {
      parsedTiers = json.tiers;
    } else if (json.tiers?.contents && Array.isArray(json.tiers.contents)) {
      parsedTiers = json.tiers.contents.map((t: any) => {
        const val = t.value || {};
        let frequency = val.frequency || val.frequency_ms || "monthly";
        
        // Map common milliseconds back to string labels
        if (frequency === "86400000") frequency = "daily";
        else if (frequency === "604800000") frequency = "weekly";
        else if (frequency === "2592000000") frequency = "monthly";
        else if (frequency === "31536000000") frequency = "yearly";

        return {
          name: val.name || "",
          amount: val.amount || "0",
          frequency,
          subscriber_count: parseInt(val.subscriber_count || "0", 10),
          is_active: val.is_active ?? true,
        };
      });
    }

    return {
      objectId: obj.address,
      initialSharedVersion: obj.owner?.initialSharedVersion ?? 0,
      json: {
        ...json,
        tiers: parsedTiers,
      },
    };
  }) as PlatformObject[];
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

export async function discoverAllPlatforms(): Promise<PlatformObject[]> {
  const events = await import("./graphql").then((m) => m.queryPlatformRegisteredEvents());
  const platformIds = Array.from(
    new Set(events.map((e) => e.platform_id).filter(Boolean))
  );

  if (platformIds.length === 0) return [];

  const client = new SuiGraphQLClient({
    url: GRAPHQL_URL,
    network: "devnet",
  });

  const query = `
    query GetPlatforms {
      ${platformIds.map((id, index) => `
        obj${index}: object(address: "${id}") {
          address
          owner {
            ... on Shared {
              initialSharedVersion
            }
          }
          asMoveObject { contents { json } }
        }
      `).join("\n")}
    }
  `;

  const res = await client.query({ query });
  const objects = Object.values(res.data || {}).filter(Boolean) as any[];

  return objects.map((obj: any) => {
    const json = obj.asMoveObject?.contents?.json || {};
    let parsedTiers = [];

    if (json.tiers && Array.isArray(json.tiers)) {
      parsedTiers = json.tiers;
    } else if (json.tiers?.contents && Array.isArray(json.tiers.contents)) {
      parsedTiers = json.tiers.contents.map((t: any) => {
        const val = t.value || {};
        let frequency = val.frequency || val.frequency_ms || "monthly";
        
        if (frequency === "86400000") frequency = "daily";
        else if (frequency === "604800000") frequency = "weekly";
        else if (frequency === "2592000000") frequency = "monthly";
        else if (frequency === "31536000000") frequency = "yearly";

        return {
          name: val.name || "",
          amount: val.amount || "0",
          frequency,
          subscriber_count: parseInt(val.subscriber_count || "0", 10),
          is_active: val.is_active ?? true,
        };
      });
    }

    return {
      objectId: obj.address,
      initialSharedVersion: obj.owner?.initialSharedVersion ?? 0,
      json: {
        ...json,
        tiers: parsedTiers,
      },
    };
  }) as PlatformObject[];
}

export function useAllPlatforms() {
  return useQuery({
    queryKey: ["all-platforms"],
    queryFn: async () => {
      return discoverAllPlatforms();
    },
  });
}