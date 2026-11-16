import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listConversations, createNewConversation } from "@/lib/chat/service";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q") || undefined;
    const items = listConversations(q);
    return NextResponse.json({ conversations: items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to list conversations" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const schema = z.object({ title: z.string().optional(), project_id: z.string().nullable().optional(), model_provider: z.literal("openai-compatible").nullable().optional(), model_id: z.string().nullable().optional(), system_prompt: z.string().nullable().optional() });
    const input = schema.parse(body);
    const conv = createNewConversation(input as any);
    return NextResponse.json({ conversation: conv }, { status: 201 });
  } catch (e: any) {
    const status = e?.name === "ZodError" ? 400 : 500;
    return NextResponse.json({ error: e?.message || "Failed to create conversation" }, { status });
  }
}
