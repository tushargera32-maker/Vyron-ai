import type { AIProvider, ChatRequest, ChatResponse, ChatStreamDelta } from "../types";

function buildResponse(req: ChatRequest, providerId: string): ChatResponse {
  const lastUser = [...req.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const content = `[mock:${req.model}] ${lastUser}`.trim();
  const input = req.messages.reduce((n, m) => n + Math.ceil(m.content.length / 4), 0);
  const output = Math.ceil(content.length / 4);
  return {
    id: `mock_${Date.now()}`,
    provider: providerId,
    model: req.model,
    content,
    finishReason: "stop",
    usage: { input, output, total: input + output },
    raw: { mock: true },
  };
}

export function createMockProvider(id = "mock"): AIProvider {
  return {
    id,
    type: "mock",
    async chat(request) {
      return buildResponse(request, id);
    },
    async *stream(request): AsyncIterable<ChatStreamDelta> {
      const res = buildResponse(request, id);
      const parts = res.content.match(/.{1,12}/g) || [res.content];
      let acc = "";
      for (const p of parts) {
        acc += p;
        yield { type: "delta", content: p };
      }
      yield { type: "done", response: { ...res, content: acc } };
    },
  };
}
