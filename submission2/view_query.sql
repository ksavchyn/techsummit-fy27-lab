-- Live retention view: open at-risk customers, RANKED by decision priority
-- (revenue at risk x attrition probability), flagged, with the model's next-best action
-- and current case/action state. Reads the Build-1 SYNCED tables (read-only) joined to
-- writable ops state. This is what the app surfaces at the top of the queue.
SELECT
  a.customer_id,
  a.customer_display_name,
  a.tier,
  a.home_metro,
  ROUND(a.revenue_at_risk_usd::numeric,2)      AS revenue_at_risk_usd,
  ROUND(a.attrition_risk_score::numeric,3)     AS attrition_risk_score,
  ROUND((a.revenue_at_risk_usd * a.attrition_risk_score)::numeric,2) AS decision_priority,
  CASE WHEN a.attrition_risk_score >= 0.80 THEN 'ACT NOW'
       WHEN a.attrition_risk_score >= 0.60 THEN 'WATCH'
       ELSE 'MONITOR' END                      AS flag,
  n.recommended_action,
  n.recommended_offer_product_id,
  ROUND(n.recommended_rate_apy::numeric,4)     AS recommended_rate_apy,
  ROUND(n.predicted_net_value_usd::numeric,2)  AS predicted_net_value_usd,
  c.status                                     AS case_status,
  ra.approval_status                           AS latest_action_status
FROM retention.gold_open_atrisk a
JOIN retention.gold_nba_recommendations n USING (customer_id)
LEFT JOIN ops.rm_cases c ON c.customer_id = a.customer_id AND c.status <> 'won'
LEFT JOIN LATERAL (
   SELECT approval_status FROM ops.retention_actions r
   WHERE r.customer_id = a.customer_id ORDER BY created_at DESC LIMIT 1
) ra ON true
ORDER BY decision_priority DESC
LIMIT 20;
