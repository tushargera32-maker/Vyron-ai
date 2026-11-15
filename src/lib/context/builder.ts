import "server-only";
import { ensureDbReady } from "@/lib/db";
import { listMessages } from "@/lib/db/repositories/conversations";
import { retrieveRelevantMemories } from "@/lib/memory/service";
import { searchKnowledge } from "@/lib/knowledge/service";

export interface BuiltContext {
  system: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  used: { memoryIds: string[]; knowledge: Array<{ document_id: string; chunk_id: string; document_title?: string }> };
}

function truncate(s: string, max: number) { return s.length <= max ? s : s.slice(0, max) + "\n...[truncated]"; }

export function buildChatContext(input: { conversationId: string; userMessage: string; systemPrompt?: string | null; projectId?: string | null; historyLimit?: number }) {
  const db = ensureDbReady();
  const history = listMessages(db, input.conversationId).filter(m => m.status !== "error").slice(-(input.historyLimit ?? 12));
  const memories = retrieveRelevantMemories(input.userMessage, { project_id: input.projectId ?? null, limit: 6, conversation_id: input.conversationId });
  const knowledge = input.userMessage.trim() ? searchKnowledge(input.userMessage, { project_id: input.projectId ?? null, limit: 4, hybrid: true }) : [];

  const memBlock = memories.length ? memories.map((m) => `- [${m.type}] ${truncate(m.content, 500)}`).join("\n") : "None.";
  const knowBlock = knowledge.length ? knowledge.map((k: any, i: number) => `Source ${i + 1} (${k.document_title || k.document_id}#${k.chunk_index ?? "?"}):\n${truncate(k.content || "", 700)}`).join("\n\n") : "None.";

  // Safe diagnostics: IDs/counts only, no sensitive content
  console.info("[vyron.context]", JSON.stringify({ conversationId: input.conversationId, memoryCount: memories.length, memoryIds: memories.map(m => m.id), knowledgeCount: knowledge.length }));

  const systemParts = [
    input.systemPrompt || "You are VYRON, a refined local-first personal AI operating intelligence.",
    "Use the provided conversation history, retrieved memories, and retrieved knowledge when relevant. Retrieved memories are the user's approved long-term personal memory. If memory contains relevant personal/profile information, answer using it. If knowledge sources are provided, cite them by source number/title. Do not claim access to information not present in context.",
    `\n[Retrieved Memories]\n${memBlock}`,
    `\n[Retrieved Knowledge]\n${knowBlock}`,
  ];
  const system = systemParts.join("\n\n");
  const msgs: BuiltContext["messages"] = [];
  for (const m of history) {
    if (m.role === "user" || m.role === "assistant" || m.role === "system") {
      // avoid duplicating current user message if already stored and passed again
      msgs.push({ role: m.role as any, content: m.content });
    }
  }
  // ensure current user message included
  if (!msgs.length || msgs[msgs.length - 1].content !== input.userMessage || msgs[msgs.length - 1].role !== "user") {
    msgs.push({ role: "user", content: input.userMessage });
  }
  return {
    system,
    messages: msgs,
    used: {
      memoryIds: memories.map(m => m.id),
      knowledge: knowledge.map((k: any) => ({ document_id: k.document_id, chunk_id: k.chunk_id || k.id, document_title: k.document_title })),
    },
  } as BuiltContext;
}
