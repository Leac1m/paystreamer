import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import { useQueryClient } from "@tanstack/react-query";
import { 
  PUSD_DEVNET_PACKAGE_ID, 
  PUSD_TREASURY_CAP_ID, 
  PUSD_TREASURY_CAP_INIT_VERSION,
  NETWORK
} from "../constants";
import { useSponsoredTransaction } from "./useSponsoredTransaction";

export function useMintPusd() {
  const account = useCurrentAccount();
  const queryClient = useQueryClient();
  const { executeSponsored } = useSponsoredTransaction();

  const mintPusd = async (amount: number = 1000 * 1_000_000_000) => {
    if (!account) throw new Error("Wallet not connected");
    if (NETWORK !== "devnet") throw new Error("Faucet only available on devnet");

    const tx = new Transaction();
    
    tx.moveCall({
      target: `${PUSD_DEVNET_PACKAGE_ID}::pusd::mint`,
      arguments: [
        tx.sharedObjectRef({
          objectId: PUSD_TREASURY_CAP_ID,
          initialSharedVersion: PUSD_TREASURY_CAP_INIT_VERSION,
          mutable: true,
        }),
        tx.pure.address(account.address),
        tx.pure.u64(amount),
      ],
    });

    const result = await executeSponsored(tx);
    if (result.error) throw new Error(result.error);
    
    // Invalidate the sui client coin queries that dApp Kit uses
    await queryClient.invalidateQueries({ queryKey: ["sui-client", "getCoins"] });
    await queryClient.invalidateQueries({ queryKey: ["sui-client", "getAllBalances"] });
    
    return result;
  };

  return { mintPusd };
}
