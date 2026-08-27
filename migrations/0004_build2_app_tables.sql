-- Build 2 app tables (writable Postgres; never the synced retention.* tables).
-- retention_actions = the write-back action table (proposed -> approved/corrected -> committed).
CREATE TABLE IF NOT EXISTS ops.retention_actions (
    action_id        BIGSERIAL PRIMARY KEY,
    case_id          BIGINT REFERENCES ops.rm_cases(case_id),
    customer_id      TEXT NOT NULL,
    proposed_action  TEXT NOT NULL,               -- match_competitor_rate | fee_waiver | premium_upgrade | outreach_call
    offer_product_id TEXT,
    offer_rate_apy   NUMERIC(6,4),
    rationale        TEXT,
    approval_status  TEXT NOT NULL DEFAULT 'proposed',  -- proposed | approved | rejected | corrected
    approver         TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),  -- proposed at
    committed_at     TIMESTAMPTZ                            -- set when a human approves/commits
);
CREATE INDEX IF NOT EXISTS ix_retention_actions_customer ON ops.retention_actions(customer_id);

-- workflow_events = state + observability: trigger events and recorded decisions with timestamps.
CREATE TABLE IF NOT EXISTS ops.workflow_events (
    event_id       BIGSERIAL PRIMARY KEY,
    event_type     TEXT NOT NULL,                 -- trigger | decision
    trigger_source TEXT,                          -- schedule | system_update | user_open
    customer_id    TEXT,
    action_id      BIGINT REFERENCES ops.retention_actions(action_id),
    detail         TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_workflow_events_type ON ops.workflow_events(event_type, created_at);
