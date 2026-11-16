import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createOpenAICompatibleProvider } from "@/lib/ai/providers/openai-compatible";
import { chatWithRetry, streamWithRetry } from "@/lib/ai/runtime";
import { AIProviderError } from "@/lib/ai/errors";

const baseReq = { model: "gpt-test", messages: [{ role: "user" as const, content: "hello" }] };

describe("openai-compatible provider (mocked fetch)", () => {
  const originalFetch = global.fetch;
  beforeEach(() => { vi.useRealTimers(); });
  afterEach(() => { global.fetch = originalFetch; vi.restoreAllMocks(); });

  it("parses non-streaming chat completion", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "cmpl_1", model: "gpt-test", choices: [{ message: { content: "hi there" }, finish_reason: "stop" }], usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 }
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const p = createOpenAICompatibleProvider({ id: "oai", baseURL: "https://example.test/v1", apiKey: "k" });
    const res = await chatWithRetry(p, baseReq, { timeoutMs: 5000, maxRetries: 0 });
    expect(res.content).toBe("hi there");
    expect(res.usage.input).toBe(3);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("retries on retryable failure then succeeds", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "rate limit" } }), { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "cmpl_2", model: "gpt-test", choices: [{ message: { content: "ok" }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
      }), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const p = createOpenAICompatibleProvider({ id: "oai", baseURL: "https://example.test/v1" });
    const res = await chatWithRetry(p, baseReq, { timeoutMs: 5000, maxRetries: 2 });
    expect(res.content).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces standardized error on non-retryable failure", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "bad key" } }), { status: 401 }));
    const p = createOpenAICompatibleProvider({ id: "oai", baseURL: "https://example.test/v1" });
    await expect(chatWithRetry(p, baseReq, { timeoutMs: 5000, maxRetries: 2 })).rejects.toMatchObject({ code: "auth_error", retryable: false, status: 401 });
  });

  it("times out requests", async () => {
    global.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const e = new Error("aborted");
        e.name = "AbortError";
        reject(e);
      });
    })) as unknown as typeof fetch;
    const p = createOpenAICompatibleProvider({ id: "oai", baseURL: "https://example.test/v1" });
    await expect(chatWithRetry(p, baseReq, { timeoutMs: 20, maxRetries: 0 })).rejects.toMatchObject({ code: "timeout", retryable: true });
  });

  it("streams SSE deltas and done", async () => {
    const sse = [
      'data: {"id":"cmpl_s","model":"gpt-test","choices":[{"delta":{"content":"hel"},"finish_reason":null}]}\n\n',
      'data: {"id":"cmpl_s","model":"gpt-test","choices":[{"delta":{"content":"lo"},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n',
    ].join("");
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) { controller.enqueue(encoder.encode(sse)); controller.close(); }
    });
    global.fetch = vi.fn().mockResolvedValue(new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } }));
    const p = createOpenAICompatibleProvider({ id: "oai", baseURL: "https://example.test/v1" });
    const parts: string[] = [];
    let final = "";
    for await (const d of streamWithRetry(p, baseReq, { timeoutMs: 5000, maxRetries: 0 })) {
      if (d.type === "delta" && d.content) parts.push(d.content);
      if (d.type === "done") final = d.response?.content || "";
    }
    expect(parts.join("")).toBe("hello");
    expect(final).toBe("hello");
  });

  it("retries stream when failure occurs before first delta", async () => {
    const sse = 'data: {"id":"cmpl_s","model":"gpt-test","choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';
    const encoder = new TextEncoder();
    const okStream = () => new ReadableStream({ start(c) { c.enqueue(encoder.encode(sse)); c.close(); } });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "upstream" } }), { status: 503 }))
      .mockResolvedValueOnce(new Response(okStream(), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const p = createOpenAICompatibleProvider({ id: "oai", baseURL: "https://example.test/v1" });
    let out = "";
    for await (const d of streamWithRetry(p, baseReq, { timeoutMs: 5000, maxRetries: 2 })) {
      if (d.type === "delta" && d.content) out += d.content;
    }
    expect(out).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("standardized errors", () => {
  it("AIProviderError has shape", () => {
    const e = new AIProviderError({ name: "X", message: "m", code: "c", retryable: true, provider: "p", status: 500 });
    expect(e.toJSON()).toMatchObject({ name: "X", message: "m", code: "c", retryable: true, provider: "p", status: 500 });
  });
});
