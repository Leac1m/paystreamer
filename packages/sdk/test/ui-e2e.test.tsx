import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

import { PayStreamerProvider } from '../src/react';
import { TierCard, SetupSubscriptionModal } from '../src/ui';
// @ts-ignore
import { NETWORK_CONFIGS } from '../../../src/constants';

const devnetConfig = NETWORK_CONFIGS.devnet;

// Mock the dAppKit hooks
vi.mock('@mysten/dapp-kit-react', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    useCurrentAccount: () => ({ address: "0x123" }),
    useCurrentClient: () => ({
      waitForTransaction: async () => ({}),
    }),
    useDAppKit: () => ({
      signTransaction: async () => {
        return { signature: "mock", bytes: new Uint8Array() };
      }
    })
  };
});

describe('React SDK UI Components E2E', () => {
  const config = {
    packageId: devnetConfig.PACKAGE_ID,
    registryId: devnetConfig.COIN_TYPE_REGISTRY_ID,
    clockId: "0x0000000000000000000000000000000000000000000000000000000000000006",
    pusdType: devnetConfig.PUSD_TYPE_ARG,
    network: "devnet",
    graphqlClient: {} as any, // Mock client
  };

  it('should render the TierCard', async () => {
    const tier = {
      name: "Premium",
      amount: "10000000000",
      frequency: "monthly",
      subscriber_count: 5,
      is_active: true
    };

    render(
      <PayStreamerProvider config={config}>
        <TierCard 
          platformId={devnetConfig.DEMO_PLATFORM_ID}
          initialSharedVersion={devnetConfig.DEMO_PLATFORM_INIT_VERSION}
          tier={tier}
          tierIndex={0}
        />
      </PayStreamerProvider>
    );

    expect(screen.getByText('Premium')).toBeDefined();
    expect(screen.getByText('10 PUSD')).toBeDefined();
    expect(screen.getByText('5 subscribers')).toBeDefined();
    expect(screen.getByText('Deactivate')).toBeDefined();
  });

  it('should render the SetupSubscriptionModal', async () => {
    render(
      <PayStreamerProvider config={config}>
        <SetupSubscriptionModal 
          isOpen={true}
          onClose={() => {}}
          platformId={devnetConfig.DEMO_PLATFORM_ID}
          tierIndex={0}
          tierAmount={10000000000n}
          tierFrequencyMs={2592000000n}
        />
      </PayStreamerProvider>
    );

    expect(screen.getByText('Setup Subscription')).toBeDefined();
    expect(screen.getByText('10.00 PUSD')).toBeDefined();
    expect(screen.getByText('Setup & Subscribe')).toBeDefined();
  });
});
