# Gateway endpoint handoff — Meridian RM app (for Will, Platform Eng)

**Context:** The Meridian relationship-manager app (Build 2) makes AI calls that must become
**bounded, visible, and attributable** (Build 3 / the $1,200 runaway incident). Today the app
calls **shared system FM endpoints** directly, which can't carry app-specific limits/budgets/PII
guardrails. Please create **app-owned serving endpoints** that front those models, and apply the
AI Gateway config below. The app team will repoint the app at your endpoint URLs.

Workspace: `fe-sandbox-reyden-whisperers.cloud.databricks.com` (profile `reyden-whisperers`, org `7474649765011275`)

## Endpoints to create

| Create this endpoint | Fronts (underlying model) | App uses it for |
|---|---|---|
| `meridian-rm-assist-chat` | `databricks-claude-opus-4-8` (task `llm/v1/chat`) | "why flagged" explanation, what-if, memo drafting |
| `meridian-rm-embed` | `databricks-gte-large-en` (task `llm/v1/embeddings`) | Lakebase Search query embeddings |
| `meridian-rm-genie` *(optional)* | Genie space `01f1a243d9f810e9b54208917a76af3e` | NL Q&A / what-if via Genie (only if we route Genie through the app) |

App will call the resulting URLs:
`https://fe-sandbox-reyden-whisperers.cloud.databricks.com/serving-endpoints/meridian-rm-assist-chat/invocations`
`.../serving-endpoints/meridian-rm-embed/invocations`

## AI Gateway config to apply (on `meridian-rm-assist-chat` — the incident surface)

Apply via `databricks serving-endpoints put-ai-gateway meridian-rm-assist-chat --json '{...}'`
(verify exact field names against this workspace's CLI/API version):

```json
{
  "usage_tracking_config": { "enabled": true },
  "inference_table_config": {
    "enabled": true,
    "catalog_name": "reyden_whisperers_catalog",
    "schema_name": "meridian_ai_gateway",
    "table_name_prefix": "rm_assist_chat"
  },
  "rate_limits": [
    { "calls": 60, "renewal_period": "minute", "key": "endpoint" },
    { "calls": 20, "renewal_period": "minute", "key": "user" }
  ],
  "guardrails": {
    "input":  { "pii": { "behavior": "BLOCK" }, "safety": true },
    "output": { "pii": { "behavior": "MASK" }, "safety": true }
  },
  "fallback_config": { "enabled": true }
}
```

**Also cap single-call cost** (this is what actually stops a 2-hour runaway, which calls-based
rate limits alone do not): enforce a **max output tokens** ceiling and a **request timeout** on the
endpoint/route (e.g. `max_tokens <= 1024`, timeout ~60s). If this workspace's UAIG supports
**token/cost budgets or quotas**, set a monthly $ budget + alert on the endpoint too.

## On `meridian-rm-embed`
Same `usage_tracking` + `inference_table` (prefix `rm_embed`) + a `rate_limits` calls cap.
PII guardrail optional (embeddings input is the query text). Cheap but keep it **visible**.

## Attribution the app will send (so charge-back works — for Wen Jiang)
Every request carries metadata tags you can group usage by:
`app=meridian-rm`, `layer=assist`, `function=explain|whatif|memo|search_embed`, `caller=<service-principal>`.
The app authenticates as a **service principal** (stable attribution, no broad user PII).

## Permissions
- Grant the app's **service principal** `CAN_QUERY` on both endpoints.
- Grant your platform team `CAN_MANAGE`.
- Inference-table schema `reyden_whisperers_catalog.meridian_ai_gateway`: grant your team + auditors `SELECT`.

## Why each control (maps to the incident + personas)
- **max_tokens + timeout + rate limits** → the $1,200 / 2-hour runaway becomes impossible (bounded).
- **inference tables** → the trace that was missing in the incident; Marisol can hand an examiner the exact call (auditable).
- **usage tracking + tags** → Wen Jiang can forecast + charge back per app/function (attributable/visible).
- **PII BLOCK/MASK guardrail** → reduced PII exposure, audit-ready (Sinead/Marisol). App already sends only `customer_id` + bank-generated `profile_summary`/signals, not raw PII.
