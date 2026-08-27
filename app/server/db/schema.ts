import {
  text,
  timestamp,
  uuid,
  integer,
  doublePrecision,
  jsonb,
  pgSchema,
  index,
  uniqueIndex,
  boolean,
  bigint,
  numeric,
} from 'drizzle-orm/pg-core';

/**
 * Lakebase schema — THREE schemas, two read-only + one writable.
 *
 * 1. `retention.*` — synced Unity Catalog tables (Build 1 pipeline output).
 *    READ-ONLY. Never write to these from the app.
 *      • gold_customer_position (40K rows, full customer 360)
 *      • gold_open_atrisk (340 rows, at-risk details)
 *      • gold_nba_recommendations (340 rows, ML-scored next-best-actions)
 *
 * 2. `ops.*` — writable operational tables for RM decisions.
 *    The app writes ONLY here.
 *      • rm_cases (retention cases opened by the system)
 *      • outreach_actions (approved RM actions)
 *      • rm_notes (audit notes with full-text search + embeddings)
 *
 * 3. `app.*` — chat state (conversations, messages, feedback).
 *    Owned by the app's service principal. Standard AppKit plumbing.
 *
 * Technical requirement #2: Never write to synced UC tables.
 * All app state and actions persist to ops.* writable Postgres tables.
 */
export const retentionSchema = pgSchema('retention');
export const opsSchema = pgSchema('ops');
export const appSchema = pgSchema('app');

// ============================================================================
// Chat state
// ============================================================================

export const conversations = appSchema.table(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userEmail: text('user_email').notNull(),
    title: text('title').notNull(),
    // 'default' for regular chats, 'demo_dock' for the floating dock's
    // persistent conversation (one per user).
    kind: text('kind', { enum: ['default', 'demo_dock'] })
      .notNull()
      .default('default'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('conversations_user_idx').on(t.userEmail, t.updatedAt),
    index('conversations_kind_idx').on(t.userEmail, t.kind),
  ],
);

export const messages = appSchema.table(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
    content: text('content').notNull(),
    position: integer('position').notNull(),
    traceId: text('trace_id'),
    // Captured reasoning steps (tool calls, outputs, intermediate messages)
    // for assistant messages. Shape matches client's ThinkingEvent union.
    thinking: jsonb('thinking').$type<ThinkingEntry[]>().notNull().default([]),
    // If the agent run failed, the error message is persisted here so a
    // page reload still shows what went wrong (instead of an empty bubble).
    error: text('error'),
    // True when the turn was stopped by the user (Stop button or page
    // navigation away from an in-flight stream). The assistant's partial
    // streamed content is still kept in `content` for context; the UI
    // renders a "Canceled by the user" banner below it.
    canceled: boolean('canceled').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Unique on (conversation_id, position) so the `SELECT MAX + 1` race in
    // appendMessage surfaces as a constraint error (caller retries) instead
    // of silently inserting two messages at the same position — which
    // would break the on-reload ordering. Doubles as the lookup index.
    uniqueIndex('messages_convo_pos_uq').on(t.conversationId, t.position),
  ],
);

export const feedback = appSchema.table(
  'feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    userEmail: text('user_email').notNull(),
    value: text('value', { enum: ['up', 'down'] }).notNull(),
    rationale: text('rationale'),
    traceId: text('trace_id'),
    mlflowAssessmentId: text('mlflow_assessment_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('feedback_message_idx').on(t.messageId)],
);

// ============================================================================
// retention.* — Synced Unity Catalog tables (READ-ONLY)
// These are populated by the Build 1 SDP pipeline. NEVER write to these.
// ============================================================================

export const goldCustomerPosition = retentionSchema.table('gold_customer_position', {
  customerId: text('customer_id').primaryKey(),
  customerDisplayName: text('customer_display_name'),
  tier: text('tier', {
    enum: ['mass', 'mass_affluent', 'affluent', 'private'],
  }).notNull(),
  tenureYears: integer('tenure_years'),
  homeMetro: text('home_metro'),
  customerLat: doublePrecision('customer_lat'),
  customerLng: doublePrecision('customer_lng'),
  profileSummary: text('profile_summary'),
  totalBalanceUsd: doublePrecision('total_balance_usd'),
  depositBalanceUsd: doublePrecision('deposit_balance_usd'),
  affectedDepositBalanceUsd: doublePrecision('affected_deposit_balance_usd'),
  minDaysToMaturity: integer('min_days_to_maturity'),
  attritionRiskScore: doublePrecision('attrition_risk_score'),
  balanceOutflow30dUsd: doublePrecision('balance_outflow_30d_usd'),
  churnSignalScore: numeric('churn_signal_score'),
  productCount: bigint('product_count', { mode: 'number' }),
  balanceAtRiskUsd: doublePrecision('balance_at_risk_usd'),
  revenueAtRiskUsd: doublePrecision('revenue_at_risk_usd'),
  riskBand: text('risk_band', {
    enum: ['critical', 'elevated', 'watch', 'healthy'],
  }).notNull(),
});

export const goldOpenAtrisk = retentionSchema.table('gold_open_atrisk', {
  customerId: text('customer_id').primaryKey(),
  customerDisplayName: text('customer_display_name'),
  tier: text('tier'),
  tenureYears: integer('tenure_years'),
  homeMetro: text('home_metro'),
  customerLat: doublePrecision('customer_lat'),
  customerLng: doublePrecision('customer_lng'),
  attritionRiskScore: doublePrecision('attrition_risk_score'),
  balanceAtRiskUsd: doublePrecision('balance_at_risk_usd'),
  revenueAtRiskUsd: doublePrecision('revenue_at_risk_usd'),
  atriskProductId: text('atrisk_product_id'),
  atriskBalanceUsd: doublePrecision('atrisk_balance_usd'),
  daysToMaturity: integer('days_to_maturity'),
  currentRateApy: doublePrecision('current_rate_apy'),
  candidateCrossSellProductId: text('candidate_cross_sell_product_id'),
});

export const goldNbaRecommendations = retentionSchema.table('gold_nba_recommendations', {
  customerId: text('customer_id').primaryKey(),
  recommendedAction: text('recommended_action').notNull(),
  recommendedOfferProductId: text('recommended_offer_product_id'),
  recommendedRateApy: numeric('recommended_rate_apy'),
  predictedRetainedUsd: doublePrecision('predicted_retained_usd'),
  predictedNetValueUsd: doublePrecision('predicted_net_value_usd'),
  actionRanking: text('action_ranking'), // JSON string from the pipeline
  scoredAt: timestamp('scored_at', { withTimezone: true }),
});

// ============================================================================
// ops.* — Writable operational tables (RM decisions + audit)
// All app writes go HERE. Never to retention.*.
// ============================================================================

export const rmCases = opsSchema.table('rm_cases', {
  caseId: bigint('case_id', { mode: 'number' }).primaryKey(),
  customerId: text('customer_id').notNull(),
  status: text('status').notNull().default('open'),
  priority: text('priority'),
  assignedRm: text('assigned_rm'),
  balanceAtRiskUsd: numeric('balance_at_risk_usd'),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  priorityScore: numeric('priority_score'),
});

export const outreachActions = opsSchema.table('outreach_actions', {
  actionId: bigint('action_id', { mode: 'number' }).primaryKey(),
  caseId: bigint('case_id', { mode: 'number' }),
  customerId: text('customer_id').notNull(),
  actionType: text('action_type').notNull(),
  offerProductId: text('offer_product_id'),
  offerRateApy: numeric('offer_rate_apy'),
  outcome: text('outcome'),
  actionAt: timestamp('action_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rmNotes = opsSchema.table('rm_notes', {
  noteId: bigint('note_id', { mode: 'number' }).primaryKey(),
  caseId: bigint('case_id', { mode: 'number' }),
  customerId: text('customer_id').notNull(),
  author: text('author'),
  noteText: text('note_text'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Legacy alias for backward compat with template chat routes
export const rmActions = opsSchema.table('outreach_actions', {
  id: bigint('action_id', { mode: 'number' }).primaryKey(),
  customerId: text('customer_id').notNull(),
  actionType: text('action_type').notNull(),
  offerProductId: text('offer_product_id'),
  offerRateApy: numeric('offer_rate_apy'),
  outcome: text('outcome'),
  actionAt: timestamp('action_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Shared types (used by queries + client)
// ============================================================================

export type ActionRankingEntry = {
  action_type: 'retention_offer' | 'cross_sell' | 'rm_outreach';
  retained_revenue?: number;
  net_value?: number;
  cost?: number;
};

export type RmAuditEntry = {
  at: string;
  by: string;
  action: string;
  notes?: string;
};

// ============================================================================
// JSONB entry shapes
// ============================================================================

export type ThinkingEntry =
  | { kind: 'tool_call'; callId: string; name: string; args: string }
  | { kind: 'tool_output'; callId: string; output: string }
  | { kind: 'intermediate_message'; text: string };
