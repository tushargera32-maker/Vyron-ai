import "server-only";
import { ensureDbReady } from "@/lib/db";
import { recordUsageEvent } from "@/lib/db/repositories/usage";
import type { ChatResponse } from "./types";
import type { AIProviderError } from "./errors";

export function tryRecordUsage(params: {
  providerId: string;
  model: string;
  status: string;
  response?: ChatResponse | null;
  error?: AIProviderError | null;
  latencyMs?: number | null;
  metadata?: { conversationId?: string | null; messageId?: string | null; agentRunId?: string | null };
  record?: boolean;
}) {
  if (params.record === false) return;
  if (process.env.VITEST && params.record !== true) return;
  try {
    const db = ensureDbReady();
    recordUsageEvent(db, {
      conversation_id: params.metadata?.conversationId ?? null,
      message_id: params.metadata?.messageId ?? null,
      agent_run_id: params.metadata?.agentRunId ?? null,
      provider_id: params.providerId,
      model_id: params.response?.model || params.model,
      token_input: params.response?.usage?.input ?? null,
      token_output: params.response?.usage?.output ?? null,
      latency_ms: params.latencyMs ?? null,
      status: params.status,
      error_json: params.error ? JSON.stringify(params.error.toJSON ? params.error.toJSON() : { message: params.error.message }) : null,
    });
  } catch {
    // Usage tracking must not break provider calls
  }
}
