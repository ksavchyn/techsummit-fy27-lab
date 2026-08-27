-- Query against the synced Unity Catalog gold table (read-only in Postgres),
-- served at low latency from Lakebase. Riskiest customers by revenue-at-risk.
SELECT customer_id, customer_display_name, tier, home_metro, risk_band,
       ROUND(revenue_at_risk_usd::numeric,2) AS revenue_at_risk_usd,
       ROUND(balance_at_risk_usd::numeric,2)  AS balance_at_risk_usd
FROM retention.gold_customer_position
WHERE risk_band IN ('critical','elevated','watch')
ORDER BY revenue_at_risk_usd DESC
LIMIT 10;
