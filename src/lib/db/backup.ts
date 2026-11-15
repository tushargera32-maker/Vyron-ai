import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Db } from "./connection";
import { getDatabasePath } from "./connection";

export interface BackupResult {
  ok: boolean;
  path?: string;
  error?: string;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export async function backupDatabase(db: Db, destDir?: string): Promise<BackupResult> {
  const dir = destDir || path.join(process.cwd(), "data", "backups");
  ensureDir(dir);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(dir, `aether-${ts}.db`);
  try {
    await db.backup(dest);
    // record in backups table if exists
    try {
      db.prepare(
        "INSERT INTO backups(id,type,path,status,metadata_json,created_at) VALUES (?,?,?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
      ).run(randomUUID(), "db", dest, "success", "{}");
    } catch {
      // table may not exist in all contexts
    }
    return { ok: true, path: dest };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function restoreDatabase(backupPath: string, targetPath = getDatabasePath()): BackupResult {
  try {
    if (!fs.existsSync(backupPath)) return { ok: false, error: "Backup file not found" };
    const dir = path.dirname(targetPath);
    ensureDir(dir);
    fs.copyFileSync(backupPath, targetPath);
    // remove wal/shm sidecars if present to avoid stale state
    for (const suffix of ["-wal", "-shm"]) {
      const p = `${targetPath}${suffix}`;
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    return { ok: true, path: targetPath };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
