import "server-only";
import { randomUUID } from "node:crypto";
import type { Db } from "../connection";
import type { UsageEvent, AuditLog } from "../types";

export function recordUsageEvent(db: Db, input: Omit<UsageEvent, "id" | "created_at"> & { id?: string; created_at?: string }) {
  const id = input.id ?? randomUUID();
  const now = input.created_at ?? new Date().toISOString();
  db.prepare(
    `INSERT INTO usage_events(id,conversation_id,message_id,agent_run_id,provider_id,model_id,token_input,token_output,latency_ms,status,error_json,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(id, input.conversation_id ?? null, input.message_id ?? null, input.agent_run_id ?? null, input.provider_id ?? null, input.model_id ?? null, input.token_input ?? null, input.token_output ?? null, input.latency_ms ?? null, input.status, input.error_json ?? null, now);
  return db.prepare(`SELECT * FROM usage_events WHERE id = ?`).get(id) as UsageEvent;
}

export function recordAuditLog(db: Db, input: { actor: string; action: string; resource_type: string; resource_id?: string | null; severity?: string; details_json?: string }) {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO audit_logs(id,actor,action,resource_type,resource_id,severity,details_json,created_at)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(id, input.actor, input.action, input.resource_type, input.resource_id ?? null, input.severity ?? "info", input.details_json ?? "{}", now);
  return db.prepare(`SELECT * FROM audit_logs WHERE id = ?`).get(id) as AuditLog;
}

export function listAuditLogs(db: Db, limit = 100): AuditLog[] {
  return db.prepare(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?`).all(limit) as AuditLog[];
}
