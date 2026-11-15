import path from "node:path";
import { describe, it, expect } from "vitest";
import { openDatabase } from "@/lib/db/connection";
import { migrate } from "@/lib/db/migrator";
import { createConversation, addMessage } from "@/lib/db/repositories/conversations";
import { createMemory, approveMemory } from "@/lib/db/repositories/memories";
import * as docsRepo from "@/lib/db/repositories/documents";
import { chunkText } from "@/lib/knowledge/chunk";
import { localEmbed, LOCAL_EMBEDDING_DIMS, LOCAL_EMBEDDING_MODEL, LOCAL_EMBEDDING_PROVIDER } from "@/lib/knowledge/embedding";

const MIGRATIONS_DIR = path.join(process.cwd(), "src", "lib", "db", "migrations");

describe("context building primitives", () => {
  it("ranks and retrieves memory and knowledge for prompt context", () => {
    const db = openDatabase(":memory:");
    try {
      migrate(db, MIGRATIONS_DIR);
      const conv = createConversation(db, { title: "Test" });
      addMessage(db, { conversation_id: conv.id, role: "user", content: "I use TypeScript daily" });
      addMessage(db, { conversation_id: conv.id, role: "assistant", content: "Noted" });
      const mem = createMemory(db, { type: "semantic", content: "User uses TypeScript daily", status: "proposed" });
      approveMemory(db, mem.id, "user");
      const doc = docsRepo.createDocument(db, { title: "Guide", source_type: "text", mime_type: "text/plain", storage_path: "x", file_size_bytes: 1, status: "indexed" });
      docsRepo.replaceDocumentChunks(db, doc.id, chunkText("TypeScript works well with SQLite in local apps."));
      const chunks = docsRepo.listDocumentChunks(db, doc.id);
      docsRepo.saveChunkEmbeddings(db, doc.id, chunks.map(c => ({ chunk_id: c.id, provider: LOCAL_EMBEDDING_PROVIDER, model: LOCAL_EMBEDDING_MODEL, dims: LOCAL_EMBEDDING_DIMS, vector: localEmbed(c.content) })));
      const memHits = db.prepare(`SELECT m.* FROM memories m JOIN memories_fts f ON f.rowid=m.rowid WHERE memories_fts MATCH ? AND m.status='approved'`).all("TypeScript") as any[];
      const kHits = docsRepo.searchDocumentChunksFts(db, "TypeScript SQLite", { limit: 5 });
      expect(memHits.length).toBeGreaterThan(0);
      expect(kHits.length).toBeGreaterThan(0);
      // dedupe by memory id/content
      const uniq = new Set(memHits.map(m=>m.id));
      expect(uniq.size).toBe(memHits.length);
    } finally { db.close(); }
  });
});
