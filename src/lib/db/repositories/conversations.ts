import "server-only";
import { randomUUID } from "node:crypto";
import type { Db } from "../connection";
import type { Conversation, Message } from "../types";

function hasColumn(db: Db, table: string, col: string) {
  try {
    const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    return rows.some((r) => r.name === col);
  } catch { return false; }
}

export function createConversation(db: Db, input: { project_id?: string | null; agent_id?: string | null; title?: string | null; system_prompt?: string | null; model_provider?: string | null; model_id?: string | null; metadata_json?: string }) {
  const now = new Date().toISOString();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO conversations(id,project_id,agent_id,title,system_prompt,model_provider,model_id,metadata_json,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(id, input.project_id ?? null, input.agent_id ?? null, input.title ?? (input as any).title ?? "New conversation", input.system_prompt ?? null, input.model_provider ?? null, input.model_id ?? null, input.metadata_json ?? "{}", now, now);
  return getConversation(db, id)!;
}

export function getConversation(db: Db, id: string): Conversation | undefined {
  if (hasColumn(db, "conversations", "deleted_at")) {
    return db.prepare(`SELECT * FROM conversations WHERE id = ? AND deleted_at IS NULL`).get(id) as Conversation | undefined;
  }
  return db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(id) as Conversation | undefined;
}

export function listConversations(db: Db, projectId?: string): Conversation[] {
  const del = hasColumn(db, "conversations", "deleted_at") ? "AND deleted_at IS NULL" : "";
  if (projectId) return db.prepare(`SELECT * FROM conversations WHERE project_id = ? ${del} ORDER BY updated_at DESC`).all(projectId) as Conversation[];
  return db.prepare(`SELECT * FROM conversations WHERE 1=1 ${del} ORDER BY updated_at DESC`).all() as Conversation[];
}

export function updateConversation(db: Db, id: string, patch: { title?: string | null; system_prompt?: string | null; model_provider?: string | null; model_id?: string | null; metadata_json?: string | null; archived_at?: string | null }) {
  const current = getConversation(db, id);
  if (!current) return undefined;
  const now = new Date().toISOString();
  const next = {
    title: patch.title !== undefined ? patch.title : current.title,
    system_prompt: patch.system_prompt !== undefined ? patch.system_prompt : current.system_prompt,
    model_provider: patch.model_provider !== undefined ? patch.model_provider : current.model_provider,
    model_id: patch.model_id !== undefined ? patch.model_id : current.model_id,
    metadata_json: patch.metadata_json !== undefined ? patch.metadata_json : current.metadata_json,
    archived_at: patch.archived_at !== undefined ? patch.archived_at : current.archived_at,
  };
  db.prepare(`UPDATE conversations SET title=?, system_prompt=?, model_provider=?, model_id=?, metadata_json=?, archived_at=?, updated_at=? WHERE id=?`).run(
    next.title, next.system_prompt, next.model_provider, next.model_id, next.metadata_json, next.archived_at, now, id
  );
  return getConversation(db, id);
}

export function deleteConversation(db: Db, id: string) {
  const now = new Date().toISOString();
  if (hasColumn(db, "conversations", "deleted_at")) {
    const info = db.prepare(`UPDATE conversations SET deleted_at=?, updated_at=? WHERE id=? AND deleted_at IS NULL`).run(now, now, id);
    return info.changes > 0;
  }
  const info = db.prepare(`DELETE FROM conversations WHERE id = ?`).run(id);
  return info.changes > 0;
}

export function searchConversations(db: Db, query: string, limit = 20): Conversation[] {
  const q = query.trim();
  if (!q) return listConversations(db).slice(0, limit);
  const del = hasColumn(db, "conversations", "deleted_at") ? "AND c.deleted_at IS NULL" : "";
  // try FTS via messages
  try {
    const rows = db.prepare(
      `SELECT DISTINCT c.* FROM conversations c
       JOIN messages m ON m.conversation_id = c.id
       JOIN messages_fts f ON f.rowid = m.rowid
       WHERE messages_fts MATCH ? ${del}
       ORDER BY c.updated_at DESC LIMIT ?`
    ).all(q, limit) as Conversation[];
    if (rows.length) return rows;
  } catch {}
  return db.prepare(`SELECT * FROM conversations c WHERE (c.title LIKE ? OR EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id=c.id AND m.content LIKE ?)) ${del} ORDER BY c.updated_at DESC LIMIT ?`).all(`%${q}%`, `%${q}%`, limit) as Conversation[];
}

function syncMessageFts(db: Db, messageId: string, content: string, conversationId: string) {
  try {
    const row = db.prepare(`SELECT rowid FROM messages WHERE id = ?`).get(messageId) as { rowid: number } | undefined;
    if (!row) return;
    db.prepare(`DELETE FROM messages_fts WHERE rowid = ?`).run(row.rowid);
    db.prepare(`INSERT INTO messages_fts(rowid, content, conversation_id, message_id) VALUES (?,?,?,?)`).run(row.rowid, content, conversationId, messageId);
  } catch {}
}

export function addMessage(db: Db, input: { conversation_id: string; role: string; content: string; content_json?: string | null; parent_message_id?: string | null; status?: string; token_input?: number | null; token_output?: number | null; error_json?: string | null }) {
  const now = new Date().toISOString();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO messages(id,conversation_id,role,content,content_json,parent_message_id,status,error_json,token_input,token_output,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(id, input.conversation_id, input.role, input.content, input.content_json ?? null, input.parent_message_id ?? null, input.status ?? "complete", input.error_json ?? null, input.token_input ?? null, input.token_output ?? null, now);
  db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(now, input.conversation_id);
  syncMessageFts(db, id, input.content, input.conversation_id);
  return getMessage(db, id)!;
}

export function updateMessage(db: Db, id: string, patch: { content?: string; status?: string; error_json?: string | null; token_input?: number | null; token_output?: number | null; content_json?: string | null }) {
  const current = getMessage(db, id);
  if (!current) return undefined;
  const next = {
    content: patch.content ?? current.content,
    status: patch.status ?? current.status,
    error_json: patch.error_json !== undefined ? patch.error_json : current.error_json,
    token_input: patch.token_input !== undefined ? patch.token_input : current.token_input,
    token_output: patch.token_output !== undefined ? patch.token_output : current.token_output,
    content_json: patch.content_json !== undefined ? patch.content_json : current.content_json,
  };
  db.prepare(`UPDATE messages SET content=?, status=?, error_json=?, token_input=?, token_output=?, content_json=? WHERE id=?`).run(next.content, next.status, next.error_json, next.token_input, next.token_output, next.content_json, id);
  if (patch.content !== undefined) syncMessageFts(db, id, next.content, current.conversation_id);
  return getMessage(db, id);
}

export function getMessage(db: Db, id: string): Message | undefined {
  return db.prepare(`SELECT * FROM messages WHERE id = ?`).get(id) as Message | undefined;
}

export function listMessages(db: Db, conversationId: string): Message[] {
  return db.prepare(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`).all(conversationId) as Message[];
}
