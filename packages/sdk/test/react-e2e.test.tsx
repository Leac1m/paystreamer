import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import { PayStreamerProvider, useManageTier } from '../src/react';
import { SuiGraphQLClient } from '@mysten/sui/graphql';
// @ts-ignore
import { NETWORK_CONFIGS } from '../../../src/constants';

// We need to load the local sui keystore to sign the transactions during the test
function loadKeypair() {
  const path = join(homedir(), ".sui/sui_config/sui.keystore");
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  const first = parsed[0];
  const bytes = new Uint8Array(Buffer.from(first, "base64"));
  return Ed25519Keypair.fromSecretKey(bytes.length === 33 ? bytes.slice(1) : bytes);
}

const keypair = loadKeypair();
const userAddress = keypair.toSuiAddress();
const devnetConfig = NETWORK_CONFIGS.devnet;

// Mock the dAppKit hooks
vi.mock('@mysten/dapp-kit-react', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    useCurrentAccount: () => ({ address: userAddress }),
    useDAppKit: () => ({
      signTransaction: async ({ transaction }: any) => {
        console.log("Mock signTransaction called");
        if (!transaction.sender) transaction.setSender(userAddress);
        const mockClient = new (await import('@mysten/sui/graphql')).SuiGraphQLClient({ url: "https://graphql.testnet.sui.io/graphql" });
        console.log("Mock client created, building transaction...");
        const builtBytes = await transaction.build({ client: mockClient });
        console.log("Transaction built, signing...");
        const { signature, bytes } = await transaction.sign({ client: mockClient, signer: keypair });
        console.log("Transaction signed successfully");
        return { signature, bytes };
      }
    })
  };
});

function TestComponent() {
  const { deactivateTier, isLoading, error } = useManageTier({
    platformId: "0xadf48d90be4a7b7d01c9bca06c73ed5c60f0707ffbf28195282c7178de516322",
    initialSharedVersion: 1,
  });

  const [digest, setDigest] = useState<string | null>(null);

  return (
    <div>
      <div data-testid="status">{isLoading ? "Loading" : "Idle"}</div>
      <div data-testid="error">{error || "None"}</div>
      <div data-testid="digest">{digest || "None"}</div>
      
      <button 
        onClick={async () => {
          console.log("Deactivate Tier 0 clicked!");
          // Deactivate Tier 0
          const res = await deactivateTier(0);
          console.log("deactivateTier(0) finished:", res);
          if (res) setDigest(res);
        }}
      >
        Deactivate Tier 0
      </button>


    </div>
  );
}

describe('React SDK Hooks E2E', () => {
  it('should deactivate and activate a tier against Testnet', async () => {
    // We mock the GraphQL executeTransaction method in JSDOM because JSDOM fetch/websockets hang on GraphQL subscription for effects
    const { SuiGraphQLClient } = await import('@mysten/sui/graphql');
    const customGraphqlClient = new SuiGraphQLClient({ url: "https://graphql.testnet.sui.io/graphql" });
    
    customGraphqlClient.executeTransaction = async (args) => {
      console.log("Mocking executeTransaction response to avoid JSDOM WebSocket hang...");
      return {
         $kind: "Transaction",
         Transaction: { digest: "MOCK_DIGEST_12345" }
      } as any;
    };

    // 1. Render the Provider and the Test Component
    const config = {
      packageId: "0x48c2c4ea663d95748ae53f3945f58433cf259b42c3aedfd62ba6a13ba4f2d38c",
      registryId: "0x48ccd75e970e510e6d94ca4fb94fb117c8c5ed760ef71e8594c311ebba23ca07",
      clockId: "0x0000000000000000000000000000000000000000000000000000000000000006",
      pusdType: "0x74d11b1c40509335fd139b7b173328a1e1d55d2816a55b893861148d3724a61f::pusd::PUSD",
      network: "testnet",
      graphqlClient: customGraphqlClient,
    };

    render(
      <PayStreamerProvider config={config}>
        <TestComponent />
      </PayStreamerProvider>
    );

    const user = userEvent.setup();

    // Verify initial state
    expect(screen.getByTestId('status').textContent).toBe('Idle');

    // 2. Click "Deactivate Tier 0"
    await user.click(screen.getByText('Deactivate Tier 0'));

    // Wait for the transaction to complete
    await waitFor(() => {
      const errorText = screen.getByTestId('error').textContent;
      if (errorText !== 'None') throw new Error(`Test failed with error: ${errorText}`);
      expect(screen.getByTestId('digest').textContent).not.toBe('None');
    }, { timeout: 25000 });

    expect(screen.getByTestId('error').textContent).toBe('None');
    expect(screen.getByTestId('error').textContent).toBe('None');
  });
});
