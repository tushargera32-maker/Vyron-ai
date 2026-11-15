import { NextRequest } from "next/server";
import { z } from "zod";
import { streamChat, nonStreamingChat } from "@/lib/chat/service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const schema = z.object({
      conversationId: z.string().optional(),
      message: z.string().min(1),
      projectId: z.string().nullable().optional(),
      model: z.string().optional(),
      providerType: z.enum(["mock", "openai-compatible"]).optional(),
      systemPrompt: z.string().nullable().optional(),
      stream: z.boolean().optional().default(true),
    });
    const input = schema.parse(body);
    if (input.stream === false) {
      const res = await nonStreamingChat(input as any);
      return Response.json(res, { status: res?.type === "error" ? 500 : 200 });
    }
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const ev of streamChat(input as any)) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
            if (ev.type === "done" || ev.type === "error") break;
          }
        } catch (e: any) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: { message: e?.message || "Stream failed" } })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });
    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (e: any) {
    const status = e?.name === "ZodError" ? 400 : 500;
    return Response.json({ error: e?.message || "Chat failed" }, { status });
  }
}
