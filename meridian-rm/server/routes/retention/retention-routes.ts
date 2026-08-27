// Meridian Bank RM retention cockpit — server routes.
// Reads the read-only synced gold layer (retention.*) joined to writable ops.* state.
// NEVER writes to retention.* — writes only touch ops.* (cases, notes, actions, events).

import { Application, Request } from 'express';

export interface RetentionAppKit {
  lakebase: {
    query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  };
  serving(alias?: string): {
    invoke(payload: unknown): Promise<unknown>;
    asUser(req: Request): { invoke(payload: unknown): Promise<unknown> };
  };
  server: {
    extend(fn: (app: Application) => void): void;
  };
}

// ── Layer 1: VISUALIZE ────────────────────────────────────────────────────────
// Ranked/flagged live queue. Exact logic from submission2/view_query.sql:
// join open at-risk x NBA recs, left join current case + latest action,
// decision_priority = revenue_at_risk x attrition, flag ACT NOW at attrition>=0.80.
const QUEUE_SQL = `
  SELECT
    a.customer_id,
    a.customer_display_name,
    a.tier,
    a.home_metro,
    a.tenure_years,
    ROUND(a.revenue_at_risk_usd::numeric, 2)                         AS revenue_at_risk_usd,
    ROUND(a.balance_at_risk_usd::numeric, 2)                         AS balance_at_risk_usd,
    ROUND(a.attrition_risk_score::numeric, 3)                        AS attrition_risk_score,
    ROUND((a.revenue_at_risk_usd * a.attrition_risk_score)::numeric, 2) AS decision_priority,
    CASE WHEN a.attrition_risk_score >= 0.80 THEN 'ACT NOW'
         WHEN a.attrition_risk_score >= 0.60 THEN 'WATCH'
         ELSE 'MONITOR' END                                          AS flag,
    n.recommended_action,
    n.recommended_offer_product_id,
    ROUND(n.recommended_rate_apy::numeric, 4)                        AS recommended_rate_apy,
    ROUND(n.predicted_net_value_usd::numeric, 2)                     AS predicted_net_value_usd,
    c.case_id,
    c.status                                                         AS case_status,
    ra.approval_status                                               AS latest_action_status
  FROM retention.gold_open_atrisk a
  JOIN retention.gold_nba_recommendations n USING (customer_id)
  LEFT JOIN ops.rm_cases c
    ON c.customer_id = a.customer_id AND c.status <> 'won'
  LEFT JOIN LATERAL (
    SELECT approval_status
    FROM ops.retention_actions r
    WHERE r.customer_id = a.customer_id
    ORDER BY created_at DESC
    LIMIT 1
  ) ra ON true
  ORDER BY decision_priority DESC
  LIMIT 100
`;

export function setupRetentionRoutes(appkit: RetentionAppKit) {
  appkit.server.extend((app) => {
    // GET /api/retention/queue — the ranked at-risk queue (Visualize)
    app.get('/api/retention/queue', async (_req, res) => {
      try {
        const { rows } = await appkit.lakebase.query(QUEUE_SQL);
        res.json(rows);
      } catch (err) {
        console.error('[retention] queue failed:', err);
        res.status(500).json({ error: 'Failed to load retention queue' });
      }
    });

    // GET /api/retention/customer/:id — full position + case for a selected customer
    app.get('/api/retention/customer/:id', async (req, res) => {
      try {
        const id = String(req.params.id);
        const { rows } = await appkit.lakebase.query(
          `SELECT p.customer_id, p.customer_display_name, p.tier, p.home_metro, p.tenure_years,
                  p.profile_summary, p.total_balance_usd, p.deposit_balance_usd,
                  p.balance_at_risk_usd, p.revenue_at_risk_usd, p.attrition_risk_score,
                  p.balance_outflow_30d_usd, p.churn_signal_score, p.product_count, p.risk_band,
                  a.atrisk_product_id, a.days_to_maturity, a.current_rate_apy,
                  n.recommended_action, n.recommended_offer_product_id, n.recommended_rate_apy,
                  n.predicted_retained_usd, n.predicted_net_value_usd,
                  c.case_id, c.status AS case_status, c.assigned_rm
           FROM retention.gold_customer_position p
           LEFT JOIN retention.gold_open_atrisk a USING (customer_id)
           LEFT JOIN retention.gold_nba_recommendations n USING (customer_id)
           LEFT JOIN ops.rm_cases c ON c.customer_id = p.customer_id AND c.status <> 'won'
           WHERE p.customer_id = $1
           LIMIT 1`,
          [id],
        );
        if (rows.length === 0) {
          res.status(404).json({ error: 'Customer not found' });
          return;
        }
        res.json(rows[0]);
      } catch (err) {
        console.error('[retention] customer lookup failed:', err);
        res.status(500).json({ error: 'Failed to load customer' });
      }
    });
  });
}
