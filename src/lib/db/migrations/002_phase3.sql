-- 002_phase3.sql
PRAGMA foreign_keys = ON;

-- Conversations soft delete + search helpers
ALTER TABLE conversations ADD COLUMN deleted_at TEXT;
CREATE INDEX IF NOT EXISTS idx_conversations_deleted_updated ON conversations(deleted_at, updated_at DESC);

-- Embeddings for knowledge chunks (semantic search, optional/provider-independent)
CREATE TABLE IF NOT EXISTS chunk_embeddings (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id TEXT NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  dims INTEGER NOT NULL,
  vector_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(chunk_id, provider, model)
);
CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_document ON chunk_embeddings(document_id);
CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_chunk ON chunk_embeddings(chunk_id);

-- Memory retrieval tracking
CREATE TABLE IF NOT EXISTS memory_retrieval_events (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  query TEXT,
  score REAL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memory_retrieval_memory_created ON memory_retrieval_events(memory_id, created_at DESC);

INSERT OR IGNORE INTO schema_migrations(version, name, applied_at)
VALUES ('002_phase3', 'phase3 chat memory knowledge extensions', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
