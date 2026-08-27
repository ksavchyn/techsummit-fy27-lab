SELECT a.customer_id, a.customer_display_name, a.tier, a.home_metro,
       ROUND(a.revenue_at_risk_usd::numeric,2)   AS revenue_at_risk_usd,
       ROUND(a.balance_at_risk_usd::numeric,2)   AS balance_at_risk_usd,
       ROUND(a.attrition_risk_score::numeric,3)  AS attrition_risk_score,
       n.recommended_action,
       n.recommended_offer_product_id,
       ROUND(n.recommended_rate_apy::numeric,4)  AS recommended_rate_apy,
       ROUND(n.predicted_net_value_usd::numeric,2) AS predicted_net_value_usd
FROM retention.gold_open_atrisk a
JOIN retention.gold_nba_recommendations n USING (customer_id)
ORDER BY a.revenue_at_risk_usd DESC
LIMIT 10;
