import { describe, it, expect, beforeAll } from 'vitest';
import { 
  queryPlatform, 
  queryPlatformRegisteredEvents, 
  queryCoinTypeRegistry,
  queryPaymentScheduler
} from '../src/core/chain';
import { NETWORK_CONFIGS } from '../src/constants';

const skipLocalnet = (!!process.env.CI && !process.env.ENABLE_LOCALNET_TESTS) || process.env.SKIP_LOCALNET === 'true';

describe.skipIf(skipLocalnet)('Chain Core E2E (Localnet)', () => {
  const activeConfig = NETWORK_CONFIGS['local'];

  it('should fetch the coin type registry', async () => {
    const registry = await queryCoinTypeRegistry(activeConfig.COIN_TYPE_REGISTRY_ID, 'local');
    expect(registry).toBeDefined();
    expect(registry.version).toBeDefined();
  });

  it('should fetch the payment scheduler', async () => {
    const scheduler = await queryPaymentScheduler(activeConfig.PAYMENT_SCHEDULER_ID, 'local');
    expect(scheduler).toBeDefined();
    expect(scheduler.initialSharedVersion).toBeGreaterThan(0);
  });

  // Skipped: this local Docker node's gRPC build (mysten/sui-tools:mainnet,
  // sui 1.75.2) returns RpcError: UNIMPLEMENTED for core.listEvents entirely
  // — verified separately that the same call against the real testnet
  // fullnode works correctly (confirmed live, including that eventType
  // filters require the fully zero-padded package address form, which
  // deployed PACKAGE_IDs already are). This is a gap in the local dev
  // node's build, not application code — see roadmap.md Phase 1 item 3
  // (compatibility matrix).
  it.skip('should fetch platform registered events on localnet', async () => {
    const events = await queryPlatformRegisteredEvents('local');
    expect(Array.isArray(events)).toBe(true);
    // Since the seeder ran, we should have at least the demo platform registered!
    expect(events.length).toBeGreaterThanOrEqual(1);
    
    // We can use the first discovered platform to test queryPlatform
    const platformId = events[0].platform_id;
    const platform = await queryPlatform(platformId, 'local');
    
    expect(platform).toBeDefined();
    expect(platform.name).toBeDefined();
    expect(platform.owner).toBeDefined();
  });

});
