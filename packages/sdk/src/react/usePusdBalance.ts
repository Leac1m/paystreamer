import { useCurrentAccount, useCurrentClient } from '@mysten/dapp-kit-react';
import { useQuery } from '@tanstack/react-query';
import { usePayStreamerConfig } from './provider';

export function usePusdBalance() {
  const account = useCurrentAccount();
  const config = usePayStreamerConfig();
  const client = useCurrentClient();

  return useQuery({
    queryKey: ['paystreamer', 'balance', account?.address, config.pusdType],
    queryFn: async () => {
      if (config.isMockMode) {
        return 50000000000n; // 50 PUSD
      }

      if (!account?.address || !config.pusdType) return 0n;

      const res = await client.core.getBalance({ owner: account.address, coinType: config.pusdType });
      return BigInt(res.balance.balance);
    },
    enabled: config.isMockMode ? true : (!!account?.address && !!config.pusdType),
  });
}
