import { Suspense } from "react";
import { connection } from "next/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getProviderConfigFromEnv } from "@/lib/ai/config";

async function SettingsContent() {
  await connection();
  let cfg: ReturnType<typeof getProviderConfigFromEnv> | null = null;
  let cfgError: string | null = null;
  try { cfg = getProviderConfigFromEnv(); } catch (e: any) { cfgError = e?.message || "Invalid provider configuration"; }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-white/10 bg-black/30 backdrop-blur-xl">
        <CardHeader><CardTitle className="text-base">AI Provider (server-side)</CardTitle><CardDescription>OpenRouter API only (mock/offline removed). Configured via environment variables; API keys are never exposed to the browser.</CardDescription></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {cfgError && <div className="rounded-md border border-[#F16C78]/30 bg-[#F16C78]/10 px-3 py-2 text-[13px] text-[#f7a1aa]">{cfgError}</div>}
          {cfg && [
            ["Provider", `OpenRouter (${cfg.id})`],
            ["Default model", cfg.defaultModel || "(not set)"],
            ["Base URL", cfg.baseURL || "https://openrouter.ai/api/v1"],
            ["API key configured", cfg.apiKey ? "yes" : "no"],
            ["Streaming", "supported"],
            ["Timeout / Retries", `${cfg.timeoutMs}ms / ${cfg.maxRetries}`],
          ].map(([k,v]) => (
            <div key={String(k)} className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-white/5 px-3 py-2">
              <span className="text-muted-foreground">{k}</span><span className="text-right font-medium break-all">{String(v)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="border-white/10 bg-black/30 backdrop-blur-xl">
        <CardHeader><CardTitle className="text-base">Experience & Motion</CardTitle><CardDescription>Premium cinematic interface with accessibility-aware behavior.</CardDescription></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="rounded-md border border-white/10 bg-white/5 p-3">Reduced motion: automatically respected via your system preference (<code className="text-foreground">prefers-reduced-motion</code>).</div>
          <div className="rounded-md border border-white/10 bg-white/5 p-3">Background effects: decorative animations pause when the tab is inactive to conserve resources.</div>
          <div className="rounded-md border border-white/10 bg-white/5 p-3">Local-first: conversations, memories, knowledge, and usage are stored locally in SQLite; secrets remain server-side.</div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Settings" description="System configuration, provider status, and local-first runtime preferences." />
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl border border-white/10 bg-white/5" />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}
