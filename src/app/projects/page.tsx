"use client";
import { motion, useReducedMotion } from "motion/react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, FolderKanban } from "lucide-react";

const projects = [
  { name: "Personal", desc: "Daily life, preferences, and personal workflows" },
  { name: "Research", desc: "Exploration, notes, and knowledge synthesis" },
  { name: "Product Ideas", desc: "Concepts, planning, and future builds" },
];

export default function ProjectsPage() {
  const reduce = useReducedMotion();
  return (
    <div>
      <PageHeader title="Projects" description="Organize conversations, memories, and knowledge by project." actions={<motion.div whileTap={{scale:0.97}}><Button className="h-10"><Plus className="h-4 w-4" /> New project</Button></motion.div>} />
      <motion.div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}>
        {projects.map((p, i) => (
          <motion.div key={p.name} variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }} whileHover={reduce ? undefined : { y: -4, scale: 1.01 }}>
            <Card className="h-full border-white/10 bg-black/30 backdrop-blur-xl transition-shadow hover:shadow-[0_0_30px_rgba(149,101,245,0.14)]">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary"><FolderKanban className="h-5 w-5" /></div>
                <CardTitle className="text-base">{p.name}</CardTitle>
                <CardDescription>{p.desc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div>0 conversations · 0 memories · 0 documents</div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/5"><motion.div className="h-full rounded-full bg-gradient-to-r from-violet-500/70 to-fuchsia-400/60" initial={{ width: 0 }} animate={{ width: `${20 + i * 15}%` }} transition={{ duration: 0.8, delay: 0.2 + i * 0.1 }} /></div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
