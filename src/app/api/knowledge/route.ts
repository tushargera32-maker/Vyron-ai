import { NextRequest, NextResponse } from "next/server";
import { ingestDocument, listKnowledge, deleteKnowledgeDocument, reprocessDocument } from "@/lib/knowledge/service";

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("project_id") || undefined;
    const docs = listKnowledge(projectId);
    return NextResponse.json({ documents: docs });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "File is required" }, { status: 400 });
    const project_id = (form.get("project_id") as string) || null;
    const result = await ingestDocument({ file, project_id });
    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Ingestion failed" }, { status: 400 });
  }
}
