import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { openDatabase } from "@/lib/db/connection";
import { migrate } from "@/lib/db/migrator";
import { chunkText } from "@/lib/knowledge/chunk";
import { extractTextFromBuffer } from "@/lib/knowledge/extract";
import { localEmbed, cosineSimilarity } from "@/lib/knowledge/embedding";
import * as docsRepo from "@/lib/db/repositories/documents";

const MIGRATIONS_DIR = path.join(process.cwd(), "src", "lib", "db", "migrations");
function db() { const d = openDatabase(":memory:"); migrate(d, MIGRATIONS_DIR); return d; }

describe("knowledge processing", () => {
  it("extracts and chunks text/markdown", async () => {
    const txt = await extractTextFromBuffer(Buffer.from("Hello world\n\nSecond paragraph"), "text", "text/plain");
    expect(txt.text).toContain("Hello world");
    const md = await extractTextFromBuffer(Buffer.from("# Title\n\nBody"), "markdown", "text/markdown");
    expect(md.text).toContain("Title");
    const chunks = chunkText("paragraph one content\n\nparagraph two content\n\nparagraph three content", { maxChars: 30, overlap: 0 });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("handles unsupported/empty safely", async () => {
    await expect(extractTextFromBuffer(Buffer.from("x"), "exe", "application/x-msdownload")).rejects.toThrow();
    const chunks = chunkText("   \n\n  ");
    expect(chunks.length).toBe(0);
  });

  it("local embedding fallback produces similarity", () => {
    const a = localEmbed("typescript sqlite local database");
    const b = localEmbed("local sqlite database with typescript");
    const c = localEmbed("banana smoothie recipe");
    expect(cosineSimilarity(a,b)).toBeGreaterThan(cosineSimilarity(a,c));
  });

  it("stores chunks and searches via FTS", () => {
    const d = db();
    try {
      const doc = docsRepo.createDocument(d, { title: "Doc", source_type: "text", mime_type: "text/plain", storage_path: "data/uploads/x.txt", file_size_bytes: 10, status: "indexed" });
      docsRepo.replaceDocumentChunks(d, doc.id, [{ content: "Aether uses SQLite and FTS5 for local search." }, { content: "Memories can be approved by the user." }]);
      const res = docsRepo.searchDocumentChunksFts(d, "SQLite FTS5", { limit: 5 });
      expect(res.length).toBeGreaterThan(0);
      expect(res[0].content).toContain("SQLite");
    } finally { d.close(); }
  });
});
