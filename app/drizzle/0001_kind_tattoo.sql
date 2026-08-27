CREATE SCHEMA "app";
--> statement-breakpoint
CREATE SCHEMA "ops";
--> statement-breakpoint
CREATE SCHEMA "retention";
--> statement-breakpoint
CREATE TABLE "app"."conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'default' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"user_email" text NOT NULL,
	"value" text NOT NULL,
	"rationale" text,
	"trace_id" text,
	"mlflow_assessment_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retention"."gold_customer_position" (
	"customer_id" text PRIMARY KEY NOT NULL,
	"customer_display_name" text,
	"tier" text NOT NULL,
	"tenure_years" integer,
	"home_metro" text,
	"customer_lat" double precision,
	"customer_lng" double precision,
	"profile_summary" text,
	"total_balance_usd" double precision,
	"deposit_balance_usd" double precision,
	"affected_deposit_balance_usd" double precision,
	"min_days_to_maturity" integer,
	"attrition_risk_score" double precision,
	"balance_outflow_30d_usd" double precision,
	"churn_signal_score" numeric,
	"product_count" bigint,
	"balance_at_risk_usd" double precision,
	"revenue_at_risk_usd" double precision,
	"risk_band" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retention"."gold_nba_recommendations" (
	"customer_id" text PRIMARY KEY NOT NULL,
	"recommended_action" text NOT NULL,
	"recommended_offer_product_id" text,
	"recommended_rate_apy" numeric,
	"predicted_retained_usd" double precision,
	"predicted_net_value_usd" double precision,
	"action_ranking" text,
	"scored_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "retention"."gold_open_atrisk" (
	"customer_id" text PRIMARY KEY NOT NULL,
	"customer_display_name" text,
	"tier" text,
	"tenure_years" integer,
	"home_metro" text,
	"customer_lat" double precision,
	"customer_lng" double precision,
	"attrition_risk_score" double precision,
	"balance_at_risk_usd" double precision,
	"revenue_at_risk_usd" double precision,
	"atrisk_product_id" text,
	"atrisk_balance_usd" double precision,
	"days_to_maturity" integer,
	"current_rate_apy" double precision,
	"candidate_cross_sell_product_id" text
);
--> statement-breakpoint
CREATE TABLE "app"."messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"position" integer NOT NULL,
	"trace_id" text,
	"thinking" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"canceled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."outreach_actions" (
	"action_id" bigint PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"action_type" text NOT NULL,
	"offer_product_id" text,
	"offer_rate_apy" numeric,
	"outcome" text,
	"action_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."rm_cases" (
	"case_id" bigint PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text,
	"assigned_rm" text,
	"balance_at_risk_usd" numeric,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"priority_score" numeric
);
--> statement-breakpoint
CREATE TABLE "ops"."rm_notes" (
	"note_id" bigint PRIMARY KEY NOT NULL,
	"case_id" bigint,
	"customer_id" text NOT NULL,
	"author" text,
	"note_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."feedback" ADD CONSTRAINT "feedback_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "app"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "app"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversations_user_idx" ON "app"."conversations" USING btree ("user_email","updated_at");--> statement-breakpoint
CREATE INDEX "conversations_kind_idx" ON "app"."conversations" USING btree ("user_email","kind");--> statement-breakpoint
CREATE INDEX "feedback_message_idx" ON "app"."feedback" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_convo_pos_uq" ON "app"."messages" USING btree ("conversation_id","position");