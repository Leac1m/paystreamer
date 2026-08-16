import { useQuery } from '@tanstack/react-query';
import { useCurrentClient } from '@mysten/dapp-kit-react';
import { usePayStreamerConfig } from './provider';

export interface PlatformTier {
  name: string;
  amount: string;
  frequency: string;
  subscriber_count: number;
  is_active: boolean;
}

export interface PlatformWithTiers {
  id: string;
  owner: string;
  name: string;
  description: string;
  category: string;
  image_url: string | null;
  is_paused: boolean;
  created_at: number;
  tiers: PlatformTier[];
  packageId?: string;
  coinType?: string;
}

export function usePlatform(platformId: string | undefined) {
  const config = usePayStreamerConfig();
  const client = useCurrentClient();

  return useQuery({
    queryKey: ['paystreamer', 'platform', platformId, config.network],
    queryFn: async () => {
      if (!platformId) return null;
      if (config.isMockMode) {
        return {
          id: platformId,
          owner: "0xMockOwner",
          name: "Mock Platform",
          description: "This is a mock platform for the playground.",
          category: "Education",
          image_url: null,
          is_paused: false,
          created_at: Date.now(),
          tiers: [
            {
              name: "Pro Tier",
              amount: "5000000000",
              frequency: "2592000000",
              subscriber_count: 42,
              is_active: true
            }
          ],
          initialSharedVersion: 1
        } as PlatformWithTiers & { initialSharedVersion: number };
      }
      
      const res = await client.core.getObject({ objectId: platformId, include: { json: true } });
      if (!res.object.json) {
        return null;
      }

      const typeStr = res.object.type;
      let packageId = "";
      let coinType = "";
      if (typeStr) {
        packageId = typeStr.split("::")[0];
        const match = typeStr.match(/<([^>]+)>/);
        if (match) {
          coinType = match[1];
        }
      }

      const owner = res.object.owner as any;
      const json = res.object.json as any;

      // `tiers` is a Move VecMap<u64, SubscriptionTier> — the on-chain JSON
      // representation wraps entries as `{ contents: [{ key, value }, ...] }`,
      // not a plain array. Unwrap it, and map `frequency_ms` (the raw field
      // name on-chain) to `frequency`, which is what buildSubscribeTx/
      // SetupSubscriptionModal expect (as a raw millisecond bigint string).
      // Tolerate an already-flat array too (e.g. mock data).
      const rawTiers = Array.isArray(json?.tiers) ? json.tiers : json?.tiers?.contents;
      const tiers: PlatformTier[] = Array.isArray(rawTiers)
        ? rawTiers.map((entry: any) => {
            const value = entry?.value ?? entry ?? {};
            return {
              name: value.name ?? "",
              amount: value.amount ?? "0",
              frequency: value.frequency_ms ?? value.frequency ?? "0",
              subscriber_count: Number(value.subscriber_count ?? 0),
              is_active: value.is_active ?? true,
            };
          })
        : [];

      return {
        ...json,
        tiers,
        packageId,
        coinType,
        initialSharedVersion: owner?.$kind === "Shared" ? Number(owner.Shared.initialSharedVersion) : 0,
      } as PlatformWithTiers & { initialSharedVersion: number };
    },
    enabled: !!platformId,
  });
}
