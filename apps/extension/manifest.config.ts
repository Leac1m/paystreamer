import { defineManifest } from '@crxjs/vite-plugin';

/**
 * Chrome MV3 only — Firefox's MV3 differs enough (background scripts rather
 * than service workers, the `browser.*` namespace, different alarm
 * behavior) that supporting it was descoped for the first version.
 */
export default defineManifest({
  manifest_version: 3,
  name: 'PayStreamer Scheduler',
  version: '0.1.0',
  description: 'Runs PayStreamer billing cycles in the background and earns the 1% scheduler fee.',
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  permissions: [
    // Cycle state and the signing key. `setInterval` does not survive an MV3
    // service worker suspending, so the loop must be alarm-driven.
    'storage',
    'alarms',
  ],
  // Sui fullnode + GraphQL endpoints the scheduler talks to. Narrow rather
  // than <all_urls>, since Chrome Web Store review weighs host permissions.
  host_permissions: [
    'https://fullnode.testnet.sui.io/*',
    'https://graphql.testnet.sui.io/*',
    'https://fullnode.mainnet.sui.io/*',
    'https://graphql.mainnet.sui.io/*',
  ],
});
