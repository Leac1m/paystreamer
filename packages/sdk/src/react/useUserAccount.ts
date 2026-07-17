import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { useQuery } from '@tanstack/react-query';
import { usePayStreamerConfig } from './provider';

export interface PayStreamerUserAccount {
  accountCapId: string;
  accountId: string;
}

export function useUserAccount() {
  const account = useCurrentAccount();
  const config = usePayStreamerConfig();

  const { data, isLoading, error } = useQuery({
    queryKey: ['getOwnedObjects', account?.address, config.packageId],
    queryFn: async () => {
      if (!account?.address) return null;
      if (!config.graphqlClient) {
        throw new Error("GraphQL client is not configured in PayStreamerProvider");
      }

      const query = `
        query GetAccountCap($owner: SuiAddress!, $type: String!) {
          address(address: $owner) {
            objects(filter: { type: $type }) {
              nodes {
                address
                asMoveObject {
                  contents {
                    json
                  }
                }
              }
            }
          }
        }
      `;

      const result = await config.graphqlClient.query({
        query,
        variables: {
          owner: account.address,
          type: `${config.packageId}::account::AccountCap`
        }
      });

      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors[0].message);
      }

      return result.data as any;
    },
    enabled: !!account?.address && !!config.packageId,
  });

  let userAccount: PayStreamerUserAccount | null = null;

  if (data?.address?.objects?.nodes && data.address.objects.nodes.length > 0) {
    const obj = data.address.objects.nodes[0];
    const json = obj.asMoveObject?.contents?.json;
    
    if (json?.account_id) {
      userAccount = {
        accountCapId: obj.address || '',
        accountId: json.account_id,
      };
    }
  }

  return {
    userAccount,
    isLoading,
    error,
  };
}
