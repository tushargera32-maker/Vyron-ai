"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Upload, Search, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

type Doc = { id: string; title: string; source_type: string; status: string; file_size_bytes: number; created_at: string; error_json?: string | null };

export function KnowledgeClient() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const reduce = useReducedMotion();

  async function load() {
    const res = await fetch("/api/knowledge", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setDocs(data.documents || []);
  }
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/knowledge", { cache: "no-store" });
      const data = await res.json();
      if (!cancelled && res.ok) setDocs(data.documents || []);
    })();
    return () => { cancelled = true; };
  }, []);

  async function upload() {
    if (!file) return;
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/knowledge", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Upload failed");
      setMsg(`Indexed ${data.document?.title || "document"} (${data.chunkCount} chunks).`);
      setFile(null); await load();
    } catch (e: any) { setMsg(e?.message || "Upload failed"); }
    finally { setBusy(false); }
  }
  async function search() {
    if (!q.trim()) { setResults([]); return; }
    const res = await fetch(`/api/knowledge/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setResults(data.results || []);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-white/10 bg-black/30 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-base">Upload & ingest</CardTitle><CardDescription>Local ingestion for PDF, TXT, Markdown, DOCX. Chunking + FTS5 indexing; retrieval with source references.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <motion.label whileHover={reduce?undefined:{scale:1.005}} className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/5 p-6 text-center transition-colors hover:border-primary/40 hover:bg-primary/5">
              <Upload className="mb-2 h-5 w-5 text-primary" />
              <span className="text-sm">{file ? file.name : "Choose a document to ingest"}</span>
              <input type="file" className="hidden" accept=".pdf,.txt,.md,.docx" onChange={e=>setFile(e.target.files?.[0]||null)} />
            </motion.label>
            <div className="flex items-center gap-2"><Button className="h-10" onClick={upload} disabled={!file || busy}>{busy ? <><Loader2 className="h-4 w-4 animate-spin" />Processing...</> : "Ingest document"}</Button></div>
            <AnimatePresence>{msg && <motion.div initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="text-sm text-muted-foreground">{msg}</motion.div>}</AnimatePresence>
            <AnimatePresence>{busy && (
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="space-y-2 rounded-lg border border-violet-400/20 bg-violet-500/5 p-3">
                <div className="flex items-center gap-2 text-xs text-violet-200"><Loader2 className="h-3.5 w-3.5 animate-spin" />Document processing pipeline active</div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full w-1/3 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400" animate={{x:["-100%","300%"]}} transition={{duration:1.4, repeat:Infinity, ease:"linear"}} /></div>
              </motion.div>
            )}</AnimatePresence>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-black/30 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-base">Search knowledge</CardTitle><CardDescription>Keyword (FTS5) + hybrid local semantic fallback with source citations.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2"><input className="h-10 flex-1 rounded-md border border-white/10 bg-white/5 px-3 text-sm" placeholder="Search indexed chunks..." value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")search();}} /><Button variant="secondary" className="h-10" onClick={search}><Search className="h-4 w-4" />Search</Button></div>
            <div className="max-h-64 space-y-2 overflow-auto">
              <AnimatePresence initial={false}>
                {results.map((r:any, i:number)=>(
                  <motion.div key={r.chunk_id||i} initial={reduce?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="rounded-lg border border-white/10 bg-white/5 p-2">
                    <div className="text-xs text-muted-foreground">Source: {r.document_title || r.document_id} · chunk {r.chunk_index} · {r.source_type}</div>
                    <div className="mt-1 text-sm whitespace-pre-wrap">{String(r.content||"").slice(0,400)}</div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {!results.length && <div className="text-sm text-muted-foreground">No search results yet.</div>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-black/30 backdrop-blur-xl">
        <CardHeader><CardTitle className="text-base">Documents</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <AnimatePresence initial={false}>
            {docs.map((d, i)=>(
              <motion.div key={d.id} layout initial={reduce?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:Math.min(i*0.03,0.2)}} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-primary/10 p-2 text-primary"><FileText className="h-4 w-4" /></div>
                  <div>
                    <div className="font-medium">{d.title}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">{d.status==="ready"?<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />:d.status==="failed"?<AlertCircle className="h-3.5 w-3.5 text-red-400" />:<Loader2 className="h-3.5 w-3.5 animate-spin text-violet-300" />}{d.status}</span>
                      <span>{d.source_type.toUpperCase()} · {Math.round((d.file_size_bytes||0)/1024)} KB · {new Date(d.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={async()=>{ await fetch(`/api/knowledge/${d.id}`, { method: "DELETE" }); await load(); }}>Delete</Button>
              </motion.div>
            ))}
          </AnimatePresence>
          {!docs.length && <div className="text-sm text-muted-foreground">No documents ingested yet.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
