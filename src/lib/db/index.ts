import "server-only";
import { getDb, openDatabase, closeDb, getDatabasePath, type Db } from "./connection";
import { migrate } from "./migrator";
import { checkHealth } from "./health";
import { backupDatabase, restoreDatabase } from "./backup";

let initialized = false;

export function initDb(db: Db = getDb()) {
  const result = migrate(db);
  try {
    // Safe single-user local initialization (idempotent). Preserves existing data.
    const now = new Date().toISOString();
    db.prepare(`INSERT OR IGNORE INTO local_profile(id,name,created_at,updated_at) VALUES ('local-user','Local User',?,?)`).run(now, now);
  } catch {
    // profile table may not exist in minimal contexts; ignore
  }
  initialized = true;
  return result;
}

export function ensureDbReady() {
  const db = getDb();
  if (!initialized) initDb(db);
  return db;
}

export function dbHealth() {
  return checkHealth(ensureDbReady());
}

export { getDb, openDatabase, closeDb, getDatabasePath, migrate, checkHealth, backupDatabase, restoreDatabase };
export type { Db };
