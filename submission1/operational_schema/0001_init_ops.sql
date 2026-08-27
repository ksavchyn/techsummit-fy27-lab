-- Meridian Bank — operational (writable) schema for the retention app.
-- Synced gold tables live in schema "synced" (read-only, maintained by Lakebase sync).
-- App state + actions live here in "ops" (writable Postgres), keyed to customer_id.

CREATE SCHEMA IF NOT EXISTS ops;

-- Retention cases: one open case per at-risk customer being worked by an RM.
CREATE TABLE IF NOT EXISTS ops.rm_cases (
    case_id            BIGSERIAL PRIMARY KEY,
    customer_id        TEXT        NOT NULL,           -- links to synced.gold_customer_position
    status             TEXT        NOT NULL DEFAULT 'open',    -- open | working | won | lost
    priority           TEXT        NOT NULL DEFAULT 'medium',  -- low | medium | high
    assigned_rm        TEXT,
    balance_at_risk_usd NUMERIC(18,2),
    opened_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (customer_id, status)
);
CREATE INDEX IF NOT EXISTS ix_rm_cases_customer ON ops.rm_cases (customer_id);

-- RM notes: free-text notes on a case. note_text is the searchable field for Lakebase Search.
CREATE TABLE IF NOT EXISTS ops.rm_notes (
    note_id     BIGSERIAL PRIMARY KEY,
    case_id     BIGINT NOT NULL REFERENCES ops.rm_cases(case_id) ON DELETE CASCADE,
    customer_id TEXT   NOT NULL,
    author      TEXT,
    note_text   TEXT   NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_rm_notes_case ON ops.rm_notes (case_id);

-- Outreach actions: the actions the app takes (offers made, calls logged) and their outcome.
CREATE TABLE IF NOT EXISTS ops.outreach_actions (
    action_id        BIGSERIAL PRIMARY KEY,
    case_id          BIGINT NOT NULL REFERENCES ops.rm_cases(case_id) ON DELETE CASCADE,
    customer_id      TEXT   NOT NULL,
    action_type      TEXT   NOT NULL,          -- call | email | rate_offer | branch_visit
    offer_product_id TEXT,
    offer_rate_apy   NUMERIC(6,4),
    outcome          TEXT,                       -- pending | accepted | declined | no_response
    action_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_outreach_case ON ops.outreach_actions (case_id);
