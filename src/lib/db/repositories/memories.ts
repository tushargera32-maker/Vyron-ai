import "server-only";
import { randomUUID, createHash } from "node:crypto";
import type { Db } from "../connection";
import type { Memory } from "../types";

function syncMemoryFts(db: Db, memoryId: string, content: string, summary: string | null, projectId: string | null, type: string) {
  try {
    const row = db.prepare(`SELECT rowid FROM memories WHERE id = ?`).get(memoryId) as { rowid: number } | undefined;
    if (!row) return;
    db.prepare(`DELETE FROM memories_fts WHERE rowid = ?`).run(row.rowid);
    db.prepare(`INSERT INTO memories_fts(rowid, content, summary, memory_id, project_id, type) VALUES (?,?,?,?,?,?)`).run(row.rowid, content, summary || "", memoryId, projectId || "", type);
  } catch {}
}

function removeMemoryFts(db: Db, memoryId: string) {
  try {
    const row = db.prepare(`SELECT rowid FROM memories WHERE id = ?`).get(memoryId) as { rowid: number } | undefined;
    if (row) db.prepare(`DELETE FROM memories_fts WHERE rowid = ?`).run(row.rowid);
  } catch {}
}

export function computeDedupeHash(type: string, content: string) {
  const norm = `${type}:${content}`.toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha256").update(norm).digest("hex");
}

function logEvent(db: Db, memoryId: string, eventType: string, actor: string, details: unknown = {}) {
  db.prepare(`INSERT INTO memory_events(id,memory_id,event_type,actor,details_json,created_at) VALUES (?,?,?,?,?,?)`).run(randomUUID(), memoryId, eventType, actor, JSON.stringify(details ?? {}), new Date().toISOString());
}

export function createMemory(db: Db, input: { project_id?: string | null; type: string; content: string; summary?: string | null; importance?: number; confidence?: number; status?: string; source_conversation_id?: string | null; source_message_id?: string | null; dedupe_hash?: string | null; metadata_json?: string; actor?: string }) {
  const now = new Date().toISOString();
  const id = randomUUID();
  const status = input.status ?? "proposed";
  const dedupe = input.dedupe_hash || computeDedupeHash(input.type, input.content);
  const approvedAt = status === "approved" ? now : null;
  db.prepare(
    `INSERT INTO memories(id,project_id,type,content,summary,importance,confidence,status,source_conversation_id,source_message_id,dedupe_hash,metadata_json,approved_at,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(id, input.project_id ?? null, input.type, input.content, input.summary ?? null, input.importance ?? 0.5, input.confidence ?? 0.5, status, input.source_conversation_id ?? null, input.source_message_id ?? null, dedupe, input.metadata_json ?? "{}", approvedAt, now, now);
  logEvent(db, id, status === "approved" ? "approved" : "proposed", input.actor || "system", { status, explicit: (input.actor === "user") });
  const mem = getMemory(db, id)!;
  if (mem.status === "approved") syncMemoryFts(db, id, mem.content, mem.summary, mem.project_id, mem.type);
  return mem;
}

export function getMemory(db: Db, id: string): Memory | undefined {
  return db.prepare(`SELECT * FROM memories WHERE id = ?`).get(id) as Memory | undefined;
}

export function listMemories(db: Db, opts?: { project_id?: string | null; status?: string; type?: string; includeDeleted?: boolean }): Memory[] {
  const conds: string[] = [];
  const args: unknown[] = [];
  if (!opts?.includeDeleted) conds.push("deleted_at IS NULL");
  if (opts?.project_id !== undefined) { conds.push("(project_id IS ? OR ? IS NULL)"); args.push(opts.project_id, opts.project_id); }
  if (opts?.status) { conds.push("status = ?"); args.push(opts.status); }
  if (opts?.type) { conds.push("type = ?"); args.push(opts.type); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  return db.prepare(`SELECT * FROM memories ${where} ORDER BY importance DESC, updated_at DESC`).all(...args) as Memory[];
}

export function updateMemory(db: Db, id: string, patch: Partial<Pick<Memory, "content" | "summary" | "importance" | "confidence" | "status" | "metadata_json" | "type" | "project_id">>, actor = "user") {
  const current = getMemory(db, id);
  if (!current || current.deleted_at) return undefined;
  const now = new Date().toISOString();
  const next = {
    content: patch.content ?? current.content,
    summary: patch.summary !== undefined ? patch.summary : current.summary,
    importance: patch.importance ?? current.importance,
    confidence: patch.confidence ?? current.confidence,
    status: patch.status ?? current.status,
    metadata_json: patch.metadata_json ?? current.metadata_json,
    type: patch.type ?? current.type,
    project_id: patch.project_id !== undefined ? patch.project_id : current.project_id,
  };
  const dedupe = computeDedupeHash(next.type, next.content);
  db.prepare(`UPDATE memories SET content=?, summary=?, importance=?, confidence=?, status=?, metadata_json=?, type=?, project_id=?, dedupe_hash=?, updated_at=? WHERE id=?`).run(
    next.content, next.summary, next.importance, next.confidence, next.status, next.metadata_json, next.type, next.project_id, dedupe, now, id
  );
  logEvent(db, id, "edited", actor, { patch: Object.keys(patch) });
  const updated = getMemory(db, id)!;
  if (updated.status === "approved" && !updated.deleted_at) syncMemoryFts(db, id, updated.content, updated.summary, updated.project_id, updated.type);
  else removeMemoryFts(db, id);
  return updated;
}

export function approveMemory(db: Db, id: string, actor = "user") {
  const now = new Date().toISOString();
  db.prepare(`UPDATE memories SET status='approved', approved_at=?, updated_at=? WHERE id=?`).run(now, now, id);
  logEvent(db, id, "approved", actor, {});
  const mem = getMemory(db, id)!;
  syncMemoryFts(db, id, mem.content, mem.summary, mem.project_id, mem.type);
  return mem;
}

export function rejectMemory(db: Db, id: string, actor = "user") {
  const now = new Date().toISOString();
  db.prepare(`UPDATE memories SET status='rejected', updated_at=? WHERE id=?`).run(now, id);
  logEvent(db, id, "rejected", actor, {});
  removeMemoryFts(db, id);
  return getMemory(db, id);
}

export function archiveMemory(db: Db, id: string, actor = "user") {
  const now = new Date().toISOString();
  db.prepare(`UPDATE memories SET status='archived', updated_at=? WHERE id=?`).run(now, id);
  logEvent(db, id, "archived", actor, {});
  removeMemoryFts(db, id);
  return getMemory(db, id);
}

export function deleteMemory(db: Db, id: string, actor = "user") {
  const now = new Date().toISOString();
  db.prepare(`UPDATE memories SET deleted_at=?, updated_at=? WHERE id=?`).run(now, now, id);
  logEvent(db, id, "deleted", actor, {});
  removeMemoryFts(db, id);
  return getMemory(db, id);
}

export function findPotentialDuplicates(db: Db, input: { type: string; content: string; excludeId?: string }) {
  const hash = computeDedupeHash(input.type, input.content);
  const rows = db.prepare(`SELECT * FROM memories WHERE dedupe_hash = ? AND deleted_at IS NULL ${input.excludeId ? "AND id != ?" : ""}`).all(...(input.excludeId ? [hash, input.excludeId] : [hash])) as Memory[];
  return rows;
}

function sanitizeFtsQuery(q: string) {
  const tokens = q.toLowerCase().match(/[a-z0-9_]+/g) || [];
  const uniq = Array.from(new Set(tokens)).filter(t => t.length > 1).slice(0, 12);
  if (!uniq.length) return "";
  return uniq.map(t => `"${t}"`).join(" OR ");
}

export function searchMemories(db: Db, query: string, opts?: { project_id?: string | null; status?: string; limit?: number }) {
  const q = query.trim();
  const limit = opts?.limit ?? 10;
  const status = opts?.status ?? "approved";
  const base = listMemories(db, { project_id: opts?.project_id, status });
  if (!q) return base.slice(0, limit);
  const ftsQ = sanitizeFtsQuery(q);
  let ftsResults: Memory[] = [];
  if (ftsQ) {
    try {
      const conds: string[] = ["m.deleted_at IS NULL", "m.status = ?"];
      const args: unknown[] = [ftsQ, status];
      if (opts?.project_id !== undefined) { conds.push("(m.project_id IS ? OR ? IS NULL)"); args.push(opts.project_id, opts.project_id); }
      args.push(limit);
      ftsResults = db.prepare(
        `SELECT m.*, bm25(memories_fts) as rank FROM memories m JOIN memories_fts f ON f.rowid = m.rowid WHERE memories_fts MATCH ? AND ${conds.join(" AND ")} ORDER BY rank LIMIT ?`
      ).all(...args) as Memory[];
    } catch {}
  }
  // fallback + augmentation: token/substring match over approved memories
  const ql = q.toLowerCase();
  const tokens = ql.match(/[a-z0-9_]+/g) || [];
  const scored = base.map(m => {
    const text = `${m.content} ${m.summary || ""} ${m.metadata_json || ""}`.toLowerCase();
    let score = 0;
    if (text.includes(ql)) score += 5;
    for (const t of tokens) if (t.length > 1 && text.includes(t)) score += 1;
    // boost core profile/identity memories for personal queries
    if (/\b(who am i|what do you know about me|my profile|about me|my name|tell me about me)\b/i.test(q) && /profile|identity|name|about|user/i.test(text)) score += 4;
    if (m.importance >= 0.8) score += 0.5;
    return { m, score };
  }).filter(x => x.score > 0).sort((a,b)=> b.score - a.score || b.m.importance - a.m.importance).map(x=>x.m);
  const byId = new Map<string, Memory>();
  for (const m of [...ftsResults, ...scored]) if (!byId.has(m.id)) byId.set(m.id, m);
  // if asking about "me/profile" ensure we include top approved semantic/profile memories even if weak lexical match
  if (/\b(who am i|what do you know about me|my profile|about me|tell me about me)\b/i.test(q)) {
    const core = base.filter(m => (m.type === 'semantic' || m.type === 'episodic') && (m.importance >= 0.7 || /profile|identity|name|about/i.test(`${m.content} ${m.summary} ${m.metadata_json}`))).slice(0, 3);
    for (const m of core) if (!byId.has(m.id)) byId.set(m.id, m);
  }
  return Array.from(byId.values()).slice(0, limit);
}

export function recordRetrievalEvents(db: Db, memoryIds: string[], conversationId: string | null, query: string, scores?: Record<string, number>) {
  const now = new Date().toISOString();
  const hasTable = (() => { try { db.prepare(`SELECT 1 FROM memory_retrieval_events LIMIT 1`).get(); return true; } catch { return false; } })();
  if (!hasTable) return;
  const stmt = db.prepare(`INSERT INTO memory_retrieval_events(id,memory_id,conversation_id,query,score,created_at) VALUES (?,?,?,?,?,?)`);
  for (const id of memoryIds) stmt.run(randomUUID(), id, conversationId, query, scores?.[id] ?? null, now);
}
