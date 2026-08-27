-- 0003 (agentic change): add a derived retention priority score to ops.rm_cases.
-- Weights balance-at-risk by case priority so the app can rank outreach.
-- Authored by the coding agent; developed on Lakebase branch `dev`, then promoted to `production`.
ALTER TABLE ops.rm_cases ADD COLUMN IF NOT EXISTS priority_score NUMERIC(12,2);

UPDATE ops.rm_cases
SET priority_score = ROUND(
    COALESCE(balance_at_risk_usd, 0)
    * CASE priority WHEN 'high' THEN 1.5 WHEN 'medium' THEN 1.0 ELSE 0.5 END
, 2);
