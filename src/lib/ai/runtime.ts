import "server-only";
import { AIProviderError, normalizeError } from "./errors";
import { chatRequestSchema } from "./config";
import { tryRecordUsage } from "./usage";
import type { AIProvider, ChatRequest, ChatResponse, ChatStreamDelta } from "./types";

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, timeoutMs: number, provider?: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } catch (e) {
    const err = normalizeError(e, provider);
    if (err.code === "aborted") {
      throw new AIProviderError({ name: "TimeoutError", message: `Request timed out after ${timeoutMs}ms`, code: "timeout", retryable: true, provider });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function chatWithRetry(provider: AIProvider, request: ChatRequest, opts?: { timeoutMs?: number; maxRetries?: number }): Promise<ChatResponse> {
  const req = chatRequestSchema.parse(request);
  const timeoutMs = opts?.timeoutMs ?? 30000;
  const maxRetries = opts?.maxRetries ?? 2;
  let attempt = 0;
  const start = Date.now();
  while (true) {
    try {
      const res = await withTimeout((signal) => provider.chat(req, { signal }), timeoutMs, provider.id);
      tryRecordUsage({ providerId: provider.id, model: req.model, status: "success", response: res, latencyMs: Date.now() - start, metadata: req.metadata });
      return res;
    } catch (e) {
      const err = normalizeError(e, provider.id);
      const canRetry = err.retryable && attempt < maxRetries;
      if (!canRetry) {
        tryRecordUsage({ providerId: provider.id, model: req.model, status: err.code === "rate_limited" ? "rate_limited" : "error", error: err, latencyMs: Date.now() - start, metadata: req.metadata });
        throw err;
      }
      attempt += 1;
      await sleep(Math.min(500 * 2 ** (attempt - 1), 4000));
    }
  }
}

export async function* streamWithRetry(provider: AIProvider, request: ChatRequest, opts?: { timeoutMs?: number; maxRetries?: number }): AsyncIterable<ChatStreamDelta> {
  const req = chatRequestSchema.parse(request);
  const timeoutMs = opts?.timeoutMs ?? 30000;
  const maxRetries = opts?.maxRetries ?? 2;
  let attempt = 0;
  const start = Date.now();
  while (true) {
    let yielded = false;
    let finalResponse: ChatResponse | null = null;
    try {
      // For streaming, enforce overall timeout by racing with timer that aborts
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        for await (const delta of provider.stream(req, { signal: controller.signal })) {
          yielded = true;
          if (delta.type === "done" && delta.response) finalResponse = delta.response;
          yield delta;
          if (delta.type === "done") {
            tryRecordUsage({ providerId: provider.id, model: req.model, status: "success", response: finalResponse, latencyMs: Date.now() - start, metadata: req.metadata });
            return;
          }
        }
        // ended without explicit done
        tryRecordUsage({ providerId: provider.id, model: req.model, status: "success", response: finalResponse, latencyMs: Date.now() - start, metadata: req.metadata });
        return;
      } finally {
        clearTimeout(timer);
      }
    } catch (e) {
      const err = normalizeError(e, provider.id);
      const timeoutErr = err.code === "aborted"
        ? new AIProviderError({ name: "TimeoutError", message: `Request timed out after ${timeoutMs}ms`, code: "timeout", retryable: true, provider: provider.id })
        : err;
      const canRetry = !yielded && timeoutErr.retryable && attempt < maxRetries;
      if (!canRetry) {
        tryRecordUsage({ providerId: provider.id, model: req.model, status: timeoutErr.code === "rate_limited" ? "rate_limited" : "error", error: timeoutErr, latencyMs: Date.now() - start, metadata: req.metadata });
        throw timeoutErr;
      }
      attempt += 1;
      await sleep(Math.min(500 * 2 ** (attempt - 1), 4000));
    }
  }
}
