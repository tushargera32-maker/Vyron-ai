import "server-only";
import { ensureDbReady } from "@/lib/db";
import * as convRepo from "@/lib/db/repositories/conversations";
import { createProvider } from "@/lib/ai/provider";
import { chatWithRetry, streamWithRetry } from "@/lib/ai/runtime";
import { getProviderConfigFromEnv } from "@/lib/ai/config";
import { buildChatContext } from "@/lib/context/builder";
import { proposeMemoriesFromMessage, detectExplicitMemorySaveIntent, saveExplicitMemoriesFromMessage } from "@/lib/memory/service";

export function listConversations(query?: string) {
  const db = ensureDbReady();
  return query ? convRepo.searchConversations(db, query) : convRepo.listConversations(db);
}
export function getConversationWithMessages(id: string) {
  const db = ensureDbReady();
  const conv = convRepo.getConversation(db, id);
  if (!conv) return null;
  const messages = convRepo.listMessages(db, id);
  return { conversation: conv, messages };
}
export function createNewConversation(input?: { title?: string; project_id?: string | null; model_provider?: string | null; model_id?: string | null; system_prompt?: string | null }) {
  const db = ensureDbReady();
  const cfg = getProviderConfigFromEnv();
  return convRepo.createConversation(db, { title: input?.title || "New conversation", project_id: input?.project_id ?? null, model_provider: input?.model_provider ?? cfg.type, model_id: input?.model_id ?? cfg.defaultModel ?? "default", system_prompt: input?.system_prompt ?? null });
}
export function renameConversation(id: string, title: string) { const db = ensureDbReady(); return convRepo.updateConversation(db, id, { title }); }
export function removeConversation(id: string) { const db = ensureDbReady(); return convRepo.deleteConversation(db, id); }
export function updateConversationSettings(id: string, patch: { model_provider?: string | null; model_id?: string | null; system_prompt?: string | null }) { const db = ensureDbReady(); return convRepo.updateConversation(db, id, patch as any); }

export async function* streamChat(input: { conversationId?: string; message: string; projectId?: string | null; model?: string; providerType?: "mock" | "openai-compatible"; systemPrompt?: string | null }) {
  const db = ensureDbReady();
  const text = (input.message || "").trim();
  if (!text) throw new Error("Message is required");
  let conversation = input.conversationId ? convRepo.getConversation(db, input.conversationId) : null;
  if (!conversation) conversation = createNewConversation({ project_id: input.projectId ?? null, model_id: input.model, model_provider: input.providerType, system_prompt: input.systemPrompt ?? null });
  if (input.model || input.providerType || input.systemPrompt !== undefined) {
    conversation = convRepo.updateConversation(db, conversation.id, { model_id: input.model ?? conversation.model_id, model_provider: input.providerType ?? conversation.model_provider, system_prompt: input.systemPrompt !== undefined ? input.systemPrompt : conversation.system_prompt }) || conversation;
  }

  // prevent duplicate user message on naive retry: if last message identical user and no following assistant completed, reuse
  const existing = convRepo.listMessages(db, conversation.id);
  const last = existing[existing.length - 1];
  const userMsg = last && last.role === "user" && last.content === text ? last : convRepo.addMessage(db, { conversation_id: conversation.id, role: "user", content: text, status: "complete" });
  // create assistant placeholder
  const assistantMsg = convRepo.addMessage(db, { conversation_id: conversation.id, role: "assistant", content: "", status: "streaming" });

  let acc = "";
  const started = Date.now();
  try {
    const ctx = buildChatContext({ conversationId: conversation.id, userMessage: text, systemPrompt: conversation.system_prompt, projectId: conversation.project_id });
    const providerCfg: any = {};
    if (conversation.model_provider === "mock" || conversation.model_provider === "openai-compatible") providerCfg.type = conversation.model_provider;
    if (conversation.model_id) providerCfg.defaultModel = conversation.model_id;
    const provider = createProvider(providerCfg);
    const model = conversation.model_id || getProviderConfigFromEnv().defaultModel || "default";

    for await (const delta of streamWithRetry(provider, { model, messages: [{ role: "system", content: ctx.system }, ...ctx.messages], stream: true, metadata: { conversationId: conversation.id, messageId: assistantMsg.id } } as any, { timeoutMs: 30000, maxRetries: 2 })) {
      if (delta.type === "delta" && delta.content) {
        acc += delta.content;
        yield { type: "delta", content: delta.content, conversationId: conversation.id, assistantMessageId: assistantMsg.id };
      }
      if (delta.type === "done") {
        const usage = delta.response?.usage;
        convRepo.updateMessage(db, assistantMsg.id, { content: acc || delta.response?.content || "", status: "complete", token_input: usage?.input ?? null, token_output: usage?.output ?? null });
        // explicit save intent => create approved memories with provenance; otherwise propose candidates
        try {
          if (detectExplicitMemorySaveIntent(text)) {
            saveExplicitMemoriesFromMessage({ text, conversation_id: conversation.id, message_id: userMsg.id, project_id: conversation.project_id });
          } else {
            proposeMemoriesFromMessage({ text, conversation_id: conversation.id, message_id: userMsg.id, project_id: conversation.project_id });
          }
        } catch {}
        yield { type: "done", conversationId: conversation.id, assistantMessageId: assistantMsg.id, content: acc || delta.response?.content || "", usage: usage || null, latencyMs: Date.now() - started, context: ctx.used };
        return;
      }
    }
    convRepo.updateMessage(db, assistantMsg.id, { content: acc, status: "complete" });
    try {
      if (detectExplicitMemorySaveIntent(text)) {
        saveExplicitMemoriesFromMessage({ text, conversation_id: conversation.id, message_id: userMsg.id, project_id: conversation.project_id });
      } else {
        proposeMemoriesFromMessage({ text, conversation_id: conversation.id, message_id: userMsg.id, project_id: conversation.project_id });
      }
    } catch {}
    yield { type: "done", conversationId: conversation.id, assistantMessageId: assistantMsg.id, content: acc, usage: null, latencyMs: Date.now() - started, context: (ctx as any).used || { memoryIds: [], knowledge: [] } };
  } catch (e: any) {
    const msg = e?.message || "Chat failed";
    convRepo.updateMessage(db, assistantMsg.id, { status: "error", error_json: JSON.stringify({ message: msg, code: e?.code }) , content: acc });
    yield { type: "error", conversationId: conversation.id, assistantMessageId: assistantMsg.id, error: { message: msg, code: e?.code || "error" } };
  }
}

export async function nonStreamingChat(input: { conversationId?: string; message: string; projectId?: string | null; model?: string; providerType?: "mock" | "openai-compatible"; systemPrompt?: string | null }) {
  let result: any = null;
  for await (const ev of streamChat(input)) { if (ev.type === "done" || ev.type === "error") result = ev; }
  return result;
}
