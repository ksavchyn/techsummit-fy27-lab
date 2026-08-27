import type { Application } from 'express';
import {
  listAtRiskCustomers,
  getCustomerPosition,
  getOpenAtrisk,
  getNbaRecommendation,
  getRiskMetrics,
  listOutreachActions,
} from '../db/queries/index.js';
import type { AppDb } from '../db/index.js';

/**
 * REST endpoints for the Meridian Relationship Desk.
 *
 * Layer 1 (SURFACE): exposes the retention.* synced UC tables for the
 * React front-end. All reads — no writes here.
 */
export function registerRelationshipsRoutes(
  app: Application,
  deps: { db: AppDb },
): void {
  const { db } = deps;

  // ── At-risk customer list (Operations queue) ────────────────────────
  app.get('/api/customers/at-risk', async (_req, res) => {
    try {
      const customers = await listAtRiskCustomers(db);
      res.json(customers);
    } catch (e) {
      console.error('[relationships] /api/customers/at-risk error:', e);
      res.status(500).json({ error: 'Failed to load at-risk customers' });
    }
  });

  // ── Single customer 360 detail ─────────────────────────────────────
  app.get('/api/customers/:customerId', async (req, res) => {
    try {
      const { customerId } = req.params;
      const [position, atrisk, nba, actions] = await Promise.all([
        getCustomerPosition(db, customerId),
        getOpenAtrisk(db, customerId),
        getNbaRecommendation(db, customerId),
        listOutreachActions(db, customerId),
      ]);

      if (!position) {
        res.status(404).json({ error: `Customer ${customerId} not found` });
        return;
      }

      res.json({
        position,
        atrisk,
        nba,
        actions,
      });
    } catch (e) {
      console.error('[relationships] /api/customers/:id error:', e);
      res.status(500).json({ error: 'Failed to load customer detail' });
    }
  });

  // ── Risk metrics (KPI cards) ───────────────────────────────────────
  app.get('/api/metrics/risk', async (_req, res) => {
    try {
      const metrics = await getRiskMetrics(db);
      res.json(metrics);
    } catch (e) {
      console.error('[relationships] /api/metrics/risk error:', e);
      res.status(500).json({ error: 'Failed to load risk metrics' });
    }
  });
}
