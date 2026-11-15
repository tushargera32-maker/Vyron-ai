import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

let tmpDir: string;
let origCwd: string;
let origDbPath: string | undefined;

beforeAll(() => {
  origCwd = process.cwd();
  origDbPath = process.env.AETHER_DB_PATH;
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aether-phase3-"));
  process.env.AETHER_DB_PATH = path.join(tmpDir, "test.db");
  process.env.AETHER_AI_PROVIDER = "mock";
});

afterAll(() => {
  process.env.AETHER_DB_PATH = origDbPath;
  process.chdir(origCwd);
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

describe("chat engine (service)", () => {
  it("creates conversation, persists messages, streams and recovers", async () => {
    const { ensureDbReady } = await import("@/lib/db");
    const { streamChat, listConversations, getConversationWithMessages, renameConversation, removeConversation } = await import("@/lib/chat/service");
    ensureDbReady();
    let convId = "";
    let final = "";
    for await (const ev of streamChat({ message: "Hello AETHER", providerType: "mock", model: "mock-model" })) {
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
    // recovery: fetch again
    const again = getConversationWithMessages(convId);
    expect(again?.messages.length).toBeGreaterThanOrEqual(2);
    expect(removeConversation(convId)).toBe(true);
  }, 20000);

  it("handles provider failure without duplicating user message on retry path logic", async () => {
    const { ensureDbReady } = await import("@/lib/db");
    const convRepo = await import("@/lib/db/repositories/conversations");
    ensureDbReady();
    // simulate: same user message already last -> streamChat should reuse it
    const db = (await import("@/lib/db")).getDb();
    const conv = convRepo.createConversation(db, { title: "Retry" });
    convRepo.addMessage(db, { conversation_id: conv.id, role: "user", content: "ping", status: "complete" });
    const { streamChat } = await import("@/lib/chat/service");
    for await (const ev of streamChat({ conversationId: conv.id, message: "ping", providerType: "mock" })) { if (ev.type==="done"||ev.type==="error") break; }
    const msgs = convRepo.listMessages(db, conv.id).filter(m=>m.role==='user' && m.content==='ping');
    expect(msgs.length).toBe(1);
  }, 20000);

  it("uses real openai-compatible provider when selected (mocked HTTP) and does not fall back to mock on config failure", async () => {
    const { ensureDbReady } = await import("@/lib/db");
    const { streamChat } = await import("@/lib/chat/service");
    ensureDbReady();
    const originalFetch = global.fetch;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "or_1", model: "openrouter/free", choices: [{ delta: { content: "hello from openrouter" }, finish_reason: "stop" }]
    }) + "\n", { status: 200, headers: { "Content-Type": "text/event-stream" } }));
    // Provide SSE-style stream response
    const sse = 'data: {"id":"or_1","model":"openrouter/free","choices":[{"delta":{"content":"hello from openrouter"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';
    const encoder = new TextEncoder();
    fetchMock.mockResolvedValue(new Response(new ReadableStream({ start(c){ c.enqueue(encoder.encode(sse)); c.close(); } }), { status: 200, headers: { "Content-Type": "text/event-stream" } }));
    global.fetch = fetchMock as any;
    const prev = { base: process.env.AETHER_AI_BASE_URL, key: process.env.AETHER_AI_API_KEY };
    process.env.AETHER_AI_BASE_URL = "https://openrouter.ai/api/v1";
    process.env.AETHER_AI_API_KEY = "test-key";
    try {
      let content = "";
      let err: any = null;
      for await (const ev of streamChat({ message: "hi", providerType: "openai-compatible", model: "openrouter/free" })) {
        if (ev.type === "done") content = (ev as any).content || "";
        if (ev.type === "error") err = ev.error;
      }
      expect(err).toBeNull();
      expect(content).toContain("hello from openrouter");
      expect(content).not.toContain("[mock:");
      expect(fetchMock).toHaveBeenCalled();
      const calledUrl = String(fetchMock.mock.calls[0][0]);
      expect(calledUrl).toContain("https://openrouter.ai/api/v1");
    } finally {
      global.fetch = originalFetch;
      if (prev.base === undefined) delete process.env.AETHER_AI_BASE_URL; else process.env.AETHER_AI_BASE_URL = prev.base;
      if (prev.key === undefined) delete process.env.AETHER_AI_API_KEY; else process.env.AETHER_AI_API_KEY = prev.key;
    }
  }, 20000);

  it("surfaces clear config error for openai-compatible without silent mock fallback", async () => {
    const { ensureDbReady } = await import("@/lib/db");
    const { streamChat } = await import("@/lib/chat/service");
    ensureDbReady();
    const prev = { base: process.env.AETHER_AI_BASE_URL, key: process.env.AETHER_AI_API_KEY };
    delete process.env.AETHER_AI_BASE_URL;
    delete process.env.AETHER_AI_API_KEY;
    try {
      let err: any = null;
      for await (const ev of streamChat({ message: "hi", providerType: "openai-compatible", model: "openrouter/free" })) {
        if (ev.type === "error") err = ev.error;
      }
      expect(err).toBeTruthy();
      expect(String(err.message)).toMatch(/baseURL|API key/i);
      expect(String(err.message)).not.toContain("[mock:");
    } finally {
      if (prev.base === undefined) delete process.env.AETHER_AI_BASE_URL; else process.env.AETHER_AI_BASE_URL = prev.base;
      if (prev.key === undefined) delete process.env.AETHER_AI_API_KEY; else process.env.AETHER_AI_API_KEY = prev.key;
    }
  }, 20000);

  it("persists and retrieves explicit profile memory across new conversations and restart", async () => {
    const { ensureDbReady, closeDb, openDatabase } = await import("@/lib/db");
    const { streamChat, createNewConversation } = await import("@/lib/chat/service");
    const convRepo = await import("@/lib/db/repositories/conversations");
    const memRepo = await import("@/lib/db/repositories/memories");
    const { retrieveRelevantMemories } = await import("@/lib/memory/service");
    const { buildChatContext } = await import("@/lib/context/builder");
    ensureDbReady();
    const profileMsg = "Please save my profile to memory. My name is Tushar. I work in graphic design, visa consultancy and social media marketing. I am building AETHER as my personal AI brain.";
    let saveConvId = "";
    for await (const ev of streamChat({ message: profileMsg, providerType: "mock", model: "mock-model" })) {
      if (ev.conversationId) saveConvId = ev.conversationId as string;
      if (ev.type === "done" || ev.type === "error") break;
    }
    const db = (await import("@/lib/db")).getDb();
    const approved = memRepo.listMemories(db, { status: "approved" });
    expect(approved.some(m => /tushar/i.test(m.content))).toBe(true);
    const relevant = retrieveRelevantMemories("What do you know about me?", { limit: 6 });
    expect(relevant.length).toBeGreaterThan(0);
    expect(relevant.some(m => /tushar/i.test(m.content))).toBe(true);

    // New conversation context must include retrieved memories
    const conv2 = createNewConversation({ title: "New chat" });
    const ctx = buildChatContext({ conversationId: conv2.id, userMessage: "What do you know about me?" });
    expect(ctx.used.memoryIds.length).toBeGreaterThan(0);
    expect(ctx.system).toMatch(/tushar/i);
    expect(ctx.system).toContain("[Retrieved Memories]");
    expect(ctx.system).not.toContain("[Retrieved Memories]\nNone.");

    // Simulate restart: reopen DB and verify persistence
    const dbPath = process.env.AETHER_DB_PATH!;
    closeDb();
    const db2 = openDatabase(dbPath);
    const { migrate } = await import("@/lib/db/migrator");
    migrate(db2, path.join(process.cwd(), "src", "lib", "db", "migrations"));
    const memsAfter = memRepo.listMemories(db2, { status: "approved" });
    expect(memsAfter.some(m => /tushar/i.test(m.content))).toBe(true);
    db2.close();
    ensureDbReady(); // reinit singleton for subsequent tests if any
    expect(saveConvId).toBeTruthy();
  }, 30000);
});
