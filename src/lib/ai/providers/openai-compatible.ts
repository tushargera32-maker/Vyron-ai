import { AIProviderError, errorFromHttpStatus, normalizeError } from "../errors";
import type { AIProvider, ChatStreamDelta, TokenUsage } from "../types";

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function mapUsage(u: unknown): TokenUsage {
  const usage = asRecord(u);
  if (!usage) return { input: null, output: null, total: null };
  const input = (usage.prompt_tokens ?? usage.input_tokens ?? null) as number | null;
  const output = (usage.completion_tokens ?? usage.output_tokens ?? null) as number | null;
  const total = (usage.total_tokens ?? (input != null && output != null ? input + output : null)) as number | null;
  return { input, output, total };
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error?.message || data?.message || JSON.stringify(data);
  } catch {
    try { return await res.text(); } catch { return res.statusText || "Request failed"; }
  }
}

export function createOpenAICompatibleProvider(config: { id: string; baseURL: string; apiKey?: string; headers?: Record<string, string> }): AIProvider {
  const { id, baseURL, apiKey, headers = {} } = config;
  const endpoint = joinUrl(baseURL, "/chat/completions");

  function makeHeaders() {
    const h: Record<string, string> = { "Content-Type": "application/json", ...headers };
    if (apiKey) h.Authorization = `Bearer ${apiKey}`;
    // Optional provider-recommended headers (no secrets)
    if (process.env.AETHER_AI_HTTP_REFERER) h["HTTP-Referer"] = process.env.AETHER_AI_HTTP_REFERER;
    if (process.env.AETHER_AI_X_TITLE) h["X-Title"] = process.env.AETHER_AI_X_TITLE;
    return h;
  }

  return {
    id,
    type: "openai-compatible",
    async chat(request, options) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: makeHeaders(),
          body: JSON.stringify({
            model: request.model,
            messages: request.messages,
            temperature: request.temperature,
            max_tokens: request.max_tokens,
            stream: false,
          }),
          signal: options?.signal,
        });
        if (!res.ok) throw errorFromHttpStatus(res.status, `Provider request failed (${res.status}) at ${endpoint}: ${await readErrorMessage(res)}`, id);
        const data = asRecord(await res.json()) ?? {};
        const choices = Array.isArray(data.choices) ? data.choices : [];
        const choice = asRecord(choices[0]) ?? {};
        const message = asRecord(choice.message);
        const content = message?.content ?? "";
        return {
          id: typeof data.id === "string" ? data.id : `chatcmpl_${Date.now()}`,
          provider: id,
          model: typeof data.model === "string" ? data.model : request.model,
          content: typeof content === "string" ? content : JSON.stringify(content),
          finishReason: typeof choice.finish_reason === "string" ? choice.finish_reason : null,
          usage: mapUsage(data.usage),
          raw: data,
        };
      } catch (e) {
        throw normalizeError(e, id);
      }
    },
    async *stream(request, options): AsyncIterable<ChatStreamDelta> {
      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers: makeHeaders(),
          body: JSON.stringify({
            model: request.model,
            messages: request.messages,
            temperature: request.temperature,
            max_tokens: request.max_tokens,
            stream: true,
          }),
          signal: options?.signal,
        });
      } catch (e) {
        throw normalizeError(e, id);
      }
      if (!res.ok) throw errorFromHttpStatus(res.status, `Provider request failed (${res.status}) at ${endpoint}: ${await readErrorMessage(res)}`, id);
      if (!res.body) throw new AIProviderError({ name: "AIProviderError", message: "Streaming response has no body", code: "invalid_response", retryable: false, provider: id });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";
      let responseId = `chatcmpl_${Date.now()}`;
      let model = request.model;
      let finishReason: string | null = null;
      let usage: TokenUsage = { input: null, output: null, total: null };

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) continue;
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === "[DONE]") {
              yield {
                type: "done",
                response: { id: responseId, provider: id, model, content, finishReason, usage },
              };
              return;
            }
            let parsed: unknown;
            try { parsed = JSON.parse(dataStr); } catch { continue; }
            const json = asRecord(parsed);
            if (!json) continue;
            if (typeof json.id === "string") responseId = json.id;
            if (typeof json.model === "string") model = json.model;
            const choices = Array.isArray(json.choices) ? json.choices : [];
            const choice = asRecord(choices[0]) ?? {};
            const deltaObj = asRecord(choice.delta);
            const delta = typeof deltaObj?.content === "string" ? deltaObj.content : "";
            if (delta) {
              content += delta;
              yield { type: "delta", content: delta };
            }
            if (typeof choice.finish_reason === "string") finishReason = choice.finish_reason;
            if (json.usage) usage = mapUsage(json.usage);
          }
        }
      } finally {
        reader.releaseLock();
      }
      yield { type: "done", response: { id: responseId, provider: id, model, content, finishReason, usage } };
    },
  };
}
