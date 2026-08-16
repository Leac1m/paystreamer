import { useCurrentAccount, useCurrentClient } from '@mysten/dapp-kit-react';
import { useQuery } from '@tanstack/react-query';
import { usePayStreamerConfig } from './provider';

export interface PayStreamerUserAccount {
  accountCapId: string;
  accountId: string;
  balance: bigint;
}

export function useUserAccount() {
  const account = useCurrentAccount();
  const config = usePayStreamerConfig();
  const client = useCurrentClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['getOwnedObjects', account?.address, config.packageId],
    queryFn: async () => {
      if (config.isMockMode) {
        return {
          accountCapId: "0xMockAccountCap",
          accountId: "0xMockAccount",
          balance: 10000000000n, // 10 PUSD
        };
      }
      
      if (!account?.address) return null;

      const owned = await client.core.listOwnedObjects({
        owner: account.address,
        type: `${config.packageId}::account::AccountCap`,
        include: { json: true },
      });

      let accountCapId = '';
      let accountId = '';
      let balance = 0n;

      if (owned.objects.length > 0) {
        const obj = owned.objects[0];
        const json = obj.json as any;
        if (json?.account_id) {
          accountCapId = obj.objectId || '';
          accountId = json.account_id;

          const balRes = await client.core.getObject({ objectId: accountId, include: { json: true } });
          const balStr = (balRes.object.json as any)?.balance || "0";
          balance = BigInt(balStr);
        }
      }

      if (!accountId) return null;

      return {
        accountCapId,
        accountId,
        balance,
      };
    },
    enabled: config.isMockMode ? true : (!!account?.address && !!config.packageId),
  });

  return {
    userAccount: data || null,
    isLoading,
    error,
  };
}
