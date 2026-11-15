"use client";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Brain, Network } from "lucide-react";

type Mem = { id: string; type: string; content: string; summary?: string | null; status: string; importance: number; confidence: number; created_at: string; metadata_json?: string };
const types = ["all", "working", "episodic", "semantic", "procedural"] as const;

export function MemoryClient() {
  const [items, setItems] = useState<Mem[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ type: "semantic", content: "", summary: "", importance: 0.6, confidence: 0.6 });
  const reduce = useReducedMotion();

  async function load() {
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams();
      if (filterStatus !== "all") qs.set("status", filterStatus);
      if (filterType !== "all") qs.set("type", filterType);
      const res = await fetch(`/api/memories?${qs.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      setItems(data.memories || []);
    } catch (e: any) { setError(e?.message || "Failed"); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const qs = new URLSearchParams();
        if (filterStatus !== "all") qs.set("status", filterStatus);
        if (filterType !== "all") qs.set("type", filterType);
        const res = await fetch(`/api/memories?${qs.toString()}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed");
        if (!cancelled) setItems(data.memories || []);
      } catch (e: any) { if (!cancelled) setError(e?.message || "Failed"); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [filterType, filterStatus]);

  async function act(id: string, action: string, content?: string) {
    await fetch(`/api/memories/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, content }) });
    await load();
  }
  async function createMemory() {
    if (!form.content.trim()) return;
    const res = await fetch("/api/memories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) { setForm({ ...form, content: "", summary: "" }); await load(); }
  }

  const counts = useMemo(() => ({
    total: items.length,
    approved: items.filter(i=>i.status==="approved").length,
    proposed: items.filter(i=>i.status==="proposed").length,
  }), [items]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card className="border-white/10 bg-black/30 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-base">Propose / add memory</CardTitle><CardDescription>Explicit additions are proposed first (user-controlled). Approve to make retrievable.</CardDescription></CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2">
            <select className="h-10 rounded-md border border-white/10 bg-white/5 px-2 text-sm" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>{types.filter(t=>t!=="all").map(t=><option key={t} value={t}>{t}</option>)}</select>
            <input className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-sm" placeholder="Summary (optional)" value={form.summary} onChange={e=>setForm(f=>({...f,summary:e.target.value}))} />
            <textarea className="min-h-24 rounded-md border border-white/10 bg-white/5 p-2 text-sm md:col-span-2" placeholder="Memory content..." value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} />
            <div className="md:col-span-2 flex justify-end"><motion.div whileTap={{scale:0.97}}><Button className="h-10" onClick={createMemory}>Save proposal</Button></motion.div></div>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-black/30 backdrop-blur-xl overflow-hidden">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Network className="h-4 w-4 text-violet-300" />Memory Graph (live)</CardTitle><CardDescription>Real memories visualized as nodes by type/status.</CardDescription></CardHeader>
          <CardContent>
            <div className="relative h-48 rounded-lg border border-white/10 bg-gradient-to-b from-white/5 to-transparent">
              <svg className="absolute inset-0 h-full w-full">
                {items.slice(0, 12).map((m, i) => {
                  const a = (i / Math.max(items.slice(0,12).length,1)) * Math.PI * 2;
                  const x = 50 + Math.cos(a) * 28; const y = 50 + Math.sin(a) * 28;
                  return <motion.line key={`l-${m.id}`} x1="50%" y1="50%" x2={`${x}%`} y2={`${y}%`} stroke={m.status==="approved"?"rgba(149,101,245,0.4)":"rgba(255,255,255,0.12)"} strokeWidth="1" initial={{pathLength:0}} animate={{pathLength:1}} transition={{duration:0.8, delay:i*0.03}} />;
                })}
              </svg>
              <motion.div className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-violet-400/30 bg-violet-500/10" animate={reduce?{}:{boxShadow:["0 0 0 rgba(149,101,245,0)","0 0 24px rgba(149,101,245,0.28)","0 0 0 rgba(149,101,245,0)"]}} transition={{duration:3, repeat:Infinity}}><Brain className="h-5 w-5 text-violet-200" /></motion.div>
              {items.slice(0, 12).map((m, i) => {
                const a = (i / Math.max(items.slice(0,12).length,1)) * Math.PI * 2;
                const x = 50 + Math.cos(a) * 34; const y = 50 + Math.sin(a) * 34;
                const color = m.status==="approved"?"bg-violet-400":m.status==="proposed"?"bg-amber-400":"bg-white/30";
                return <motion.div key={m.id} className={`absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${color}`} style={{left:`${x}%`, top:`${y}%`}} initial={{scale:0}} animate={{scale:1}} transition={{delay:0.1+i*0.03}} title={`${m.type} · ${m.status}`} />;
              })}
              {!items.length && <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">No memories yet</div>}
            </div>
            <div className="mt-3 flex gap-3 text-xs text-muted-foreground"><span>Total: {counts.total}</span><span className="text-violet-300">Approved: {counts.approved}</span><span className="text-amber-300">Proposed: {counts.proposed}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-black/30 backdrop-blur-xl">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Memories</CardTitle>
            <select className="h-10 rounded-md border border-white/10 bg-white/5 px-2 text-xs sm:text-sm" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}><option value="all">all status</option><option value="proposed">proposed</option><option value="approved">approved</option><option value="archived">archived</option><option value="rejected">rejected</option></select>
            <select className="h-10 rounded-md border border-white/10 bg-white/5 px-2 text-xs sm:text-sm" value={filterType} onChange={e=>setFilterType(e.target.value)}>{types.map(t=><option key={t} value={t}>{t}</option>)}</select>
            <Button size="sm" variant="outline" className="h-10 px-3" onClick={load} disabled={loading}>Refresh</Button>
          </div>
          {error && <div className="text-sm text-red-300">{error}</div>}
        </CardHeader>
        <CardContent className="space-y-2">
          <AnimatePresence initial={false}>
            {items.map((m, i) => (
              <motion.div key={m.id} layout initial={reduce?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{delay: Math.min(i*0.02,0.2)}} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded bg-primary/15 px-2 py-0.5 text-primary">{m.type}</span><span className="rounded bg-white/10 px-2 py-0.5">{m.status}</span><span className="text-muted-foreground">imp {m.importance.toFixed(2)} · conf {m.confidence.toFixed(2)}</span></div>
                  <div className="flex flex-wrap gap-1.5">
                    {m.status !== "approved" && <Button size="sm" variant="secondary" className="h-9 min-h-[40px] px-3" onClick={()=>act(m.id,"approve")}>Approve</Button>}
                    {m.status === "proposed" && <Button size="sm" variant="outline" className="h-9 min-h-[40px] px-3" onClick={()=>act(m.id,"reject")}>Reject</Button>}
                    <Button size="sm" variant="outline" className="h-9 min-h-[40px] px-3" onClick={()=>{ const v = prompt("Edit memory content", m.content); if (v!=null) act(m.id,"edit",v); }}>Edit</Button>
                    <Button size="sm" variant="outline" className="h-9 min-h-[40px] px-3" onClick={()=>act(m.id,"archive")}>Archive</Button>
                    <Button size="sm" variant="ghost" className="h-9 min-h-[40px] px-3" onClick={()=>act(m.id,"delete")}>Delete</Button>
                  </div>
                </div>
                <div className="mt-2 text-sm whitespace-pre-wrap">{m.content}</div>
                <div className="mt-1 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()} · {m.id}</div>
              </motion.div>
            ))}
          </AnimatePresence>
          {!items.length && !loading && <div className="text-sm text-muted-foreground">No memories found.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
