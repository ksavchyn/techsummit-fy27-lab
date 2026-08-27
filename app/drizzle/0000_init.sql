-- AppKit chat-state schema migration
-- Creates app.conversations, app.messages, app.feedback
-- Safe to run multiple times (IF NOT EXISTS throughout)

CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email  TEXT NOT NULL,
  title       TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'default' CHECK (kind IN ('default', 'demo_dock')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conversations_user_idx ON app.conversations (user_email, updated_at);
CREATE INDEX IF NOT EXISTS conversations_kind_idx ON app.conversations (user_email, kind);

CREATE TABLE IF NOT EXISTS app.messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES app.conversations(id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content          TEXT NOT NULL,
  position         INTEGER NOT NULL,
  trace_id         TEXT,
  thinking         JSONB NOT NULL DEFAULT '[]',
  error            TEXT,
  canceled         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS messages_convo_pos_uq ON app.messages (conversation_id, position);

CREATE TABLE IF NOT EXISTS app.feedback (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id            UUID NOT NULL REFERENCES app.messages(id) ON DELETE CASCADE,
  user_email            TEXT NOT NULL,
  value                 TEXT NOT NULL CHECK (value IN ('up', 'down')),
  rationale             TEXT,
  trace_id              TEXT,
  mlflow_assessment_id  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feedback_message_idx ON app.feedback (message_id);
