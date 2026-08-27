#!/bin/bash
# Development + forecasting branches off production (main), created as code (CLI, not UI).
P="${1:-reyden-whisperers}"

# named development branch off production, kept (iteration branch)
databricks postgres create-branch projects/meridian-bank dev \
  --json '{"spec":{"source_branch":"projects/meridian-bank/branches/production","no_expiry":true}}' -p "$P"
databricks postgres create-endpoint projects/meridian-bank/branches/dev primary --replace-existing \
  --json '{"spec":{"endpoint_type":"ENDPOINT_TYPE_READ_WRITE","autoscaling_limit_min_cu":0.5,"autoscaling_limit_max_cu":2.0,"suspend_timeout_duration":"300s"}}' -p "$P"

# throwaway forecasting branch off production (what-if scenarios; production stays clean)
databricks postgres create-branch projects/meridian-bank forecast \
  --json '{"spec":{"source_branch":"projects/meridian-bank/branches/production","no_expiry":true}}' -p "$P"
databricks postgres create-endpoint projects/meridian-bank/branches/forecast primary --replace-existing \
  --json '{"spec":{"endpoint_type":"ENDPOINT_TYPE_READ_WRITE","autoscaling_limit_min_cu":0.5,"autoscaling_limit_max_cu":2.0,"suspend_timeout_duration":"300s"}}' -p "$P"

# git side: named development branch 'dev' created off 'main', then promoted via merge.
git checkout main
git checkout -b dev                       # create dev branch off main
#   ... make schema change on dev (see agent_change/) ...
git checkout main
git merge --no-ff dev                      # promote validated dev into main
# (see git_history.txt for the resulting branch-off-main + merge graph)
