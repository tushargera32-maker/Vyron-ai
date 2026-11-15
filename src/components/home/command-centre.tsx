"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { VyronCore } from "@/components/motion/vyron-core";
import type { HomeDashboardData } from "@/lib/dashboard/home-data";
import { cn } from "@/lib/utils";
import {
  Paperclip, Mic, Send, ChevronRight, ChevronDown, Search, FolderKanban, Bot, Sparkles,
  Activity, Brain, Library, Cpu, ArrowUpRight, MessageSquare
} from "lucide-react";

function timeAgo(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "—";
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24); return `${days}d ago`;
}

function PanelSection({ title, subtitle, children, defaultOpen = true }: { title: string; subtitle?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-[14px] border border-[#292932] bg-[#111116]/40">
      <button onClick={() => setOpen(v => !v)} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left">
        <div>
          <div className="text-[13px] font-medium text-[#F5F3FA]">{title}</div>
          {subtitle && <div className="text-[11px] text-[#777582]">{subtitle}</div>}
        </div>
        <ChevronDown className={cn("h-4 w-4 text-[#777582] transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="border-t border-[#292932] px-3 py-2.5 text-sm">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatRow({ label, value, tone = "muted" }: { label: string; value: string; tone?: "muted" | "good" | "warn" | "bad" }) {
  const toneCls = tone === "good" ? "text-[#36D6A0]" : tone === "warn" ? "text-[#E7B45B]" : tone === "bad" ? "text-[#F16C78]" : "text-[#AAA7B5]";
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
      <span className="text-[#AAA7B5]">{label}</span>
      <span className={cn("font-medium", toneCls)}>{value}</span>
    </div>
  );
}

function Composer({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const reduce = useReducedMotion();

  function submit(text?: string) {
    const v = (text ?? value).trim();
    if (!v) return;
    try { sessionStorage.setItem("vyron:pendingPrompt", v); } catch {}
    setValue("");
    router.push(`/chat?prompt=${encodeURIComponent(v)}`);
  }

  function onMic() {
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { alert("Voice input is unavailable in this browser."); return; }
    try {
      const rec = new SR();
      rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onstart = () => setListening(true);
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      rec.onresult = (e: any) => { const t = e?.results?.[0]?.[0]?.transcript; if (t) setValue(prev => (prev ? prev + " " : "") + t); };
      rec.start();
    } catch { setListening(false); }
  }

  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={reduce ? {} : { opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className={cn("w-full", compact ? "" : "mx-auto max-w-[840px]")}>
      <div className="rounded-[18px] border border-[#292932] bg-[#111116] p-2 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
        <div className="flex items-end gap-1.5">
          <button onClick={() => router.push('/knowledge')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#777582] hover:bg-white/5 hover:text-[#F5F3FA]" title="Attach / Knowledge"><Paperclip className="h-4 w-4" /></button>
          <textarea
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="Ask VYRON anything..."
            rows={1}
            className="max-h-32 min-h-[40px] flex-1 resize-y bg-transparent px-1 py-2 text-[14px] text-[#F5F3FA] outline-none placeholder:text-[#777582]"
          />
          <button onClick={onMic} className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-white/5", listening ? "text-[#A970FF]" : "text-[#777582] hover:text-[#F5F3FA]")} title={listening ? "Listening..." : "Voice input"}><Mic className="h-4 w-4" /></button>
          <button onClick={() => router.push('/models')} className="hidden h-9 shrink-0 items-center rounded-lg border border-[#292932] bg-[#18181F] px-3 text-xs text-[#AAA7B5] hover:text-[#F5F3FA] sm:inline-flex">Model</button>
          <button onClick={() => submit()} disabled={!value.trim()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#9565F5] text-white transition hover:bg-[#A970FF] disabled:opacity-40"><Send className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[11px]">
        <Link href="/models" className="inline-flex items-center gap-1 rounded-full border border-[#292932] px-2.5 py-1 text-[#777582] hover:border-[#9565F5]/35 hover:text-[#AAA7B5]"><Cpu className="h-3.5 w-3.5" />Model selection</Link>
        <Link href="/memory" className="inline-flex items-center gap-1 rounded-full border border-[#292932] px-2.5 py-1 text-[#777582] hover:border-[#9565F5]/35 hover:text-[#AAA7B5]"><Brain className="h-3.5 w-3.5" />Memory context</Link>
        <Link href="/knowledge" className="inline-flex items-center gap-1 rounded-full border border-[#292932] px-2.5 py-1 text-[#777582] hover:border-[#9565F5]/35 hover:text-[#AAA7B5]"><Library className="h-3.5 w-3.5" />Knowledge context</Link>
        <Link href="/agents" className="inline-flex items-center gap-1 rounded-full border border-[#292932] px-2.5 py-1 text-[#777582] hover:border-[#9565F5]/35 hover:text-[#AAA7B5]"><Bot className="h-3.5 w-3.5" />Agent access</Link>
      </div>
    </motion.div>
  );
}

function IntelligencePanel({ data }: { data: HomeDashboardData }) {
  const providerOk = data.system.provider === "configured";
  return (
    <div className="space-y-3">
      <PanelSection title="System Status" subtitle="Local-first runtime">
        <div className="divide-y divide-[#292932]/60">
          <StatRow label="Interface" value="Ready" tone="good" />
          <StatRow label="Memory & Knowledge" value={data.system.memoryKnowledge === "available" ? "Available" : "Unavailable"} tone={data.system.memoryKnowledge === "available" ? "good" : "warn"} />
          <StatRow label="AI Provider" value={providerOk ? "Configured" : "Unconfigured"} tone={providerOk ? "good" : "warn"} />
          {data.system.providerName && <div className="pt-2 text-[11px] text-[#777582]">Provider: {data.system.providerName}</div>}
        </div>
      </PanelSection>
      <PanelSection title="Memory">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-[#292932] bg-[#18181F]/40 p-2"><div className="text-base font-semibold text-[#F5F3FA]">{data.memory.total}</div><div className="text-[11px] text-[#777582]">Total</div></div>
          <div className="rounded-lg border border-[#292932] bg-[#18181F]/40 p-2"><div className="text-base font-semibold text-[#36D6A0]">{data.memory.approved}</div><div className="text-[11px] text-[#777582]">Approved</div></div>
          <div className="rounded-lg border border-[#292932] bg-[#18181F]/40 p-2"><div className="text-base font-semibold text-[#E7B45B]">{data.memory.proposed}</div><div className="text-[11px] text-[#777582]">Proposed</div></div>
        </div>
        <Link href="/memory" className="mt-2 inline-flex items-center gap-1 text-xs text-[#A970FF] hover:text-[#D2B5FF]">Memory Explorer <ArrowUpRight className="h-3.5 w-3.5" /></Link>
      </PanelSection>
      <PanelSection title="Knowledge">
        <div className="space-y-1.5 text-[13px]">
          <div className="flex justify-between"><span className="text-[#AAA7B5]">Indexed documents</span><span className="text-[#F5F3FA]">{data.knowledge.indexed}</span></div>
          <div className="flex justify-between"><span className="text-[#AAA7B5]">Processing</span><span className="text-[#F5F3FA]">{data.knowledge.processing}</span></div>
          <div className="flex justify-between"><span className="text-[#AAA7B5]">Total</span><span className="text-[#F5F3FA]">{data.knowledge.total}</span></div>
        </div>
        <Link href="/knowledge" className="mt-2 inline-flex items-center gap-1 text-xs text-[#A970FF] hover:text-[#D2B5FF]">Knowledge search <ArrowUpRight className="h-3.5 w-3.5" /></Link>
      </PanelSection>
      <PanelSection title="Projects">
        <div className="text-[13px] text-[#AAA7B5]">Active projects: <span className="font-medium text-[#F5F3FA]">{data.projects.activeCount}</span></div>
        <div className="mt-2 space-y-1.5">
          {data.projects.recent.length ? data.projects.recent.map(p => (
            <div key={p.id} className="flex items-center justify-between rounded-md border border-[#292932] bg-[#18181F]/30 px-2 py-1.5 text-[12px]"><span className="truncate text-[#F5F3FA]">{p.name}</span><span className="ml-2 shrink-0 text-[#777582]">{timeAgo(p.updated_at)}</span></div>
          )) : <div className="text-xs text-[#777582]">No projects yet.</div>}
        </div>
        <Link href="/projects" className="mt-2 inline-flex items-center gap-1 text-xs text-[#A970FF] hover:text-[#D2B5FF]">Project workspace <ArrowUpRight className="h-3.5 w-3.5" /></Link>
      </PanelSection>
      <PanelSection title="Agents">
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-wide text-[#777582]">Available specialist agents</div>
          {data.agents.available.map(a => (
            <div key={a.id} className="flex items-center justify-between text-[13px]"><span className="text-[#F5F3FA]">{a.name}</span><span className="inline-flex items-center gap-1 text-[#36D6A0]"><span className="h-1.5 w-1.5 rounded-full bg-[#36D6A0]" />Available</span></div>
          ))}
        </div>
        <div className="mt-3 space-y-1 border-t border-[#292932] pt-2 text-[12px]">
          <div className="flex justify-between"><span className="text-[#AAA7B5]">Currently executing</span><span className="text-[#777582]">{data.agents.executingTracked ? "—" : "Unavailable (not tracked)"}</span></div>
          <div className="flex justify-between"><span className="text-[#AAA7B5]">Pending approvals</span><span className="text-[#777582]">{data.agents.pendingApprovalsTracked ? "—" : "Unavailable (not tracked)"}</span></div>
        </div>
      </PanelSection>
      <PanelSection title="Usage">
        {data.usage.hasAny ? (
          <div className="space-y-2">
            {data.usage.recent.slice(0, 5).map(u => (
              <div key={u.id} className="rounded-md border border-[#292932] bg-[#18181F]/30 p-2 text-[12px]">
                <div className="flex items-center justify-between"><span className="text-[#F5F3FA]">{u.provider_id || "provider"} / {u.model_id || "model"}</span><span className={u.status === "success" || u.status === "ok" ? "text-[#36D6A0]" : "text-[#E7B45B]"}>{u.status}</span></div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[#777582]"><span>in: {u.token_input ?? "—"}</span><span>out: {u.token_output ?? "—"}</span><span>latency: {u.latency_ms != null ? `${u.latency_ms}ms` : "—"}</span></div>
                <div className="mt-0.5 text-[#777582]">{timeAgo(u.created_at)}</div>
              </div>
            ))}
          </div>
        ) : <div className="text-xs text-[#777582]">No usage events recorded yet.</div>}
      </PanelSection>
      <PanelSection title="Recent Activity">
        {data.activity.length ? (
          <div className="space-y-2">
            {data.activity.map(a => (
              <div key={a.id} className="flex items-start gap-2 text-[12px]">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#9565F5]" />
                <div className="min-w-0 flex-1"><div className="truncate text-[#F5F3FA]">{a.label}</div><div className="text-[#777582]">{timeAgo(a.at)}</div></div>
              </div>
            ))}
          </div>
        ) : <div className="text-xs text-[#777582]">No recent activity yet.</div>}
      </PanelSection>
    </div>
  );
}

export function HomeCommandCentre({ data }: { data: HomeDashboardData }) {
  const reduce = useReducedMotion();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const desktopQuickActions = [
    { label: "Work on a project", icon: FolderKanban, onClick: () => router.push("/projects") },
    { label: "Search knowledge", icon: Search, onClick: () => router.push("/knowledge") },
    { label: "Use an agent", icon: Bot, onClick: () => router.push("/agents") },
    { label: "Analyze & plan", icon: Sparkles, onClick: () => { const p = "Help me analyze and plan: "; try { sessionStorage.setItem("vyron:pendingPrompt", p); } catch {} router.push(`/chat?prompt=${encodeURIComponent(p)}`); } },
  ];

  // MOBILE
  const mobile = (
    <div className="flex h-full flex-col md:hidden">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[#292932] bg-[#070709]/90 px-4 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[#292932] bg-[#18181F]"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5"><path d="M4 4 L12 20 L20 4 L17.5 4 L12 15 L6.5 4 Z" fill="#D2B5FF" /></svg></div>
          <span className="text-[13px] font-semibold tracking-[0.18em] text-[#F5F3FA]">VYRON</span>
        </div>
        <div className="flex items-center gap-1">
          <Link href="/knowledge" className="rounded-md p-2 text-[#777582] hover:bg-white/5 hover:text-[#F5F3FA]"><Search className="h-4 w-4" /></Link>
          <Link href="/profile" className="flex h-7 w-7 items-center justify-center rounded-full border border-[#292932] bg-[#18181F] text-[11px] text-[#F5F3FA]">{data.profile.name.slice(0, 1).toUpperCase()}</Link>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-4">
          <div className="text-[13px] text-[#AAA7B5]">Hi, {data.profile.name}</div>
        </div>
        <div className="flex flex-col items-center px-4 pt-6 text-center">
          <VyronCore state="idle" size={132} />
          <div className="mt-4 text-[12px] font-medium tracking-[0.24em] text-[#A970FF]">VYRON</div>
          <h1 className="mt-2 text-[28px] font-medium leading-tight tracking-tight text-[#F5F3FA]">How can I help you today?</h1>
          <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-[#AAA7B5]">YOUR MIND. YOUR MACHINE. YOUR COMMAND.</p>
          <p className="mt-3 max-w-[340px] text-[14px] leading-relaxed text-[#AAA7B5]">Your personal intelligence workspace for conversation, memory, knowledge and execution.</p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 px-4">
          {[
            { label: "Chat", href: "/chat", icon: MessageSquare },
            { label: "Projects", href: "/projects", icon: FolderKanban },
            { label: "Memory", href: "/memory", icon: Brain },
            { label: "Agents", href: "/agents", icon: Bot },
          ].map((a) => {
            const Icon = a.icon;
            return (
              <Link key={a.label} href={a.href} className="flex items-center gap-2.5 rounded-[14px] border border-[#292932] bg-[#111116]/50 px-3 py-3 text-[14px] text-[#F5F3FA]">
                <Icon className="h-4 w-4 text-[#AAA7B5]" />{a.label}
              </Link>
            );
          })}
        </div>
        <div className="mt-5 px-4 pb-4">
          <Composer compact />
        </div>
        <div className="space-y-2.5 px-4 pb-6">
          <div className="text-[13px] font-medium text-[#F5F3FA]">Intelligence overview</div>
          <PanelSection title="System Status" subtitle="Local-first runtime" defaultOpen={false}>
            <StatRow label="Interface" value="Ready" tone="good" />
            <StatRow label="Memory & Knowledge" value={data.system.memoryKnowledge === "available" ? "Available" : "Unavailable"} tone={data.system.memoryKnowledge === "available" ? "good" : "warn"} />
            <StatRow label="AI Provider" value={data.system.provider === "configured" ? "Configured" : "Unconfigured"} tone={data.system.provider === "configured" ? "good" : "warn"} />
          </PanelSection>
          <PanelSection title="Knowledge overview" defaultOpen={false}>
            <div className="text-[13px] text-[#AAA7B5]">Indexed: <span className="text-[#F5F3FA]">{data.knowledge.indexed}</span> · Processing: <span className="text-[#F5F3FA]">{data.knowledge.processing}</span></div>
          </PanelSection>
          <PanelSection title="Projects overview" defaultOpen={false}>
            <div className="text-[13px] text-[#AAA7B5]">Active: <span className="text-[#F5F3FA]">{data.projects.activeCount}</span></div>
          </PanelSection>
          <PanelSection title="Agent activity" defaultOpen={false}>
            <div className="text-[13px] text-[#AAA7B5]">Available: <span className="text-[#F5F3FA]">{data.agents.available.length}</span></div>
            <div className="mt-1 text-[12px] text-[#777582]">Executing/Pending approvals: unavailable (not tracked)</div>
          </PanelSection>
          <PanelSection title="Recent activity" defaultOpen={false}>
            {data.activity.length ? data.activity.slice(0, 6).map(a => <div key={a.id} className="py-1 text-[12px]"><div className="text-[#F5F3FA]">{a.label}</div><div className="text-[#777582]">{timeAgo(a.at)}</div></div>) : <div className="text-xs text-[#777582]">No recent activity.</div>}
          </PanelSection>
        </div>
      </div>
    </div>
  );

  // DESKTOP/TABLET
  const desktop = (
    <div className="hidden h-full md:flex">
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-[920px] flex-col justify-between px-6 pb-6 pt-4 lg:px-10">
            <div className="flex flex-1 flex-col justify-center">
              <motion.div initial={reduce ? false : { opacity: 0 }} animate={reduce ? {} : { opacity: 1 }} transition={{ duration: 0.5 }} className="relative flex flex-col items-center justify-center py-6 text-center">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_300px_at_50%_30%,rgba(149,101,245,0.06),transparent_65%)]" />
                <div className="relative">
                  <div className="hidden md:block xl:hidden"><VyronCore state="idle" size={190} /></div>
                  <div className="hidden xl:block"><VyronCore state="idle" size={220} /></div>
                  <div className="mt-6">
                    <div className="text-[12px] font-medium tracking-[0.28em] text-[#A970FF]">VYRON</div>
                    <h1 className="mt-2 text-[36px] font-medium leading-tight tracking-tight text-[#F5F3FA] xl:text-[42px]">How can I help <span className="text-[#D2B5FF]">you</span> today?</h1>
                    <p className="mt-3 text-[12px] uppercase tracking-[0.22em] text-[#AAA7B5]">YOUR MIND. YOUR MACHINE. YOUR COMMAND.</p>
                    <p className="mx-auto mt-4 max-w-[560px] text-[15px] leading-relaxed text-[#AAA7B5]">VYRON is your personal AI operating system — a quiet, precise environment for conversation, memory, knowledge, and execution.</p>
                  </div>
                </div>
              </motion.div>
              <div className="mx-auto mt-2 flex max-w-[840px] flex-wrap items-center justify-center gap-2 px-2">
                {desktopQuickActions.map((a) => {
                  const Icon = a.icon;
                  return (
                    <button key={a.label} onClick={a.onClick} className="inline-flex items-center gap-2 rounded-full border border-[#292932] bg-[#111116]/40 px-3.5 py-2 text-[13px] text-[#F5F3FA] transition hover:border-[#9565F5]/35 hover:bg-[#18181F]/60">
                      <Icon className="h-4 w-4 text-[#AAA7B5]" />{a.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-8 pb-2"><Composer /></div>
          </div>
        </div>
        <div className="pointer-events-none absolute right-3 top-3 z-20 xl:hidden">
          <button onClick={() => setDrawerOpen(true)} className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-[#292932] bg-[#111116]/95 px-3 py-1.5 text-xs text-[#F5F3FA]"><Activity className="h-3.5 w-3.5 text-[#A970FF]" />Intelligence</button>
        </div>
      </div>

      <aside className="hidden w-[290px] shrink-0 flex-col border-l border-[#292932] bg-[#070709]/30 xl:flex">
        <div className="border-b border-[#292932] px-4 py-3"><div className="text-[13px] font-medium text-[#F5F3FA]">Intelligence</div><div className="text-[11px] text-[#777582]">Contextual system overview</div></div>
        <div className="flex-1 overflow-y-auto p-3"><IntelligencePanel data={data} /></div>
      </aside>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/50 xl:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawerOpen(false)} />
            <motion.aside className="fixed right-0 top-0 z-50 h-full w-[320px] max-w-[90vw] border-l border-[#292932] bg-[#0B0B0F]/98 backdrop-blur-xl xl:hidden" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 280, damping: 30 }}>
              <div className="flex items-center justify-between border-b border-[#292932] px-4 py-3"><div><div className="text-[13px] font-medium text-[#F5F3FA]">Intelligence</div><div className="text-[11px] text-[#777582]">Contextual system overview</div></div><button onClick={() => setDrawerOpen(false)} className="rounded-md p-1.5 text-[#AAA7B5] hover:bg-white/5"><ChevronRight className="h-4 w-4" /></button></div>
              <div className="h-[calc(100%-57px)] overflow-y-auto p-3"><IntelligencePanel data={data} /></div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="h-full min-h-0">
      {mobile}
      {desktop}
    </div>
  );
}
