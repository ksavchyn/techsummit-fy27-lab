-- Lakebase Search enablement over ops.rm_notes.note_text (hybrid: BM25 full-text + ANN vector).
-- (Project-level "Enable Lakebase Search" toggle done in Settings; this installs + indexes per-database.)

-- 1. Install extensions (pgvector must precede lakebase_vector)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS lakebase_vector;
CREATE EXTENSION IF NOT EXISTS lakebase_text;

-- 2. Searchable columns on the operational table
ALTER TABLE ops.rm_notes
  ADD COLUMN IF NOT EXISTS note_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', note_text)) STORED,
  ADD COLUMN IF NOT EXISTS note_embedding vector(1024);   -- filled via ai_query('databricks-gte-large-en', note_text)

-- 3. Hybrid indexes: BM25 full-text + ANN vector
CREATE INDEX IF NOT EXISTS rm_notes_tsv_bm25 ON ops.rm_notes USING lakebase_bm25 (note_tsv);
CREATE INDEX IF NOT EXISTS rm_notes_emb_ann  ON ops.rm_notes USING lakebase_ann  (note_embedding vector_cosine_ops);
