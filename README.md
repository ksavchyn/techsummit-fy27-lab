# Lakebase Build 1 — Meridian Bank retention app

Stands up a Lakebase (Autoscaling) Postgres instance for the Meridian Bank customer-360:
- syncs the governed UC gold layer (read-only) into Postgres for low-latency serving
- models a writable operational schema (cases / notes / actions) with a searchable text field
- reverse-syncs operational changes back to UC Delta (SCD2) via Lakebase CDF
- enables hybrid Lakebase Search over case-note text
- iterates on a dev branch and promotes validated changes

See `migrations/`, `bundle/` (sync-as-code), and `scripts/`.
