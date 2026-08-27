#!/bin/bash
# Reproducibly (re)create the reverse Lakehouse Sync from reverse_sync_cdf.json. Not UI.
set -euo pipefail
P="${1:-reyden-whisperers}"
SPEC="$(dirname "$0")/reverse_sync_cdf.json"
databricks postgres create-cdf-config \
  "$(jq -r .parent "$SPEC")" \
  "$(jq -r .catalog "$SPEC")" \
  "$(jq -r .schema "$SPEC")" \
  "$(jq -r .postgres_schema "$SPEC")" \
  --cdf-config-id "$(jq -r .cdf_config_id "$SPEC")" \
  -p "$P"
