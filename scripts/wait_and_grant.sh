#!/bin/bash
set -e
P=reyden-whisperers
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
HOST=$(databricks postgres list-endpoints projects/meridian-bank/branches/production -p $P -o json | jq -r '.[0].status.hosts.host')
EMAIL=$(databricks current-user me -p $P -o json | jq -r '.userName')
for i in $(seq 1 60); do
  n=$(databricks postgres list-endpoints projects/meridian-bank/branches/production -p $P -o json >/dev/null 2>&1; \
      TOKEN=$(databricks postgres generate-database-credential projects/meridian-bank/branches/production/endpoints/primary -p $P -o json | jq -r '.token'); \
      PGPASSWORD=$TOKEN psql "host=$HOST port=5432 dbname=databricks_postgres user=$EMAIL sslmode=require" -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='retention';")
  echo "poll $i: retention tables = $n"
  if [ "$n" -ge 3 ]; then
    TOKEN=$(databricks postgres generate-database-credential projects/meridian-bank/branches/production/endpoints/primary -p $P -o json | jq -r '.token')
    PGPASSWORD=$TOKEN psql "host=$HOST port=5432 dbname=databricks_postgres user=$EMAIL sslmode=require" \
      -c "GRANT USAGE ON SCHEMA retention TO \"users\";" \
      -c "GRANT SELECT ON ALL TABLES IN SCHEMA retention TO \"users\";"
    echo "GRANTED SELECT on retention to users; row counts:"
    PGPASSWORD=$TOKEN psql "host=$HOST port=5432 dbname=databricks_postgres user=$EMAIL sslmode=require" \
      -c "SELECT 'gold_customer_position' t, count(*) FROM retention.gold_customer_position
          UNION ALL SELECT 'gold_open_atrisk', count(*) FROM retention.gold_open_atrisk
          UNION ALL SELECT 'gold_nba_recommendations', count(*) FROM retention.gold_nba_recommendations;"
    echo "DONE"
    exit 0
  fi
  sleep 15
done
echo "TIMEOUT waiting for synced tables"
exit 1
