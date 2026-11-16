import "server-only";
import { parseProviderConfig, getProviderConfigFromEnv } from "./config";
import { AIProviderError } from "./errors";
import { createOpenAICompatibleProvider } from "./providers/openai-compatible";
import type { AIProvider, ProviderConfig } from "./types";

export function createProvider(configInput?: Partial<ProviderConfig>): AIProvider {
  const config = configInput ? parseProviderConfig({ ...getProviderConfigFromEnv(), ...configInput } as ProviderConfig) : getProviderConfigFromEnv();
  if (config.type === "openai-compatible") {
    if (!config.baseURL) {
      throw new AIProviderError({ name: "ConfigError", message: "Base URL is required (set AETHER_AI_BASE_URL, e.g. https://openrouter.ai/api/v1)", code: "config_error", retryable: false, provider: config.id });
    }
    if (!config.apiKey) {
      throw new AIProviderError({ name: "ConfigError", message: "API key is required (set AETHER_AI_API_KEY on the server)", code: "config_error", retryable: false, provider: config.id });
    }
    if (!config.defaultModel) {
      throw new AIProviderError({ name: "ConfigError", message: "Model is required (set AETHER_AI_MODEL or choose a model in chat)", code: "config_error", retryable: false, provider: config.id });
    }
    return createOpenAICompatibleProvider({ id: config.id, baseURL: config.baseURL, apiKey: config.apiKey, headers: config.headers });
  }
  throw new AIProviderError({ name: "ConfigError", message: "Unsupported provider configuration", code: "config_error", retryable: false });
}

export function getProvider(overrides?: Partial<ProviderConfig>) {
  return { provider: createProvider(overrides), config: overrides ? parseProviderConfig({ ...getProviderConfigFromEnv(), ...overrides } as ProviderConfig) : getProviderConfigFromEnv() };
}
