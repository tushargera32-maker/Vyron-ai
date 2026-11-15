import "server-only";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ensureDbReady } from "@/lib/db";
import * as docsRepo from "@/lib/db/repositories/documents";
import { readManagedFile, saveUpload, deleteManagedFile } from "@/lib/storage/files";
import { extractTextFromBuffer } from "./extract";
import { chunkText } from "./chunk";
import { localEmbed, LOCAL_EMBEDDING_DIMS, LOCAL_EMBEDDING_MODEL, LOCAL_EMBEDDING_PROVIDER, cosineSimilarity } from "./embedding";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED = new Map<string, string>([
  [".pdf", "pdf"], [".txt", "text"], [".md", "markdown"], [".markdown", "markdown"], [".docx", "docx"],
]);

function detectSourceType(filename: string, mime: string) {
  const ext = path.extname(filename).toLowerCase();
  const byExt = ALLOWED.get(ext);
  if (byExt) return byExt;
  if (mime === "application/pdf") return "pdf";
  if (mime === "text/plain") return "text";
  if (mime === "text/markdown" || mime === "text/x-markdown") return "markdown";
  if (mime.includes("wordprocessingml")) return "docx";
  return null;
}

export async function ingestDocument(input: { file: File | { name: string; type: string; buffer: Buffer; size: number }; project_id?: string | null; reprocessOf?: string | null }) {
  const db = ensureDbReady();
  const name = "name" in input.file ? input.file.name : (input.file as File).name;
  const type = "type" in input.file ? input.file.type : (input.file as File).type;
  const size = "size" in input.file ? input.file.size : (input.file as File).size;
  if (size > MAX_UPLOAD_BYTES) throw new Error(`File too large (max ${MAX_UPLOAD_BYTES} bytes)`);
  const sourceType = detectSourceType(name, type || "");
  if (!sourceType) throw new Error("Unsupported file type. Allowed: PDF, TXT, Markdown, DOCX");
  const buffer = Buffer.isBuffer((input.file as any).buffer) ? (input.file as any).buffer : Buffer.from(await (input.file as File).arrayBuffer());
  if (!buffer.length) throw new Error("Empty file");
  const saved = await saveUpload(buffer, name);
  const doc = docsRepo.createDocument(db, {
    project_id: input.project_id ?? null,
    title: name,
    source_type: sourceType,
    mime_type: type || "application/octet-stream",
    storage_path: saved.relativePath,
    file_size_bytes: size,
    status: "processing",
    metadata_json: JSON.stringify({ originalName: name }),
  });
  try {
    const extracted = await extractTextFromBuffer(buffer, sourceType, type || "");
    const text = (extracted.text || "").trim();
    if (!text) throw new Error("No extractable text found");
    const chunks = chunkText(text);
    if (!chunks.length) throw new Error("No content chunks produced");
    docsRepo.replaceDocumentChunks(db, doc.id, chunks);
    // local embedding fallback (always available)
    const storedChunks = docsRepo.listDocumentChunks(db, doc.id);
    const embeddings = storedChunks.map((c) => ({ chunk_id: c.id, provider: LOCAL_EMBEDDING_PROVIDER, model: LOCAL_EMBEDDING_MODEL, dims: LOCAL_EMBEDDING_DIMS, vector: localEmbed(c.content) }));
    docsRepo.saveChunkEmbeddings(db, doc.id, embeddings);
    const updated = docsRepo.updateDocument(db, doc.id, { status: "indexed", ingested_at: new Date().toISOString(), error_json: null, metadata_json: JSON.stringify({ ...(extracted.meta || {}), originalName: name, chunks: chunks.length, embedding: "local-fallback" }) });
    return { document: updated, chunks: storedChunks.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    docsRepo.updateDocument(db, doc.id, { status: "failed", error_json: JSON.stringify({ message: msg }) });
    throw e;
  }
}

export function listKnowledge(projectId?: string) {
  const db = ensureDbReady();
  return docsRepo.listDocuments(db, projectId);
}

export function getKnowledgeDocument(id: string) {
  const db = ensureDbReady();
  const doc = docsRepo.getDocument(db, id);
  if (!doc) return null;
  const chunks = docsRepo.listDocumentChunks(db, id);
  return { document: doc, chunks };
}

export async function deleteKnowledgeDocument(id: string) {
  const db = ensureDbReady();
  const doc = docsRepo.getDocument(db, id) || (db.prepare(`SELECT * FROM documents WHERE id=?`).get(id) as any);
  if (!doc) return false;
  docsRepo.deleteDocument(db, id);
  if (doc.storage_path) await deleteManagedFile(doc.storage_path);
  return true;
}

export async function reprocessDocument(id: string) {
  const db = ensureDbReady();
  const doc = docsRepo.getDocument(db, id) || (db.prepare(`SELECT * FROM documents WHERE id=?`).get(id) as any);
  if (!doc) throw new Error("Document not found");
  const buffer = await readManagedFile(doc.storage_path);
  docsRepo.updateDocument(db, id, { status: "processing", error_json: null });
  const extracted = await extractTextFromBuffer(buffer, doc.source_type, doc.mime_type);
  const text = (extracted.text || "").trim();
  if (!text) throw new Error("No extractable text found");
  const chunks = chunkText(text);
  docsRepo.replaceDocumentChunks(db, id, chunks);
  const storedChunks = docsRepo.listDocumentChunks(db, id);
  const embeddings = storedChunks.map((c) => ({ chunk_id: c.id, provider: LOCAL_EMBEDDING_PROVIDER, model: LOCAL_EMBEDDING_MODEL, dims: LOCAL_EMBEDDING_DIMS, vector: localEmbed(c.content) }));
  docsRepo.saveChunkEmbeddings(db, id, embeddings);
  docsRepo.updateDocument(db, id, { status: "indexed", ingested_at: new Date().toISOString(), metadata_json: JSON.stringify({ originalName: doc.title, chunks: chunks.length, embedding: "local-fallback" }) });
  return { ok: true };
}

export function searchKnowledge(query: string, opts?: { project_id?: string | null; limit?: number; hybrid?: boolean }) {
  const db = ensureDbReady();
  const limit = opts?.limit ?? 6;
  const keyword = docsRepo.searchDocumentChunksFts(db, query, { project_id: opts?.project_id, limit: Math.max(limit, 8) }) as any[];
  // semantic via local embeddings
  let semantic: any[] = [];
  try {
    const qv = localEmbed(query);
    const embRows = db.prepare(`SELECT e.*, c.content, c.chunk_index, c.document_id, d.title as document_title, d.project_id FROM chunk_embeddings e JOIN document_chunks c ON c.id=e.chunk_id JOIN documents d ON d.id=e.document_id WHERE d.deleted_at IS NULL`).all() as any[];
    const scored = embRows.map((r) => {
      let vec: number[] = [];
      try { vec = JSON.parse(r.vector_json); } catch { vec = []; }
      const score = cosineSimilarity(qv, vec);
      return { ...r, semantic_score: score };
    }).filter(r => opts?.project_id === undefined || r.project_id === opts.project_id || opts?.project_id === null)
      .sort((a,b)=>b.semantic_score-a.semantic_score).slice(0, Math.max(limit,8));
    semantic = scored;
  } catch {}
  // hybrid merge
  const map = new Map<string, any>();
  const add = (item: any, kScore: number | null, sScore: number | null) => {
    const key = item.chunk_id || item.id;
    const prev = map.get(key) || { chunk_id: item.chunk_id || item.id, document_id: item.document_id, content: item.content, document_title: item.document_title, chunk_index: item.chunk_index, keyword_score: null, semantic_score: null };
    if (kScore != null) prev.keyword_score = kScore;
    if (sScore != null) prev.semantic_score = sScore;
    prev.score = (prev.keyword_score != null ? 1/(1+Math.abs(prev.keyword_score)) : 0) * 0.5 + (prev.semantic_score ?? 0) * 0.5;
    map.set(key, prev);
  };
  for (const k of keyword) add(k, typeof k.rank === 'number' ? k.rank : null, null);
  for (const s of semantic) add(s, null, typeof s.semantic_score === 'number' ? s.semantic_score : null);
  const merged = Array.from(map.values()).sort((a,b)=> (b.score||0)-(a.score||0)).slice(0, limit);
  return merged;
}
