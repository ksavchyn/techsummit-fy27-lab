// Meridian Bank RM retention cockpit — server routes.
// Reads the read-only synced gold layer (retention.*) joined to writable ops.* state.
// NEVER writes to retention.* — writes only touch ops.* (cases, notes, actions, events).

import { z } from 'zod';
import { Application, Request } from 'express';

interface ServingHandle {
  invoke(payload: unknown): Promise<unknown>;
  asUser(req: Request): { invoke(payload: unknown): Promise<unknown> };
}

export interface RetentionAppKit {
  lakebase: {
    query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  };
  serving(alias?: string): ServingHandle;
  server: {
    extend(fn: (app: Application) => void): void;
  };
}

// ── Shared SQL ────────────────────────────────────────────────────────────────
const CUSTOMER_SQL = `
  SELECT p.customer_id, p.customer_display_name, p.tier, p.home_metro, p.tenure_years,
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
  LIMIT 1
`;

// ── Layer 1: VISUALIZE — ranked/flagged queue (exact submission2/view_query.sql) ─
const QUEUE_SQL = `
  SELECT
    a.customer_id,
    a.customer_display_name,
    a.tier,
    a.home_metro,
    a.tenure_years,
    ROUND(a.revenue_at_risk_usd::numeric, 2)                            AS revenue_at_risk_usd,
    ROUND(a.balance_at_risk_usd::numeric, 2)                            AS balance_at_risk_usd,
    ROUND(a.attrition_risk_score::numeric, 3)                           AS attrition_risk_score,
    ROUND((a.revenue_at_risk_usd * a.attrition_risk_score)::numeric, 2) AS decision_priority,
    CASE WHEN a.attrition_risk_score >= 0.80 THEN 'ACT NOW'
         WHEN a.attrition_risk_score >= 0.60 THEN 'WATCH'
         ELSE 'MONITOR' END                                            AS flag,
    n.recommended_action,
    n.recommended_offer_product_id,
    ROUND(n.recommended_rate_apy::numeric, 4)                          AS recommended_rate_apy,
    ROUND(n.predicted_net_value_usd::numeric, 2)                       AS predicted_net_value_usd,
    c.case_id,
    c.status                                                           AS case_status,
    ra.approval_status                                                 AS latest_action_status
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

// ── Helpers ─────────────────────────────────────────────────────────────────
function chatContent(result: unknown): string {
  const r = result as { choices?: { message?: { content?: string } }[] } | undefined;
  return r?.choices?.[0]?.message?.content ?? JSON.stringify(result);
}

function factSheet(c: Record<string, unknown>): string {
  return [
    `customer_id: ${c.customer_id}`,
    `name: ${c.customer_display_name}`,
    `tier: ${c.tier}, tenure_years: ${c.tenure_years}, metro: ${c.home_metro}`,
    `profile: ${c.profile_summary ?? 'n/a'}`,
    `attrition_risk_score: ${c.attrition_risk_score} (band ${c.risk_band})`,
    `revenue_at_risk_usd: ${c.revenue_at_risk_usd}, balance_at_risk_usd: ${c.balance_at_risk_usd}`,
    `deposit_balance_usd: ${c.deposit_balance_usd}, total_balance_usd: ${c.total_balance_usd}`,
    `balance_outflow_30d_usd: ${c.balance_outflow_30d_usd}, churn_signal_score: ${c.churn_signal_score}`,
    `at-risk product: ${c.atrisk_product_id}, days_to_maturity: ${c.days_to_maturity}, current_rate_apy: ${c.current_rate_apy}`,
    `model next-best-action: ${c.recommended_action}, offer ${c.recommended_offer_product_id} @ rate_apy ${c.recommended_rate_apy}`,
    `predicted_retained_usd: ${c.predicted_retained_usd}, predicted_net_value_usd: ${c.predicted_net_value_usd}`,
  ].join('\n');
}

// Parse an embedding vector out of a serving response (best-effort).
function parseEmbedding(result: unknown): number[] | null {
  const r = result as
    | { data?: { embedding?: number[] }[]; predictions?: number[][] }
    | undefined;
  const e = r?.data?.[0]?.embedding ?? r?.predictions?.[0];
  return Array.isArray(e) && e.length > 0 && typeof e[0] === 'number' ? e : null;
}

interface RetrievedNote {
  note_id: number;
  author: string | null;
  note_text: string;
  created_at: string;
  bm25_score?: number | null;
  vec_dist?: number | null;
  methods: string[];
}

// Hybrid Lakebase Search over ops.rm_notes: BM25 (full-text) + best-effort vector ANN.
async function retrieveNotes(
  appkit: RetentionAppKit,
  req: Request,
  customerId: string,
  query: string,
): Promise<{ notes: RetrievedNote[]; method: string }> {
  const byId = new Map<number, RetrievedNote>();

  // BM25 (more-negative score = better match), scoped to the customer.
  const bm25 = await appkit.lakebase.query(
    `SELECT note_id, author, note_text, created_at,
            (note_tsv <@> to_bm25query(to_tsvector('english', $2), 'ops.rm_notes_tsv_bm25'::regclass)) AS bm25_score
     FROM ops.rm_notes
     WHERE customer_id = $1
     ORDER BY bm25_score ASC
     LIMIT 5`,
    [customerId, query],
  );
  for (const row of bm25.rows) {
    const id = Number(row.note_id);
    byId.set(id, {
      note_id: id,
      author: row.author as string | null,
      note_text: String(row.note_text),
      created_at: String(row.created_at),
      bm25_score: row.bm25_score == null ? null : Number(row.bm25_score),
      methods: ['bm25'],
    });
  }

  let method = 'bm25';
  // Best-effort vector ANN via the embeddings endpoint + rm_notes_emb_ann index.
  try {
    const emb = await appkit.serving('embeddings').asUser(req).invoke({ input: [query] });
    const vec = parseEmbedding(emb);
    if (vec) {
      const vecLiteral = `[${vec.join(',')}]`;
      const ann = await appkit.lakebase.query(
        `SELECT note_id, author, note_text, created_at,
                (note_embedding <=> $2::vector) AS vec_dist
         FROM ops.rm_notes
         WHERE customer_id = $1
         ORDER BY vec_dist ASC
         LIMIT 5`,
        [customerId, vecLiteral],
      );
      for (const row of ann.rows) {
        const id = Number(row.note_id);
        const existing = byId.get(id);
        if (existing) {
          existing.vec_dist = row.vec_dist == null ? null : Number(row.vec_dist);
          existing.methods.push('vector');
        } else {
          byId.set(id, {
            note_id: id,
            author: row.author as string | null,
            note_text: String(row.note_text),
            created_at: String(row.created_at),
            vec_dist: row.vec_dist == null ? null : Number(row.vec_dist),
            methods: ['vector'],
          });
        }
      }
      method = 'hybrid (bm25 + vector)';
    }
  } catch (err) {
    console.warn('[retention] vector retrieval unavailable, using BM25 only:', (err as Error).message);
  }

  return { notes: Array.from(byId.values()).slice(0, 6), method };
}

export function setupRetentionRoutes(appkit: RetentionAppKit) {
  appkit.server.extend((app) => {
    // ── VISUALIZE ────────────────────────────────────────────────────────────
    app.get('/api/retention/queue', async (_req, res) => {
      try {
        const { rows } = await appkit.lakebase.query(QUEUE_SQL);
        res.json(rows);
      } catch (err) {
        console.error('[retention] queue failed:', err);
        res.status(500).json({ error: 'Failed to load retention queue' });
      }
    });

    app.get('/api/retention/customer/:id', async (req, res) => {
      try {
        const { rows } = await appkit.lakebase.query(CUSTOMER_SQL, [String(req.params.id)]);
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

    // ── ASSIST (a): LLM "why flagged" explanation ─────────────────────────────
    app.post('/api/retention/explain', async (req, res) => {
      const parsed = z.object({ customer_id: z.string().min(1) }).safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'customer_id required' });
        return;
      }
      try {
        const { rows } = await appkit.lakebase.query(CUSTOMER_SQL, [parsed.data.customer_id]);
        if (rows.length === 0) {
          res.status(404).json({ error: 'Customer not found' });
          return;
        }
        const result = await appkit
          .serving('chat')
          .asUser(req)
          .invoke({
            max_tokens: 600,
            messages: [
              {
                role: 'system',
                content:
                  'You are a retention analyst for a US retail bank. Explain, in 3-5 tight bullet points, WHY this customer is flagged as an attrition risk, citing the specific drivers in the data (rate gap, maturing product, balance outflow, churn signals, tenure/tier). Be concrete and reference the numbers. No preamble.',
              },
              { role: 'user', content: factSheet(rows[0]) },
            ],
          });
        res.json({ explanation: chatContent(result) });
      } catch (err) {
        console.error('[retention] explain failed:', err);
        res.status(500).json({ error: 'Explanation failed' });
      }
    });

    // ── ASSIST (b): what-if scenario ──────────────────────────────────────────
    app.post('/api/retention/whatif', async (req, res) => {
      const parsed = z
        .object({ customer_id: z.string().min(1), scenario: z.string().min(1) })
        .safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'customer_id and scenario required' });
        return;
      }
      try {
        const { rows } = await appkit.lakebase.query(CUSTOMER_SQL, [parsed.data.customer_id]);
        if (rows.length === 0) {
          res.status(404).json({ error: 'Customer not found' });
          return;
        }
        const result = await appkit
          .serving('chat')
          .asUser(req)
          .invoke({
            max_tokens: 700,
            messages: [
              {
                role: 'system',
                content:
                  'You are a retention analyst. Given the customer facts and a what-if scenario the RM is considering, estimate the likely effect on retention probability and on the economics (cost of the offer vs revenue at risk). Reason with the numbers provided, state assumptions, and end with a one-line recommendation. Be concise.',
              },
              {
                role: 'user',
                content: `CUSTOMER FACTS:\n${factSheet(rows[0])}\n\nWHAT-IF SCENARIO:\n${parsed.data.scenario}`,
              },
            ],
          });
        res.json({ answer: chatContent(result) });
      } catch (err) {
        console.error('[retention] whatif failed:', err);
        res.status(500).json({ error: 'What-if failed' });
      }
    });

    // ── ASSIST (c): draft retention memo (retrieve first, then generate) ───────
    app.post('/api/retention/memo', async (req, res) => {
      const parsed = z
        .object({ customer_id: z.string().min(1), query: z.string().optional() })
        .safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'customer_id required' });
        return;
      }
      try {
        const { rows } = await appkit.lakebase.query(CUSTOMER_SQL, [parsed.data.customer_id]);
        if (rows.length === 0) {
          res.status(404).json({ error: 'Customer not found' });
          return;
        }
        const cust = rows[0];
        const q =
          parsed.data.query?.trim() ||
          'retention offer rate sensitive maturing CD competitor fintech callback churn';

        // RETRIEVE FIRST — Lakebase Search over ops.rm_notes.
        const { notes, method } = await retrieveNotes(appkit, req, parsed.data.customer_id, q);
        const notesBlock =
          notes.length > 0
            ? notes
                .map((n) => `- [note ${n.note_id}${n.author ? `, ${n.author}` : ''}] ${n.note_text}`)
                .join('\n')
            : '(no case notes retrieved)';

        // THEN generate.
        const result = await appkit
          .serving('chat')
          .asUser(req)
          .invoke({
            max_tokens: 1200,
            messages: [
              {
                role: 'system',
                content:
                  'You are a relationship manager at a US retail bank. Draft a concise, professional retention outreach memo in Markdown with sections: Situation, Recommended Offer, Talking Points, Next Step. Ground every claim in the retrieved case notes and the customer facts — do not invent facts. Lead with the model recommended offer. Keep it under ~300 words.',
              },
              {
                role: 'user',
                content: `CUSTOMER FACTS:\n${factSheet(cust)}\n\nRETRIEVED CASE NOTES (Lakebase Search):\n${notesBlock}`,
              },
            ],
          });

        res.json({
          memo: chatContent(result),
          retrieval: { source: 'lakebase_search:ops.rm_notes', method, notes },
        });
      } catch (err) {
        console.error('[retention] memo failed:', err);
        res.status(500).json({ error: 'Memo drafting failed' });
      }
    });

    // ── ACT: propose a retention action (human-in-the-loop, pending approval) ──
    app.post('/api/retention/propose', async (req, res) => {
      const parsed = z
        .object({
          customer_id: z.string().min(1),
          proposed_action: z.string().min(1),
          offer_product_id: z.string().optional(),
          offer_rate_apy: z.number().nullable().optional(),
          rationale: z.string().optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'customer_id and proposed_action required' });
        return;
      }
      const b = parsed.data;
      try {
        const ins = await appkit.lakebase.query(
          `INSERT INTO ops.retention_actions
             (customer_id, proposed_action, offer_product_id, offer_rate_apy, rationale, approval_status)
           VALUES ($1, $2, $3, $4, $5, 'proposed')
           RETURNING action_id, customer_id, proposed_action, offer_product_id, offer_rate_apy,
                     rationale, approval_status, created_at, committed_at`,
          [b.customer_id, b.proposed_action, b.offer_product_id ?? null, b.offer_rate_apy ?? null, b.rationale ?? null],
        );
        const action = ins.rows[0];
        await appkit.lakebase.query(
          `INSERT INTO ops.workflow_events (event_type, trigger_source, customer_id, action_id, detail)
           VALUES ('decision', 'user_open', $1, $2, 'Action PROPOSED by assistant, pending human approval')`,
          [b.customer_id, action.action_id],
        );
        res.status(201).json(action);
      } catch (err) {
        console.error('[retention] propose failed:', err);
        res.status(500).json({ error: 'Propose failed' });
      }
    });

    // ── ACT: approve/correct + commit → closed loop (writes ops.* only) ───────
    app.post('/api/retention/approve', async (req, res) => {
      const parsed = z
        .object({
          action_id: z.number().int(),
          approver: z.string().min(1),
          // optional corrections applied at approval time
          proposed_action: z.string().optional(),
          offer_product_id: z.string().optional(),
          offer_rate_apy: z.number().nullable().optional(),
          rationale: z.string().optional(),
          corrected: z.boolean().optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'action_id and approver required' });
        return;
      }
      const b = parsed.data;
      try {
        const found = await appkit.lakebase.query(
          `SELECT customer_id FROM ops.retention_actions WHERE action_id = $1`,
          [b.action_id],
        );
        if (found.rows.length === 0) {
          res.status(404).json({ error: 'Action not found' });
          return;
        }
        const customerId = String(found.rows[0].customer_id);

        // Ensure/flip an operational case to 'working' (never touches retention.*)
        const existing = await appkit.lakebase.query(
          `SELECT case_id FROM ops.rm_cases WHERE customer_id = $1 AND status <> 'won'
           ORDER BY opened_at LIMIT 1`,
          [customerId],
        );
        let caseId: number;
        if (existing.rows.length > 0) {
          caseId = Number(existing.rows[0].case_id);
          await appkit.lakebase.query(
            `UPDATE ops.rm_cases SET status = 'working', updated_at = now() WHERE case_id = $1`,
            [caseId],
          );
        } else {
          const created = await appkit.lakebase.query(
            `INSERT INTO ops.rm_cases (customer_id, status, priority, assigned_rm)
             VALUES ($1, 'working', 'high', $2) RETURNING case_id`,
            [customerId, b.approver],
          );
          caseId = Number(created.rows[0].case_id);
        }

        // Commit the action: approved + approver + committed_at, applying any corrections.
        const status = b.corrected ? 'corrected' : 'approved';
        const upd = await appkit.lakebase.query(
          `UPDATE ops.retention_actions
             SET approval_status = $2,
                 approver        = $3,
                 committed_at    = now(),
                 case_id         = $4,
                 proposed_action = COALESCE($5, proposed_action),
                 offer_product_id = COALESCE($6, offer_product_id),
                 offer_rate_apy  = COALESCE($7, offer_rate_apy),
                 rationale       = COALESCE($8, rationale)
           WHERE action_id = $1
           RETURNING action_id, case_id, customer_id, proposed_action, offer_product_id,
                     offer_rate_apy, rationale, approval_status, approver, created_at, committed_at`,
          [
            b.action_id,
            status,
            b.approver,
            caseId,
            b.proposed_action ?? null,
            b.offer_product_id ?? null,
            b.offer_rate_apy ?? null,
            b.rationale ?? null,
          ],
        );

        await appkit.lakebase.query(
          `INSERT INTO ops.workflow_events (event_type, trigger_source, customer_id, action_id, detail)
           VALUES ('decision', 'user_open', $1, $2, $3)`,
          [
            customerId,
            b.action_id,
            `Action ${status.toUpperCase()} and committed by ${b.approver}`,
          ],
        );

        res.json(upd.rows[0]);
      } catch (err) {
        console.error('[retention] approve failed:', err);
        res.status(500).json({ error: 'Approve failed' });
      }
    });

    // ── ACT: reject a proposed action ─────────────────────────────────────────
    app.post('/api/retention/reject', async (req, res) => {
      const parsed = z
        .object({ action_id: z.number().int(), approver: z.string().min(1) })
        .safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'action_id and approver required' });
        return;
      }
      try {
        const upd = await appkit.lakebase.query(
          `UPDATE ops.retention_actions
             SET approval_status = 'rejected', approver = $2, committed_at = now()
           WHERE action_id = $1
           RETURNING action_id, customer_id, approval_status`,
          [parsed.data.action_id, parsed.data.approver],
        );
        if (upd.rows.length === 0) {
          res.status(404).json({ error: 'Action not found' });
          return;
        }
        await appkit.lakebase.query(
          `INSERT INTO ops.workflow_events (event_type, trigger_source, customer_id, action_id, detail)
           VALUES ('decision', 'user_open', $1, $2, $3)`,
          [
            String(upd.rows[0].customer_id),
            parsed.data.action_id,
            `Action REJECTED by ${parsed.data.approver}`,
          ],
        );
        res.json(upd.rows[0]);
      } catch (err) {
        console.error('[retention] reject failed:', err);
        res.status(500).json({ error: 'Reject failed' });
      }
    });
  });
}
