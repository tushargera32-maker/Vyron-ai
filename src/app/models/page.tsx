import { PageHeader } from "@/components/layout/page-header";
import { ModelsClient } from "@/components/models/models-client";

export default function ModelsPage() {
  return (
    <div>
      <PageHeader title="Model Settings" description="Provider configuration and model selection (server-side secrets only, no keys exposed to browser)." />
      <ModelsClient />
    </div>
  );
}
