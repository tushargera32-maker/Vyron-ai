import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getConversationWithMessages, renameConversation, removeConversation, updateConversationSettings } from "@/lib/chat/service";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const data = getConversationWithMessages(id);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const schema = z.object({ title: z.string().min(1).optional(), model_provider: z.literal("openai-compatible").nullable().optional(), model_id: z.string().nullable().optional(), system_prompt: z.string().nullable().optional() });
    const input = schema.parse(body);
    let updated = null;
    if (input.title) updated = renameConversation(id, input.title);
    if (input.model_provider !== undefined || input.model_id !== undefined || input.system_prompt !== undefined) {
      updated = updateConversationSettings(id, { model_provider: input.model_provider, model_id: input.model_id, system_prompt: input.system_prompt });
    }
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ conversation: updated });
  } catch (e: any) {
    const status = e?.name === "ZodError" ? 400 : 500;
    return NextResponse.json({ error: e?.message || "Failed" }, { status });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const ok = removeConversation(id);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
