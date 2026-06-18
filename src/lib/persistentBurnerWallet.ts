import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import type {
	IdentifierArray,
	IdentifierString,
	StandardConnectFeature,
	StandardConnectMethod,
	StandardEventsFeature,
	StandardEventsOnMethod,
	SuiFeatures,
	SuiSignAndExecuteTransactionMethod,
	SuiSignPersonalMessageMethod,
	SuiSignTransactionMethod,
} from '@mysten/wallet-standard';
import {
	getWallets,
	ReadonlyWalletAccount,
	StandardConnect,
	StandardEvents,
	SuiSignAndExecuteTransaction,
	SuiSignPersonalMessage,
	SuiSignTransaction,
} from '@mysten/wallet-standard';
import type { Wallet } from '@mysten/wallet-standard';
import { toBase64 } from '@mysten/utils';
import type { ClientWithCoreApi } from '@mysten/sui/client';
import type { WalletInitializer } from '@mysten/dapp-kit-core';

const STORAGE_KEY = 'paystreamer_burner_sk';

function getChain(network: string): IdentifierString {
	return `sui:${network}` as IdentifierString;
}

function loadOrCreateKeypair(): Ed25519Keypair {
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored) {
		try {
			return Ed25519Keypair.fromSecretKey(stored);
		} catch {
			// Fall through to create new
		}
	}
	const keypair = Ed25519Keypair.generate();
	localStorage.setItem(STORAGE_KEY, keypair.getSecretKey());
	return keypair;
}

export function createPersistentBurnerWalletInitializer(): WalletInitializer {
	return {
		id: 'persistent-burner-initializer',
		initialize({ networks, getClient }) {
			const wallet = new PersistentBurnerWallet({ clients: networks.map(getClient) });
			const unregister = getWallets().register(wallet);
			return { unregister };
		},
	};
}

class PersistentBurnerWallet implements Wallet {
	#chainConfig: Record<IdentifierString, ClientWithCoreApi>;
	#keypair: Ed25519Keypair;
	#account: ReadonlyWalletAccount;

	constructor({ clients }: { clients: ClientWithCoreApi[] }) {
		this.#chainConfig = clients.reduce<Record<IdentifierString, ClientWithCoreApi>>(
			(accumulator, client) => {
				const chain = getChain(client.network);
				accumulator[chain] = client;
				return accumulator;
			},
			{},
		);

		this.#keypair = loadOrCreateKeypair();

		this.#account = new ReadonlyWalletAccount({
			address: this.#keypair.getPublicKey().toSuiAddress(),
			publicKey: this.#keypair.getPublicKey().toSuiBytes(),
			chains: this.chains,
			features: [SuiSignTransaction, SuiSignAndExecuteTransaction, SuiSignPersonalMessage],
		});
	}

	get version() {
		return '1.0.0' as const;
	}

	get name() {
		return 'Persistent Burner Wallet' as const;
	}

	get icon() {
		return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAAJrElEQVR42tWbe2xT1x3H7UxAyD3XrdrSbGXlUbKWsq5rWdVuVOMRSEqSOmnVRZMmJqZNYv1nf3R/jWmVmVrtRRM/YwPd1nVTNcrE3pQCoikrIRAC4VVNY0hlD9ZOo1uCfe3ra9979v0dcy3s5Pper76Oh/STE+495/4+5/c85zqe2f7HAx5vKsS+monJj/CdHi/f4/HWW4f6AwdblmXjTM0NyS+movKtw9v+j6C5gKhyTMTTpA2x15Qwy+Pz75motOGdgKep8WF5ATgVZIt5NeO2wMqD0hfVGNPh3oYaYflsjG0l63PeyLCDnqbsLpZIhaRNFI+Ox+Le5KB0RybK8gDmJOkI07U4i/FhT1NDQl8Me5rUIfaDfELOJ0NsFa/SJQHm1WLsHcDqRWiy9BCL8s0N5t6UWWFVvxplejYm60hC91cNjPtzCTZsAptCVoeLP8PDDQJNCSodap6H+LtE8ZcdkvVkkD38vwDn4/Jvy4EhBhZSvRaUHiTXn31gJJxkUPoClBKKFizM+inhVA2cYIdM4HJouPvoe9s9H+KzDhyGK6KkmIqitBhww2C11rjQL2L4kgUwFxk8yPyzauUA3Pk/353XnA6zKbKCaQ2UlMvJF6W5uF5F8yHfZWZpC9HRmBziaEpm1bpY9XvhxuWJRldC7Mt03WlZwpjnkZUNa2DMG2EaPj9MGd2l2mofd0hQ7ZSopsXckHxVCUp32fXGdD0ZktrgFUmMqwhcWFjp87RArsD+9bn585IRaSHAKgBL3SZwOTRc8BKg7yYoskp5OJDiiPmF2Sj7ox0siYJ7lJA04EqvzZ9B1xSVt6PlW0IxZgUMJdZYAJuWngLQt9IRuZXmoTEkmci8ZtTXTViUKyasA9FRun5d8z6bfw0gYWm9mmCXxZatQgxfC7I2NVpRYQOxKWppLs4mcgn5NcibgL1K40xYp8CYY5TXEpjcb3LAJ0OZyyg3+2nySm6fjEtzkEz+7VBx3RTb+60z9dma7pkvwO2QQL5HzTtAdpKF7euw/HuzfrosBHy+ZsBimzbQshjWTVMDgez53B5MbjcGbr1ZjdUJOM5O0SLXzJ2R+uOA1dMAVoLsm5zb73JSId8t8Aa1LsAJdoTCrCaw6e3NC2DdFMUXWRg173mysJNOSUNskUJ1cOlXa2LhcbgmSszXYSn9hl3KSxTDjrZ2cbbfbWDyumsh9m3e7zCG7a3ETt+gtI7fx6lEOanZKDVvuA2cjYmt5xNOd2Louz3IQ12UZ2Zo3lkb9cDlvSs6m4Vk5Yqlabs0B97wT7PUuCXQz0Bnt9QxMPTW4iwBtmUlY8hFsHJPlzcQ1xuG75CVK1kXofCUGnU9fg1aVD7kfE9MoabtYkcAvIUYS2op3Hc3TTrDQzIAeojugTVLFolWDR6wFPtY0R66n6HltwjCIawnE2ymresk9NtN+pfUUi0mX6RJLfrh9zMRaRPOqubSA8W2MNzC0mHpK7j2ruuw5mYkxl5+2+HGQeg4yNYg7vNg+xMxFsuRMuiTsRJZG3cysAl4D9n4aC4un8L9qUyVvbCyYwFXX1nGUxFf1cCiEQqy75O+TpMwYKNKSPQUqhLyyWLsRbESLctx0YnixgfphRWA8pOPc+N4F9d+eV9V4OlCX/As5w5g+wtGhJGukp5go2R3D7EW9rSDcnGL56YgJHj+8GcFND/Vy41jj/H0jxc6HU/AA2QlR01UlH3D7CmITQnJq4lVWBi1yl8XYEh278c5H++F+Iui7r7bYR8tH/gbqoJN7fVODUhLYVVxzmYCEyOxFg7RUVa0egCHZZ55eRHnp/tKgMna6s/bbMdTxZgMzl9CCcmq7k690OzDfaeSN4QcsREjsQpgXHwyWyfg9K5WE7hc6JqTWjyihObfygOFOkv6i5K5TZx8LsL1sVS4NL8ItiB7fcsQAAAAASUVORK5CYII=' as const;
	}

	get chains() {
		return Object.keys(this.#chainConfig) as IdentifierArray;
	}

	get accounts() {
		return [this.#account];
	}

	get features(): StandardConnectFeature & StandardEventsFeature & SuiFeatures {
		return {
			[StandardConnect]: {
				version: '1.0.0',
				connect: this.#connect,
			},
			[StandardEvents]: {
				version: '1.0.0',
				on: this.#on,
			},
			[SuiSignPersonalMessage]: {
				version: '1.1.0',
				signPersonalMessage: this.#signPersonalMessage,
			},
			[SuiSignTransaction]: {
				version: '2.0.0',
				signTransaction: this.#signTransaction,
			},
			[SuiSignAndExecuteTransaction]: {
				version: '2.0.0',
				signAndExecuteTransaction: this.#signAndExecuteTransaction,
			},
		};
	}

	#on: StandardEventsOnMethod = () => {
		return () => {};
	};

	#connect: StandardConnectMethod = async () => {
		return { accounts: this.accounts };
	};

	#signPersonalMessage: SuiSignPersonalMessageMethod = async (messageInput) => {
		return await this.#keypair.signPersonalMessage(messageInput.message);
	};

	#signTransaction: SuiSignTransactionMethod = async ({ transaction, signal, chain }) => {
		signal?.throwIfAborted();

		const client = this.#chainConfig[chain];
		if (!client) throw new Error(`Invalid chain "${chain}" specified.`);

		const parsedTransaction = Transaction.from(await transaction.toJSON());
		const builtTransaction = await parsedTransaction.build({ client });
		return await this.#keypair.signTransaction(builtTransaction);
	};

	#signAndExecuteTransaction: SuiSignAndExecuteTransactionMethod = async ({
		transaction,
		signal,
		chain,
	}) => {
		signal?.throwIfAborted();

		const client = this.#chainConfig[chain];
		if (!client) throw new Error(`Invalid chain "${chain}" specified.`);

		const parsedTransaction = Transaction.from(await transaction.toJSON());
		const bytes = await parsedTransaction.build({ client });

		const result = await this.#keypair.signAndExecuteTransaction({
			transaction: parsedTransaction,
			client,
		});

		const tx = result.Transaction ?? result.FailedTransaction;
		return {
			bytes: toBase64(bytes),
			signature: tx.signatures[0],
			digest: tx.digest,
			effects: toBase64(tx.effects.bcs!),
		};
	};
}
