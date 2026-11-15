import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Db } from "./connection";

const MIGRATIONS_DIR = path.join(process.cwd(), "src", "lib", "db", "migrations");

export interface MigrationRecord {
  version: string;
  name: string;
  applied_at: string;
}

function ensureMigrationsTable(db: Db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

export function listMigrationFiles(dir = MIGRATIONS_DIR): { version: string; name: string; file: string }[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((file) => {
      const m = file.match(/^(\d+)_([^.]+)\.sql$/);
      const version = m ? m[1] : file.replace(/\.sql$/, "");
      const name = m ? m[2] : file;
      return { version, name, file: path.join(dir, file) };
    });
}

export function getAppliedMigrations(db: Db): MigrationRecord[] {
  ensureMigrationsTable(db);
  return db.prepare("SELECT version, name, applied_at FROM schema_migrations ORDER BY version").all() as MigrationRecord[];
}

export function migrate(db: Db, dir = MIGRATIONS_DIR): { applied: string[] } {
  ensureMigrationsTable(db);
  const applied = new Set(getAppliedMigrations(db).map((m) => m.version));
  const files = listMigrationFiles(dir);
  const newlyApplied: string[] = [];
  const run = db.transaction(() => {
    for (const mig of files) {
      if (applied.has(mig.version)) continue;
      const sql = fs.readFileSync(mig.file, "utf8");
      db.exec(sql);
      // Migration SQL may insert its own record; ensure recorded
      const exists = db.prepare("SELECT 1 FROM schema_migrations WHERE version = ?").get(mig.version);
      if (!exists) {
        db.prepare("INSERT INTO schema_migrations(version,name,applied_at) VALUES (?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'))").run(mig.version, mig.name);
      }
      newlyApplied.push(mig.version);
    }
  });
  run();
  return { applied: newlyApplied };
}
