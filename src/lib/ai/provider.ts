import "server-only";
import { parseProviderConfig, getProviderConfigFromEnv } from "./config";
import { AIProviderError } from "./errors";
import { createMockProvider } from "./providers/mock";
import { createOpenAICompatibleProvider } from "./providers/openai-compatible";
import type { AIProvider, ProviderConfig } from "./types";

export function createProvider(configInput?: Partial<ProviderConfig>): AIProvider {
  const config = configInput ? parseProviderConfig({ ...getProviderConfigFromEnv(), ...configInput } as ProviderConfig) : getProviderConfigFromEnv();
  if (config.type === "mock") return createMockProvider(config.id);
  if (config.type === "openai-compatible") {
    if (!config.baseURL) {
      throw new AIProviderError({ name: "ConfigError", message: "baseURL is required for openai-compatible provider (set AETHER_AI_BASE_URL)", code: "config_error", retryable: false, provider: config.id });
    }
    if (!config.apiKey) {
      throw new AIProviderError({ name: "ConfigError", message: "API key is required for openai-compatible provider (set AETHER_AI_API_KEY on the server)", code: "config_error", retryable: false, provider: config.id });
    }
    return createOpenAICompatibleProvider({ id: config.id, baseURL: config.baseURL, apiKey: config.apiKey, headers: config.headers });
  }
  throw new AIProviderError({ name: "ConfigError", message: `Unsupported provider type: ${String((config as { type?: unknown }).type)}`, code: "config_error", retryable: false });
}

export function getProvider(overrides?: Partial<ProviderConfig>) {
  return { provider: createProvider(overrides), config: overrides ? parseProviderConfig({ ...getProviderConfigFromEnv(), ...overrides } as ProviderConfig) : getProviderConfigFromEnv() };
}
