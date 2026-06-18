import { discoverPlatforms, discoverSubscriptions, getCurrentTime, filterDueSubscriptions } from './discovery.js';
import { processDuePayments } from './payment.js';
import { SCHEDULER_INTERVAL_MS } from '../lib/config.js';

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

/**
 * Runs a single payment scheduler cycle
 * 1. Discover all platforms from PlatformRegistered events
 * 2. For each platform, discover active subscriptions
 * 3. Filter subscriptions where next_billing_time <= now
 * 4. Build and submit PTBs for each due payment
 */
export async function runSchedulerCycle(): Promise<void> {
  if (isRunning) {
    console.log('[Scheduler] Previous cycle still running, skipping...');
    return;
  }

  isRunning = true;
  const cycleId = Date.now();

  console.log(`[Scheduler] Starting payment cycle #${cycleId}`);

  try {
    // Step 1: Get current time
    const currentTime = await getCurrentTime();
    console.log(`[Scheduler] Current time: ${currentTime}`);

    // Step 2: Discover all platforms
    const platforms = await discoverPlatforms();

    if (platforms.length === 0) {
      console.log('[Scheduler] No platforms found, skipping cycle');
      return;
    }

    // Step 3: Process each platform
    for (const platform of platforms) {
      console.log(`[Scheduler] Processing platform: ${platform.platformId}`);

      // Discover subscriptions for this platform
      const subscriptions = await discoverSubscriptions(platform.platformId);

      if (subscriptions.length === 0) {
        console.log(`[Scheduler] No subscriptions found for platform ${platform.platformId}`);
        continue;
      }

      // Filter due subscriptions
      const dueSubscriptions = filterDueSubscriptions(subscriptions, currentTime);

      if (dueSubscriptions.length === 0) {
        console.log(`[Scheduler] No due payments for platform ${platform.platformId}`);
        continue;
      }

      console.log(`[Scheduler] Found ${dueSubscriptions.length} due payments for platform ${platform.platformId}`);

      // Process due payments
      const digests = await processDuePayments(dueSubscriptions);
      console.log(`[Scheduler] Processed ${digests.length} payments for platform ${platform.platformId}`);
    }

    console.log(`[Scheduler] Payment cycle #${cycleId} completed successfully`);
  } catch (error) {
    console.error(`[Scheduler] Error in payment cycle #${cycleId}:`, error);
  } finally {
    isRunning = false;
  }
}

/**
 * Starts the payment scheduler
 * Runs every SCHEDULER_INTERVAL_MS (default: 10 seconds)
 */
export function startScheduler(): void {
  if (schedulerInterval) {
    console.log('[Scheduler] Scheduler already running');
    return;
  }

  console.log(`[Scheduler] Starting payment scheduler (interval: ${SCHEDULER_INTERVAL_MS}ms)`);

  // Run immediately on start
  runSchedulerCycle();

  // Then run on interval
  schedulerInterval = setInterval(() => {
    runSchedulerCycle();
  }, SCHEDULER_INTERVAL_MS);
}

/**
 * Stops the payment scheduler
 */
export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Scheduler] Payment scheduler stopped');
  }
}

/**
 * Checks if the scheduler is currently running
 */
export function isSchedulerRunning(): boolean {
  return schedulerInterval !== null;
}
