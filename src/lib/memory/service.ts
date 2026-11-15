import "server-only";
import { ensureDbReady } from "@/lib/db";
import * as memRepo from "@/lib/db/repositories/memories";
import type { Memory } from "@/lib/db/types";

export type MemoryType = "working" | "episodic" | "semantic" | "procedural";

function normalizeContent(s: string) { return s.replace(/\s+/g, " ").trim(); }

export function listMemory(opts?: { project_id?: string | null; status?: string; type?: string }) {
  const db = ensureDbReady();
  return memRepo.listMemories(db, opts);
}

export function proposeMemory(input: { project_id?: string | null; type: MemoryType; content: string; summary?: string | null; importance?: number; confidence?: number; source_conversation_id?: string | null; source_message_id?: string | null; metadata?: Record<string, unknown>; actor?: string; status?: "proposed" | "approved" }) {
  const db = ensureDbReady();
  const content = normalizeContent(input.content);
  if (!content) throw new Error("Memory content is required");
  const dupes = memRepo.findPotentialDuplicates(db, { type: input.type, content });
  const existing = dupes.find(d => d.status === "approved" || d.status === "proposed");
  if (existing) {
    // if explicitly saving as approved, upgrade existing proposed to approved
    if (input.status === "approved" && existing.status === "proposed") {
      const updated = memRepo.approveMemory(db, existing.id, input.actor || "user");
      return { memory: updated!, duplicate: true, upgraded: true };
    }
    return { memory: existing, duplicate: true, upgraded: false };
  }
  const meta = { ...(input.metadata || {}), tags: (input.metadata?.tags as string[] | undefined) || [] };
  const mem = memRepo.createMemory(db, { ...input, content, summary: input.summary ?? content.slice(0, 80), metadata_json: JSON.stringify(meta), status: input.status ?? "proposed", actor: input.actor || "system" });
  return { memory: mem, duplicate: false, upgraded: false };
}

export function approveMemory(id: string) { const db = ensureDbReady(); return memRepo.approveMemory(db, id, "user"); }
export function rejectMemory(id: string) { const db = ensureDbReady(); return memRepo.rejectMemory(db, id, "user"); }
export function archiveMemory(id: string) { const db = ensureDbReady(); return memRepo.archiveMemory(db, id, "user"); }
export function deleteMemory(id: string) { const db = ensureDbReady(); return memRepo.deleteMemory(db, id, "user"); }
export function updateMemory(id: string, patch: any) { const db = ensureDbReady(); return memRepo.updateMemory(db, id, patch, "user"); }

export function retrieveRelevantMemories(query: string, opts?: { project_id?: string | null; limit?: number; conversation_id?: string | null }) {
  const db = ensureDbReady();
  const results = memRepo.searchMemories(db, query, { project_id: opts?.project_id, status: "approved", limit: opts?.limit ?? 6 }) as Memory[];
  memRepo.recordRetrievalEvents(db, results.map(r => r.id), opts?.conversation_id ?? null, query);
  return results;
}

// Deterministic/cost-conscious extraction heuristics (no mandatory AI call)
export function extractCandidateMemoriesFromText(input: { text: string; conversation_id?: string | null; message_id?: string | null; project_id?: string | null }) {
  const text = input.text || "";
  const candidates: Array<{ type: MemoryType; content: string; summary: string; importance: number; confidence: number; tags: string[] }> = [];
  const patterns: Array<{ type: MemoryType; re: RegExp; importance: number; confidence: number; tag: string }> = [
    { type: "semantic", re: /\b(my name is|i am called)\s+([^.!?\n]{2,40})/i, importance: 0.9, confidence: 0.8, tag: "identity" },
    { type: "semantic", re: /\b(i (?:like|love|prefer|enjoy))\s+([^.!?\n]{3,80})/i, importance: 0.7, confidence: 0.7, tag: "preference" },
    { type: "semantic", re: /\b(i (?:dislike|hate|avoid))\s+([^.!?\n]{3,80})/i, importance: 0.7, confidence: 0.7, tag: "preference" },
    { type: "semantic", re: /\b(i (?:work as|am a|work on))\s+([^.!?\n]{3,80})/i, importance: 0.7, confidence: 0.65, tag: "profile" },
    { type: "procedural", re: /\b(?:always|when .*?,?)\s+(?:please\s+)?([^.!?\n]{10,120})/i, importance: 0.6, confidence: 0.55, tag: "workflow" },
  ];
  for (const p of patterns) {
    const m = text.match(p.re);
    if (m) {
      const content = normalizeContent(m[0]);
      candidates.push({ type: p.type, content, summary: content.slice(0, 80), importance: p.importance, confidence: p.confidence, tags: [p.tag, "auto-extracted"] });
    }
  }
  // episodic summary only for sufficiently substantive user messages
  if (text.length > 120) {
    const summary = normalizeContent(text).slice(0, 180);
    candidates.push({ type: "episodic", content: `User stated: ${summary}`, summary: summary.slice(0, 80), importance: 0.4, confidence: 0.45, tags: ["conversation", "auto-extracted"] });
  }
  // dedupe by content
  const seen = new Set<string>();
  return candidates.filter(c => { const k = c.type+":"+c.content.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 6);
}

export function detectExplicitMemorySaveIntent(text: string) {
  return /\b(remember|save|store|keep|memorize|record)\b/i.test(text) && /\b(me|my|profile|about me|personal|i am|i'm|name is)\b/i.test(text)
    || /\b(initialize|set up|create)\b.*\b(profile|memory)\b/i.test(text)
    || /\b(save this to memory|add this to memory|remember this)\b/i.test(text);
}

export function buildExplicitProfileMemories(text: string): Array<{ type: MemoryType; content: string; summary: string; importance: number; confidence: number; tags: string[] }> {
  const cleaned = normalizeContent(text);
  const out: Array<{ type: MemoryType; content: string; summary: string; importance: number; confidence: number; tags: string[] }> = [];
  // capture explicit identity
  const nameMatch = text.match(/\b(?:my name is|i am called|i'm|i am)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})/);
  if (nameMatch) {
    const c = normalizeContent(`User name: ${nameMatch[1]}`);
    out.push({ type: "semantic", content: c, summary: c, importance: 0.95, confidence: 0.95, tags: ["identity", "profile", "name", "explicit-save"] });
  }
  // store full explicit profile/details as high-importance semantic memory (user explicitly asked to save)
  if (cleaned.length > 40) {
    const profileContent = cleaned.length > 4000 ? cleaned.slice(0, 4000) + " …[truncated]" : cleaned;
    out.push({ type: "semantic", content: `User profile (explicitly provided): ${profileContent}`, summary: profileContent.slice(0, 120), importance: 0.92, confidence: 0.9, tags: ["profile", "about", "explicit-save"] });
  }
  // derive a few structured facts
  for (const c of extractCandidateMemoriesFromText({ text })) {
    if (c.type === "semantic" || c.type === "procedural") out.push({ ...c, importance: Math.max(c.importance, 0.75), confidence: Math.max(c.confidence, 0.75), tags: Array.from(new Set([...c.tags, "explicit-save"])) });
  }
  const seen = new Set<string>();
  return out.filter(m => { const k = m.type+":"+m.content.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
}

export function saveExplicitMemoriesFromMessage(input: { text: string; conversation_id?: string | null; message_id?: string | null; project_id?: string | null }) {
  const mems = buildExplicitProfileMemories(input.text);
  const results: any[] = [];
  for (const c of mems) {
    results.push(proposeMemory({ ...c, source_conversation_id: input.conversation_id, source_message_id: input.message_id, project_id: input.project_id, metadata: { tags: c.tags, explicit: true }, actor: "user", status: "approved" }));
  }
  return results;
}

export function proposeMemoriesFromMessage(input: { text: string; conversation_id?: string | null; message_id?: string | null; project_id?: string | null }) {
  const cands = extractCandidateMemoriesFromText(input);
  const results: any[] = [];
  for (const c of cands) {
    results.push(proposeMemory({ ...c, source_conversation_id: input.conversation_id, source_message_id: input.message_id, project_id: input.project_id, metadata: { tags: c.tags } }));
  }
  return results;
}