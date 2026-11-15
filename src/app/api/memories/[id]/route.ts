import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { approveMemory, rejectMemory, archiveMemory, deleteMemory, updateMemory } from "@/lib/memory/service";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const schema = z.object({
      action: z.enum(["approve", "reject", "archive", "delete"]).optional(),
      content: z.string().optional(),
      summary: z.string().nullable().optional(),
      importance: z.number().min(0).max(1).optional(),
      confidence: z.number().min(0).max(1).optional(),
      status: z.string().optional(),
      type: z.enum(["working","episodic","semantic","procedural"]).optional(),
      metadata_json: z.string().optional(),
    });
    const input = schema.parse(body);
    let result: any = null;
    if (input.action === "approve") result = approveMemory(id);
    else if (input.action === "reject") result = rejectMemory(id);
    else if (input.action === "archive") result = archiveMemory(id);
    else if (input.action === "delete") result = deleteMemory(id);
    else result = updateMemory(id, input);
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ memory: result });
  } catch (e: any) {
    const status = e?.name === "ZodError" ? 400 : 500;
    return NextResponse.json({ error: e?.message || "Failed" }, { status });
  }
}
