-- Lakebase Search over ops.rm_notes.note_text (hybrid: BM25 full-text + ANN vector).
ALTER TABLE ops.rm_notes
  ADD COLUMN IF NOT EXISTS note_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('english', note_text)) STORED,
  ADD COLUMN IF NOT EXISTS note_embedding vector(1024);
