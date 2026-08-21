import type { SchedulerContext } from './context.js';

/** One settled payment this scheduler was paid a fee for. */
export interface SchedulerEarning {
  digest: string;
  timestampMs: number;
  accountId: string;
  platformId: string;
  /** Total billed to the subscriber, in the settlement coin's smallest unit. */
  amount: bigint;
  /** The scheduler's 1% cut of that amount. */
  schedulerFee: bigint;
}

export interface EarningsSummary {
  totalFee: bigint;
  paymentCount: number;
  /** Most recent first. */
  recent: SchedulerEarning[];
  /**
   * True when the page cap was hit before exhausting history, so
   * `totalFee`/`paymentCount` are lower bounds rather than exact.
   */
  truncated: boolean;
}

const PAYMENT_PROCESSED_QUERY = `
  query schedulerFees($type: String!, $sender: SuiAddress!, $after: String) {
    events(filter: { type: $type, sender: $sender }, first: 50, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        timestamp
        transaction { digest }
        contents { json }
      }
    }
  }
`;

/**
 * Computes what this scheduler has actually earned, from
 * `PaymentProcessed.scheduler_fee` on events emitted by transactions it
 * sent.
 *
 * This is the *only* correct source. Two tempting alternatives are both
 * wrong:
 *
 *  - **The event alone doesn't identify the scheduler.** `PaymentProcessed`
 *    (payment.move:71-81) carries `scheduler_fee` but not the address it
 *    was paid to. Attribution comes from filtering on the *transaction
 *    sender*, which `process_due_payment` uses as the fee recipient
 *    (`let scheduler_addr = ctx.sender()`).
 *  - **A coin-balance delta is not earnings.** On the demo deployment the
 *    platform treasury and the registry's protocol treasury are the same
 *    address as the scheduler, so its balance moves by the full billed
 *    amount rather than the 1% cut. Verified live on testnet.
 *
 * Walks pages oldest-first, so `nodes` accumulate chronologically and the
 * tail is the newest activity.
 */
export async function fetchSchedulerEarnings(
  ctx: SchedulerContext,
  options: { maxPages?: number; recentLimit?: number } = {},
): Promise<EarningsSummary> {
  const maxPages = options.maxPages ?? 50;
  const recentLimit = options.recentLimit ?? 10;
  const type = `${ctx.packageId}::payment::PaymentProcessed`;

  let totalFee = 0n;
  let paymentCount = 0;
  let truncated = false;
  let after: string | null = null;
  const chronological: SchedulerEarning[] = [];

  for (let page = 0; page < maxPages; page++) {
    const result: any = await ctx.gqlClient.query({
      query: PAYMENT_PROCESSED_QUERY,
      variables: { type, sender: ctx.senderAddress, after },
    });

    const events = result?.data?.events;
    const nodes: any[] = events?.nodes ?? [];

    for (const node of nodes) {
      const json = node?.contents?.json;
      if (!json) continue;
      const fee = BigInt(json.scheduler_fee ?? 0);
      totalFee += fee;
      paymentCount++;
      chronological.push({
        digest: node?.transaction?.digest ?? '',
        timestampMs: node?.timestamp ? Date.parse(node.timestamp) : 0,
        accountId: json.account_id ?? '',
        platformId: json.platform_id ?? '',
        amount: BigInt(json.amount ?? 0),
        schedulerFee: fee,
      });
    }

    // Only the tail is ever shown, so drop the rest as we go rather than
    // holding an unbounded history in a service worker.
    if (chronological.length > recentLimit) {
      chronological.splice(0, chronological.length - recentLimit);
    }

    if (!events?.pageInfo?.hasNextPage) {
      return { totalFee, paymentCount, recent: chronological.reverse(), truncated: false };
    }
    after = events.pageInfo.endCursor;
    if (page === maxPages - 1) truncated = true;
  }

  return { totalFee, paymentCount, recent: chronological.reverse(), truncated };
}
