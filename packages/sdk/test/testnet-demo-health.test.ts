import { describe, it, expect } from 'vitest';
import { queryPlatform } from '../src/core/chain';
import { NETWORK_CONFIGS } from '../src/constants';

// Only runs when explicitly targeting testnet (see .github/workflows/testnet-e2e.yml)
// — not part of the default `pnpm test:sdk` used by every PR, since it
// depends on live network access and shouldn't make the fast CI path flaky.
const skip = process.env.RUN_TESTNET_HEALTH_CHECKS !== 'true';

describe.skipIf(skip)('Testnet demo platform health', () => {
  const activeConfig = NETWORK_CONFIGS['testnet'];

  it('DEMO_PLATFORM_ID resolves to a platform with at least one active tier', async () => {
    const platform = await queryPlatform(activeConfig.DEMO_PLATFORM_ID, 'testnet');

    expect(platform, 'DEMO_PLATFORM_ID no longer resolves on testnet — docs "try it live" links are broken').toBeDefined();
    expect(platform.name, 'platform exists but has no name — data looks corrupted').toBeTruthy();

    const tiers = (platform as any).tiers;
    expect(Array.isArray(tiers) && tiers.length > 0, 'platform has no tiers — SetupSubscriptionModal demo has nothing to show').toBe(true);

    const firstTier = tiers[0];
    expect(BigInt(firstTier.amount ?? 0) > 0n, 'tier 0 has a zero/missing amount — matches the exact "0.00 PUSD" bug found in Phase 1 dogfooding').toBe(true);
    expect(firstTier.is_active, 'tier 0 is deactivated — docs demo would fail to subscribe').toBe(true);
  });
});
