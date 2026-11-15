import "server-only";
import { randomUUID } from "node:crypto";
import type { Db } from "../connection";
import type { Feedback } from "../types";

export function createFeedback(db: Db, input: { target_type: string; target_id: string; rating?: number | null; label?: string | null; comment?: string | null; correction_text?: string | null; metadata_json?: string }) {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO feedback(id,target_type,target_id,rating,label,comment,correction_text,metadata_json,created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(id, input.target_type, input.target_id, input.rating ?? null, input.label ?? null, input.comment ?? null, input.correction_text ?? null, input.metadata_json ?? "{}", now);
  return getFeedback(db, id)!;
}

export function getFeedback(db: Db, id: string): Feedback | undefined {
  return db.prepare(`SELECT * FROM feedback WHERE id = ?`).get(id) as Feedback | undefined;
}

export function listFeedbackForTarget(db: Db, targetType: string, targetId: string): Feedback[] {
  return db.prepare(`SELECT * FROM feedback WHERE target_type = ? AND target_id = ? ORDER BY created_at DESC`).all(targetType, targetId) as Feedback[];
}
