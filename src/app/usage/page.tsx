import { PageHeader } from "@/components/layout/page-header";
import { UsageClient } from "@/components/usage/usage-client";

export default function UsagePage() {
  return (
    <div>
      <PageHeader title="Usage Dashboard" description="Local token usage, latency, and provider event tracking recorded in SQLite." />
      <UsageClient />
    </div>
  );
}
