import { Transaction } from '@mysten/sui/transactions';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { executeTransaction } from './helpers.js';

const UPGRADE_CAP = '0xb560a18678f9403fcf3306ff9a3894141856e963df7929f31224054fabd4926d';
const PACKAGE_ID = '0xe4928343c89668936e3bac1daf786ca7ba1ab295489921caf4894f5a7a3694ca';

const modules = JSON.parse(process.argv[2]);

const client = new SuiClient({ url: getFullnodeUrl('devnet') });
const keypair = Ed25519Keypair.fromSecretKey(process.env.SECRET_KEY || '');
const sender = keypair.getPublicKey().toSuiAddress();

const tx = new Transaction();
const [cap] = tx.upgrade({
  modules: modules.map(m => Uint8Array.from(atob(m), c => c.charCodeAt(0))),
  package: PACKAGE_ID,
  upgradeCap: UPGRADE_CAP,
});

tx.transferObjects([cap], tx.pure.address(sender));

const result = await executeTransaction(client, tx, keypair);
console.log('Upgrade result:', JSON.stringify(result, null, 2));