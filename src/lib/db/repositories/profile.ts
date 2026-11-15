import "server-only";
import type { Db } from "../connection";

export interface LocalProfile { id: string; name: string; created_at: string; updated_at: string }

export function ensureLocalUser(db: Db): LocalProfile {
  const now = new Date().toISOString();
  db.prepare(`INSERT OR IGNORE INTO local_profile(id,name,created_at,updated_at) VALUES ('local-user','Local User',?,?)`).run(now, now);
  return db.prepare(`SELECT * FROM local_profile WHERE id='local-user'`).get() as LocalProfile;
}
