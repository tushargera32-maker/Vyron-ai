import { NextResponse } from "next/server";
import { getProviderConfigFromEnv } from "@/lib/ai/config";

export async function GET() {
  try {
    const cfg = getProviderConfigFromEnv();
    // server-side config only; never return apiKey
    return NextResponse.json({
      config: {
        id: cfg.id,
        type: cfg.type,
        label: "OpenRouter",
        baseURL: cfg.baseURL || null,
        defaultModel: cfg.defaultModel || null,
        timeoutMs: cfg.timeoutMs,
        maxRetries: cfg.maxRetries,
        hasApiKey: !!cfg.apiKey,
        supportsStreaming: true,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
