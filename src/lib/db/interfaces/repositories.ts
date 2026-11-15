import type { Db } from "../connection";
import type { Agent, AuditLog, Conversation, DocumentRecord, Feedback, Memory, Message, Project, UsageEvent } from "../types";

export interface ProjectRepository {
  create(db: Db, input: { name: string; description?: string | null; settings_json?: string }): Project;
  get(db: Db, id: string): Project | undefined;
  list(db: Db): Project[];
  update(db: Db, id: string, patch: Partial<Pick<Project, "name" | "description" | "settings_json" | "archived_at">>): Project | undefined;
  delete(db: Db, id: string): boolean;
}

export interface ConversationRepository {
  create(db: Db, input: { project_id?: string | null; agent_id?: string | null; title?: string | null }): Conversation;
  get(db: Db, id: string): Conversation | undefined;
  list(db: Db, projectId?: string): Conversation[];
  addMessage(db: Db, input: { conversation_id: string; role: string; content: string }): Message;
  listMessages(db: Db, conversationId: string): Message[];
}

export interface MemoryRepository {
  create(db: Db, input: { type: string; content: string; status?: string; project_id?: string | null }): Memory;
  get(db: Db, id: string): Memory | undefined;
  list(db: Db, opts?: { project_id?: string | null; status?: string; type?: string }): Memory[];
  approve(db: Db, id: string): Memory | undefined;
}

export interface DocumentRepository {
  create(db: Db, input: { title: string; source_type: string; mime_type: string; storage_path: string; file_size_bytes: number }): DocumentRecord;
  get(db: Db, id: string): DocumentRecord | undefined;
  list(db: Db, projectId?: string): DocumentRecord[];
}

export interface AgentRepository {
  upsert(db: Db, input: { id: string; name: string; system_prompt: string }): Agent;
  get(db: Db, id: string): Agent | undefined;
  list(db: Db): Agent[];
}

export interface FeedbackRepository {
  create(db: Db, input: { target_type: string; target_id: string; rating?: number | null }): Feedback;
  listForTarget(db: Db, targetType: string, targetId: string): Feedback[];
}

export interface UsageAuditRepository {
  recordUsage(db: Db, input: Omit<UsageEvent, "id" | "created_at">): UsageEvent;
  recordAudit(db: Db, input: { actor: string; action: string; resource_type: string }): AuditLog;
  listAuditLogs(db: Db, limit?: number): AuditLog[];
}
