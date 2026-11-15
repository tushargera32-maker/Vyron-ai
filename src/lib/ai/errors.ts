import type { ProviderErrorShape } from "./types";

export class AIProviderError extends Error implements ProviderErrorShape {
  code: string;
  status?: number;
  retryable: boolean;
  provider?: string;
  cause?: string;

  constructor(init: ProviderErrorShape & { cause?: unknown }) {
    super(init.message);
    this.name = init.name || "AIProviderError";
    this.code = init.code;
    this.status = init.status;
    this.retryable = init.retryable;
    this.provider = init.provider;
    this.cause = init.cause;
  }

  toJSON(): ProviderErrorShape {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      retryable: this.retryable,
      provider: this.provider,
      cause: this.cause,
    };
  }
}

export function normalizeError(err: unknown, provider?: string): AIProviderError {
  if (err instanceof AIProviderError) return err;
  if (err instanceof Error) {
    const anyErr = err as Error & { code?: string };
    const isAbort = err.name === "AbortError" || anyErr.code === "ABORT_ERR";
    const isTimeout = anyErr.code === "ETIMEDOUT" || /timeout/i.test(err.message);
    return new AIProviderError({
      name: isAbort ? "AbortError" : "AIProviderError",
      message: err.message || "Provider request failed",
      code: isAbort ? "aborted" : isTimeout ? "timeout" : "unknown_error",
      retryable: isTimeout,
      provider,
      cause: err.stack || err.message,
    });
  }
  return new AIProviderError({
    name: "AIProviderError",
    message: "Unknown provider error",
    code: "unknown_error",
    retryable: false,
    provider,
    cause: String(err),
  });
}

export function errorFromHttpStatus(status: number, message: string, provider?: string): AIProviderError {
  const retryable = status === 408 || status === 429 || status >= 500;
  let code = "http_error";
  if (status === 401 || status === 403) code = "auth_error";
  else if (status === 404) code = "not_found";
  else if (status === 429) code = "rate_limited";
  else if (status >= 500) code = "server_error";
  else if (status >= 400) code = "bad_request";
  return new AIProviderError({ name: "AIProviderError", message, code, status, retryable, provider });
}
