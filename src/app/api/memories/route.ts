import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listMemory, proposeMemory } from "@/lib/memory/service";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") || undefined;
    const type = sp.get("type") || undefined;
    const project_id = sp.get("project_id");
    const items = listMemory({ status, type, project_id: project_id ?? undefined });
    return NextResponse.json({ memories: items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const schema = z.object({ type: z.enum(["working","episodic","semantic","procedural"]), content: z.string().min(1), summary: z.string().optional(), importance: z.number().min(0).max(1).optional(), confidence: z.number().min(0).max(1).optional(), project_id: z.string().nullable().optional(), metadata: z.record(z.string(), z.any()).optional() });
    const input = schema.parse(body);
    const res = proposeMemory(input as any);
    return NextResponse.json(res, { status: 201 });
  } catch (e: any) {
    const status = e?.name === "ZodError" ? 400 : 500;
    return NextResponse.json({ error: e?.message || "Failed" }, { status });
  }
}
