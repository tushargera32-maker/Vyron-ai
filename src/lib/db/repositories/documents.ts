import "server-only";
import { randomUUID } from "node:crypto";
import type { Db } from "../connection";
import type { ChunkEmbedding, DocumentChunk, DocumentRecord } from "../types";

export function createDocument(db: Db, input: { project_id?: string | null; title: string; source_type: string; mime_type: string; storage_path: string; file_size_bytes: number; checksum_sha256?: string | null; status?: string; metadata_json?: string }) {
  const now = new Date().toISOString();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO documents(id,project_id,title,source_type,mime_type,storage_path,file_size_bytes,checksum_sha256,status,metadata_json,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(id, input.project_id ?? null, input.title, input.source_type, input.mime_type, input.storage_path, input.file_size_bytes, input.checksum_sha256 ?? null, input.status ?? "pending", input.metadata_json ?? "{}", now, now);
  return getDocument(db, id)!;
}

export function getDocument(db: Db, id: string): DocumentRecord | undefined {
  return db.prepare(`SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL`).get(id) as DocumentRecord | undefined;
}

export function listDocuments(db: Db, projectId?: string): DocumentRecord[] {
  if (projectId) return db.prepare(`SELECT * FROM documents WHERE project_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC`).all(projectId) as DocumentRecord[];
  return db.prepare(`SELECT * FROM documents WHERE deleted_at IS NULL ORDER BY updated_at DESC`).all() as DocumentRecord[];
}

export function updateDocument(db: Db, id: string, patch: Partial<Pick<DocumentRecord, "title" | "status" | "error_json" | "metadata_json" | "ingested_at" | "deleted_at">>) {
  const current = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(id) as DocumentRecord | undefined;
  if (!current) return undefined;
  const now = new Date().toISOString();
  const next = { ...current, ...patch, updated_at: now };
  db.prepare(`UPDATE documents SET title=?, status=?, error_json=?, metadata_json=?, ingested_at=?, deleted_at=?, updated_at=? WHERE id=?`).run(
    next.title, next.status, next.error_json, next.metadata_json, next.ingested_at, next.deleted_at, now, id
  );
  return getDocument(db, id) || (db.prepare(`SELECT * FROM documents WHERE id=?`).get(id) as DocumentRecord | undefined);
}

export function deleteDocument(db: Db, id: string) {
  const now = new Date().toISOString();
  db.prepare(`UPDATE documents SET deleted_at=?, updated_at=? WHERE id=?`).run(now, now, id);
  try {
    db.prepare(`DELETE FROM document_chunks_fts WHERE document_id = ?`).run(id);
    db.prepare(`DELETE FROM chunk_embeddings WHERE document_id = ?`).run(id);
  } catch {}
  return true;
}

function syncChunkFts(db: Db, chunkId: string, content: string, documentId: string, projectId: string | null) {
  try {
    const row = db.prepare(`SELECT rowid FROM document_chunks WHERE id = ?`).get(chunkId) as { rowid: number } | undefined;
    if (!row) return;
    db.prepare(`DELETE FROM document_chunks_fts WHERE rowid = ?`).run(row.rowid);
    db.prepare(`INSERT INTO document_chunks_fts(rowid, content, document_id, chunk_id, project_id) VALUES (?,?,?,?,?)`).run(row.rowid, content, documentId, chunkId, projectId || "");
  } catch {}
}

export function replaceDocumentChunks(db: Db, documentId: string, chunks: Array<{ content: string; content_raw?: string | null; token_estimate?: number | null; page_start?: number | null; page_end?: number | null; metadata_json?: string }>) {
  const doc = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(documentId) as DocumentRecord | undefined;
  if (!doc) throw new Error("Document not found");
  const now = new Date().toISOString();
  const del = db.transaction(() => {
    const existing = db.prepare(`SELECT id FROM document_chunks WHERE document_id = ?`).all(documentId) as { id: string }[];
    for (const e of existing) {
      try { const row = db.prepare(`SELECT rowid FROM document_chunks WHERE id=?`).get(e.id) as {rowid:number}|undefined; if(row) db.prepare(`DELETE FROM document_chunks_fts WHERE rowid=?`).run(row.rowid); } catch {}
    }
    db.prepare(`DELETE FROM chunk_embeddings WHERE document_id = ?`).run(documentId);
    db.prepare(`DELETE FROM document_chunks WHERE document_id = ?`).run(documentId);
  });
  del();
  const ins = db.transaction(() => {
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const id = randomUUID();
      db.prepare(`INSERT INTO document_chunks(id,document_id,chunk_index,content,content_raw,token_estimate,page_start,page_end,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
        id, documentId, i, c.content, c.content_raw ?? null, c.token_estimate ?? null, c.page_start ?? null, c.page_end ?? null, c.metadata_json ?? "{}", now
      );
      syncChunkFts(db, id, c.content, documentId, doc.project_id);
    }
  });
  ins();
  return listDocumentChunks(db, documentId);
}

export function listDocumentChunks(db: Db, documentId: string): DocumentChunk[] {
  return db.prepare(`SELECT * FROM document_chunks WHERE document_id = ? ORDER BY chunk_index ASC`).all(documentId) as DocumentChunk[];
}

export function saveChunkEmbeddings(db: Db, documentId: string, embeddings: Array<{ chunk_id: string; provider: string; model: string; dims: number; vector: number[] }>) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`INSERT OR REPLACE INTO chunk_embeddings(id,document_id,chunk_id,provider,model,dims,vector_json,created_at) VALUES (?,?,?,?,?,?,?,?)`);
  const tx = db.transaction(() => {
    for (const e of embeddings) {
      stmt.run(randomUUID(), documentId, e.chunk_id, e.provider, e.model, e.dims, JSON.stringify(e.vector), now);
    }
  });
  tx();
}

export function getChunkEmbeddings(db: Db, documentId?: string): ChunkEmbedding[] {
  if (documentId) return db.prepare(`SELECT * FROM chunk_embeddings WHERE document_id = ?`).all(documentId) as ChunkEmbedding[];
  return db.prepare(`SELECT * FROM chunk_embeddings`).all() as ChunkEmbedding[];
}

export function searchDocumentChunksFts(db: Db, query: string, opts?: { project_id?: string | null; limit?: number; document_id?: string }) {
  const q = query.trim();
  const limit = opts?.limit ?? 8;
  if (!q) return [] as (DocumentChunk & { rank: number; document_title?: string })[];
  try {
    const conds: string[] = ["d.deleted_at IS NULL"];
    const args: unknown[] = [q];
    if (opts?.project_id !== undefined) { conds.push("(d.project_id IS ? OR ? IS NULL)"); args.push(opts.project_id, opts.project_id); }
    if (opts?.document_id) { conds.push("c.document_id = ?"); args.push(opts.document_id); }
    args.push(limit);
    return db.prepare(
      `SELECT c.*, d.title as document_title, d.project_id as project_id, bm25(document_chunks_fts) as rank
       FROM document_chunks c
       JOIN document_chunks_fts f ON f.rowid = c.rowid
       JOIN documents d ON d.id = c.document_id
       WHERE document_chunks_fts MATCH ? AND ${conds.join(" AND ")}
       ORDER BY rank LIMIT ?`
    ).all(...args) as any[];
  } catch {
    const like = `%${q}%`;
    return db.prepare(`SELECT c.*, d.title as document_title FROM document_chunks c JOIN documents d ON d.id=c.document_id WHERE c.content LIKE ? AND d.deleted_at IS NULL LIMIT ?`).all(like, limit) as any[];
  }
}
