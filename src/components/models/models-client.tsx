"use client";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Settings2, ShieldCheck, Cpu } from "lucide-react";

export function ModelsClient() {
  const [cfg, setCfg] = useState<any>(null);
  const reduce = useReducedMotion();
  useEffect(() => { fetch("/api/models", { cache: "no-store" }).then(r=>r.json()).then(d=>setCfg(d.config)).catch(()=>{}); }, []);
  return (
    <motion.div initial={reduce?false:{opacity:0}} animate={reduce?{}:{opacity:1}} className="grid gap-4 lg:grid-cols-2">
      <Card className="border-white/10 bg-black/30 backdrop-blur-xl">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Cpu className="h-4 w-4 text-violet-300" />Active provider configuration</CardTitle><CardDescription>Server-side environment/config (API keys never exposed to browser).</CardDescription></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!cfg ? <div className="text-muted-foreground">Loading...</div> : (
            <motion.div initial={reduce?false:{opacity:0,y:8}} animate={reduce?{}:{opacity:1,y:0}} className="space-y-2">
              {[
                ["Provider", `${cfg.label || "OpenRouter"} (${cfg.id || "openrouter"})`],
                ["Base URL", cfg.baseURL || "https://openrouter.ai/api/v1"],
                ["Default model", cfg.defaultModel || "(not set)"],
                ["Streaming", cfg.supportsStreaming ? "supported" : "not supported"],
                ["Timeout / retries", `${cfg.timeoutMs}ms / ${cfg.maxRetries}`],
              ].map(([k,v],i)=>(
                <motion.div key={k as string} initial={reduce?false:{opacity:0,x:-6}} animate={reduce?{}:{opacity:1,x:0}} transition={{delay:i*0.04}} className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2">
                  <span className="text-muted-foreground">{k}</span><span className="font-medium">{String(v)}</span>
                </motion.div>
              ))}
              <div className="inline-flex items-center gap-2 rounded-md border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-emerald-200"><ShieldCheck className="h-4 w-4" />API key configured: {cfg.hasApiKey ? "yes" : "no"}</div>
            </motion.div>
          )}
        </CardContent>
      </Card>
      <Card className="border-white/10 bg-black/30 backdrop-blur-xl">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Settings2 className="h-4 w-4 text-violet-300" />How to configure</CardTitle><CardDescription>VYRON uses OpenRouter (OpenAI-compatible API) via server-side environment variables.</CardDescription></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Set these server-side env vars (Render/VPS/.env.local). <strong>Mock/offline mode is removed</strong> — an API key and model are required.</p>
          <motion.div className="relative overflow-hidden rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-xs text-violet-100/90" animate={reduce?{}:{boxShadow:["0 0 0 rgba(149,101,245,0)","0 0 24px rgba(149,101,245,0.10)","0 0 0 rgba(149,101,245,0)"]}} transition={{duration:4, repeat:Infinity}}>
            <div>AETHER_AI_PROVIDER=openai-compatible</div>
            <div>AETHER_AI_BASE_URL=https://openrouter.ai/api/v1</div>
            <div>AETHER_AI_API_KEY=*** (server-side)</div>
            <div>AETHER_AI_MODEL=openrouter/auto (or any OpenRouter model id)</div>
            <motion.div className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent" animate={reduce?{}:{x:["0%","450%"]}} transition={{duration:3.5, repeat:Infinity, ease:"linear"}} />
          </motion.div>
          <p>After changing env vars on Render, redeploy/restart the service. You can override the model per conversation in Chat → Advanced.</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
