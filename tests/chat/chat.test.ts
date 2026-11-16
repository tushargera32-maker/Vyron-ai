import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

let tmpDir: string;
let origCwd: string;
let origEnv: Record<string, string | undefined>;

function mockSseResponse(text: string) {
  const sse = `data: ${JSON.stringify({ id: "or_1", model: "openrouter/test", choices: [{ delta: { content: text }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`;
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({ start(c) { c.enqueue(encoder.encode(sse)); c.close(); } }), { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

function setApiEnv() {
  process.env.AETHER_AI_PROVIDER = "openai-compatible";
  process.env.AETHER_AI_BASE_URL = "https://openrouter.ai/api/v1";
  process.env.AETHER_AI_API_KEY = "test-key";
  process.env.AETHER_AI_MODEL = "openrouter/test";
}

beforeAll(() => {
  origCwd = process.cwd();
  origEnv = {
    AETHER_DB_PATH: process.env.AETHER_DB_PATH,
    AETHER_AI_PROVIDER: process.env.AETHER_AI_PROVIDER,
    AETHER_AI_BASE_URL: process.env.AETHER_AI_BASE_URL,
    AETHER_AI_API_KEY: process.env.AETHER_AI_API_KEY,
    AETHER_AI_MODEL: process.env.AETHER_AI_MODEL,
  };
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aether-phase3-"));
  process.env.AETHER_DB_PATH = path.join(tmpDir, "test.db");
  setApiEnv();
});

afterAll(() => {
  for (const [k, v] of Object.entries(origEnv)) {
    if (v === undefined) delete (process.env as any)[k]; else process.env[k] = v;
  }
  process.chdir(origCwd);
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

describe("chat engine (service)", () => {
  it("creates conversation, persists messages, streams and recovers", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue(mockSseResponse("Hello AETHER")) as any;
    try {
      const { ensureDbReady } = await import("@/lib/db");
      const { streamChat, listConversations, getConversationWithMessages, renameConversation, removeConversation } = await import("@/lib/chat/service");
      ensureDbReady();
      let convId = "";
      let final = "";
      for await (const ev of streamChat({ message: "Hello AETHER", model: "openrouter/test" })) {
        if (ev.conversationId) convId = ev.conversationId as string;
        if (ev.type === "done") final = (ev as any).content || "";
      }
      expect(convId).toBeTruthy();
      expect(final).toContain("Hello AETHER");
      const data = getConversationWithMessages(convId);
      expect(data?.messages.some(m => m.role === "user" && m.content.includes("Hello AETHER"))).toBe(true);
      expect(data?.messages.some(m => m.role === "assistant" && m.status === "complete")).toBe(true);
      const renamed = renameConversation(convId, "Renamed Chat");
      expect(renamed?.title).toBe("Renamed Chat");
      const listed = listConversations("Renamed");
      expect(listed.some(c => c.id === convId)).toBe(true);
      const again = getConversationWithMessages(convId);
      expect(again?.messages.length).toBeGreaterThanOrEqual(2);
      expect(removeConversation(convId)).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  }, 20000);

  it("handles provider failure without duplicating user message on retry path logic", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue(mockSseResponse("pong")) as any;
    try {
      const { ensureDbReady } = await import("@/lib/db");
      const convRepo = await import("@/lib/db/repositories/conversations");
      ensureDbReady();
      const db = (await import("@/lib/db")).getDb();
      const conv = convRepo.createConversation(db, { title: "Retry", model_provider: "openai-compatible", model_id: "openrouter/test" });
      convRepo.addMessage(db, { conversation_id: conv.id, role: "user", content: "ping", status: "complete" });
      const { streamChat } = await import("@/lib/chat/service");
      for await (const ev of streamChat({ conversationId: conv.id, message: "ping", model: "openrouter/test" })) { if (ev.type==="done"||ev.type==="error") break; }
      const msgs = convRepo.listMessages(db, conv.id).filter(m=>m.role==='user' && m.content==='ping');
      expect(msgs.length).toBe(1);
    } finally {
      global.fetch = originalFetch;
    }
  }, 20000);

  it("uses OpenRouter (openai-compatible API) and streams response", async () => {
    const { ensureDbReady } = await import("@/lib/db");
    const { streamChat } = await import("@/lib/chat/service");
    ensureDbReady();
    const originalFetch = global.fetch;
    const fetchMock = vi.fn().mockResolvedValue(mockSseResponse("hello from openrouter"));
    global.fetch = fetchMock as any;
    try {
      let content = "";
      let err: any = null;
      for await (const ev of streamChat({ message: "hi", model: "openrouter/free" })) {
        if (ev.type === "done") content = (ev as any).content || "";
        if (ev.type === "error") err = ev.error;
      }
      expect(err).toBeNull();
      expect(content).toContain("hello from openrouter");
      expect(fetchMock).toHaveBeenCalled();
      const calledUrl = String(fetchMock.mock.calls[0][0]);
      expect(calledUrl).toContain("https://openrouter.ai/api/v1");
    } finally {
      global.fetch = originalFetch;
    }
  }, 20000);

  it("surfaces clear config error when API key/base config missing (no mock fallback)", async () => {
    const { ensureDbReady } = await import("@/lib/db");
    const { streamChat } = await import("@/lib/chat/service");
    ensureDbReady();
    const prev = { base: process.env.AETHER_AI_BASE_URL, key: process.env.AETHER_AI_API_KEY, model: process.env.AETHER_AI_MODEL };
    delete process.env.AETHER_AI_API_KEY;
    delete process.env.AETHER_AI_MODEL;
    try {
      let err: any = null;
      for await (const ev of streamChat({ message: "hi" })) {
        if (ev.type === "error") err = ev.error;
      }
      expect(err).toBeTruthy();
      expect(String(err.message)).toMatch(/API key|Model/i);
    } finally {
      if (prev.base === undefined) delete process.env.AETHER_AI_BASE_URL; else process.env.AETHER_AI_BASE_URL = prev.base;
      if (prev.key === undefined) delete process.env.AETHER_AI_API_KEY; else process.env.AETHER_AI_API_KEY = prev.key;
      if (prev.model === undefined) delete process.env.AETHER_AI_MODEL; else process.env.AETHER_AI_MODEL = prev.model;
    }
  }, 20000);

  it("persists and retrieves explicit profile memory across new conversations and restart", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue(mockSseResponse("Got it.")) as any;
    try {
      const { ensureDbReady, closeDb, openDatabase } = await import("@/lib/db");
      const { streamChat, createNewConversation } = await import("@/lib/chat/service");
      const memRepo = await import("@/lib/db/repositories/memories");
      const { retrieveRelevantMemories } = await import("@/lib/memory/service");
      const { buildChatContext } = await import("@/lib/context/builder");
      ensureDbReady();
      const profileMsg = "Please save my profile to memory. My name is Tushar. I work in graphic design, visa consultancy and social media marketing. I am building AETHER as my personal AI brain.";
      let saveConvId = "";
      for await (const ev of streamChat({ message: profileMsg, model: "openrouter/test" })) {
        if (ev.conversationId) saveConvId = ev.conversationId as string;
        if (ev.type === "done" || ev.type === "error") break;
      }
      const db = (await import("@/lib/db")).getDb();
      const approved = memRepo.listMemories(db, { status: "approved" });
      expect(approved.some(m => /tushar/i.test(m.content))).toBe(true);
      const relevant = retrieveRelevantMemories("What do you know about me?", { limit: 6 });
      expect(relevant.length).toBeGreaterThan(0);
      expect(relevant.some(m => /tushar/i.test(m.content))).toBe(true);

      const conv2 = createNewConversation({ title: "New chat" });
      const ctx = buildChatContext({ conversationId: conv2.id, userMessage: "What do you know about me?" });
      expect(ctx.used.memoryIds.length).toBeGreaterThan(0);
      expect(ctx.system).toMatch(/tushar/i);
      expect(ctx.system).toContain("[Retrieved Memories]");
      expect(ctx.system).not.toContain("[Retrieved Memories]\nNone.");

      const dbPath = process.env.AETHER_DB_PATH!;
      closeDb();
      const db2 = openDatabase(dbPath);
      const { migrate } = await import("@/lib/db/migrator");
      migrate(db2, path.join(process.cwd(), "src", "lib", "db", "migrations"));
      const memsAfter = memRepo.listMemories(db2, { status: "approved" });
      expect(memsAfter.some(m => /tushar/i.test(m.content))).toBe(true);
      db2.close();
      ensureDbReady();
      expect(saveConvId).toBeTruthy();
    } finally {
      global.fetch = originalFetch;
    }
  }, 30000);
});
