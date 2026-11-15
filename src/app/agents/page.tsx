"use client";
import { motion, useReducedMotion } from "motion/react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bot, Workflow, Sparkles } from "lucide-react";

const agents = [
  { name: "Personal", desc: "Daily tasks, planning, and memory-grounded assistance.", status: "Ready" },
  { name: "Research", desc: "Synthesize ingested knowledge with source references.", status: "Ready" },
  { name: "Design", desc: "UX/UI, IA, and content/design planning.", status: "Ready" },
  { name: "Coding", desc: "Implementation planning and scoped code changes.", status: "Ready" },
  { name: "Marketing", desc: "Messaging, positioning, and content drafts.", status: "Ready" },
];
const tasks = [
  { step: "Understand goal", state: "complete" },
  { step: "Plan & select tools", state: "active" },
  { step: "Execute with approvals", state: "pending" },
  { step: "Record outcomes", state: "pending" },
];

export default function AgentsPage() {
  const reduce = useReducedMotion();
  return (
    <div>
      <PageHeader title="Agent Manager" description="Specialist agents, task planning, and activity visualization grounded in defined VYRON capabilities." />
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <motion.div className="grid gap-4 md:grid-cols-2" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}>
          {agents.map((a, i) => (
            <motion.div key={a.name} variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }} whileHover={reduce ? undefined : { y: -3 }}>
              <Card className="h-full border-white/10 bg-black/30 backdrop-blur-xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><div className="rounded-lg bg-primary/15 p-2 text-primary"><Bot className="h-4 w-4" /></div><CardTitle className="text-base">{a.name} Agent</CardTitle></div>
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300"><motion.span className="h-2 w-2 rounded-full bg-emerald-400" animate={reduce?{}:{scale:[1,1.5,1], opacity:[0.7,1,0.7]}} transition={{duration:2, repeat:Infinity, delay:i*0.2}} />{a.status}</span>
                  </div>
                  <CardDescription>{a.desc}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div>Tool permissions: scoped, least-privilege</div>
                  <div className="h-1 overflow-hidden rounded-full bg-white/5"><motion.div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-400/80" initial={{x:"-100%"}} animate={{x:"100%"}} transition={{duration:3.5, repeat:Infinity, ease:"linear", delay:i*0.3}} /></div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
        <motion.div initial={reduce?false:{opacity:0,x:12}} animate={reduce?{}:{opacity:1,x:0}}>
          <Card className="border-white/10 bg-black/30 backdrop-blur-xl">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Workflow className="h-4 w-4 text-violet-300" />Task Execution Timeline</CardTitle><CardDescription>Planned orchestration flow (real capabilities, not fake run data)</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {tasks.map((t, i) => (
                <div key={t.step} className="flex items-start gap-3">
                  <div className="relative flex flex-col items-center">
                    <motion.div className={`h-3.5 w-3.5 rounded-full border ${t.state==="complete"?"border-emerald-400 bg-emerald-400/80":t.state==="active"?"border-violet-400 bg-violet-400/40":"border-white/20 bg-white/5"}`} animate={t.state==="active" && !reduce ? { boxShadow:["0 0 0 rgba(149,101,245,0)","0 0 16px rgba(149,101,245,0.55)","0 0 0 rgba(149,101,245,0)"] } : {}} transition={{duration:1.8, repeat:Infinity}} />
                    {i < tasks.length-1 && <div className="mt-1 h-8 w-px bg-white/10" />}
                  </div>
                  <div><div className="text-sm font-medium">{t.step}</div><div className="text-xs text-muted-foreground capitalize">{t.state}</div></div>
                </div>
              ))}
              <div className="mt-2 rounded-lg border border-violet-400/20 bg-violet-500/10 p-3 text-xs text-violet-100/90"><Sparkles className="mr-1 inline h-3.5 w-3.5" />Phase 4 agent runtime is planned; this timeline reflects the designed execution pipeline.</div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
