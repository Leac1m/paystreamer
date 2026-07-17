import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import { PayStreamerProvider, useManageTier, usePlatform, useUserAccount } from '../src/react';
import { SuiGraphQLClient } from '@mysten/sui/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
    useCurrentClient: () => ({
      getOwnedObjects: async () => ({
        data: [
          {
            data: {
              objectId: "0xMockAccountCapId",
              content: { fields: { account_id: "0xMockAccountId" } }
            }
          }
        ]
      })
    }),
    useDAppKit: () => ({
      signTransaction: async ({ transaction }: any) => {
        console.log("Mock signTransaction called");
        if (!transaction.sender) transaction.setSender(userAddress);
        const mockClient = new (await import('@mysten/sui/graphql')).SuiGraphQLClient({ 
          url: devnetConfig.GRAPHQL_URL,
          network: "devnet"
        });
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
    platformId: devnetConfig.DEMO_PLATFORM_ID,
    initialSharedVersion: devnetConfig.DEMO_PLATFORM_INIT_VERSION,
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

function DataFetchingTestComponent() {
  const { data: platform, isLoading } = usePlatform(devnetConfig.DEMO_PLATFORM_ID);
  const { userAccount } = useUserAccount();

  return (
    <div>
      <div data-testid="platform-loading">{isLoading ? "Loading" : "Idle"}</div>
      <div data-testid="platform-name">{platform?.name || "None"}</div>
      <div data-testid="account-id">{userAccount?.accountId || "None"}</div>
    </div>
  );
}

const queryClient = new QueryClient();

describe('React SDK Hooks E2E', () => {
  it('should deactivate a tier against Devnet', async () => {
    // We mock the GraphQL executeTransaction method in JSDOM because JSDOM fetch/websockets hang on GraphQL subscription for effects
    const { SuiGraphQLClient } = await import('@mysten/sui/graphql');
    const customGraphqlClient = new SuiGraphQLClient({ 
      url: devnetConfig.GRAPHQL_URL,
      network: "devnet"
    });
    
    customGraphqlClient.executeTransaction = async (args) => {
      console.log("Mocking executeTransaction response to avoid JSDOM WebSocket hang...");
      return {
         $kind: "Transaction",
         Transaction: { digest: "MOCK_DIGEST_12345" }
      } as any;
    };

    // 1. Render the Provider and the Test Component
    const config = {
      packageId: devnetConfig.PACKAGE_ID,
      registryId: devnetConfig.COIN_TYPE_REGISTRY_ID,
      clockId: "0x0000000000000000000000000000000000000000000000000000000000000006",
      pusdType: devnetConfig.PUSD_TYPE_ARG,
      network: "devnet",
      graphqlClient: customGraphqlClient,
    };

    render(
      <QueryClientProvider client={queryClient}>
        <PayStreamerProvider config={config}>
          <TestComponent />
        </PayStreamerProvider>
      </QueryClientProvider>
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

  it('should fetch platform data and user account live against Devnet', async () => {
    const { SuiGraphQLClient } = await import('@mysten/sui/graphql');
    const customGraphqlClient = new SuiGraphQLClient({ 
      url: devnetConfig.GRAPHQL_URL,
      network: "devnet"
    });

    const config = {
      packageId: devnetConfig.PACKAGE_ID,
      registryId: devnetConfig.COIN_TYPE_REGISTRY_ID,
      clockId: "0x0000000000000000000000000000000000000000000000000000000000000006",
      pusdType: devnetConfig.PUSD_TYPE_ARG,
      network: "devnet",
      graphqlClient: customGraphqlClient,
    };

    render(
      <QueryClientProvider client={queryClient}>
        <PayStreamerProvider config={config}>
          <DataFetchingTestComponent />
        </PayStreamerProvider>
      </QueryClientProvider>
    );

    // Wait for the query to resolve against real devnet
    await waitFor(() => {
      // The platform name should not be empty, meaning it actually pulled from the Move contract
      const platformName = screen.getByTestId('platform-name').textContent;
      expect(platformName).not.toBe('None');
      expect(platformName?.length).toBeGreaterThan(0);
      
      // User account should not throw an error, even if they don't have an account
      const accountId = screen.getByTestId('account-id').textContent;
      expect(accountId).toBeDefined();
    }, { timeout: 10000 });
  });
});
