import { eq, sql, inArray, desc, ilike, or } from 'drizzle-orm';
import type { AppDb } from '../index.js';
import {
  goldCustomerPosition,
  goldOpenAtrisk,
  goldNbaRecommendations,
  outreachActions,
  rmCases,
  rmNotes,
} from '../schema.js';
import type {
  CustomerPositionRow,
  OpenAtriskRow,
  NbaRecommendationRow,
  RiskMetrics,
  ActivityEvent,
} from '../../../client/src/shared/types.js';

/**
 * Queries for the Meridian Bank Relationship Desk app.
 *
 * Layer 1 (SURFACE): reads from retention.* synced UC tables.
 * Layer 4 (ACT): writes to ops.* writable tables.
 *
 * Technical requirement #2: NEVER write to retention.* tables.
 */

// ============================================================================
// READ — retention.* (synced UC tables, read-only)
// ============================================================================

export async function listAtRiskCustomers(
  db: AppDb,
): Promise<CustomerPositionRow[]> {
  const rows = await db
    .select()
    .from(goldCustomerPosition)
    .where(
      inArray(goldCustomerPosition.riskBand, ['critical', 'elevated', 'watch']),
    )
    .orderBy(desc(goldCustomerPosition.attritionRiskScore))
    .limit(200);

  return rows.map(mapCustomerPosition);
}

export async function getCustomerPosition(
  db: AppDb,
  customerId: string,
): Promise<CustomerPositionRow | null> {
  const [row] = await db
    .select()
    .from(goldCustomerPosition)
    .where(eq(goldCustomerPosition.customerId, customerId))
    .limit(1);

  return row ? mapCustomerPosition(row) : null;
}

export async function getOpenAtrisk(
  db: AppDb,
  customerId: string,
): Promise<OpenAtriskRow | null> {
  const [row] = await db
    .select()
    .from(goldOpenAtrisk)
    .where(eq(goldOpenAtrisk.customerId, customerId))
    .limit(1);

  return row ? mapOpenAtrisk(row) : null;
}

export async function getNbaRecommendation(
  db: AppDb,
  customerId: string,
): Promise<NbaRecommendationRow | null> {
  const [row] = await db
    .select()
    .from(goldNbaRecommendations)
    .where(eq(goldNbaRecommendations.customerId, customerId))
    .limit(1);

  if (!row) return null;

  // Parse action_ranking from JSON string
  let actionRanking: any[] = [];
  try {
    actionRanking = row.actionRanking ? JSON.parse(row.actionRanking) : [];
  } catch {
    actionRanking = [];
  }

  return {
    customerId: row.customerId,
    recommendedAction: row.recommendedAction as any,
    recommendedOfferProductId: row.recommendedOfferProductId,
    recommendedRateApy: row.recommendedRateApy ? Number(row.recommendedRateApy) : null,
    predictedRetainedUsd: row.predictedRetainedUsd ?? 0,
    predictedNetValueUsd: row.predictedNetValueUsd ?? 0,
    actionRanking,
    scoredAt: row.scoredAt?.toISOString() ?? null,
  };
}

export async function getRiskMetrics(db: AppDb): Promise<RiskMetrics> {
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(balance_at_risk_usd), 0)::float AS total_balance_at_risk_usd,
      COALESCE(SUM(revenue_at_risk_usd), 0)::float AS total_revenue_at_risk_usd,
      COUNT(*)::int AS critical_customer_count
    FROM retention.gold_customer_position
    WHERE risk_band IN ('critical', 'elevated', 'watch')
  `);

  const row = result.rows[0] as any;
  return {
    totalBalanceAtRiskUsd: row?.total_balance_at_risk_usd ?? 0,
    totalRevenueAtRiskUsd: row?.total_revenue_at_risk_usd ?? 0,
    criticalCustomerCount: row?.critical_customer_count ?? 0,
  };
}

// ============================================================================
// WRITE — ops.* (writable Postgres tables)
// Stubbed for Layer 4 (ACT). These will be implemented in a later layer.
// ============================================================================

export async function createOutreachAction(
  db: AppDb,
  action: {
    caseId?: number;
    customerId: string;
    actionType: string;
    offerProductId?: string;
    offerRateApy?: number;
    outcome?: string;
  },
) {
  // Layer 4 implementation
  const result = await db.execute(sql`
    INSERT INTO ops.outreach_actions
      (customer_id, action_type, offer_product_id, offer_rate_apy, outcome, case_id)
    VALUES
      (${action.customerId}, ${action.actionType}, ${action.offerProductId ?? null}, ${action.offerRateApy?.toString() ?? null}, ${action.outcome ?? 'approved'}, ${action.caseId ?? null})
    RETURNING action_id, action_at
  `);
  const row = result.rows[0] as any;
  return { actionId: row?.action_id, actionAt: row?.action_at };
}

export async function listOutreachActions(
  db: AppDb,
  customerId: string,
) {
  const rows = await db
    .select()
    .from(outreachActions)
    .where(eq(outreachActions.customerId, customerId))
    .orderBy(desc(outreachActions.actionAt));
  return rows;
}

export async function recentActivity(
  db: AppDb,
  limit: number,
): Promise<ActivityEvent[]> {
  const rows = await db
    .select()
    .from(outreachActions)
    .orderBy(desc(outreachActions.actionAt))
    .limit(limit);

  return rows.map((r) => ({
    kind: 'rm_action' as const,
    actionId: String(r.actionId),
    at: r.actionAt?.toISOString() ?? new Date().toISOString(),
    by: 'rm.desk',
    customerId: r.customerId,
    actionType: r.actionType as any,
    predictedRetainedUsd: null,
    status: (r.outcome as any) ?? 'approved',
  }));
}

// ============================================================================
// Mapping helpers
// ============================================================================

function mapCustomerPosition(row: typeof goldCustomerPosition.$inferSelect): CustomerPositionRow {
  return {
    customerId: row.customerId,
    tier: row.tier as any,
    tenureYears: row.tenureYears,
    homeMetro: row.homeMetro,
    customerLat: row.customerLat,
    customerLng: row.customerLng,
    profileSummary: row.profileSummary,
    attritionRiskScore: row.attritionRiskScore ?? 0,
    balanceOutflow30dUsd: row.balanceOutflow30dUsd,
    churnSignalScore: row.churnSignalScore ? Number(row.churnSignalScore) : null,
    totalBalanceUsd: row.totalBalanceUsd,
    depositBalanceUsd: row.depositBalanceUsd,
    affectedDepositBalanceUsd: row.affectedDepositBalanceUsd,
    minDaysToMaturity: row.minDaysToMaturity,
    productCount: row.productCount,
    balanceAtRiskUsd: row.balanceAtRiskUsd ?? 0,
    revenueAtRiskUsd: row.revenueAtRiskUsd ?? 0,
    riskBand: row.riskBand as any,
  };
}

function mapOpenAtrisk(row: typeof goldOpenAtrisk.$inferSelect): OpenAtriskRow {
  return {
    customerId: row.customerId,
    attritionRiskScore: row.attritionRiskScore ?? 0,
    balanceAtRiskUsd: row.balanceAtRiskUsd ?? 0,
    revenueAtRiskUsd: row.revenueAtRiskUsd ?? 0,
    atriskProductId: row.atriskProductId,
    atriskBalanceUsd: row.atriskBalanceUsd,
    daysToMaturity: row.daysToMaturity,
    currentRateApy: row.currentRateApy,
    candidateCrossSellProductId: row.candidateCrossSellProductId,
  };
}
