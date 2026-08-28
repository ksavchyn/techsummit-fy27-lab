-- Build 3 · Unity AI Gateway — catalog, schema, and inference-table setup (committed code)
-- Run against the reyden-whisperers workspace.

-- 1) Catalog + schema that hold the governed model service and its inference (payload) table.
CREATE CATALOG IF NOT EXISTS reyden_whisperers_catalog;
CREATE SCHEMA  IF NOT EXISTS reyden_whisperers_catalog.meridian_ai_gateway;

-- 2) The inference (payload) table is auto-created and auto-captured by the model service's
--    inference_table config (see gateway_service.txt and gateway_model_service_config.json).
--    Enabling auto-capture on the model service creates and populates:
--        reyden_whisperers_catalog.meridian_ai_gateway.`meridian-rm-gw-acs_payload`
--    config.inference_table = { disabled: false, parent: schemas/reyden_whisperers_catalog.meridian_ai_gateway,
--                               table_name_prefix: "meridian-rm-gw-acs" }  -- disabled:false => auto-capture ON

-- 3) The custom guardrail function is created here too (bound as a service policy on the endpoint).
CREATE OR REPLACE FUNCTION reyden_whisperers_catalog.meridian_ai_gateway.guard_block_all_data(event VARIANT)
RETURNS VARIANT
LANGUAGE SQL
RETURN
  CASE
    WHEN event:type::string = 'request'
      AND (
           contains(lower(event:context.message::string), 'all data')
        OR contains(lower(event:context.message::string), 'all customers')
        OR contains(lower(event:context.message::string), 'every customer')
        OR contains(lower(event:context.message::string), 'all accounts')
        OR contains(lower(event:context.message::string), 'all records')
        OR contains(lower(event:context.message::string), 'entire dataset')
        OR contains(lower(event:context.message::string), 'read everything')
        OR contains(lower(event:context.message::string), 'unfiltered')
        OR contains(lower(event:context.message::string), 'select *')
      )
    THEN to_variant_object(named_struct('result','DENY','reason','Blocked: attempts to read all/unfiltered Lakebase data'))
    ELSE to_variant_object(named_struct('result','ALLOW','reason',''))
  END;
