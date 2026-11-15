"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { VyronCore } from "@/components/motion/vyron-core";
import { Send, Square, Plus, Trash2, Pencil, Search, RefreshCw, Bot, User, SlidersHorizontal, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { id: string; role: string; content: string; status?: string; error_json?: string | null };
type Conv = { id: string; title: string | null; updated_at: string; model_provider?: string | null; model_id?: string | null; system_prompt?: string | null };

export function ChatClient() {
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerType, setProviderType] = useState<"mock" | "openai-compatible">("openai-compatible");
  const [model, setModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("You are VYRON, a refined local-first personal AI operating intelligence.");
  const [providerConfig, setProviderConfig] = useState<any>(null);
  const [renameValue, setRenameValue] = useState("");
  const [composerFocus, setComposerFocus] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const pendingHandled = useRef(false);
  const reduce = useReducedMotion();
  const searchParams = useSearchParams();

  const coreState: "idle" | "thinking" | "generating" | "responding" = streaming
    ? (messages.some(m => m.status === "streaming" && m.content) ? "generating" : "thinking")
    : (messages.length ? "responding" : "idle");

  async function loadConversations(q = "") {
    const url = q ? `/api/conversations?query=${encodeURIComponent(q)}` : "/api/conversations";
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setConversations(data.conversations || []);
  }
  async function loadConversation(id: string) {
    const res = await fetch(`/api/conversations/${id}`, { cache: "no-store" });
    const data = await res.json();
    if (res.ok) {
      setMessages(data.messages || []);
      setRenameValue(data.conversation?.title || "");
      if (data.conversation?.model_provider) setProviderType(data.conversation.model_provider);
      if (data.conversation?.model_id) setModel(data.conversation.model_id);
      if (data.conversation?.system_prompt) setSystemPrompt(data.conversation.system_prompt);
    }
  }
  async function loadProviderConfig() {
    try {
      const res = await fetch("/api/models", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        const cfg = data.config || null;
        setProviderConfig(cfg);
        if (cfg) {
          // Prefer configured provider/model by default for a clean, ready-to-chat experience
          if (cfg.type === "mock" || cfg.type === "openai-compatible") setProviderType(cfg.type);
          if (typeof cfg.defaultModel === "string" && cfg.defaultModel.trim()) setModel(cfg.defaultModel.trim());
          else if (cfg.type === "mock") setModel("mock-model");
        }
      }
    } catch {}
  }

  useEffect(() => { void Promise.all([loadConversations(), loadProviderConfig()]); }, []);
  useEffect(() => { if (activeId) loadConversation(activeId); else setMessages([]); }, [activeId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); }, [messages, streaming, reduce]);

  useEffect(() => {
    if (pendingHandled.current) return;
    const fromStorage = typeof window !== "undefined" ? sessionStorage.getItem("vyron:pendingPrompt") : null;
    const fromQuery = searchParams?.get("prompt") || searchParams?.get("q");
    const p = (fromStorage || fromQuery || "").trim();
    if (!p) return;
    pendingHandled.current = true;
    try { sessionStorage.removeItem("vyron:pendingPrompt"); } catch {}
    // Auto-start chat smoothly when arriving from Home with a prompt
    const t = setTimeout(() => { void send(p); }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function newChat() {
    const res = await fetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "New conversation", model_provider: providerType, model_id: model, system_prompt: systemPrompt }) });
    const data = await res.json();
    if (res.ok) { await loadConversations(query); setActiveId(data.conversation.id); }
  }
  async function deleteChat(id: string) {
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (activeId === id) setActiveId(null);
    await loadConversations(query);
  }
  async function renameChat() {
    if (!activeId) return;
    await fetch(`/api/conversations/${encodeURIComponent(activeId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: renameValue || "Untitled", model_provider: providerType, model_id: model, system_prompt: systemPrompt }) });
    await loadConversations(query);
  }

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || streaming) return;
    setError(null);
    setInput("");
    const tempUser: Msg = { id: `u-${Date.now()}`, role: "user", content: text, status: "complete" };
    const tempAsst: Msg = { id: `a-${Date.now()}`, role: "assistant", content: "", status: "streaming" };
    setMessages(prev => [...prev, tempUser, tempAsst]);
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: activeId ?? undefined, message: text, providerType, model, systemPrompt, stream: true }), signal: ctrl.signal });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = ""; let currentAssistantId = tempAsst.id;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n"); buf = parts.pop() || "";
        for (const part of parts) {
          const lines = part.split("\n");
          const ev = lines.find(l => l.startsWith("event:"))?.slice(6).trim();
          const dataLine = lines.find(l => l.startsWith("data:"))?.slice(5).trim();
          if (!ev || !dataLine) continue;
          const payload = JSON.parse(dataLine);
          if (ev === "meta") {
            if (!activeId && payload.conversationId) setActiveId(payload.conversationId);
            if (payload.assistantMessageId) currentAssistantId = payload.assistantMessageId;
          } else if (ev === "delta") {
            setMessages(prev => prev.map(m => (m.id === tempAsst.id || m.id === currentAssistantId) ? { ...m, id: currentAssistantId, content: (m.content || "") + (payload.delta || "") } : m));
          } else if (ev === "done") {
            setMessages(prev => prev.map(m => (m.id === tempAsst.id || m.id === currentAssistantId) ? { ...m, id: payload.assistantMessageId || currentAssistantId, content: payload.content || m.content, status: "complete" } : m));
            if (payload.conversationId && !activeId) setActiveId(payload.conversationId);
            await loadConversations(query);
          } else if (ev === "error") {
            const errMsg = payload.error?.message || "Chat failed";
            setError(errMsg);
            setMessages(prev => prev.map(m => (m.id === tempAsst.id || m.id === currentAssistantId) ? { ...m, status: "error", content: m.content || `Error: ${errMsg}` } : m));
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(e?.message || "Request failed");
      setMessages(prev => prev.map(m => m.status === "streaming" ? { ...m, status: e?.name === "AbortError" ? "stopped" : "error", content: m.content || (e?.name === "AbortError" ? "(stopped)" : "Error") } : m));
    } finally {
      setStreaming(false); abortRef.current = null;
      if (activeId) await loadConversation(activeId);
      await loadConversations(query);
    }
  }

  async function retryLast() {
    if (!activeId) return;
    const lastUser = [...messages].reverse().find(m => m.role === "user");
    if (lastUser) setInput(lastUser.content);
  }

  const ConversationPanel = (
    <div className="flex h-full min-h-0 flex-col border-r border-[#292932] bg-[#070709]/20 lg:bg-transparent">
      <div className="space-y-2.5 border-b border-[#292932] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[13px] font-medium text-[#F5F3FA]">Conversations</div>
          <button onClick={async () => { await newChat(); setShowHistory(false); setTimeout(() => document.querySelector<HTMLTextAreaElement>('textarea[placeholder="Ask VYRON anything..."]')?.focus(), 50); }} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#292932] bg-[#111116] px-2.5 text-xs text-[#F5F3FA] hover:bg-[#18181F]"><Plus className="h-3.5 w-3.5" />New</button>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-[#292932] bg-[#111116]/60 px-2.5">
          <Search className="h-3.5 w-3.5 text-[#777582]" />
          <input className="h-8 w-full bg-transparent text-[13px] text-[#F5F3FA] outline-none placeholder:text-[#777582]" placeholder="Search..." value={query} onChange={e => { setQuery(e.target.value); loadConversations(e.target.value); }} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="space-y-0.5">
          {conversations.map((c) => {
            const active = activeId === c.id;
            return (
              <div key={c.id} className={cn("group flex items-center gap-1 rounded-md px-2 py-2 transition-colors", active ? "bg-white/[0.04]" : "hover:bg-white/[0.02]")}>
                <button className="min-w-0 flex-1 text-left" onClick={() => { setActiveId(c.id); setShowHistory(false); }}>
                  <div className={cn("truncate text-[13px]", active ? "text-[#F5F3FA]" : "text-[#AAA7B5] group-hover:text-[#F5F3FA]")}>{c.title || "Untitled"}</div>
                  <div className="mt-0.5 text-[11px] text-[#777582]">{new Date(c.updated_at).toLocaleString()}</div>
                </button>
                <button onClick={() => deleteChat(c.id)} className="shrink-0 rounded p-1.5 text-[#777582] opacity-100 hover:bg-white/5 hover:text-[#F5F3FA] md:opacity-0 md:group-hover:opacity-100" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            );
          })}
        </div>
        {!conversations.length && <div className="px-2 py-4 text-[13px] text-[#777582]">No conversations yet.</div>}
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col md:gap-0">
      {/* Mobile history drawer */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowHistory(false)} />
            <motion.div className="fixed inset-x-0 bottom-0 top-[8%] z-50 lg:hidden" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 28 }}>
              <div className="h-full rounded-t-[18px] border border-[#292932] bg-[#0B0B0F] shadow-2xl">
                <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/15" />
                {ConversationPanel}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="grid h-full min-h-0 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="hidden min-h-0 lg:block">{ConversationPanel}</div>

        <div className="flex min-h-0 min-w-0 flex-col bg-transparent">
          {/* Header */}
          <div className="border-b border-[#292932] px-3 py-2.5 md:px-4">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setShowHistory(true)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#292932] px-2.5 text-xs text-[#AAA7B5] hover:bg-white/5 lg:hidden"><Search className="h-3.5 w-3.5" />History</button>
              <input className="h-9 min-w-[180px] flex-1 rounded-md border border-[#292932] bg-[#111116] px-3 text-[13px] text-[#F5F3FA] outline-none placeholder:text-[#777582] focus:border-[#9565F5]/40" placeholder="Conversation title" value={renameValue} onChange={e => setRenameValue(e.target.value)} />
              <button onClick={renameChat} disabled={!activeId} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#292932] bg-[#18181F] px-3 text-xs text-[#F5F3FA] hover:bg-[#222229] disabled:opacity-40"><Pencil className="h-3.5 w-3.5" />Save</button>
              <button onClick={retryLast} disabled={!activeId || streaming} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#292932] px-3 text-xs text-[#AAA7B5] hover:bg-white/5 hover:text-[#F5F3FA] disabled:opacity-40"><RefreshCw className="h-3.5 w-3.5" />Retry</button>
              <button onClick={() => setShowAdvanced(v => !v)} className={cn("inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs", showAdvanced ? "border-[#9565F5]/40 bg-[#9565F5]/10 text-[#F5F3FA]" : "border-[#292932] text-[#AAA7B5] hover:bg-white/5 hover:text-[#F5F3FA]")}>
                <SlidersHorizontal className="h-3.5 w-3.5" />Advanced <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAdvanced && "rotate-180")} />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#777582]">
              <span>Model: <span className="text-[#AAA7B5]">{model}</span></span>
              <span>Provider: <span className="text-[#AAA7B5]">{providerType}</span></span>
              {providerConfig && <span className="truncate">Env: <span className="text-[#AAA7B5]">{providerConfig.type} · {providerConfig.model}{providerConfig.baseURL ? ` · ${providerConfig.baseURL}` : ""}</span></span>}
            </div>
            <AnimatePresence initial={false}>
              {showAdvanced && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-3 grid gap-2 border-t border-[#292932] pt-3 sm:grid-cols-2">
                    <label className="space-y-1 text-[12px] text-[#777582]"><span>Provider</span>
                      <select className="h-9 w-full rounded-md border border-[#292932] bg-[#111116] px-2 text-[13px] text-[#F5F3FA] outline-none" value={providerType} onChange={e => setProviderType(e.target.value as any)}>
                        <option value="mock">mock (offline)</option>
                        <option value="openai-compatible">openai-compatible</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-[12px] text-[#777582]"><span>Model ID</span>
                      <input className="h-9 w-full rounded-md border border-[#292932] bg-[#111116] px-3 text-[13px] text-[#F5F3FA] outline-none" value={model} onChange={e => setModel(e.target.value)} placeholder="Model ID" />
                    </label>
                    <label className="space-y-1 text-[12px] text-[#777582] sm:col-span-2"><span>System prompt</span>
                      <textarea className="min-h-[72px] w-full rounded-md border border-[#292932] bg-[#111116] px-3 py-2 text-[13px] text-[#F5F3FA] outline-none" value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} placeholder="System prompt / behavior" />
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>{error && <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2 rounded-md border border-[#F16C78]/30 bg-[#F16C78]/10 px-3 py-2 text-[13px] text-[#f7a1aa]">{error}</motion.div>}</AnimatePresence>
          </div>

          {/* Messages */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 md:px-6">
            {!messages.length && (
              <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
                <div className="md:hidden"><VyronCore state={coreState} size={150} /></div>
                <div className="hidden md:block"><VyronCore state={coreState} size={200} /></div>
                <h2 className="mt-6 text-[28px] font-medium tracking-tight text-[#F5F3FA] md:text-[34px]">How can I help you today?</h2>
                <p className="mt-3 max-w-[460px] text-[14px] leading-relaxed text-[#AAA7B5]">A quiet, precise workspace for conversation, memory, knowledge and execution.</p>
              </div>
            )}
            <div className="mx-auto max-w-[820px] space-y-4">
              <AnimatePresence initial={false}>
                {messages.map(m => (
                  <motion.div key={m.id} layout initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className={cn("flex gap-2.5", m.role === "user" ? "justify-end" : "justify-start")}>
                    {m.role !== "user" && <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#292932] bg-[#111116] text-[#A970FF]"><Bot className="h-4 w-4" /></div>}
                    <div className={cn("max-w-[88%] rounded-[14px] border px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap break-words", m.role === "user" ? "border-[#9565F5]/25 bg-[#9565F5]/10 text-[#F5F3FA]" : "border-[#292932] bg-[#111116]/60 text-[#F5F3FA]")}>
                      <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-[#777582]">
                        <span>{m.role === "user" ? "You" : "VYRON"}</span>
                        {m.status === "streaming" && <span className="text-[#A970FF]">streaming</span>}
                        {m.status === "error" && <span className="text-[#F16C78]">error</span>}
                        {m.status === "stopped" && <span className="text-[#E7B45B]">stopped</span>}
                      </div>
                      <div>{m.content || (m.status === "streaming" ? <span className="inline-flex gap-1 text-[#AAA7B5]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:120ms]" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:240ms]" /></span> : "")}</div>
                    </div>
                    {m.role === "user" && <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#292932] bg-[#18181F] text-[#AAA7B5]"><User className="h-4 w-4" /></div>}
                  </motion.div>
                ))}
              </AnimatePresence>
              <AnimatePresence>{streaming && messages.some(m => m.status === "streaming" && !m.content) && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 text-xs text-[#AAA7B5]"><VyronCore state="thinking" size={36} /><span>Thinking…</span></motion.div>
              )}</AnimatePresence>
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Composer */}
          <div className="border-t border-[#292932] px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6">
            <div className="mx-auto max-w-[820px]">
              <div className={cn("rounded-[16px] border bg-[#111116] p-2 transition-colors", composerFocus ? "border-[#9565F5]/40" : "border-[#292932]")}>
                <div className="flex items-end gap-2">
                  <textarea
                    className="max-h-40 min-h-[44px] flex-1 resize-y rounded-md bg-transparent px-2 py-2 text-[14px] text-[#F5F3FA] outline-none placeholder:text-[#777582]"
                    value={input}
                    onFocus={() => setComposerFocus(true)}
                    onBlur={() => setComposerFocus(false)}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Ask VYRON anything..."
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                  />
                  {streaming ? (
                    <button onClick={() => abortRef.current?.abort()} className="inline-flex h-10 items-center gap-1.5 rounded-[12px] border border-[#292932] bg-[#18181F] px-3 text-[13px] text-[#F5F3FA] hover:bg-[#222229]"><Square className="h-4 w-4" />Stop</button>
                  ) : (
                    <button onClick={() => void send()} disabled={!input.trim()} className="inline-flex h-10 items-center gap-1.5 rounded-[12px] bg-[#9565F5] px-4 text-[13px] font-medium text-white hover:bg-[#A970FF] disabled:opacity-40"><Send className="h-4 w-4" />Send</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
