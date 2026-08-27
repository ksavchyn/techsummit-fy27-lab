import { sql } from 'drizzle-orm';
import type { AppDb } from './index.js';

/**
 * Sync module for Meridian Bank.
 *
 * The retention.* tables (gold_customer_position, gold_open_atrisk,
 * gold_nba_recommendations) are ALREADY synced into Lakebase by the
 * Build 1 SDP pipeline via UC Synced Tables. No boot-time Delta copy needed.
 *
 * The ops.* tables (rm_cases, outreach_actions, rm_notes) are writable
 * Postgres tables managed by the pipeline's seed step.
 *
 * This module only verifies connectivity at boot.
 */

export async function verifyRetentionTables(db: AppDb): Promise<void> {
  const t0 = Date.now();
  try {
    const result = await db.execute(
      sql`SELECT COUNT(*)::int AS n FROM retention.gold_customer_position`,
    );
    const n = (result.rows[0] as { n: number } | undefined)?.n ?? 0;
    console.log(
      `[sync] retention.gold_customer_position: ${n} rows (verified in ${Date.now() - t0}ms)`,
    );
    if (n === 0) {
      console.warn(
        '[sync] WARNING: retention.gold_customer_position is empty. ' +
        'Ensure the Build 1 SDP pipeline has run and synced tables are populated.',
      );
    }
  } catch (e) {
    console.error(
      '[sync] Failed to verify retention tables:',
      e instanceof Error ? e.message : e,
    );
    console.warn(
      '[sync] The app will boot but read queries will fail until ' +
      'the retention schema is accessible.',
    );
  }
}

export async function verifyOpsTables(db: AppDb): Promise<void> {
  try {
    const result = await db.execute(
      sql`SELECT COUNT(*)::int AS n FROM ops.rm_cases`,
    );
    const n = (result.rows[0] as { n: number } | undefined)?.n ?? 0;
    console.log(`[sync] ops.rm_cases: ${n} rows`);
  } catch (e) {
    console.error(
      '[sync] Failed to verify ops tables:',
      e instanceof Error ? e.message : e,
    );
  }
}

/**
 * Boot-time verification. Called from server.ts after migrations.
 * Replaces the old syncFromDelta — no data is copied, just connectivity check.
 */
export async function syncFromDelta(
  db: AppDb,
  _cfg: unknown,
  _opts: { forceIfAnyEmpty?: boolean } = {},
): Promise<void> {
  console.log('[sync] Verifying Lakebase connectivity (dev branch)…');
  await verifyRetentionTables(db);
  await verifyOpsTables(db);
  console.log('[sync] Boot verification complete.');
}

/** Legacy compat — called by admin reset route. No-op since we don't own the data. */
export async function wipeMirroredTables(_db: AppDb): Promise<void> {
  console.log('[sync] wipeMirroredTables is a no-op — retention.* is managed by Build 1 pipeline.');
}
