import "server-only";
import type { Db } from "./connection";

export interface HealthStatus {
  ok: boolean;
  journalMode?: string;
  foreignKeys?: number;
  fts5?: boolean;
  migrations?: number;
  error?: string;
}

export function checkHealth(db: Db): HealthStatus {
  try {
    const jm = db.pragma("journal_mode", { simple: true }) as string;
    const fk = db.pragma("foreign_keys", { simple: true }) as number;
    const fts = db.prepare("SELECT 1 FROM pragma_compile_options WHERE compile_options LIKE '%FTS5%'").get();
    let migrations = 0;
    try {
      const row = db.prepare("SELECT COUNT(*) as c FROM schema_migrations").get() as { c: number } | undefined;
      migrations = row?.c ?? 0;
    } catch {
      migrations = 0;
    }
    return { ok: true, journalMode: String(jm), foreignKeys: Number(fk), fts5: !!fts, migrations };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
