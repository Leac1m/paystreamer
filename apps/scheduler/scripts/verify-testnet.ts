/**
 * Verifies the `@paystreamer/scheduler-core` extraction against real
 * testnet data.
 *
 * Read-only by default: reports the scheduler's address and gas/PUSD
 * balances, then runs discovery and prints every subscription it finds with
 * how it would be classified and whether it is due. Pass `--execute` to
 * actually run a billing cycle, which signs and submits real transactions.
 *
 *   pnpm --filter scheduler exec tsx scripts/verify-testnet.ts
 *   pnpm --filter scheduler exec tsx scripts/verify-testnet.ts --execute
 */
process.env.NETWORK = process.env.NETWORK || 'testnet';

import {
  classifyPayment,
  discoverPlatforms,
  discoverSubscriptions,
  filterDueSubscriptions,
  getCurrentTime,
} from '@paystreamer/scheduler-core';

const EXECUTE = process.argv.includes('--execute');

function fmt(amount: bigint, decimals = 6) {
  const base = 10n ** BigInt(decimals);
  return `${amount / base}.${(amount % base).toString().padStart(decimals, '0')}`;
}

/**
 * Uses `core.getBalance`, NOT a sum over `core.listCoins`.
 *
 * `listCoins` is paginated at 50 objects per page. The testnet scheduler
 * address holds 653 PUSD coin objects, so summing the first page under-reports
 * its balance roughly four-fold and makes a real 1% fee credit look like a
 * delta of exactly zero. Anything that reports scheduler earnings has to
 * either use `getBalance` or paginate to exhaustion.
 */
async function totalBalance(client: any, owner: string, coinType: string): Promise<bigint> {
  try {
    const res = await client.core.getBalance({ owner, coinType });
    return BigInt(res.balance.balance);
  } catch (err: any) {
    console.log(`  (failed to read ${coinType}: ${err?.message || err})`);
    return 0n;
  }
}

async function main() {
  // Imported after NETWORK is set — the adapter builds its context from
  // config at module load.
  const { context, runCycle } = await import('../src/scheduler/index.js');
  const { PUSD_TYPE_ARG } = await import('../src/lib/config.js');

  console.log('=== Context ===');
  console.log(`network:          ${context.network}`);
  console.log(`packageId:        ${context.packageId}`);
  console.log(`registryId:       ${context.registryId}`);
  console.log(`paymentScheduler: ${context.paymentSchedulerId}`);
  console.log(`scheduler addr:   ${context.senderAddress}`);
  console.log(`routing allowlist entries: ${Object.keys(context.routingAllowlist).length}`);
  console.log(`routed executor wired:     ${Boolean(context.routedPaymentExecutor)}`);

  const sui = await totalBalance(context.grpcClient, context.senderAddress, '0x2::sui::SUI');
  const pusd = await totalBalance(context.grpcClient, context.senderAddress, PUSD_TYPE_ARG);
  console.log(`\nSUI  balance: ${fmt(sui, 9)} SUI   <- pays gas`);
  console.log(`PUSD balance: ${fmt(pusd)} PUSD`);

  console.log('\n=== Discovery ===');
  const now = await getCurrentTime(context);
  console.log(`on-chain clock: ${now} (${new Date(Number(now)).toISOString()})`);

  const platforms = await discoverPlatforms(context);
  if (platforms.length === 0) {
    console.log('No platforms discovered — nothing to verify.');
    return;
  }

  let totalDue = 0;
  for (const p of platforms) {
    const subs = await discoverSubscriptions(context, p.platformId);
    const due = filterDueSubscriptions(subs, now);
    totalDue += due.length;

    console.log(`\nplatform ${p.platformId}`);
    console.log(`  active subscriptions: ${subs.length}, due now: ${due.length}`);
    for (const s of subs) {
      const overdueMs = now - s.nextBillingTime;
      const state = overdueMs >= 0n ? `DUE (overdue ${overdueMs}ms)` : `not due (in ${-overdueMs}ms)`;
      const cls = classifyPayment(s, context.routingAllowlist);
      console.log(`   - ${s.accountId}`);
      console.log(`     tier ${s.tierIndex}, amount ${fmt(s.tierAmount)} | holds ${s.denomination}`);
      console.log(`     settles in ${s.settlementDenomination ?? '(tier lookup failed)'} -> classified: ${cls.kind}`);
      console.log(`     ${state}`);
    }
  }

  console.log(`\n=== Summary: ${platforms.length} platform(s), ${totalDue} payment(s) due ===`);

  if (!EXECUTE) {
    console.log('\nRead-only run. Re-run with --execute to bill the due payments.');
    return;
  }

  console.log('\n=== Executing billing cycle (real transactions) ===');
  const result = await runCycle();
  console.log(JSON.stringify(result, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));

  const pusdAfter = await totalBalance(context.grpcClient, context.senderAddress, PUSD_TYPE_ARG);
  const delta = pusdAfter - pusd;
  const billed = result.succeeded.reduce((sum: bigint, s: { amount: bigint }) => sum + s.amount, 0n);
  console.log(`\nPUSD balance after: ${fmt(pusdAfter)} PUSD (delta ${fmt(delta)})`);
  console.log(`total billed this cycle: ${fmt(billed)} PUSD`);
  console.log(`nominal 1% scheduler fee: ${fmt(billed / 100n)} PUSD`);

  if (delta === billed) {
    console.log(
      '\nNOTE: the delta equals the FULL billed amount, not the 1% fee, because on\n' +
      'this demo deployment the platform treasury and the registry protocol treasury\n' +
      'are the same address as the scheduler — one key seeded everything. A balance\n' +
      'delta is therefore NOT a valid earnings signal here; scheduler earnings must\n' +
      "come from PaymentProcessed's `scheduler_fee` field, filtered by tx sender.",
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('verify-testnet failed:', err);
    process.exit(1);
  });
