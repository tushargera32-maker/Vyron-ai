import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchKnowledge } from "@/lib/knowledge/service";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q") || "";
    const project_id = req.nextUrl.searchParams.get("project_id");
    const schema = z.object({ q: z.string().default("") });
    schema.parse({ q });
    const results = q.trim() ? searchKnowledge(q, { project_id: project_id ?? undefined, limit: 8, hybrid: true }) : [];
    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Search failed" }, { status: 400 });
  }
}
