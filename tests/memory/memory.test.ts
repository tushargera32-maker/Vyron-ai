import path from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { openDatabase } from "@/lib/db/connection";
import { migrate } from "@/lib/db/migrator";
import { createMemory, listMemories, approveMemory, rejectMemory, updateMemory, deleteMemory, findPotentialDuplicates, searchMemories } from "@/lib/db/repositories/memories";
import { extractCandidateMemoriesFromText } from "@/lib/memory/service";

const MIGRATIONS_DIR = path.join(process.cwd(), "src", "lib", "db", "migrations");
function db() { const d = openDatabase(":memory:"); migrate(d, MIGRATIONS_DIR); return d; }

describe("memory repo", () => {
  it("creates, approves, rejects, edits, deletes with dedupe and events", () => {
    const d = db();
    try {
      const m = createMemory(d, { type: "semantic", content: "User prefers dark mode", status: "proposed" });
      expect(m.status).toBe("proposed");
      const dupes = findPotentialDuplicates(d, { type: "semantic", content: "User   prefers dark mode" });
      expect(dupes.length).toBe(1);
      const approved = approveMemory(d, m.id, "user");
      expect(approved?.status).toBe("approved");
      const edited = updateMemory(d, m.id, { content: "User prefers dark themes" }, "user");
      expect(edited?.content).toContain("dark themes");
      const rejected = rejectMemory(d, m.id, "user");
      expect(rejected?.status).toBe("rejected");
      const deleted = deleteMemory(d, m.id, "user");
      expect(deleted?.deleted_at).toBeTruthy();
      expect(listMemories(d, { status: "rejected", includeDeleted: false }).length).toBe(0);
      const events = d.prepare(`SELECT COUNT(*) as c FROM memory_events WHERE memory_id=?`).get(m.id) as any;
      expect(Number(events.c)).toBeGreaterThanOrEqual(4);
    } finally { d.close(); }
  });

  it("searches approved memories via FTS", () => {
    const d = db();
    try {
      const m = createMemory(d, { type: "semantic", content: "User likes TypeScript and SQLite", status: "approved" });
      approveMemory(d, m.id, "user");
      const res = searchMemories(d, "TypeScript", { status: "approved", limit: 5 });
      expect(res.some(r => r.id === m.id)).toBe(true);
    } finally { d.close(); }
  });

  it("extracts deterministic candidate memories", () => {
    const c = extractCandidateMemoriesFromText({ text: "My name is Alex and I like dark mode. Please always respond concisely." });
    expect(c.length).toBeGreaterThan(0);
    expect(c.some(x => x.type === "semantic")).toBe(true);
  });
});
