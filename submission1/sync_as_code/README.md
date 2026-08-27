# Sync defined as code (Technical Requirement #2)

- **databricks.yml** — Declarative Automation Bundle declaring the three forward synced tables
  (UC gold layer → Lakebase Postgres `retention.*`, read-only). Deploy: `databricks bundle deploy -t prod`.
- **reverse_sync_cdf.json + apply_reverse_sync.sh** — the reverse Lakehouse Sync (Lakebase CDF,
  `ops` Postgres schema → UC Delta `reyden_whisperers_catalog.meridian_ops_history`, SCD Type 2).
  CDF has no first-class DAB/Terraform resource yet (Beta), so it is version-controlled here as a
  parameterized spec + apply script — defined as code, applied via CLI, never the UI.

Everything in this build was created via the CLI/API (see ../../scripts and ../../migrations), not the UI.
