# Scale-to-zero (idle branches cost ~nothing)

Lakebase Autoscaling compute scales to zero (suspends) after an inactivity timeout.
Configured on every endpoint as code (see branch_create.sh / sync_as_code):
  autoscaling_limit_min_cu: 0.5   (compute floor while active)
  autoscaling_limit_max_cu: 2.0
  suspend_timeout_duration: "300s"  (suspend after 5 min idle -> $0 compute)

Set via:
  databricks postgres create-endpoint <branch> primary --replace-existing \
    --json '{"spec":{"endpoint_type":"ENDPOINT_TYPE_READ_WRITE","autoscaling_limit_min_cu":0.5,"autoscaling_limit_max_cu":2.0,"suspend_timeout_duration":"300s"}}'

Evidence: scale_to_zero_evidence.json (all three branch endpoints).
