export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  metadata?: {
    conversationId?: string | null;
    messageId?: string | null;
    agentRunId?: string | null;
  };
}

export interface TokenUsage {
  input: number | null;
  output: number | null;
  total?: number | null;
}

export interface ChatResponse {
  id: string;
  provider: string;
  model: string;
  content: string;
  finishReason?: string | null;
  usage: TokenUsage;
  raw?: unknown;
}

export interface ChatStreamDelta {
  type: "delta" | "done" | "error";
  content?: string;
  response?: ChatResponse;
  error?: ProviderErrorShape;
}

export interface ProviderErrorShape {
  name: string;
  message: string;
  code: string;
  status?: number;
  retryable: boolean;
  provider?: string;
  cause?: string;
}

export interface ProviderConfig {
  id: string;
  type: "openai-compatible";
  baseURL?: string;
  apiKey?: string;
  defaultModel?: string;
  timeoutMs?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
  enabled?: boolean;
}

export interface AIProvider {
  readonly id: string;
  readonly type: ProviderConfig["type"];
  chat(request: ChatRequest, options?: { signal?: AbortSignal }): Promise<ChatResponse>;
  stream(request: ChatRequest, options?: { signal?: AbortSignal }): AsyncIterable<ChatStreamDelta>;
}
