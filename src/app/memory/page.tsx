import { PageHeader } from "@/components/layout/page-header";
import { MemoryClient } from "@/components/memory/memory-client";

export default function MemoryPage() {
  return (
    <div>
      <PageHeader title="Memory Explorer" description="Structured long-term memory (working, episodic, semantic, procedural) with approval controls, retrieval, and audit-aware lifecycle." />
      <MemoryClient />
    </div>
  );
}
