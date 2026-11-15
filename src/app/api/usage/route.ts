import { NextResponse } from "next/server";
import { ensureDbReady } from "@/lib/db";

export async function GET() {
  try {
    const db = ensureDbReady();
    const totals = db.prepare(`SELECT COUNT(*) as requests, COALESCE(SUM(token_input),0) as input_tokens, COALESCE(SUM(token_output),0) as output_tokens, SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as errors, COALESCE(AVG(latency_ms),0) as avg_latency FROM usage_events`).get() as any;
    const recent = db.prepare(`SELECT * FROM usage_events ORDER BY created_at DESC LIMIT 20`).all();
    return NextResponse.json({ totals, recent });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
