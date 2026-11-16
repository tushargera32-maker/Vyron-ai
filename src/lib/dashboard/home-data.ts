import "server-only";
import { ensureDbReady } from "@/lib/db";
import { listMemories } from "@/lib/db/repositories/memories";
import { listDocuments } from "@/lib/db/repositories/documents";
import { listProjects } from "@/lib/db/repositories/projects";
import { listAgents } from "@/lib/db/repositories/agents";
import { listConversations } from "@/lib/db/repositories/conversations";
import { listAuditLogs } from "@/lib/db/repositories/usage";
import { ensureLocalUser } from "@/lib/db/repositories/profile";
import type { DocumentRecord, Project, Conversation, UsageEvent, Memory } from "@/lib/db/types";

export type HomeDashboardData = {
  profile: { name: string };
  system: {
    interface: "ready";
    memoryKnowledge: "available" | "unavailable";
    provider: "configured" | "unconfigured";
    providerName?: string | null;
  };
  memory: { total: number; approved: number; proposed: number };
  knowledge: { indexed: number; processing: number; total: number };
  projects: { activeCount: number; recent: Array<{ id: string; name: string; updated_at: string }> };
  agents: {
    available: Array<{ id: string; name: string }>;
    executingTracked: boolean;
    pendingApprovalsTracked: boolean;
  };
  usage: {
    recent: Array<{ id: string; provider_id: string | null; model_id: string | null; token_input: number | null; token_output: number | null; latency_ms: number | null; status: string; created_at: string }>;
    hasAny: boolean;
  };
  activity: Array<{ id: string; type: string; label: string; at: string }>;
};

function safeListUsage(db: ReturnType<typeof ensureDbReady>, limit = 10): UsageEvent[] {
  try {
    return db.prepare(`SELECT * FROM usage_events ORDER BY created_at DESC LIMIT ?`).all(limit) as UsageEvent[];
  } catch {
    return [];
  }
}

function safeRecentMemoryEvents(db: ReturnType<typeof ensureDbReady>, limit = 10) {
  try {
    return db.prepare(`SELECT id, memory_id, event_type, created_at FROM memory_events ORDER BY created_at DESC LIMIT ?`).all(limit) as Array<{id:string; memory_id:string; event_type:string; created_at:string}>;
  } catch {
    return [] as Array<{id:string; memory_id:string; event_type:string; created_at:string}>;
  }
}

export async function getHomeDashboardData(): Promise<HomeDashboardData> {
  const db = ensureDbReady();

  let profileName = "Local User";
  try { profileName = ensureLocalUser(db).name || "Local User"; } catch {}

  // Memory counts (real)
  let memories: Memory[] = [];
  try { memories = listMemories(db, { includeDeleted: false }); } catch {}
  const approved = memories.filter(m => m.status === "approved").length;
  const proposed = memories.filter(m => m.status === "proposed").length;

  // Knowledge/documents (real)
  let docs: DocumentRecord[] = [];
  try { docs = listDocuments(db); } catch {}
  const processing = docs.filter(d => d.status === "processing" || d.status === "pending" || d.status === "queued").length;
  const indexed = docs.filter(d => d.status === "indexed" || d.status === "complete" || d.status === "ready" || d.status === "ingested").length;

  // Projects (real)
  let projects: Project[] = [];
  try { projects = listProjects(db); } catch {}
  const activeProjects = projects.filter(p => !p.archived_at);
  const recentProjects = activeProjects.slice(0, 5).map(p => ({ id: p.id, name: p.name, updated_at: p.updated_at }));

  // Agents (available definitions; execution/approvals tracking not implemented as real run records)
  let dbAgents: Array<{id:string;name:string}> = [];
  try { dbAgents = listAgents(db).filter(a => (a.enabled ?? 1) === 1).map(a => ({ id: a.id, name: a.name })); } catch {}
  const fallbackAgents = [
    { id: "personal", name: "Personal Agent" },
    { id: "research", name: "Research Agent" },
    { id: "design", name: "Design Agent" },
    { id: "coding", name: "Coding Agent" },
    { id: "marketing", name: "Marketing Agent" },
  ];
  const availableAgents = dbAgents.length ? dbAgents : fallbackAgents;

  // Usage (real)
  const usageRecent = safeListUsage(db, 8).map(u => ({
    id: u.id,
    provider_id: u.provider_id,
    model_id: u.model_id,
    token_input: u.token_input,
    token_output: u.token_output,
    latency_ms: u.latency_ms,
    status: u.status,
    created_at: u.created_at,
  }));

  // Provider config status (env-based, no secrets). OpenRouter API only.
  const providerId = "openrouter";
  const providerConfigured = Boolean(process.env.AETHER_AI_API_KEY && (process.env.AETHER_AI_MODEL || "").trim());

  // Recent activity (real timestamps only)
  let conversations: Conversation[] = [];
  try { conversations = listConversations(db).slice(0, 5); } catch {}
  const memEvents = safeRecentMemoryEvents(db, 6);
  let audit: ReturnType<typeof listAuditLogs> = [];
  try { audit = listAuditLogs(db, 10); } catch {}

  const activity: Array<{ id: string; type: string; label: string; at: string }> = [];
  for (const e of memEvents) {
    const label = e.event_type === "approved" ? "Memory approved" : e.event_type === "proposed" ? "Memory proposed" : e.event_type === "edited" ? "Memory updated" : e.event_type === "deleted" ? "Memory deleted" : e.event_type === "archived" ? "Memory archived" : "Memory event";
    activity.push({ id: `mem-${e.id}`, type: "memory", label, at: e.created_at });
  }
  for (const d of docs.slice(0, 5)) {
    if (d.ingested_at || d.updated_at) {
      const label = (d.status === "indexed" || d.status === "complete" || d.status === "ready" || d.status === "ingested") ? "Document processed" : d.status === "processing" ? "Document processing" : "Document updated";
      activity.push({ id: `doc-${d.id}`, type: "knowledge", label: `${label}: ${d.title}`, at: d.ingested_at || d.updated_at });
    }
  }
  for (const p of projects.slice(0, 5)) {
    const created = p.created_at === p.updated_at;
    activity.push({ id: `proj-${p.id}-${p.updated_at}`, type: "project", label: `${created ? "Project created" : "Project updated"}: ${p.name}`, at: p.updated_at });
  }
  for (const c of conversations.slice(0, 5)) {
    activity.push({ id: `conv-${c.id}-${c.updated_at}`, type: "conversation", label: `Conversation activity: ${c.title || "Untitled"}`, at: c.updated_at });
  }
  // include select audit events if meaningful
  for (const a of audit.slice(0, 5)) {
    activity.push({ id: `audit-${a.id}`, type: "system", label: `${a.action} (${a.resource_type})`, at: a.created_at });
  }
  activity.sort((a,b) => (b.at || "").localeCompare(a.at || ""));
  const deduped: typeof activity = [];
  const seen = new Set<string>();
  for (const item of activity) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
    if (deduped.length >= 12) break;
  }

  const memoryKnowledge = "available"; // local DB/repos available if we reached here

  return {
    profile: { name: profileName },
    system: {
      interface: "ready",
      memoryKnowledge,
      provider: providerConfigured ? "configured" : "unconfigured",
      providerName: "OpenRouter",
    },
    memory: { total: memories.length, approved, proposed },
    knowledge: { indexed, processing, total: docs.length },
    projects: { activeCount: activeProjects.length, recent: recentProjects },
    agents: { available: availableAgents, executingTracked: false, pendingApprovalsTracked: false },
    usage: { recent: usageRecent, hasAny: usageRecent.length > 0 },
    activity: deduped,
  };
}
