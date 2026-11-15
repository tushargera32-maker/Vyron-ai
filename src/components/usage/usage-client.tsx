"use client";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function UsageClient() {
  const [data, setData] = useState<any>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/usage", { cache: "no-store" });
        const d = await r.json();
        if (!cancelled) setData(d);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);
  const t = data?.totals || {};
  const stats = [
    { label: "Requests", value: Number(t.requests ?? 0) },
    { label: "Input tokens", value: Number(t.input_tokens ?? 0) },
    { label: "Output tokens", value: Number(t.output_tokens ?? 0) },
    { label: "Errors", value: Number(t.errors ?? 0) },
  ];
  const max = Math.max(1, ...stats.map(s=>s.value));
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={reduce?false:{opacity:0,y:12}} animate={reduce?{}:{opacity:1,y:0}} transition={{delay:i*0.05}}>
            <Card className="border-white/10 bg-black/30 backdrop-blur-xl">
              <CardHeader className="py-4">
                <CardDescription>{s.label}</CardDescription>
                <CardTitle className="text-2xl">{s.value}</CardTitle>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400" initial={{width:0}} animate={{width:`${Math.max(6,(s.value/max)*100)}%`}} transition={{duration:0.8, delay:0.1+i*0.05}} />
                </div>
              </CardHeader>
            </Card>
          </motion.div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-white/10 bg-black/30 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-base">Usage distribution</CardTitle><CardDescription>Smooth chart transitions from live local telemetry.</CardDescription></CardHeader>
          <CardContent className="flex h-48 items-end gap-3">
            {stats.map((s,i)=> (
              <div key={s.label} className="flex h-full flex-1 flex-col justify-end gap-2">
                <motion.div className="rounded-t-md bg-gradient-to-t from-violet-600/70 to-fuchsia-400/60" initial={{height:0}} animate={{height:`${Math.max(8,(s.value/max)*100)}%`}} transition={{type:"spring", stiffness:120, damping:18, delay:i*0.05}} />
                <div className="text-center text-[11px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-black/30 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-base">Recent usage events</CardTitle></CardHeader>
          <CardContent className="max-h-80 space-y-2 overflow-auto">
            {(data?.events || []).map((e: any, i: number) => (
              <motion.div key={e.id || i} initial={reduce?false:{opacity:0,x:8}} animate={reduce?{}:{opacity:1,x:0}} transition={{delay:Math.min(i*0.02,0.2)}} className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs">
                <div className="font-medium">{e.event_type} · {e.provider_id || "?"} / {e.model_id || "?"} {e.success ? "· ok" : "· error"}</div>
                <div className="text-muted-foreground">in {e.token_input ?? 0} · out {e.token_output ?? 0} · {e.latency_ms ?? 0}ms · {new Date(e.created_at).toLocaleString()}</div>
              </motion.div>
            ))}
            {!data?.events?.length && <div className="text-sm text-muted-foreground">No usage events recorded yet.</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
