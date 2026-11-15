import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { openDatabase } from "@/lib/db/connection";
import { migrate, getAppliedMigrations } from "@/lib/db/migrator";
import { checkHealth } from "@/lib/db/health";
import { backupDatabase, restoreDatabase } from "@/lib/db/backup";
import * as projects from "@/lib/db/repositories/projects";
import * as conv from "@/lib/db/repositories/conversations";
import * as memories from "@/lib/db/repositories/memories";
import * as docs from "@/lib/db/repositories/documents";
import * as agents from "@/lib/db/repositories/agents";
import * as feedback from "@/lib/db/repositories/feedback";
import * as usage from "@/lib/db/repositories/usage";

const MIGRATIONS_DIR = path.join(process.cwd(), "src", "lib", "db", "migrations");

function tempDb() {
  const db = openDatabase(":memory:");
  migrate(db, MIGRATIONS_DIR);
  return db;
}

describe("migrations and health", () => {
  it("applies migrations and reports health", () => {
    const db = tempDb();
    try {
      const applied = getAppliedMigrations(db);
      expect(applied.length).toBeGreaterThanOrEqual(1);
      expect(applied[0].version).toBe("001");
      const health = checkHealth(db);
      expect(health.ok).toBe(true);
      expect(health.foreignKeys).toBe(1);
      expect(health.fts5).toBe(true);
      expect((health.migrations ?? 0)).toBeGreaterThanOrEqual(1);
    } finally {
      db.close();
    }
  });

  it("initializes local single-user profile idempotently and preserves existing data", () => {
    const db = tempDb();
    try {
      // simulate missing-user state: remove row, then ensure init creates it
      db.prepare(`DELETE FROM local_profile WHERE id='local-user'`).run();
      db.prepare(`INSERT OR IGNORE INTO local_profile(id,name,created_at,updated_at) VALUES ('local-user','Local User',strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'))`).run();
      const c = conv.createConversation(db, { title: "Existing" });
      conv.addMessage(db, { conversation_id: c.id, role: "user", content: "hello" });
      // idempotent re-init
      db.prepare(`INSERT OR IGNORE INTO local_profile(id,name,created_at,updated_at) VALUES ('local-user','Local User',strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'))`).run();
      const profile = db.prepare(`SELECT * FROM local_profile WHERE id='local-user'`).get() as any;
      expect(profile?.id).toBe("local-user");
      const again = conv.getConversation(db, c.id);
      expect(again?.title).toBe("Existing");
      expect(conv.listMessages(db, c.id).length).toBe(1);
    } finally {
      db.close();
    }
  });
});

describe("repositories (temp db)", () => {
  it("creates and lists projects", () => {
    const db = tempDb();
    try {
      const p = projects.createProject(db, { name: "Test Project", description: "desc" });
      expect(p.name).toBe("Test Project");
      expect(projects.getProject(db, p.id)?.id).toBe(p.id);
      expect(projects.listProjects(db).length).toBe(1);
    } finally { db.close(); }
  });

  it("creates conversation and messages", () => {
    const db = tempDb();
    try {
      const c = conv.createConversation(db, { title: "Hello" });
      const m = conv.addMessage(db, { conversation_id: c.id, role: "user", content: "hi" });
      expect(m.conversation_id).toBe(c.id);
      expect(conv.listMessages(db, c.id).map(x => x.content)).toEqual(["hi"]);
    } finally { db.close(); }
  });

  it("creates and approves memory", () => {
    const db = tempDb();
    try {
      const mem = memories.createMemory(db, { type: "semantic", content: "User likes dark mode", status: "proposed" });
      expect(mem.status).toBe("proposed");
      const approved = memories.approveMemory(db, mem.id);
      expect(approved?.status).toBe("approved");
      expect(approved?.approved_at).toBeTruthy();
      expect(memories.listMemories(db, { status: "approved" }).length).toBe(1);
    } finally { db.close(); }
  });

  it("creates documents, agents, feedback, usage and audit", () => {
    const db = tempDb();
    try {
      const d = docs.createDocument(db, { title: "Doc", source_type: "text", mime_type: "text/plain", storage_path: "data/uploads/doc.txt", file_size_bytes: 10 });
      expect(docs.getDocument(db, d.id)?.title).toBe("Doc");
      const a = agents.upsertAgent(db, { id: "personal", name: "Personal", system_prompt: "helpful" });
      expect(a.id).toBe("personal");
      expect(agents.getAgent(db, "personal")?.name).toBe("Personal");
      const f = feedback.createFeedback(db, { target_type: "message", target_id: "m1", rating: 1, label: "positive" });
      expect(feedback.listFeedbackForTarget(db, "message", "m1")[0].id).toBe(f.id);
      const u = usage.recordUsageEvent(db, { conversation_id: null, message_id: null, agent_run_id: null, provider_id: "mock", model_id: "m", token_input: 1, token_output: 2, latency_ms: 5, status: "success", error_json: null });
      expect(u.status).toBe("success");
      const al = usage.recordAuditLog(db, { actor: "user", action: "test.action", resource_type: "test" });
      expect(usage.listAuditLogs(db).some(x => x.id === al.id)).toBe(true);
    } finally { db.close(); }
  });
});

describe("backup and restore basics", () => {
  it("backs up and restores a file-based temp db", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aether-db-"));
    const dbPath = path.join(dir, "test.db");
    const backupDir = path.join(dir, "backups");
    const db = openDatabase(dbPath);
    try {
      migrate(db, MIGRATIONS_DIR);
      projects.createProject(db, { name: "BackupMe" });
      const res = await backupDatabase(db, backupDir);
      expect(res.ok).toBe(true);
      expect(res.path && fs.existsSync(res.path)).toBe(true);

      // mutate then restore
      projects.createProject(db, { name: "AfterBackup" });
      expect(projects.listProjects(db).length).toBe(2);
      db.close();
      const restoreRes = restoreDatabase(res.path!, dbPath);
      expect(restoreRes.ok).toBe(true);
      const db2 = openDatabase(dbPath);
      try {
        expect(projects.listProjects(db2).length).toBe(1);
        expect(projects.listProjects(db2)[0].name).toBe("BackupMe");
      } finally { db2.close(); }
    } finally {
      try { db.close(); } catch {}
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
