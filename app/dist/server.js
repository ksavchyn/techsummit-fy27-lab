var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/lib/logger.ts
import util from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
var LEVEL_COLORS = {
  DEBUG: "\x1B[90m",
  INFO: "\x1B[36m",
  WARN: "\x1B[33m",
  ERROR: "\x1B[31m"
};
var LEVEL_RANK = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40
};
var MIN_LEVEL = (() => {
  const raw = (process.env.LOG_LEVEL ?? "INFO").toUpperCase();
  return ["DEBUG", "INFO", "WARN", "ERROR"].includes(raw) ? raw : "INFO";
})();
function shouldEmit(level) {
  return LEVEL_RANK[level] >= LEVEL_RANK[MIN_LEVEL];
}
var DIM = "\x1B[2m";
var RESET = "\x1B[0m";
var SELF_TAG = "\0logger\0";
var CONT_INDENT = "    ";
var THIS_FILE = fileURLToPath(import.meta.url);
var THIS_BASENAME = path.basename(THIS_FILE);
var installed = false;
function installLogger() {
  if (installed)
    return;
  installed = true;
  const useColor = process.stdout.isTTY === true;
  const origStdoutWrite = process.stdout.write.bind(process.stdout);
  const origStderrWrite = process.stderr.write.bind(process.stderr);
  const colorLevel = (level) => useColor ? `${LEVEL_COLORS[level]}${level.padEnd(5)}${RESET}` : level.padEnd(5);
  const colorTs = (ts) => useColor ? `${DIM}${ts}${RESET}` : ts;
  const colorCaller = (caller) => useColor ? `${DIM}${caller}${RESET}` : caller;
  function callerFrame() {
    const stack = new Error().stack;
    if (!stack)
      return "";
    const lines = stack.split("\n");
    for (const line of lines) {
      const m = line.match(/\(?(?:file:\/\/)?([^\s()]+\.(?:ts|js|mjs|cjs)):(\d+):\d+\)?/);
      if (!m)
        continue;
      const file = m[1];
      if (file.endsWith(THIS_BASENAME))
        continue;
      if (file.startsWith("node:"))
        continue;
      const parts = file.split("/");
      const short = parts.slice(-2).join("/");
      return `${short}:${m[2]}`;
    }
    return "";
  }
  function prefix(level, caller) {
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    const callerPad = caller ? ` ${caller.padEnd(22)}` : "";
    return `${colorTs(ts)} ${colorLevel(level)}${colorCaller(callerPad)}  `;
  }
  function formatArg(a) {
    if (typeof a === "string")
      return a;
    if (a instanceof Error)
      return a.stack ?? `${a.name}: ${a.message}`;
    return util.inspect(a, { colors: useColor, depth: 4, breakLength: 120 });
  }
  function render(level, args) {
    const body = args.map(formatArg).join(" ");
    const lines = body.split("\n");
    while (lines.length > 1 && lines[lines.length - 1] === "")
      lines.pop();
    const p = prefix(level, callerFrame());
    const out = lines.length === 1 ? p + lines[0] : p + lines[0] + "\n" + lines.slice(1).map((l) => CONT_INDENT + l).join("\n");
    return SELF_TAG + out + "\n";
  }
  const makeConsoleMethod = (level, write) => (...args) => {
    if (!shouldEmit(level))
      return;
    const out = render(level, args);
    write(out.slice(SELF_TAG.length));
  };
  const stdoutSink = (s) => origStdoutWrite(s);
  const stderrSink = (s) => origStderrWrite(s);
  console.log = makeConsoleMethod("INFO", stdoutSink);
  console.info = makeConsoleMethod("INFO", stdoutSink);
  console.debug = makeConsoleMethod("DEBUG", stdoutSink);
  console.warn = makeConsoleMethod("WARN", stderrSink);
  console.error = makeConsoleMethod("ERROR", stderrSink);
  const patchWrite = (level, orig) => {
    return (chunk, ...rest) => {
      let s = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
      if (s.startsWith(SELF_TAG)) {
        return orig(s.slice(SELF_TAG.length), ...rest);
      }
      const endsWithNL = s.endsWith("\n");
      const lines = (endsWithNL ? s.slice(0, -1) : s).split("\n");
      while (lines.length > 1 && lines[lines.length - 1] === "")
        lines.pop();
      const p = prefix(level, callerFrame());
      const out = lines.length === 1 ? p + lines[0] : p + lines[0] + "\n" + lines.slice(1).map((l) => CONT_INDENT + l).join("\n");
      return orig(out + (endsWithNL ? "\n" : ""), ...rest);
    };
  };
  process.stdout.write = patchWrite("INFO", origStdoutWrite);
  process.stderr.write = patchWrite("ERROR", origStderrWrite);
}

// server/server.ts
import {
  createApp,
  server,
  lakebase,
  analytics,
  getExecutionContext as getExecutionContext4
} from "@databricks/appkit";
import { readFileSync as readFileSync2 } from "node:fs";
import { fileURLToPath as fileURLToPath3 } from "node:url";
import { dirname as dirname2, resolve as resolve3 } from "node:path";
import { parse as parseJsonc, printParseErrorCode } from "jsonc-parser";
import { z as z3 } from "zod";
import * as mlflow4 from "mlflow-tracing";

// server/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";

// server/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  appSchema: () => appSchema,
  conversations: () => conversations,
  feedback: () => feedback,
  goldCustomerPosition: () => goldCustomerPosition,
  goldNbaRecommendations: () => goldNbaRecommendations,
  goldOpenAtrisk: () => goldOpenAtrisk,
  messages: () => messages,
  opsSchema: () => opsSchema,
  outreachActions: () => outreachActions,
  retentionSchema: () => retentionSchema,
  rmActions: () => rmActions,
  rmCases: () => rmCases,
  rmNotes: () => rmNotes
});
import {
  text,
  timestamp,
  uuid,
  integer,
  doublePrecision,
  jsonb,
  pgSchema,
  index,
  uniqueIndex,
  boolean,
  bigint,
  numeric
} from "drizzle-orm/pg-core";
var retentionSchema = pgSchema("retention");
var opsSchema = pgSchema("ops");
var appSchema = pgSchema("app");
var conversations = appSchema.table(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userEmail: text("user_email").notNull(),
    title: text("title").notNull(),
    // 'default' for regular chats, 'demo_dock' for the floating dock's
    // persistent conversation (one per user).
    kind: text("kind", { enum: ["default", "demo_dock"] }).notNull().default("default"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("conversations_user_idx").on(t.userEmail, t.updatedAt),
    index("conversations_kind_idx").on(t.userEmail, t.kind)
  ]
);
var messages = appSchema.table(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
    content: text("content").notNull(),
    position: integer("position").notNull(),
    traceId: text("trace_id"),
    // Captured reasoning steps (tool calls, outputs, intermediate messages)
    // for assistant messages. Shape matches client's ThinkingEvent union.
    thinking: jsonb("thinking").$type().notNull().default([]),
    // If the agent run failed, the error message is persisted here so a
    // page reload still shows what went wrong (instead of an empty bubble).
    error: text("error"),
    // True when the turn was stopped by the user (Stop button or page
    // navigation away from an in-flight stream). The assistant's partial
    // streamed content is still kept in `content` for context; the UI
    // renders a "Canceled by the user" banner below it.
    canceled: boolean("canceled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    // Unique on (conversation_id, position) so the `SELECT MAX + 1` race in
    // appendMessage surfaces as a constraint error (caller retries) instead
    // of silently inserting two messages at the same position — which
    // would break the on-reload ordering. Doubles as the lookup index.
    uniqueIndex("messages_convo_pos_uq").on(t.conversationId, t.position)
  ]
);
var feedback = appSchema.table(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
    userEmail: text("user_email").notNull(),
    value: text("value", { enum: ["up", "down"] }).notNull(),
    rationale: text("rationale"),
    traceId: text("trace_id"),
    mlflowAssessmentId: text("mlflow_assessment_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("feedback_message_idx").on(t.messageId)]
);
var goldCustomerPosition = retentionSchema.table("gold_customer_position", {
  customerId: text("customer_id").primaryKey(),
  customerDisplayName: text("customer_display_name"),
  tier: text("tier", {
    enum: ["mass", "mass_affluent", "affluent", "private"]
  }).notNull(),
  tenureYears: integer("tenure_years"),
  homeMetro: text("home_metro"),
  customerLat: doublePrecision("customer_lat"),
  customerLng: doublePrecision("customer_lng"),
  profileSummary: text("profile_summary"),
  totalBalanceUsd: doublePrecision("total_balance_usd"),
  depositBalanceUsd: doublePrecision("deposit_balance_usd"),
  affectedDepositBalanceUsd: doublePrecision("affected_deposit_balance_usd"),
  minDaysToMaturity: integer("min_days_to_maturity"),
  attritionRiskScore: doublePrecision("attrition_risk_score"),
  balanceOutflow30dUsd: doublePrecision("balance_outflow_30d_usd"),
  churnSignalScore: numeric("churn_signal_score"),
  productCount: bigint("product_count", { mode: "number" }),
  balanceAtRiskUsd: doublePrecision("balance_at_risk_usd"),
  revenueAtRiskUsd: doublePrecision("revenue_at_risk_usd"),
  riskBand: text("risk_band", {
    enum: ["critical", "elevated", "watch", "healthy"]
  }).notNull()
});
var goldOpenAtrisk = retentionSchema.table("gold_open_atrisk", {
  customerId: text("customer_id").primaryKey(),
  customerDisplayName: text("customer_display_name"),
  tier: text("tier"),
  tenureYears: integer("tenure_years"),
  homeMetro: text("home_metro"),
  customerLat: doublePrecision("customer_lat"),
  customerLng: doublePrecision("customer_lng"),
  attritionRiskScore: doublePrecision("attrition_risk_score"),
  balanceAtRiskUsd: doublePrecision("balance_at_risk_usd"),
  revenueAtRiskUsd: doublePrecision("revenue_at_risk_usd"),
  atriskProductId: text("atrisk_product_id"),
  atriskBalanceUsd: doublePrecision("atrisk_balance_usd"),
  daysToMaturity: integer("days_to_maturity"),
  currentRateApy: doublePrecision("current_rate_apy"),
  candidateCrossSellProductId: text("candidate_cross_sell_product_id")
});
var goldNbaRecommendations = retentionSchema.table("gold_nba_recommendations", {
  customerId: text("customer_id").primaryKey(),
  recommendedAction: text("recommended_action").notNull(),
  recommendedOfferProductId: text("recommended_offer_product_id"),
  recommendedRateApy: numeric("recommended_rate_apy"),
  predictedRetainedUsd: doublePrecision("predicted_retained_usd"),
  predictedNetValueUsd: doublePrecision("predicted_net_value_usd"),
  actionRanking: text("action_ranking"),
  // JSON string from the pipeline
  scoredAt: timestamp("scored_at", { withTimezone: true })
});
var rmCases = opsSchema.table("rm_cases", {
  caseId: bigint("case_id", { mode: "number" }).primaryKey(),
  customerId: text("customer_id").notNull(),
  status: text("status").notNull().default("open"),
  priority: text("priority"),
  assignedRm: text("assigned_rm"),
  balanceAtRiskUsd: numeric("balance_at_risk_usd"),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  priorityScore: numeric("priority_score")
});
var outreachActions = opsSchema.table("outreach_actions", {
  actionId: bigint("action_id", { mode: "number" }).primaryKey(),
  caseId: bigint("case_id", { mode: "number" }),
  customerId: text("customer_id").notNull(),
  actionType: text("action_type").notNull(),
  offerProductId: text("offer_product_id"),
  offerRateApy: numeric("offer_rate_apy"),
  outcome: text("outcome"),
  actionAt: timestamp("action_at", { withTimezone: true }).notNull().defaultNow()
});
var rmNotes = opsSchema.table("rm_notes", {
  noteId: bigint("note_id", { mode: "number" }).primaryKey(),
  caseId: bigint("case_id", { mode: "number" }),
  customerId: text("customer_id").notNull(),
  author: text("author"),
  noteText: text("note_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var rmActions = opsSchema.table("outreach_actions", {
  id: bigint("action_id", { mode: "number" }).primaryKey(),
  customerId: text("customer_id").notNull(),
  actionType: text("action_type").notNull(),
  offerProductId: text("offer_product_id"),
  offerRateApy: numeric("offer_rate_apy"),
  outcome: text("outcome"),
  actionAt: timestamp("action_at", { withTimezone: true }).notNull().defaultNow()
});

// server/db/index.ts
function createDb(pool) {
  return drizzle(pool, { schema: schema_exports, logger: false });
}

// server/db/migrate.ts
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath as fileURLToPath2 } from "node:url";
import { dirname, resolve } from "node:path";
async function runMigrations(db2) {
  const here = dirname(fileURLToPath2(import.meta.url));
  const candidates = [
    resolve(here, "../../drizzle"),
    resolve(here, "../drizzle")
  ];
  const fs = await import("node:fs");
  const migrationsFolder = candidates.find((p) => fs.existsSync(p));
  if (!migrationsFolder) {
    throw new Error(
      `No Drizzle migrations folder found. Tried: ${candidates.join(", ")}. Run \`npm run db:generate\` first.`
    );
  }
  await migrate(db2, { migrationsFolder });
}

// server/db/sync.ts
import { sql } from "drizzle-orm";
async function verifyRetentionTables(db2) {
  const t02 = Date.now();
  try {
    const result = await db2.execute(
      sql`SELECT COUNT(*)::int AS n FROM retention.gold_customer_position`
    );
    const n = result.rows[0]?.n ?? 0;
    console.log(
      `[sync] retention.gold_customer_position: ${n} rows (verified in ${Date.now() - t02}ms)`
    );
    if (n === 0) {
      console.warn(
        "[sync] WARNING: retention.gold_customer_position is empty. Ensure the Build 1 SDP pipeline has run and synced tables are populated."
      );
    }
  } catch (e) {
    console.error(
      "[sync] Failed to verify retention tables:",
      e instanceof Error ? e.message : e
    );
    console.warn(
      "[sync] The app will boot but read queries will fail until the retention schema is accessible."
    );
  }
}
async function verifyOpsTables(db2) {
  try {
    const result = await db2.execute(
      sql`SELECT COUNT(*)::int AS n FROM ops.rm_cases`
    );
    const n = result.rows[0]?.n ?? 0;
    console.log(`[sync] ops.rm_cases: ${n} rows`);
  } catch (e) {
    console.error(
      "[sync] Failed to verify ops tables:",
      e instanceof Error ? e.message : e
    );
  }
}
async function syncFromDelta(db2, _cfg, _opts = {}) {
  console.log("[sync] Verifying Lakebase connectivity (dev branch)\u2026");
  await verifyRetentionTables(db2);
  await verifyOpsTables(db2);
  console.log("[sync] Boot verification complete.");
}
async function wipeMirroredTables(_db) {
  console.log("[sync] wipeMirroredTables is a no-op \u2014 retention.* is managed by Build 1 pipeline.");
}

// server/lib/mlflow.ts
import { getExecutionContext as getExecutionContext2 } from "@databricks/appkit";

// server/lib/auth.ts
import { getExecutionContext } from "@databricks/appkit";
async function authHeaders(req) {
  const h = new Headers();
  const userToken = req.headers["x-forwarded-access-token"];
  if (userToken) {
    h.set("Authorization", `Bearer ${userToken}`);
    return h;
  }
  const { client } = getExecutionContext();
  await client.config.authenticate(h);
  return h;
}

// server/lib/mlflow.ts
async function ensureMlflowExperiment(host, experimentPath) {
  const h = new Headers();
  const { client } = getExecutionContext2();
  await client.config.authenticate(h);
  h.set("Content-Type", "application/json");
  const base = host.replace(/\/$/, "");
  const timeout = () => AbortSignal.timeout(30 * 1e3);
  const getUrl = `${base}/api/2.0/mlflow/experiments/get-by-name?experiment_name=${encodeURIComponent(experimentPath)}`;
  const getResp = await fetch(getUrl, { method: "GET", headers: h, signal: timeout() });
  if (getResp.ok) {
    const body = await getResp.json();
    const id = body.experiment?.experiment_id;
    if (id)
      return id;
  } else if (getResp.status !== 404 && getResp.status !== 400) {
    const errText = await getResp.text();
    throw new Error(`mlflow get-by-name failed: ${getResp.status} ${errText}`);
  }
  const doCreate = () => fetch(`${base}/api/2.0/mlflow/experiments/create`, {
    method: "POST",
    headers: h,
    signal: timeout(),
    body: JSON.stringify({ name: experimentPath })
  });
  let createResp = await doCreate();
  if (!createResp.ok) {
    let errText = await createResp.text();
    if (/RESOURCE_ALREADY_EXISTS/i.test(errText)) {
      const retry = await fetch(getUrl, { method: "GET", headers: h, signal: timeout() });
      if (retry.ok) {
        const body = await retry.json();
        const id = body.experiment?.experiment_id;
        if (id)
          return id;
      }
    }
    if (/Parent directory does not exist/i.test(errText)) {
      const parent = experimentPath.slice(0, experimentPath.lastIndexOf("/"));
      if (parent) {
        await fetch(`${base}/api/2.0/workspace/mkdirs`, {
          method: "POST",
          headers: h,
          signal: timeout(),
          body: JSON.stringify({ path: parent })
        });
        createResp = await doCreate();
      }
    }
    if (!createResp.ok) {
      errText = await createResp.text();
      throw new Error(`mlflow create failed: ${createResp.status} ${errText}`);
    }
  }
  const createBody = await createResp.json();
  if (!createBody.experiment_id) {
    throw new Error("mlflow create returned no experiment_id");
  }
  return createBody.experiment_id;
}
async function postMlflowAssessment(args) {
  const { req, host, traceId, userEmail, value, rationale } = args;
  try {
    const base = host.replace(/\/$/, "");
    const headers = await authHeaders(req);
    headers.set("Content-Type", "application/json");
    const url = `${base}/api/2.0/mlflow/traces/${traceId}/assessments`;
    const resp = await fetch(url, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(30 * 1e3),
      body: JSON.stringify({
        assessment: {
          trace_id: traceId,
          assessment_name: "user_feedback",
          source: { source_type: "HUMAN", source_id: userEmail },
          feedback: { value: value === "up" },
          ...rationale ? { rationale } : {}
        }
      })
    });
    if (!resp.ok) {
      console.warn(
        "[mlflow] assessment post failed",
        resp.status,
        await resp.text().catch(() => "")
      );
      return null;
    }
    const json = await resp.json();
    return json.assessment?.assessment_id ?? null;
  } catch (e) {
    console.warn("[mlflow] assessment post threw", e.message);
    return null;
  }
}

// server/routes/config.ts
import { getExecutionContext as getExecutionContext3 } from "@databricks/appkit";

// server/lib/user.ts
var PLACEHOLDER_EMAIL = "local_user@databricks.com";
function getCurrentUserEmail(req) {
  const h = req.headers;
  const forwardedEmail = h["x-forwarded-email"] ?? "";
  if (forwardedEmail)
    return forwardedEmail;
  const forwardedUser = h["x-forwarded-user"] ?? "";
  if (forwardedUser.includes("@"))
    return forwardedUser;
  return process.env.DEV_USER_EMAIL ?? PLACEHOLDER_EMAIL;
}
function getCurrentUserInfo(req) {
  const h = req.headers;
  const userName = h["x-forwarded-preferred-username"] ?? h["x-forwarded-user"] ?? process.env.USER ?? "dev-user";
  const userEmail = h["x-forwarded-email"] ?? null;
  return {
    userName,
    userEmail,
    workspaceUrl: process.env.DATABRICKS_HOST ?? "",
    workspaceId: process.env.DATABRICKS_WORKSPACE_ID ?? null
  };
}

// server/routes/config.ts
function composeUrl(host, path2, id) {
  if (!host || !id)
    return "";
  return `${host}${path2}${id}`;
}
function buildResources(host, cfg) {
  const catalog = cfg.data?.catalog ?? "";
  const schema = cfg.data?.schema ?? "";
  const catalogPath = catalog && schema ? `/explore/data/${catalog}/${schema}` : "";
  const modelPath = cfg.mlModelName ? `/explore/data/models/${cfg.mlModelName.replace(/\./g, "/")}` : "";
  const volumeUiPath = cfg.pdfVolumePath ? cfg.pdfVolumePath.replace(/^\/Volumes\//, "/explore/data/volumes/") : "";
  return {
    dashboard: {
      id: cfg.dashboardId ?? "",
      url: composeUrl(host, "/dashboardsv3/", cfg.dashboardId)
    },
    genie: {
      id: cfg.genieSpaceId ?? "",
      url: composeUrl(host, "/genie/rooms/", cfg.genieSpaceId)
    },
    pipeline: {
      id: cfg.pipelineId ?? "",
      url: composeUrl(host, "/pipelines/", cfg.pipelineId)
    },
    // RT warehouse tile links to the workspace-wide SQL warehouses list,
    // not a single warehouse page — operators usually want to browse and
    // compare warehouses, not deep-link into one. The id is kept so other
    // consumers can grab it.
    warehouse: {
      id: cfg.warehouseId ?? "",
      url: host ? `${host}/compute/sql-warehouses` : ""
    },
    lakebase: {
      id: cfg.lakebaseProjectId ?? "",
      url: composeUrl(host, "/lakebase/projects/", cfg.lakebaseProjectId)
    },
    mas: {
      id: cfg.masEndpointName ?? "",
      url: composeUrl(host, "/ml/endpoints/", cfg.masEndpointName)
    },
    ka: {
      id: cfg.kaEndpointName ?? "",
      url: composeUrl(host, "/ml/endpoints/", cfg.kaEndpointName)
    },
    // AI Gateway is a workspace-wide page (no id) — same URL for every
    // demo in this workspace.
    gateway: {
      id: "",
      url: host ? `${host}/ml/ai-gateway` : ""
    },
    // Databricks One — the unified Genie + agent experience landing page.
    databricksOne: {
      id: "",
      url: host ? `${host}/one` : ""
    },
    // Agent Bricks — workspace-wide landing page. Used as the default for
    // the Agent Bricks tile on /platform when the demo doesn't deploy a
    // specific MAS endpoint (the common case for most demos). If the demo
    // DOES deploy a MAS, the PlatformDiagram author can swap the tile to
    // `R.mas.url` for a direct deep-link.
    agentBricks: {
      id: "",
      url: host ? `${host}/ml/agents` : ""
    },
    catalog: { id: `${catalog}.${schema}`, url: host && catalogPath ? `${host}${catalogPath}` : "" },
    model: { id: cfg.mlModelName ?? "", url: host && modelPath ? `${host}${modelPath}` : "" },
    volume: { id: cfg.pdfVolumePath ?? "", url: host && volumeUiPath ? `${host}${volumeUiPath}` : "" },
    // App URL is on a different host (*.databricksapps.com), so we don't
    // compose — it's stored verbatim.
    app: { id: cfg.appUrl ?? "", url: cfg.appUrl ?? "" }
  };
}
function registerConfigRoutes(app, deps) {
  app.get("/api/config", (_req, res) => {
    const { appConfig: appConfig2, getAgentExperimentId } = deps;
    res.json({
      mlflowExperimentId: appConfig2.mlflowExperimentId ?? null,
      agentMlflowExperimentId: getAgentExperimentId(),
      dashboardId: appConfig2.dashboardId,
      branding: appConfig2.branding,
      assistantScript: appConfig2.assistantScript ?? []
    });
  });
  app.get("/api/me", (req, res) => {
    const info = getCurrentUserInfo(req);
    const ctx = getExecutionContext3();
    const isUserContext = "isUserContext" in ctx && ctx.isUserContext === true;
    res.json({ ...info, isUserContext });
  });
  const WAREHOUSE_CACHE_TTL_MS = 3e4;
  let warehouseCache = null;
  app.get("/api/warehouse", async (_req, res) => {
    const id = process.env.DATABRICKS_WAREHOUSE_ID;
    if (!id) {
      res.json({ id: null, name: null, state: null });
      return;
    }
    const now = Date.now();
    if (warehouseCache && warehouseCache.id === id && warehouseCache.expiresAt > now) {
      const { expiresAt: _e2, ...payload2 } = warehouseCache;
      res.json(payload2);
      return;
    }
    const { client } = getExecutionContext3();
    const w = await client.warehouses.get({ id });
    warehouseCache = {
      id,
      name: w.name ?? id,
      state: w.state ?? "UNKNOWN",
      expiresAt: now + WAREHOUSE_CACHE_TTL_MS
    };
    const { expiresAt: _e, ...payload } = warehouseCache;
    res.json(payload);
  });
  app.get("/api/resources", (_req, res) => {
    const host = (process.env.DATABRICKS_HOST ?? "").replace(/\/+$/, "");
    res.json(buildResources(host, deps.appConfig));
  });
}

// server/routes/chat.ts
import express from "express";

// server/db/queries/chat.ts
import { and, asc, desc, eq, sql as sql2 } from "drizzle-orm";
async function listConversations(db2, userEmail) {
  return db2.select({
    id: conversations.id,
    title: conversations.title,
    createdAt: conversations.createdAt,
    updatedAt: conversations.updatedAt
  }).from(conversations).where(eq(conversations.userEmail, userEmail)).orderBy(desc(conversations.updatedAt));
}
async function createConversation(db2, userEmail, title) {
  const rows = await db2.insert(conversations).values({ userEmail, title }).returning();
  return rows[0];
}
async function getOrCreateDockConversation(db2, userEmail) {
  const existing = await db2.select().from(conversations).where(
    and(
      eq(conversations.userEmail, userEmail),
      eq(conversations.kind, "demo_dock")
    )
  ).limit(1);
  if (existing[0])
    return existing[0];
  const rows = await db2.insert(conversations).values({
    userEmail,
    title: "Assistant",
    kind: "demo_dock"
  }).returning();
  return rows[0];
}
async function getConversationWithMessages(db2, userEmail, id) {
  const convoRows = await db2.select().from(conversations).where(and(eq(conversations.id, id), eq(conversations.userEmail, userEmail)));
  const convo = convoRows[0];
  if (!convo)
    return null;
  const msgs = await db2.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.position), asc(messages.createdAt));
  return { ...convo, messages: msgs };
}
async function deleteConversation(db2, userEmail, id) {
  const rows = await db2.delete(conversations).where(and(eq(conversations.id, id), eq(conversations.userEmail, userEmail))).returning({ id: conversations.id });
  return rows.length > 0;
}
async function appendMessage(db2, conversationId, role, content, traceId, thinking, error, canceled) {
  const thinkingJson = JSON.stringify(thinking ?? []);
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await db2.transaction(async (tx) => {
        const rows = await tx.execute(sql2`
          INSERT INTO app.messages (conversation_id, role, content, position, trace_id, thinking, error, canceled)
          SELECT
            ${conversationId}::uuid,
            ${role},
            ${content},
            COALESCE((SELECT MAX(position) FROM app.messages WHERE conversation_id = ${conversationId}::uuid), -1) + 1,
            ${traceId ?? null},
            ${thinkingJson}::jsonb,
            ${error ?? null},
            ${canceled ?? false}
          RETURNING id, position
        `);
        await tx.update(conversations).set({ updatedAt: /* @__PURE__ */ new Date() }).where(eq(conversations.id, conversationId));
        return rows.rows[0];
      });
    } catch (e) {
      const pgCode = e.cause?.code ?? e.code;
      const isPositionRace = pgCode === "23505" && /messages_convo_pos_uq/.test(e.message ?? "");
      if (isPositionRace && attempt < MAX_ATTEMPTS) {
        continue;
      }
      throw e;
    }
  }
  throw new Error("appendMessage: exhausted retries");
}
async function renameConversationIfDefault(db2, id, title) {
  await db2.update(conversations).set({ title }).where(and(eq(conversations.id, id), eq(conversations.title, "New conversation")));
}
async function getMessageById(db2, id) {
  const rows = await db2.select().from(messages).where(eq(messages.id, id));
  return rows[0] ?? null;
}
async function insertFeedback(db2, args) {
  const rows = await db2.insert(feedback).values({
    messageId: args.messageId,
    userEmail: args.userEmail,
    value: args.value,
    rationale: args.rationale,
    traceId: args.traceId ?? null,
    mlflowAssessmentId: args.mlflowAssessmentId ?? null
  }).returning();
  return rows[0];
}

// server/db/queries/relationships.ts
import { eq as eq2, sql as sql3, inArray, desc as desc2 } from "drizzle-orm";
async function listAtRiskCustomers(db2) {
  const rows = await db2.select().from(goldCustomerPosition).where(
    inArray(goldCustomerPosition.riskBand, ["critical", "elevated", "watch"])
  ).orderBy(desc2(goldCustomerPosition.attritionRiskScore)).limit(200);
  return rows.map(mapCustomerPosition);
}
async function getCustomerPosition(db2, customerId) {
  const [row] = await db2.select().from(goldCustomerPosition).where(eq2(goldCustomerPosition.customerId, customerId)).limit(1);
  return row ? mapCustomerPosition(row) : null;
}
async function getOpenAtrisk(db2, customerId) {
  const [row] = await db2.select().from(goldOpenAtrisk).where(eq2(goldOpenAtrisk.customerId, customerId)).limit(1);
  return row ? mapOpenAtrisk(row) : null;
}
async function getNbaRecommendation(db2, customerId) {
  const [row] = await db2.select().from(goldNbaRecommendations).where(eq2(goldNbaRecommendations.customerId, customerId)).limit(1);
  if (!row)
    return null;
  let actionRanking = [];
  try {
    actionRanking = row.actionRanking ? JSON.parse(row.actionRanking) : [];
  } catch {
    actionRanking = [];
  }
  return {
    customerId: row.customerId,
    recommendedAction: row.recommendedAction,
    recommendedOfferProductId: row.recommendedOfferProductId,
    recommendedRateApy: row.recommendedRateApy ? Number(row.recommendedRateApy) : null,
    predictedRetainedUsd: row.predictedRetainedUsd ?? 0,
    predictedNetValueUsd: row.predictedNetValueUsd ?? 0,
    actionRanking,
    scoredAt: row.scoredAt?.toISOString() ?? null
  };
}
async function getRiskMetrics(db2) {
  const result = await db2.execute(sql3`
    SELECT
      COALESCE(SUM(balance_at_risk_usd), 0)::float AS total_balance_at_risk_usd,
      COALESCE(SUM(revenue_at_risk_usd), 0)::float AS total_revenue_at_risk_usd,
      COUNT(*)::int AS critical_customer_count
    FROM retention.gold_customer_position
    WHERE risk_band IN ('critical', 'elevated', 'watch')
  `);
  const row = result.rows[0];
  return {
    totalBalanceAtRiskUsd: row?.total_balance_at_risk_usd ?? 0,
    totalRevenueAtRiskUsd: row?.total_revenue_at_risk_usd ?? 0,
    criticalCustomerCount: row?.critical_customer_count ?? 0
  };
}
async function listOutreachActions(db2, customerId) {
  const rows = await db2.select().from(outreachActions).where(eq2(outreachActions.customerId, customerId)).orderBy(desc2(outreachActions.actionAt));
  return rows;
}
async function recentActivity(db2, limit) {
  const rows = await db2.select().from(outreachActions).orderBy(desc2(outreachActions.actionAt)).limit(limit);
  return rows.map((r) => ({
    kind: "rm_action",
    actionId: String(r.actionId),
    at: r.actionAt?.toISOString() ?? (/* @__PURE__ */ new Date()).toISOString(),
    by: "rm.desk",
    customerId: r.customerId,
    actionType: r.actionType,
    predictedRetainedUsd: null,
    status: r.outcome ?? "approved"
  }));
}
function mapCustomerPosition(row) {
  return {
    customerId: row.customerId,
    tier: row.tier,
    tenureYears: row.tenureYears,
    homeMetro: row.homeMetro,
    customerLat: row.customerLat,
    customerLng: row.customerLng,
    profileSummary: row.profileSummary,
    attritionRiskScore: row.attritionRiskScore ?? 0,
    balanceOutflow30dUsd: row.balanceOutflow30dUsd,
    churnSignalScore: row.churnSignalScore ? Number(row.churnSignalScore) : null,
    totalBalanceUsd: row.totalBalanceUsd,
    depositBalanceUsd: row.depositBalanceUsd,
    affectedDepositBalanceUsd: row.affectedDepositBalanceUsd,
    minDaysToMaturity: row.minDaysToMaturity,
    productCount: row.productCount,
    balanceAtRiskUsd: row.balanceAtRiskUsd ?? 0,
    revenueAtRiskUsd: row.revenueAtRiskUsd ?? 0,
    riskBand: row.riskBand
  };
}
function mapOpenAtrisk(row) {
  return {
    customerId: row.customerId,
    attritionRiskScore: row.attritionRiskScore ?? 0,
    balanceAtRiskUsd: row.balanceAtRiskUsd ?? 0,
    revenueAtRiskUsd: row.revenueAtRiskUsd ?? 0,
    atriskProductId: row.atriskProductId,
    atriskBalanceUsd: row.atriskBalanceUsd,
    daysToMaturity: row.daysToMaturity,
    currentRateApy: row.currentRateApy,
    candidateCrossSellProductId: row.candidateCrossSellProductId
  };
}

// server/chat-stream/agent-stream.ts
import * as mlflow3 from "mlflow-tracing";

// server/agent/relationshipdesk.ts
import OpenAI from "openai";
import {
  Agent,
  run,
  setDefaultOpenAIClient,
  setTracingDisabled
} from "@openai/agents";

// server/agent/tools/logged-tool.ts
import { tool } from "@openai/agents";
function sanitizeForModel(err) {
  const raw = err instanceof Error ? err.message : String(err);
  const firstLine = raw.split("\n", 1)[0] ?? "";
  const trimmed = firstLine.split(/params:|query:/i)[0]?.trim() ?? firstLine;
  return trimmed.length > 240 ? `${trimmed.slice(0, 240)}\u2026` : trimmed;
}
function loggedTool(args) {
  const userErrorFunction = args.errorFunction;
  return tool({
    ...args,
    errorFunction: (context, err) => {
      console.error(`[tool:${args.name}] threw`, err);
      if (typeof userErrorFunction === "function") {
        return userErrorFunction(context, err);
      }
      return `An error occurred while running the tool. Please try again. Error: ${sanitizeForModel(err)}`;
    }
  });
}

// server/agent/relationshipdesk.ts
import * as mlflow2 from "mlflow-tracing";
import { z as z2 } from "zod";

// server/agent/tools/mas.ts
import * as mlflow from "mlflow-tracing";
import { z } from "zod";
async function callMasEndpoint(ctx, endpointName, question) {
  function emit(ev) {
    try {
      ctx.onToolProgress?.(ev);
    } catch (e) {
      console.error("[onToolProgress] callback threw \u2014 fix the handler", e);
    }
  }
  const headers = await authHeaders(ctx.req);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "text/event-stream");
  const abort = AbortSignal.timeout(10 * 60 * 1e3);
  const url = `${ctx.databricksHost}/serving-endpoints/${endpointName}/invocations`;
  const resp = await fetch(url, {
    method: "POST",
    headers,
    signal: abort,
    body: JSON.stringify({
      input: [{ role: "user", content: question }],
      databricks_options: { return_trace: true },
      stream: true
    })
  });
  if (!resp.ok || !resp.body) {
    const t = await resp.text().catch(() => "");
    console.error("[ask_mas] endpoint bad response", {
      status: resp.status,
      body: t.slice(0, 500)
    });
    return {
      answer: `MAS call failed: HTTP ${resp.status} ${t.slice(0, 300)}`,
      trace_id: null
    };
  }
  console.log("[ask_mas] stream opened, reading events\u2026");
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let trace_id = null;
  let lastStepText = null;
  const deltaBuf = [];
  let currentSubAgent = null;
  const callSubAgent = /* @__PURE__ */ new Map();
  let lastToolCallId = null;
  try {
    while (true) {
      let chunk;
      try {
        chunk = await reader.read();
      } catch (e) {
        if (e.name === "AbortError") {
          console.error("[ask_mas] stream timed out after 10 minutes");
          return {
            answer: "MAS call timed out after 10 minutes. The supervisor may be stuck on a long sub-agent hop \u2014 try a narrower question.",
            trace_id: null
          };
        }
        throw e;
      }
      const { value, done } = chunk;
      if (done)
        break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const p of parts) {
        const line = p.split("\n").find((l) => l.startsWith("data: "));
        if (!line)
          continue;
        const data = line.slice(6);
        if (!data || data === "[DONE]")
          continue;
        let ev;
        try {
          ev = JSON.parse(data);
        } catch {
          continue;
        }
        if (ev.type === "response.completed") {
          trace_id = ev.databricks_output?.trace?.info?.trace_id ?? trace_id;
          continue;
        }
        if (ev.type === "response.output_text.delta" && typeof ev.delta === "string") {
          deltaBuf.push(ev.delta);
          continue;
        }
        if (ev.type !== "response.output_item.done")
          continue;
        const item = ev.item;
        if (!item)
          continue;
        if (item.type === "message" && Array.isArray(item.content)) {
          const text2 = item.content.find((c) => c?.type === "output_text")?.text;
          if (!text2)
            continue;
          const tagMatch = text2.trim().match(/^<name>([^<]+)<\/name>$/);
          if (tagMatch) {
            currentSubAgent = tagMatch[1];
            continue;
          }
          if (typeof ev.step === "number") {
            lastStepText = text2;
            emit({ kind: "mas_narration", text: text2 });
            currentSubAgent = null;
          } else {
            emit({
              kind: "mas_tool_output",
              callId: lastToolCallId ?? `mas-orphan-${Date.now()}`,
              subAgent: currentSubAgent ?? "data",
              snippet: text2
            });
            currentSubAgent = null;
          }
        } else if (item.type === "function_call") {
          const subAgent = item.name ?? "data";
          const callId = item.call_id ?? `mas-${Date.now()}-${Math.random()}`;
          callSubAgent.set(callId, subAgent);
          let query = "";
          try {
            const parsed = JSON.parse(item.arguments ?? "{}");
            query = parsed.genie_query || parsed.ka_query || parsed.query || parsed.question || item.arguments || "";
          } catch {
            query = item.arguments ?? "";
          }
          lastToolCallId = callId;
          emit({ kind: "mas_tool_call", callId, subAgent, query });
        } else if (item.type === "function_call_output" && item.call_id) {
          const subAgent = callSubAgent.get(item.call_id) ?? "data";
          const out = item.content?.find((c) => c?.type === "output_text")?.text ?? "";
          emit({
            kind: "mas_tool_output",
            callId: item.call_id,
            subAgent,
            snippet: out
          });
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
    }
  }
  const answer = lastStepText || deltaBuf.join("") || "(no answer)";
  console.log(
    `[ask_mas] stream closed \u2014 answer_len=${answer.length}ch trace_id=${trace_id}`
  );
  return { answer, trace_id };
}
function askMasTool(ctx, endpointName) {
  return loggedTool({
    name: "ask_mas",
    description: 'Ask an open-ended question that may require SQL data lookups, document/knowledge retrieval, or both. Routes to a Databricks Multi-Agent Supervisor that orchestrates between sub-agents (data_analyst, incident_expert, etc.) and returns a synthesized answer. Use for any "why" / "what happened" / investigative question.',
    parameters: z.object({
      question: z.string().describe(
        "A clear, focused English question. Narrow questions finish in 20\u201340s; broad multi-part questions can take 90s+ as the supervisor hops between sub-agents."
      )
    }),
    execute: async ({ question }) => mlflow.withSpan(
      async () => callMasEndpoint(ctx, endpointName, question),
      {
        name: "ask_mas",
        spanType: mlflow.SpanType.TOOL,
        inputs: { question }
      }
    )
  });
}

// server/agent/relationshipdesk.ts
function makeTools(ctx) {
  const findAtriskCustomer = loggedTool({
    name: "find_atrisk_customer",
    description: "Identify an at-risk customer from Lakebase app.customer_position. Pass a customer_id to fetch that customer; pass null to find the worst open at-risk (highest attrition_risk_score). Returns {customer_id, tier, attrition_risk_score, balance_at_risk_usd, revenue_at_risk_usd, days_to_maturity, maturing_deposit_balance_usd, current_rate_apy, home_metro, total_balance_usd}. Use this to begin the discovery phase.",
    parameters: z2.object({
      customer_id: z2.string().nullable().describe("Customer ID to lookup. If null, returns the worst open at-risk by attrition_risk_score.")
    }),
    execute: async ({ customer_id }) => mlflow2.withSpan(
      async () => {
        throw new Error(
          "Not implemented \u2014 this is a training stub. Implement this tool by reading from app.customer_position and app.open_atrisk. See APP_WORKSHOP.md for guidance."
        );
      },
      {
        name: "find_atrisk_customer",
        spanType: mlflow2.SpanType.TOOL,
        inputs: { customer_id }
      }
    )
  });
  const rankNextBestActions = loggedTool({
    name: "rank_next_best_actions",
    description: 'Retrieve ranked next best actions for a customer from Lakebase app.nba_recommendations. The recommender model scores each action (e.g., "offer certificate_of_deposit at 5.25%", "upgrade_checking_account_features", "introduce_investment_product") by predicted_retained_usd and predicted_net_value_usd. Returns {recommended_action, predicted_retained_usd, predicted_net_value_usd, action_ranking: [...]}, sorted by value impact. Use this in the recommendation phase.',
    parameters: z2.object({
      customer_id: z2.string().describe("Customer ID to fetch ranked recommendations for.")
    }),
    execute: async ({ customer_id }) => mlflow2.withSpan(
      async () => {
        throw new Error(
          "Not implemented \u2014 this is a training stub. Implement this tool by querying app.nba_recommendations. See APP_WORKSHOP.md for guidance."
        );
      },
      {
        name: "rank_next_best_actions",
        spanType: mlflow2.SpanType.TOOL,
        inputs: { customer_id }
      }
    )
  });
  const searchProducts = loggedTool({
    name: "search_products",
    description: "Search Lakebase app.products by query string (searches product_name and description). Returns {product_id, product_name, segment, rate_apy, min_balance_usd}[]. Use this to find products to offer the customer.",
    parameters: z2.object({
      query: z2.string().describe('Search query \u2014 e.g., "high yield savings", "money market" or "certificate of deposit 5%".')
    }),
    execute: async ({ query }) => mlflow2.withSpan(
      async () => {
        throw new Error(
          "Not implemented \u2014 this is a training stub. Implement this tool by searching app.products on product_name + description. See APP_WORKSHOP.md for guidance."
        );
      },
      {
        name: "search_products",
        spanType: mlflow2.SpanType.TOOL,
        inputs: { query }
      }
    )
  });
  const executeNbaAction = loggedTool({
    name: "execute_nba_action",
    description: "WRITE TOOL: record a relationship manager action in Lakebase app.rm_actions. Captures the customer_id, action_type (retention_offer / cross_sell / rm_outreach), offered_product_id (if applicable), rate_apy (if a rate offer), and drafted_note (the RM's outreach message). All recorded on behalf of userEmail for audit. Returns {action_id, created_at, recorded_by}. Use ONLY after the user has approved the action.",
    parameters: z2.object({
      customer_id: z2.string().describe("Customer ID."),
      action_type: z2.string().describe('Type of action \u2014 e.g., "offer_product", "increase_rate", "upsell_service", "extend_terms".'),
      offered_product_id: z2.string().nullable().describe("Product ID if offering a specific product; else null."),
      rate_apy: z2.number().nullable().describe("APY if the action involves a rate offer; else null."),
      drafted_note: z2.string().describe("The RM outreach message or note captured for the customer record.")
    }),
    execute: async (args) => mlflow2.withSpan(
      async () => {
        throw new Error(
          "Not implemented \u2014 this is a training stub. Implement this tool by writing to app.rm_actions. See APP_WORKSHOP.md for guidance."
        );
      },
      {
        name: "execute_nba_action",
        spanType: mlflow2.SpanType.TOOL,
        inputs: {
          customer_id: args.customer_id,
          action_type: args.action_type,
          recorded_by: ctx.userEmail
        }
      }
    )
  });
  const tools = [findAtriskCustomer, rankNextBestActions, searchProducts, executeNbaAction];
  if (ctx.masEndpointName) {
    tools.push(askMasTool(ctx, ctx.masEndpointName));
  }
  return tools;
}
async function configureAgentsSdk(ctx) {
  const headers = await authHeaders(ctx.req);
  const bearer = headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
  const client = new OpenAI({
    apiKey: bearer,
    baseURL: `${ctx.databricksHost}/serving-endpoints`,
    maxRetries: 4,
    fetch: async (input, init2) => {
      const headers2 = new Headers(init2?.headers);
      headers2.set("Connection", "close");
      let body = init2?.body;
      if (typeof body === "string" && body.startsWith("{")) {
        try {
          const parsed = JSON.parse(body);
          if (Array.isArray(parsed.input)) {
            for (const item of parsed.input) {
              const id = item.id;
              if (typeof id === "string" && id.length > 64) {
                delete item.id;
              }
            }
          }
          if (Array.isArray(parsed.messages)) {
            for (const m of parsed.messages) {
              const content = m.content;
              if (Array.isArray(content)) {
                for (const part of content) {
                  if (part && typeof part === "object") {
                    delete part.annotations;
                  }
                }
              }
            }
          }
          body = JSON.stringify(parsed);
        } catch {
        }
      }
      const url = typeof input === "string" ? input : input.toString?.() ?? String(input);
      console.debug(
        `[openai-shim] \u2192 ${url}
  request_body: ${typeof body === "string" ? body.slice(0, 2e3) : "(non-string)"}`
      );
      const tShim = Date.now();
      let resp;
      try {
        resp = await fetch(input, {
          ...init2,
          headers: headers2,
          body,
          keepalive: false
        });
      } catch (e) {
        console.error("[openai-shim] fetch threw", { url, error: e });
        throw e;
      }
      console.debug(
        `[openai-shim] \u2190 ${resp.status} ${resp.statusText} from ${url} in ${Date.now() - tShim}ms (content-type: ${resp.headers.get("content-type") ?? "?"})`
      );
      if (!resp.ok) {
        try {
          const text2 = await resp.clone().text();
          let code;
          let message;
          try {
            const parsed = JSON.parse(text2);
            code = parsed.error_code;
            message = parsed.message;
          } catch {
          }
          if (ctx.modelError) {
            ctx.modelError.current = {
              status: resp.status,
              url,
              bodyText: text2,
              code,
              message
            };
          }
          console.error(
            `[openai-shim] ${resp.status} from ${url}
  request_body: ${typeof body === "string" ? body.slice(0, 4e3) : "(non-string)"}
  response_body: ${text2.slice(0, 4e3)}`
          );
        } catch (e) {
          console.error("[openai-shim] failed to clone error response", e);
        }
      }
      return resp;
    }
  });
  setDefaultOpenAIClient(client);
  setTracingDisabled(true);
}
function buildAgent(ctx) {
  return new Agent({
    name: "RelationshipDesk",
    model: ctx.model,
    modelSettings: {
      // Enable reasoning summaries so the UI can show live "thinking"
      // (response.reasoning_summary_text.delta events). `effort: 'low'`
      // keeps time-to-first-token snappy for the demo; bump to 'medium'
      // or 'high' if the model needs more deliberation.
      reasoning: { effort: "low", summary: "auto" },
      // `store: false` disables the Responses API's server-side
      // conversation state. Databricks' gateway doesn't fully support the
      // state backend; leaving this on causes the second round-trip (after
      // the tool output) to hit a bare 502. Stateless runs work fine.
      store: false
    },
    instructions: `
You are the AI assistant for Marcus Bell, EVP Consumer & Small Business Banking
at Meridian Bank. Your user is a non-technical executive. Be decisive, concise,
and focus on the three-phase loop: investigate why a customer is at risk, rank
the next best action, draft the outreach, and execute after approval.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
TOOLS AT YOUR DISPOSAL
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

ask_data(question) \u2014 delegates to the multi-agent supervisor. Use for any
  WHY / WHAT HAPPENED / investigative question about customer data, attrition
  patterns, market trends, deposit maturity schedules, or retention strategies.
  Prefer ONE well-formed question over many small ones.

find_atrisk_customer(customer_id) \u2014 identify an at-risk customer from Lakebase
  app.customer_position. Pass a customer_id to fetch that customer's details;
  pass null to find the worst open at-risk by attrition_risk_score. Output:
  {customer_id, tier, attrition_risk_score, balance_at_risk_usd,
  revenue_at_risk_usd, days_to_maturity, maturing_deposit_balance_usd,
  current_rate_apy, home_metro, total_balance_usd}.

rank_next_best_actions(customer_id) \u2014 THE RECOMMENDATION TOOL. Retrieve ranked
  actions from the nba_recommender model (app.nba_recommendations) that predict
  the highest retained_usd. Each action is scored on predicted_retained_usd +
  predicted_net_value_usd. Returns {recommended_action, predicted_retained_usd,
  predicted_net_value_usd, action_ranking: [...]}. Call this after you've
  identified the at-risk customer to see what the model recommends (e.g.,
  offer certificate_of_deposit at 5.25%, upgrade checking account, introduce
  investment product).

search_products(query) \u2014 search Lakebase app.products by query string (product_name
  + description). Returns {product_id, product_name, segment, rate_apy,
  min_balance_usd}[]. Use this to find specific products to offer the customer
  (e.g., "high yield savings 5%", "money market", "certificate of deposit").

execute_nba_action(customer_id, action_type, offered_product_id, rate_apy,
  drafted_note) \u2014 THE WRITE TOOL. Record a relationship manager action in
  Lakebase app.rm_actions: the customer_id, action_type (e.g., "offer_product",
  "increase_rate", "upsell_service"), offered_product_id (if applicable),
  rate_apy (if a rate offer), and the drafted_note (your outreach message).
  Everything is recorded on behalf of your user for audit. Returns
  {action_id, created_at, recorded_by}. **This is how you execute phase 3.**
  Use ONLY after the user has explicitly approved.

THERE ARE NO OTHER TOOLS. There is no send_customer_sms, no
override_maturity_date, no manual tier change. Everything you can do
is in the five tools above.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
OPERATING MODES
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

MODE A \u2014 INVESTIGATION
If the user asks "why", "what", "who", "when", or anything that requires
reading data or documents \u2192 call ask_data EXACTLY ONCE with a SHORT,
targeted question. Then synthesize for the user. Do NOT use the action
tools unless the user explicitly asks you to fix something.

**Critical for latency**: ask_data calls out to a multi-agent supervisor
that spawns sub-agents per sub-question. Broad questions ("analyze churn
risk, maturing deposits, competitive rates, retention offers...") trigger
4+ sub-agent hops and take >90s. Narrow questions finish in 20-40s.

Prefer ONE of these shapes over the broad "tell me everything":
  - "Which customer has the highest attrition risk and the largest
     balance at risk in the next 90 days? Give me the customer_id, tier,
     current rate, and reason for risk."
  - "What is the maturity schedule for our top 50 customers by balance
     in the next Q?"

Avoid: asking for churn analysis + competitive positioning + deposit
schedule + retention levers + product recommendations in a single question.
The supervisor will hop 4 times.

MODE B \u2014 ACTION CHAIN (HUMAN-IN-THE-LOOP, RETENTION-FOCUSED)
If the user asks you to HANDLE / FIX / SAVE / RETAIN something, you
run a three-phase chain with a confirmation step in the middle. The
defining move of this chain: **you use the nba_recommender model to rank
the best action per customer**. The model scores each action (offer CD,
upgrade checking, introduce investment) by predicted_retained_usd, and
you draft the outreach accordingly. The RM retains the customer (and
revenue) by executing the model-ranked action.

**The story beat that lands the model**: Meridian's RM team manually
cherry-picks retention offers, often offering a flat rate to all at-risk
customers and missing cross-sell or product-fit opportunities. The
nba_recommender model, trained on 10K historical interventions, scores
each action by predicted_retained_usd for THIS customer's profile. A CD
retention might save $500K for a retiree; an investment intro might
save $2M for a high-net-worth customer; a rate bump saves only $50K for
a mid-tier depositor. By ranking actions, you (and the model's insight)
save the right customer with the right product.

Phase 1 and 2 are "prepare + show the user what will happen". Phase 3
is the write. NEVER run phase 3 (execute_nba_action) until the user has
explicitly approved.

--- Phase 1 \xB7 Discover (read-only) ---

  1. If you don't already know the target customer, call ask_data with a
     precise question: "Which customer has the highest attrition risk and
     the largest balance at risk in the next 30 days?". Extract the
     customer_id from the answer. If ask_data cannot produce a clear
     customer_id, ask the user once \u2014 do not guess.

  2. Call find_atrisk_customer(<customer_id>). This is THE discovery moment.
     Output: {customer_id, tier, attrition_risk_score, balance_at_risk_usd,
     revenue_at_risk_usd, days_to_maturity, maturing_deposit_balance_usd,
     current_rate_apy, home_metro, total_balance_usd}. Remember these
     details \u2014 you quote them in Phase 2.

  3. Call rank_next_best_actions(<customer_id>). Read the top-ranked action
     from the nba_recommender model. This is THE model story: "The
     recommender model suggests [action] to retain \${predicted_retained_usd}
     of balance."

  4. If the top action is an offer_product, call
     search_products(<product_description>) to find the specific product
     ID and current rate. (Optional if you already know the product.)

--- Phase 2 \xB7 Draft + ASK FOR CONFIRMATION ---

  5. Reply to the user with:
       - A bold headline: "Customer {customer_id} ({tier}, {home_metro})
         \xB7 {balance_at_risk_usd} at risk \xB7 matures in {days_to_maturity} days."
       - The attrition risk score, current rate, and total balance context.
       - The nba_recommender's top-ranked action + predicted_retained_usd.
       - A drafted outreach message (email or call summary) that offers
         the recommended action (e.g., "We'd like to offer you a {rate_apy}%
         CD for {product_name}").
       - A single-sentence CTA:
           "Reply **send** to execute this action \u2014 or tell me which action
            to try instead."

     STOP HERE. Do not proceed until the user's next message.

--- Phase 3 \xB7 Execute the action (on approval) ---

  Triggered only when the user's NEXT message is an approval (any form:
  "send", "go", "ok", "approved", "do it", "yes", "proceed", "looks good").
  Anything that looks like a revision ("try the CD instead", "increase the
  rate", "different product") means \u2192 redraft the message with the new
  action and go back to phase 2 step 5 (STOP for confirmation again).

  On approval:

    A. Call execute_nba_action exactly ONCE with:
         customer_id: the customer_id from phase 1 step 1
         action_type: the approved action (e.g., "offer_product", "increase_rate")
         offered_product_id: product_id if applicable, else null
         rate_apy: rate if applicable, else null
         drafted_note: the outreach message you drafted
       DO NOT pass individual transaction IDs or internal batch refs.

    B. Final summary \u2014 see "SUMMARY FORMAT" below. Use the counts and
       action_id returned by the tool, not your own memory.

If execute_nba_action returns an error, surface the error plainly. Never
pretend a tool ran.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
OUTREACH CRAFT
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Tone: professional, warm, urgent. The customer is about to move their
balance or let a deposit mature and not renew. You're saving a relationship.

Length: 2\u20134 sentences for email or call summary. Direct, no jargon.

Never mention internal models or risk scores to customers \u2014 translate
it: "We noticed your CD is maturing and wanted to offer you a competitive
rate before it rolls over".

Include the specific offer (rate, product, term) inline in the outreach.

--- TEMPLATE EXAMPLE (use this shape, rewrite the prose if you want) ---

  **Email Subject:** Your Meridian CD is maturing \u2014 we have a great
  rate waiting

  Hi {firstname},

  Your {product_name} CD (\${balance} balance) matures on {maturity_date},
  and we wanted to reach out with a new opportunity. Our {product_name}
  rate is now {rate_apy}% APY \u2014 up from your current {current_rate_apy}%.
  No need to move anywhere. We'd love to lock that in for you.

  Reply to this email or call 1-800-MERIDIAN to discuss.

  \u2014 Meridian Relationship Banking Team

--- END TEMPLATE ---

When you show the draft in phase 2, include it clearly. When you execute
in phase 3, the drafted_note is recorded as-is for the RM's record.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
SUMMARY FORMAT (final assistant message)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

ALWAYS end an action chain with a markdown summary the executive can
read in 10 seconds. Example:

**Done \u2014 Customer 98765 retention action executed.**

- **Customer:** {customer_id} ({tier}, {home_metro})
  - **At risk:** \${balance_at_risk_usd} over {days_to_maturity} days
  - **Model recommended:** offer_product (predicted save: \${predicted_retained_usd})
- **Action executed:** {action_type}
  - **Offer:** {product_name} at {rate_apy}% APY
  - **RM message recorded** (reference: {action_id})
- **Next step:** {action_type} outreach sent; monitor response in 48 hours.

Rules:
- Markdown-bold the headline stat on line 1.
- Numbers come from your tool calls (find_atrisk_customer,
  rank_next_best_actions, execute_nba_action) \u2014 NOT from memory.
- ALWAYS show the model's recommendation and predicted_retained_usd \u2014
  it's the demo's load-bearing model-value moment.
- Quote the action_id from execute_nba_action for audit.
- Close with ONE concrete "next step" only if warranted.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
TONE
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

The user is busy and focused on revenue retention. Lead with the answer.
No preamble like "Sure, I'll help!". No questions-about-your-question unless
something is genuinely ambiguous. When investigating, synthesize \u2014 don't
dump raw data. When acting, be decisive and show the model's contribution
to the save.
`.trim(),
    tools: makeTools(ctx)
  });
}

// server/lib/endpoint.ts
function fixMojibake(s) {
  if (!s)
    return s;
  try {
    return Buffer.from(s, "latin1").toString("utf8");
  } catch {
  }
  return s.replace(/[-ÿ]+/g, (seg) => {
    try {
      return Buffer.from(seg, "latin1").toString("utf8");
    } catch {
      return seg;
    }
  });
}

// server/chat-stream/sse.ts
function sseWrite(res, event) {
  if (res.writableEnded || res.destroyed)
    return;
  res.write(`data: ${JSON.stringify(event)}

`);
}
function sseError(res, error) {
  sseWrite(res, { type: "error", error });
}

// server/chat-stream/agent-stream.ts
async function streamAgentTurn(args) {
  const { res, messages: messages2, signal } = args;
  const lastUser = messages2[messages2.length - 1];
  const userInput = lastUser?.role === "user" ? lastUser.content : "";
  let finalText = "";
  let reasoningBuffer = "";
  let traceId = null;
  let caughtError = null;
  let caughtCanceled = false;
  const thinking = [];
  let sawToolOutput = false;
  let sawFinalDelta = false;
  let runStartMs = 0;
  return await mlflow3.withSpan(
    async (rootSpan) => {
      traceId = rootSpan.traceId ?? null;
      const modelError = {
        current: null
      };
      try {
        const ctx = {
          db: args.db,
          userEmail: args.userEmail,
          req: args.req,
          masEndpointName: args.masEndpointName,
          databricksHost: args.databricksHost,
          model: args.model,
          modelError,
          // Forward sub-agent activity from the MAS tool (ask_data) live into
          // the outer Thinking panel. Each event is both persisted into
          // `thinking` (so it's in the saved reasoning trail) and streamed to
          // the browser as an SSE event the client already knows how to render.
          onToolProgress: (ev) => {
            if (ev.kind === "mas_tool_call") {
              thinking.push({
                kind: "tool_call",
                callId: ev.callId,
                name: `mas:${ev.subAgent}`,
                args: JSON.stringify({ query: ev.query })
              });
              sseWrite(res, {
                type: "response.output_item.done",
                item: {
                  type: "function_call",
                  call_id: ev.callId,
                  name: `mas:${ev.subAgent}`,
                  arguments: JSON.stringify({ query: ev.query })
                }
              });
            } else if (ev.kind === "mas_tool_output") {
              thinking.push({
                kind: "tool_output",
                callId: ev.callId,
                output: ev.snippet
              });
              sseWrite(res, {
                type: "response.output_item.done",
                item: {
                  type: "function_call_output",
                  call_id: ev.callId,
                  output: ev.snippet
                }
              });
            } else if (ev.kind === "mas_narration") {
              thinking.push({ kind: "intermediate_message", text: ev.text });
              sseWrite(res, {
                type: "response.reasoning_summary_text.done",
                text: ev.text
              });
            }
          }
        };
        await configureAgentsSdk(ctx);
        const agent = buildAgent(ctx);
        const history = messages2.filter(
          (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0
        ).map(
          (m) => m.role === "assistant" ? {
            role: "assistant",
            content: [
              { type: "output_text", text: m.content }
            ]
          } : { role: "user", content: m.content }
        );
        const runInput = history.length > 1 ? history : userInput;
        runStartMs = Date.now();
        const roleSeq = Array.isArray(runInput) ? runInput.map((m) => m.role).join(",") : "single-string";
        console.debug(
          `[agent-stream] runAgent start \u2014 history_len=${messages2.length} filtered_len=${Array.isArray(runInput) ? runInput.length : 1} input_chars=${userInput.length} roles=[${roleSeq}]`
        );
        const stream = await run(agent, runInput, { stream: true, signal });
        console.debug(
          `[agent-stream] runAgent returned stream in ${Date.now() - runStartMs}ms`
        );
        for await (const ev of stream) {
          if (ev.type === "raw_model_stream_event") {
            const data = ev.data;
            if (data.type === "output_text_delta" && typeof data.delta === "string" && data.delta.length > 0) {
              const delta = fixMojibake(data.delta);
              if (!sawFinalDelta) {
                sawFinalDelta = true;
                console.debug(
                  `[agent-stream] first final-answer delta at +${Date.now() - runStartMs}ms`
                );
              }
              finalText += delta;
              sseWrite(res, { type: "response.output_text.delta", delta });
              continue;
            }
            const inner = data.type === "model" ? data.event ?? data : data;
            const t = inner.type;
            if (t === "response.reasoning_summary_text.delta" && inner.delta) {
              const delta = fixMojibake(inner.delta);
              reasoningBuffer += delta;
              sseWrite(res, {
                type: "response.reasoning_summary_text.delta",
                delta
              });
            } else if (t === "response.reasoning_summary_text.done") {
              const text2 = inner.text ?? reasoningBuffer;
              if (text2) {
                thinking.push({ kind: "intermediate_message", text: text2 });
              }
              reasoningBuffer = "";
              sseWrite(res, {
                type: "response.reasoning_summary_text.done",
                text: text2
              });
            }
            continue;
          }
          if (ev.type === "run_item_stream_event") {
            const item = ev.item;
            const raw = item.rawItem;
            if (!raw)
              continue;
            if (ev.name === "tool_called" && raw.type === "function_call") {
              thinking.push({
                kind: "tool_call",
                callId: raw.callId ?? "",
                name: raw.name ?? "",
                args: raw.arguments ?? ""
              });
              sseWrite(res, {
                type: "response.output_item.done",
                item: {
                  type: "function_call",
                  call_id: raw.callId ?? "",
                  name: raw.name ?? "",
                  arguments: raw.arguments ?? ""
                }
              });
            } else if (ev.name === "tool_output") {
              sawToolOutput = true;
              console.debug(
                `[agent-stream] tool_output received at +${Date.now() - runStartMs}ms (name=${raw.name ?? "?"})`
              );
              const out = typeof raw.output === "string" ? raw.output : JSON.stringify(raw.output);
              thinking.push({
                kind: "tool_output",
                callId: raw.callId ?? "",
                output: out
              });
              sseWrite(res, {
                type: "response.output_item.done",
                item: {
                  type: "function_call_output",
                  call_id: raw.callId ?? "",
                  output: out
                }
              });
            }
          }
        }
        await stream.completed;
        console.debug(
          `[agent-stream] runAgent completed \u2014 finalText_len=${finalText.length}, thinking=${thinking.length}, saw_final_delta=${sawFinalDelta}, saw_tool_output=${sawToolOutput}, elapsed_ms=${runStartMs ? Date.now() - runStartMs : 0}`
        );
        rootSpan.setOutputs({ final_text: finalText });
        sseWrite(res, {
          type: "response.completed",
          databricks_output: traceId ? { trace: { info: { trace_id: traceId } } } : void 0
        });
      } catch (e) {
        const err = e;
        if (signal?.aborted || err.name === "AbortError") {
          console.debug(
            `[agent-stream] aborted at +${runStartMs ? Date.now() - runStartMs : 0}ms (finalText_len=${finalText.length}, thinking=${thinking.length})`
          );
          caughtCanceled = true;
          return {
            finalText: finalText || null,
            traceId,
            thinking,
            error: null,
            canceled: true,
            modelError: modelError.current
          };
        }
        rootSpan.setStatus(mlflow3.SpanStatusCode.ERROR);
        const dump = {
          name: err.name,
          message: err.message,
          status: err.status,
          code: err.code,
          request_id: err.request_id,
          headers: err.headers,
          response_status: err.response?.status,
          response_body: err.response?.body,
          error_body: err.error,
          cause: err.cause instanceof Error ? {
            name: err.cause.name,
            message: err.cause.message,
            stack: err.cause.stack,
            code: err.cause.code,
            cause: err.cause.cause
          } : err.cause,
          stack: err.stack,
          finalText_len: finalText.length,
          thinking_count: thinking.length,
          saw_tool_output: sawToolOutput,
          saw_final_delta: sawFinalDelta,
          elapsed_ms: runStartMs ? Date.now() - runStartMs : null
        };
        console.error("[agent-stream] ERROR", JSON.stringify(dump, null, 2));
        const detail = modelError.current;
        if (detail) {
          const friendly = detail.message ? `${detail.code ?? `HTTP ${detail.status}`}: ${detail.message}` : `HTTP ${detail.status} from ${detail.url}: ${detail.bodyText.slice(0, 500)}`;
          caughtError = friendly;
        } else {
          caughtError = err.message || "Unknown error";
        }
        sseError(res, caughtError);
      }
      return {
        finalText: finalText || null,
        traceId,
        thinking,
        error: caughtError,
        canceled: caughtCanceled,
        modelError: modelError.current
      };
    },
    {
      name: "refundops.turn",
      spanType: mlflow3.SpanType.AGENT,
      inputs: { user_input: userInput, history_len: messages2.length }
    }
  );
}

// server/chat-stream/index.ts
async function handleChatStream(args) {
  const { req, res, db: db2, config } = args;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  const turnAbort = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) {
      console.debug("[chat-stream] client disconnected \u2192 aborting agent run");
      turnAbort.abort();
    }
  });
  const userEmail = getCurrentUserEmail(req);
  const conversationId = req.body?.conversationId ?? null;
  const messages2 = req.body?.messages ?? [];
  if (conversationId && messages2.length > 0) {
    const last = messages2[messages2.length - 1];
    if (last?.role === "user" && typeof last.content === "string") {
      try {
        await appendMessage(db2, conversationId, "user", last.content);
        const title = last.content.slice(0, 48) + (last.content.length > 48 ? "\u2026" : "");
        await renameConversationIfDefault(db2, conversationId, title);
      } catch (e) {
        const cause = e.cause;
        console.error("[db] persist user message failed", {
          drizzle_message: e.message,
          pg_code: cause?.code,
          pg_detail: cause?.detail,
          pg_hint: cause?.hint,
          pg_schema: cause?.schema,
          pg_table: cause?.table,
          pg_column: cause?.column,
          pg_message: cause?.message
        });
        sseError(
          res,
          `Your last message couldn't be saved (${cause?.code ?? "db error"}). The agent will reply but a page reload won't show it.`
        );
      }
    }
  }
  const host = (process.env.DATABRICKS_HOST ?? "").replace(/\/$/, "");
  if (!host) {
    sseError(res, "DATABRICKS_HOST not set");
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }
  const cleanMessages = messages2.filter(
    (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0
  );
  const lastClean = cleanMessages[cleanMessages.length - 1];
  if (!lastClean || lastClean.role !== "user") {
    sseError(
      res,
      "Empty message \u2014 please type something before sending."
    );
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }
  let out;
  try {
    out = await streamAgentTurn({
      db: db2,
      req,
      res,
      userEmail,
      masEndpointName: config.masEndpointName,
      databricksHost: host,
      // Foundation Model endpoint name. Needs the OpenAI Responses API
      // (refundops.ts `setOpenAIAPI('responses')`). `databricks-gpt-5-4` is the
      // baseline default; a newer GPT endpoint with `openai/v1/responses` enabled
      // works too. Claude/non-Responses models 400 BAD_REQUEST on that route. Use
      // the EXACT endpoint name from Serving → Foundation Models; never abbreviate.
      model: config.agentModel ?? "databricks-gpt-5-4",
      messages: cleanMessages,
      signal: turnAbort.signal
    });
  } catch (e) {
    const err = e;
    console.error("[chat-stream] streamAgentTurn threw uncaught", {
      name: err.name,
      message: err.message,
      stack: err.stack
    });
    const friendly = `Agent crashed: ${err.message || err.name || "unknown error"}`;
    sseError(res, friendly);
    out = {
      finalText: null,
      traceId: null,
      thinking: [],
      error: friendly,
      canceled: false,
      modelError: null
    };
  }
  let finalText = out.finalText;
  const traceId = out.traceId;
  const thinking = out.thinking;
  let errorText = out.error;
  const canceled = out.canceled;
  if (!finalText?.trim() && !errorText && !canceled) {
    const me = out.modelError;
    const fallback = me ? `Upstream model error ${me.code ?? `HTTP ${me.status}`}: ${me.message ?? me.bodyText.slice(0, 300)}` : "The agent finished without producing a response. This usually means an upstream tool returned no usable output. Check the server logs for the turn that just ran.";
    console.error(
      "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550"
    );
    console.error("[chat-stream] EMPTY TURN \u2014 agent produced no response");
    console.error("  conversation_id:", conversationId);
    console.error("  user_message:", JSON.stringify(lastClean.content).slice(0, 200));
    console.error("  thinking_entries:", thinking.length);
    console.error(
      "  thinking_kinds:",
      thinking.map((t) => t.kind).join(", ") || "(none)"
    );
    if (me) {
      console.error("  upstream_status:", me.status);
      console.error("  upstream_url:", me.url);
      console.error("  upstream_code:", me.code);
      console.error("  upstream_message:", me.message);
      console.error("  upstream_body:", me.bodyText.slice(0, 2e3));
    } else if (thinking.length > 0) {
      console.error("  thinking_dump:", JSON.stringify(thinking, null, 2).slice(0, 4e3));
    } else {
      console.error("  \u26A0 NO tool calls, NO reasoning, NO captured HTTP error.");
      console.error("  Likely causes: (1) model returned 200 with empty body, (2) system prompt forbids tool use, (3) the conversation history triggered a refusal.");
    }
    console.error(
      "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550"
    );
    errorText = fallback;
    sseError(res, fallback);
  }
  const shouldPersist = conversationId && (finalText && finalText.trim().length > 0 || errorText || canceled);
  if (shouldPersist) {
    try {
      await appendMessage(
        db2,
        conversationId,
        "assistant",
        finalText ?? "",
        traceId ?? void 0,
        thinking,
        errorText ?? void 0,
        canceled
      );
    } catch (e) {
      const cause = e.cause;
      console.error("[db] persist assistant message failed", {
        drizzle_message: e.message,
        pg_code: cause?.code,
        pg_detail: cause?.detail,
        pg_hint: cause?.hint,
        pg_message: cause?.message
      });
      sseError(
        res,
        `Reply wasn't saved (${cause?.code ?? "db error"}). It's visible now but won't survive reload.`
      );
    }
  }
  if (!res.writableEnded && !res.destroyed) {
    res.write("data: [DONE]\n\n");
    res.end();
  }
}

// server/routes/chat.ts
function registerChatRoutes(app, deps) {
  const { db: db2, appConfig: appConfig2 } = deps;
  app.get("/api/conversations", async (req, res) => {
    const userEmail = getCurrentUserEmail(req);
    const rows = await listConversations(db2, userEmail);
    res.json(rows);
  });
  app.get("/api/dock-conversation", async (req, res) => {
    const userEmail = getCurrentUserEmail(req);
    const convo = await getOrCreateDockConversation(db2, userEmail);
    res.json(convo);
  });
  app.post("/api/conversations", express.json(), async (req, res) => {
    const userEmail = getCurrentUserEmail(req);
    const title = req.body?.title ?? "New conversation";
    const convo = await createConversation(db2, userEmail, title);
    res.json(convo);
  });
  app.get("/api/conversations/:id", async (req, res) => {
    const userEmail = getCurrentUserEmail(req);
    const result = await getConversationWithMessages(db2, userEmail, req.params.id);
    if (!result) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json(result);
  });
  app.delete("/api/conversations/:id", async (req, res) => {
    const userEmail = getCurrentUserEmail(req);
    const ok = await deleteConversation(db2, userEmail, req.params.id);
    if (!ok) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json({ ok: true });
  });
  app.post("/api/chat/stream", express.json(), async (req, res) => {
    await handleChatStream({
      req,
      res,
      db: db2,
      config: appConfig2
    });
  });
  app.post("/api/messages/:id/feedback", express.json(), async (req, res) => {
    const userEmail = getCurrentUserEmail(req);
    const value = req.body?.value ?? null;
    const rationale = req.body?.rationale ?? void 0;
    if (value !== "up" && value !== "down") {
      res.status(400).json({ error: 'value must be "up" or "down"' });
      return;
    }
    const msg = await getMessageById(db2, req.params.id);
    if (!msg) {
      res.status(404).json({ error: "message not found" });
      return;
    }
    let mlflowAssessmentId = null;
    const host = (process.env.DATABRICKS_HOST ?? "").replace(/\/$/, "");
    if (msg.traceId && host) {
      mlflowAssessmentId = await postMlflowAssessment({
        req,
        host,
        traceId: msg.traceId,
        userEmail,
        value,
        rationale
      });
    }
    const row = await insertFeedback(db2, {
      messageId: req.params.id,
      userEmail,
      value,
      rationale,
      traceId: msg.traceId,
      mlflowAssessmentId
    });
    res.json({ ok: true, id: row.id, mlflowAssessmentId });
  });
}

// server/routes/relationships.ts
function registerRelationshipsRoutes(app, deps) {
  const { db: db2 } = deps;
  app.get("/api/customers/at-risk", async (_req, res) => {
    try {
      const customers = await listAtRiskCustomers(db2);
      res.json(customers);
    } catch (e) {
      console.error("[relationships] /api/customers/at-risk error:", e);
      res.status(500).json({ error: "Failed to load at-risk customers" });
    }
  });
  app.get("/api/customers/:customerId", async (req, res) => {
    try {
      const { customerId } = req.params;
      const [position, atrisk, nba, actions] = await Promise.all([
        getCustomerPosition(db2, customerId),
        getOpenAtrisk(db2, customerId),
        getNbaRecommendation(db2, customerId),
        listOutreachActions(db2, customerId)
      ]);
      if (!position) {
        res.status(404).json({ error: `Customer ${customerId} not found` });
        return;
      }
      res.json({
        position,
        atrisk,
        nba,
        actions
      });
    } catch (e) {
      console.error("[relationships] /api/customers/:id error:", e);
      res.status(500).json({ error: "Failed to load customer detail" });
    }
  });
  app.get("/api/metrics/risk", async (_req, res) => {
    try {
      const metrics = await getRiskMetrics(db2);
      res.json(metrics);
    } catch (e) {
      console.error("[relationships] /api/metrics/risk error:", e);
      res.status(500).json({ error: "Failed to load risk metrics" });
    }
  });
}

// server/routes/activity.ts
function registerActivityRoutes(app, deps) {
  app.get("/api/activity/recent", async (req, res) => {
    const raw = Number(req.query.limit);
    const limit = Number.isFinite(raw) && raw >= 1 ? Math.min(Math.floor(raw), 100) : 20;
    const events = await recentActivity(deps.db, limit);
    res.json(events);
  });
}

// server/routes/admin.ts
function registerAdminRoutes(app, deps) {
  const { db: db2, data } = deps;
  app.post("/api/admin/reset", async (_req, res) => {
    await wipeMirroredTables(db2);
    if (data) {
      await syncFromDelta(db2, data, { forceIfAnyEmpty: true });
    }
    res.json({ ok: true });
  });
}

// server/routes/charts.ts
import { readFileSync } from "node:fs";
import { resolve as resolve2 } from "node:path";
import { sql as sqlParam } from "@databricks/appkit";
var NUMERIC_RE = /^-?\d+(\.\d+)?$/;
function coerce(value) {
  if (typeof value === "string" && NUMERIC_RE.test(value)) {
    const n = Number(value);
    if (!Number.isNaN(n))
      return n;
  }
  return value;
}
var QUERY_FILES = {
  daily_refund_trend: "daily_refund_trend.sql",
  returns_by_product: "returns_by_product.sql",
  worst_lots: "worst_lots.sql"
};
function registerChartRoutes(app, deps) {
  const { query, catalog, schema, queriesDir } = deps;
  app.get("/api/charts/:key", async (req, res) => {
    const key = String(req.params.key);
    const file = QUERY_FILES[key];
    if (!file) {
      res.status(404).json({ error: `Unknown chart query: ${key}` });
      return;
    }
    let sql4;
    try {
      sql4 = readFileSync(resolve2(queriesDir, file), "utf8");
    } catch (e) {
      res.status(500).json({ error: `Could not read query ${key}: ${e.message}` });
      return;
    }
    try {
      const result = await query(sql4, {
        catalog: sqlParam.string(catalog),
        schema: sqlParam.string(schema)
      });
      const rows = (result.data ?? []).map(
        (row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, coerce(v)]))
      );
      res.json({ data: rows });
    } catch (e) {
      res.status(500).json({ error: `Query ${key} failed: ${e.message}` });
    }
  });
}

// server/routes/dev-log.ts
import express2 from "express";
function registerDevLogRoutes(app, logErrorCompact2) {
  app.post("/api/log/client-error", express2.json({ limit: "64kb" }), (req, res) => {
    const {
      message,
      stack,
      source,
      url,
      filename,
      lineno,
      colno
    } = req.body ?? {};
    const loc = filename != null ? ` ${filename}${lineno != null ? `:${lineno}` : ""}${colno != null ? `:${colno}` : ""}` : "";
    const summary = `CLIENT ERR \u25B8 [${source ?? "unknown"}]${loc} ${message ?? "unknown client error"}`;
    process.stderr.write(summary + "\n");
    if (stack) {
      process.stderr.write(`CLIENT ERR \u25B8   stack: ${stack.split("\n").slice(0, 6).join("\n  ")}
`);
    }
    if (url) {
      process.stderr.write(`CLIENT ERR \u25B8   page: ${url}
`);
    }
    logErrorCompact2(
      `[client${source ? `:${source}` : ""}]${url ? ` ${url}` : ""}`,
      { message: message ?? "unknown client error", stack }
    );
    res.status(204).end();
  });
}

// server/server.ts
if (process.env.DATABRICKS_HOST) {
  let h = process.env.DATABRICKS_HOST.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(h))
    h = "https://" + h;
  process.env.DATABRICKS_HOST = h;
}
installLogger();
var tablesSchema = z3.object({
  customerPosition: z3.string().min(1),
  openAtrisk: z3.string().min(1),
  nbaRecommendations: z3.string().min(1),
  products: z3.string().min(1)
});
var appConfigSchema = z3.object({
  masEndpointName: z3.string().optional(),
  genieSpaceId: z3.string().optional(),
  mlflowExperimentId: z3.string().optional(),
  agentMlflowExperimentPath: z3.string().optional(),
  agentModel: z3.string().optional(),
  dashboardId: z3.string(),
  pipelineId: z3.string().optional(),
  warehouseId: z3.string().optional(),
  kaEndpointName: z3.string().optional(),
  lakebaseProjectId: z3.string().optional(),
  appUrl: z3.string().optional(),
  mlModelName: z3.string().optional(),
  pdfVolumePath: z3.string().optional(),
  branding: z3.object({ appName: z3.string().min(1) }),
  assistantScript: z3.array(
    z3.object({
      label: z3.string().optional(),
      prompt: z3.string().min(1),
      triggerAfter: z3.array(z3.string()).optional()
    })
  ).optional(),
  data: z3.object({
    // NOT `.min(1)`: in local-dev / preview mode DEMO_CATALOG/DEMO_SCHEMA
    // may be unset, so the `${DEMO_CATALOG}` placeholders resolve to "".
    // We must BOOT (degraded) rather than crash — the Delta→Lakebase sync
    // already no-ops when DATABRICKS_WAREHOUSE_ID is unset (db/sync.ts),
    // which is the same condition, so empty catalog/schema never reaches
    // a query. Deployed mode always has all three set together.
    catalog: z3.string(),
    schema: z3.string(),
    tables: tablesSchema
  }).optional()
});
var CONFIG_PATH = resolve3(
  dirname2(fileURLToPath3(import.meta.url)),
  "../config/app.json"
);
function loadAppConfig() {
  let raw;
  try {
    raw = readFileSync2(CONFIG_PATH, "utf8");
  } catch (e) {
    throw new Error(
      `[config] Could not read ${CONFIG_PATH}: ${e.message}`
    );
  }
  raw = raw.replace(/\$\{([A-Z_][A-Z0-9_]*)(?::([^}]*))?\}/g, (_, name, dflt) => {
    const v = process.env[name];
    return v !== void 0 && v !== "" ? v : dflt ?? "";
  });
  const errors = [];
  const parsed = parseJsonc(raw, errors, { allowTrailingComma: true });
  if (errors.length > 0) {
    const list = errors.map(
      (e) => `  \u2022 offset ${e.offset}+${e.length}: ${printParseErrorCode(e.error)}`
    ).join("\n");
    throw new Error(
      `[config] ${CONFIG_PATH} is not valid JSONC:
${list}`
    );
  }
  const result = appConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  \u2022 ${i.path.join(".") || "<root>"}: ${i.message}`).join("\n");
    throw new Error(
      `[config] ${CONFIG_PATH} failed validation:
${issues}`
    );
  }
  const hasPlaceholder = (v) => typeof v === "string" && /<[^>]+>/.test(v);
  const warnPlaceholders = [
    ["agentMlflowExperimentPath", result.data.agentMlflowExperimentPath],
    ["mlflowExperimentId", result.data.mlflowExperimentId]
  ];
  for (const [k, v] of warnPlaceholders) {
    if (hasPlaceholder(v)) {
      console.warn(
        `[config] ${k} contains an unfilled <placeholder>: ${v} \u2014 feature will be skipped at boot.`
      );
    }
  }
  const errorPlaceholders = [
    ["dashboardId", result.data.dashboardId],
    ["branding.appName", result.data.branding?.appName],
    ["data.catalog", result.data.data?.catalog],
    ["data.schema", result.data.data?.schema]
  ];
  const unfilled = errorPlaceholders.filter(([, v]) => hasPlaceholder(v));
  if (unfilled.length > 0) {
    const list = unfilled.map(([k, v]) => `  \u2022 ${k} = ${v} (contains a <placeholder>)`).join("\n");
    throw new Error(
      `[config] ${CONFIG_PATH} has unfilled placeholders \u2014 replace them with real values:
${list}`
    );
  }
  return result.data;
}
var appConfig = loadAppConfig();
var agentExperimentId = null;
function logErrorCompact(prefix, err) {
  const e = err;
  const parts = [truncate(e.message ?? String(err), 300)];
  if (e.cause?.code)
    parts.push(`pg=${e.cause.code}`);
  if (e.cause?.constraint)
    parts.push(`constraint=${e.cause.constraint}`);
  if (e.cause?.detail)
    parts.push(`detail=${truncate(e.cause.detail, 200)}`);
  if (e.query)
    parts.push(`query=${truncate(e.query, 200)}`);
  const header = `${prefix} ${parts.join(" | ")}`;
  const frames = e.stack ? e.stack.split("\n").filter((l) => l.trimStart().startsWith("at ")).slice(0, 12).map((l) => truncate(l.trimStart(), 300)).join("\n") : "";
  console.error(frames ? `${header}
${frames}` : header);
}
function truncate(s, n) {
  return s.length > n ? `${s.slice(0, n)}\u2026 (+${s.length - n} chars)` : s;
}
process.on("unhandledRejection", (reason) => {
  logErrorCompact("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  logErrorCompact("[uncaughtException]", err);
});
var t0 = Date.now();
var ms = () => `${Date.now() - t0}ms`;
var STARTUP_SAFE_PATHS = /* @__PURE__ */ new Set([
  "/api/config",
  "/api/me",
  "/api/warehouse"
]);
var STARTUP_SAFE_PREFIXES = ["/api/log/"];
var migrationsDone = false;
var migrationsFailure = null;
var migrationsReady = new Promise(() => {
});
var db;
await createApp({
  plugins: [
    // Server auto-starts after onPluginsReady (AppKit 0.41+). The route
    // registration MUST run in onPluginsReady so it lands before the server
    // begins listening.
    server(),
    // The lakebase pool reads PGHOST/PGDATABASE/PGPORT/PGSSLMODE +
    // LAKEBASE_* from env; no config needed here. (Pre-0.41 this passed
    // branch/database to resolve resource bindings — those args were removed.)
    lakebase(),
    analytics({})
  ],
  // Runs after plugins are set up but BEFORE the server listens — the place
  // to register custom routes (was `extend()` + manual `start()` pre-0.41).
  // The server auto-starts when this returns; background init is launched
  // here as fire-and-forget (the /api gate awaits `migrationsReady`).
  onPluginsReady(appkit) {
    db = createDb(appkit.lakebase.pool);
    appkit.server.extend((app) => {
      app.use("/api", async (req, res, next) => {
        if (migrationsDone)
          return next();
        if (STARTUP_SAFE_PATHS.has(req.path))
          return next();
        if (STARTUP_SAFE_PREFIXES.some((p) => req.path.startsWith(p)))
          return next();
        if (migrationsFailure) {
          res.status(503).json({
            error: `Database initialization failed: ${migrationsFailure.message}`
          });
          return;
        }
        try {
          await Promise.race([
            migrationsReady,
            new Promise(
              (_, rej) => setTimeout(() => rej(new Error("startup-timeout")), 5e3)
            )
          ]);
          next();
        } catch (e) {
          const isTimeout = e instanceof Error && e.message === "startup-timeout";
          res.set("Retry-After", "2").status(503).json({
            error: isTimeout ? "Database is still initializing \u2014 please retry in a moment." : `Database initialization failed: ${e.message}`
          });
        }
      });
      registerConfigRoutes(app, {
        appConfig,
        getAgentExperimentId: () => agentExperimentId
      });
      if (!appConfig.masEndpointName) {
        console.warn(
          "[boot] config.masEndpointName is empty \u2014 the agent won't have an ask_mas tool. Set it in config/app.json, or wire ask_genie if your demo uses Genie."
        );
      }
      registerChatRoutes(app, {
        db,
        appConfig: {
          masEndpointName: appConfig.masEndpointName ?? "",
          agentModel: appConfig.agentModel
        }
      });
      registerRelationshipsRoutes(app, { db });
      registerActivityRoutes(app, { db });
      registerAdminRoutes(app, { db, data: appConfig.data });
      if (appConfig.data) {
        registerChartRoutes(app, {
          query: (sql4, params) => appkit.analytics.query(sql4, params),
          catalog: appConfig.data.catalog,
          schema: appConfig.data.schema,
          queriesDir: resolve3(
            dirname2(fileURLToPath3(import.meta.url)),
            "../config/queries"
          )
        });
      }
      if (process.env.DEV_CLIENT_ERROR_LOG === "1") {
        registerDevLogRoutes(app, logErrorCompact);
        console.log("[boot] DEV_CLIENT_ERROR_LOG=1 \u2192 /api/log/client-error enabled");
      }
      app.use(
        (err, req, res, _next) => {
          logErrorCompact(`[500] ${req.method} ${req.path}`, err);
          if (!res.headersSent) {
            res.status(500).json({ error: err.message });
          }
        }
      );
    });
    startBackgroundInit();
  }
  // end onPluginsReady
});
console.log(`[boot +${ms()}] Server listening \u2014 background init in progress\u2026`);
function startBackgroundInit() {
  const mlflowIdPromise = (async () => {
    const appName = (process.env.DATABRICKS_APP_NAME ?? "").trim();
    const experimentPath = appConfig.agentMlflowExperimentPath || (appName ? `/Shared/solution_builder/${appName}-agent-traces` : "");
    if (!experimentPath) {
      console.warn(
        '[boot] no MLflow experiment path \u2014 agentMlflowExperimentPath is empty AND DATABRICKS_APP_NAME is unset, so nothing could be derived. Agent traces will NOT be recorded and the chat "View trace" link will show "Trace pending\u2026". Set AGENT_MLFLOW_EXPERIMENT_PATH (e.g. /Shared/solution_builder/<app-name>-agent-traces).'
      );
      return null;
    }
    const host = (process.env.DATABRICKS_HOST ?? "").replace(/\/$/, "");
    if (!host) {
      console.warn("[boot] DATABRICKS_HOST not set \u2014 skipping MLflow experiment bootstrap.");
      return null;
    }
    try {
      const id = await ensureMlflowExperiment(host, experimentPath);
      console.log(`[boot +${ms()}] MLflow experiment resolved (id=${id}) \u2014 traces will land at ${experimentPath}`);
      return id;
    } catch (e) {
      console.warn(
        `[boot] MLflow experiment bootstrap failed for ${experimentPath} \u2014 "View trace" link will show "Trace pending\u2026":`,
        e.message
      );
      return null;
    }
  })();
  migrationsReady = (async () => {
    try {
      await runMigrations(db);
      console.log(`[boot +${ms()}] Migrations up to date`);
      if (appConfig.data) {
        await syncFromDelta(db, appConfig.data);
        console.log(`[boot +${ms()}] Delta sync done`);
      }
      migrationsDone = true;
    } catch (e) {
      migrationsFailure = e instanceof Error ? e : new Error(String(e));
      logErrorCompact("[boot] DB init failed:", e);
      throw migrationsFailure;
    }
  })();
  migrationsReady.catch(() => {
  });
  void (async () => {
    await migrationsReady.catch(() => {
    });
    agentExperimentId = await mlflowIdPromise;
    if (agentExperimentId) {
      let mlflowHost;
      let mlflowToken;
      try {
        const { client } = getExecutionContext4();
        const h = new Headers();
        await client.config.authenticate(h);
        mlflowToken = /^Bearer\s+(.+)$/i.exec(h.get("Authorization") ?? "")?.[1];
        mlflowHost = client.config.host ?? process.env.DATABRICKS_HOST;
      } catch (e) {
        console.warn("[boot] could not resolve MLflow exporter auth from the app client \u2014 trace upload may fail:", e.message);
      }
      mlflow4.init({
        trackingUri: "databricks",
        experimentId: agentExperimentId,
        ...mlflowHost && mlflowToken ? { host: mlflowHost, databricksToken: mlflowToken } : {}
      });
      console.log(`[boot +${ms()}] MLflow tracing active`);
      const origWarn = console.warn.bind(console);
      console.warn = (...args) => {
        const first = args[0];
        if (typeof first === "string" && first.includes("No trace ID found for span lakebase.query")) {
          return;
        }
        origWarn(...args);
      };
    }
  })();
}
