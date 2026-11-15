-- 003_local_user_init.sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS local_profile (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO local_profile(id, name, created_at, updated_at)
VALUES ('local-user', 'Local User', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'));

INSERT OR IGNORE INTO schema_migrations(version, name, applied_at)
VALUES ('003_local_user_init', 'local single-user profile initialization', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
