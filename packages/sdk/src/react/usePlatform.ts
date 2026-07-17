import { useQuery } from '@tanstack/react-query';
import { usePayStreamerConfig } from './provider';

export interface PlatformTier {
  name: string;
  amount: string;
  frequency: string;
  subscriber_count: number;
  is_active: boolean;
}

export interface PlatformObject {
  id: string;
  owner: string;
  name: string;
  description: string;
  category: string;
  image_url: string | null;
  is_paused: boolean;
  created_at: number;
  tiers: PlatformTier[];
}

export function usePlatform(platformId: string | undefined) {
  const config = usePayStreamerConfig();

  return useQuery({
    queryKey: ['paystreamer', 'platform', platformId, config.network],
    queryFn: async () => {
      if (!platformId) return null;
      if (!config.graphqlClient) {
        throw new Error("GraphQL client is not configured in PayStreamerProvider");
      }

      const query = `
        query GetPlatform($id: SuiAddress!) {
          object(address: $id) {
            asMoveObject {
              contents {
                json
              }
            }
            owner {
              ... on Shared {
                initialSharedVersion
              }
            }
          }
        }
      `;

      const result = await config.graphqlClient.query({
        query,
        variables: { id: platformId }
      });

      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors[0].message);
      }

      const data = result.data as any;
      if (!data?.object?.asMoveObject?.contents?.json) {
        return null;
      }

      return {
        ...data.object.asMoveObject.contents.json,
        initialSharedVersion: data.object.owner?.initialSharedVersion ?? 0,
      } as PlatformObject & { initialSharedVersion: number };
    },
    enabled: !!platformId,
  });
}
