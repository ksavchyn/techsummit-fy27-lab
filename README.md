# TechSummit FY27 Lab — Meridian Bank customer-360 retention

A three-build lab for a relationship-manager retention use case on Databricks: catch
deposit attrition before the balance leaves, and turn it into an approved decision on
the call. Each build adds a layer — data, application, governance.

## Build 1 — Lakebase (data layer)

Stands up a Lakebase (Autoscaling) Postgres instance for the customer-360:
- syncs the governed UC gold layer (read-only) into Postgres for low-latency serving
- models a writable operational schema (cases / notes / actions) with a searchable text field
- reverse-syncs operational changes back to UC Delta (SCD2) via Lakebase CDF
- enables hybrid Lakebase Search (BM25 + vector) over case-note text
- iterates on a dev branch and promotes validated changes

Paths: `migrations/`, `bundle/` (sync-as-code DAB `meridian-lakebase-sync`), `scripts/`.

## Build 2 — Databricks App (decision layer)

`meridian-rm/` — an AppKit relationship-manager retention cockpit. Reads the Build 1
synced UC table, and persists all app state/actions to writable Postgres tables (never
writes to the synced table). Answers the hero question as a decision, not a lookup,
across three layers:
- **Visualize** — ranked/flagged at-risk queue (revenue-at-risk × attrition), scored on a trigger
- **Assist** — explains why a customer is flagged, a what-if scenario explorer, and memo
  drafting, retrieving from the Build 1 Lakebase Search index; plus a Genie tab over the
  retention space
- **Act** — propose → human approve/correct/reject → write back to Postgres, with the
  committed decision reflected on the next read (closed loop)

Path: `meridian-rm/` (app DAB `meridian-rm`). Built layer-by-layer on `dev` off `main`.

## Build 3 — Unity AI Gateway (governance layer, in progress)

Makes the app's AI spend bounded, visible, and attributable, and extends governance to
developer tooling:
- a programmatically created governed model service with an inference table
- a custom guardrail blocking "read all data" prompts, plus PII policies
- budgets that block calls over a low threshold
- coding-agent (ucode) and Slack MCP traffic routed through the gateway

Path: `submission3/`. Active on `dev`.

## Repo layout

```
migrations/     Postgres operational-schema migrations
bundle/         Build 1 sync-as-code DAB (meridian-lakebase-sync)
meridian-rm/    Build 2 Databricks App DAB (meridian-rm)
scripts/        baseline / helper scripts
submission1/    Build 1 evidence bundle
submission2/    Build 2 evidence bundle
submission3/    Build 3 evidence bundle (in progress)
```

The two bundles are independent — each has its own `databricks.yml` and deploys on its own.

## Branches

- `main` — finalized builds (Build 1 + Build 2)
- `dev` — active development (Build 3)
