import "server-only";
import { z } from "zod";
import type { ProviderConfig } from "./types";

const providerConfigSchema = z.object({
  id: z.string().min(1),
  type: z.literal("openai-compatible"),
  baseURL: z.string().url().optional(),
  apiKey: z.string().min(1).optional(),
  defaultModel: z.string().min(1).optional(),
  timeoutMs: z.number().int().positive().max(120000).optional(),
  maxRetries: z.number().int().min(0).max(5).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().optional(),
});

export const chatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string(),
  name: z.string().optional(),
});

export const chatRequestSchema = z.object({
  model: z.string().min(1),
  messages: z.array(chatMessageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  stream: z.boolean().optional(),
  metadata: z
    .object({
      conversationId: z.string().nullable().optional(),
      messageId: z.string().nullable().optional(),
      agentRunId: z.string().nullable().optional(),
    })
    .optional(),
});

export function parseProviderConfig(input: unknown): ProviderConfig {
  return providerConfigSchema.parse(input) as ProviderConfig;
}

export function getProviderConfigFromEnv(overrides?: Partial<ProviderConfig>): ProviderConfig {
  // OpenRouter (OpenAI-compatible API) only. AETHER_AI_* env names preserved.
  const cfg: ProviderConfig = {
    id: overrides?.id || process.env.AETHER_AI_PROVIDER_ID || "openrouter",
    type: "openai-compatible",
    baseURL: overrides?.baseURL || process.env.AETHER_AI_BASE_URL || "https://openrouter.ai/api/v1",
    apiKey: overrides?.apiKey || process.env.AETHER_AI_API_KEY || undefined,
    defaultModel: overrides?.defaultModel || process.env.AETHER_AI_MODEL || undefined,
    timeoutMs: overrides?.timeoutMs ?? (process.env.AETHER_AI_TIMEOUT_MS ? Number(process.env.AETHER_AI_TIMEOUT_MS) : 30000),
    maxRetries: overrides?.maxRetries ?? (process.env.AETHER_AI_MAX_RETRIES ? Number(process.env.AETHER_AI_MAX_RETRIES) : 2),
    headers: overrides?.headers,
    enabled: overrides?.enabled ?? true,
  };
  return parseProviderConfig(cfg);
}
