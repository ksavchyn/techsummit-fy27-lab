-- Throwaway FORECAST branch: what-if a competitor raises savings APY, lifting churn probability.
-- Projects revenue loss from at-risk customers WITHOUT touching production.
CREATE TABLE IF NOT EXISTS ops.forecast_attrition_scenario AS
SELECT a.customer_id, a.revenue_at_risk_usd, a.attrition_risk_score,
       ROUND((a.revenue_at_risk_usd * LEAST(a.attrition_risk_score * 1.25, 1.0))::numeric, 2) AS projected_revenue_loss_usd
FROM retention.gold_open_atrisk a;

SELECT COUNT(*) AS customers, ROUND(SUM(projected_revenue_loss_usd),2) AS total_projected_loss_usd
FROM ops.forecast_attrition_scenario;
