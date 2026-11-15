import { PageHeader } from "@/components/layout/page-header";
import { KnowledgeClient } from "@/components/knowledge/knowledge-client";

export default function KnowledgePage() {
  return (
    <div>
      <PageHeader title="Knowledge Library" description="Upload and index documents (PDF, TXT, Markdown, DOCX) with chunking, FTS5 keyword search, local semantic fallback, hybrid retrieval, and source references." />
      <KnowledgeClient />
    </div>
  );
}
