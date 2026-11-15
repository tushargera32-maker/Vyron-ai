import "server-only";
import type { Db } from "../connection";
import type { Agent } from "../types";

export function upsertAgent(db: Db, input: { id: string; name: string; description?: string | null; system_prompt: string; config_json?: string; is_builtin?: number; enabled?: number }) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO agents(id,name,description,system_prompt,config_json,is_builtin,enabled,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, system_prompt=excluded.system_prompt, config_json=excluded.config_json, enabled=excluded.enabled, updated_at=excluded.updated_at`
  ).run(input.id, input.name, input.description ?? null, input.system_prompt, input.config_json ?? "{}", input.is_builtin ?? 1, input.enabled ?? 1, now, now);
  return getAgent(db, input.id)!;
}

export function getAgent(db: Db, id: string): Agent | undefined {
  return db.prepare(`SELECT * FROM agents WHERE id = ?`).get(id) as Agent | undefined;
}

export function listAgents(db: Db): Agent[] {
  return db.prepare(`SELECT * FROM agents ORDER BY is_builtin DESC, name ASC`).all() as Agent[];
}
