import { SuiJsonRpcClient as SuiClient } from '@mysten/sui/jsonRpc';
async function main() {
  const client = new SuiClient({ url: 'https://fullnode.devnet.sui.io:443' });
  const coins = await client.getCoins({ owner: '0x4cdce7c7afad9318fab1cedfc8ff07fb66bea30420443600544282dcb3bc3993' });
  console.log("Sponsor Coins:", JSON.stringify(coins, null, 2));
}
main();
