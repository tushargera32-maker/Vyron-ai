import { NextResponse } from "next/server";
import { ensureDbReady } from "@/lib/db";
import { ensureLocalUser } from "@/lib/db/repositories/profile";

export async function GET() {
  try {
    const db = ensureDbReady();
    const profile = ensureLocalUser(db);
    return NextResponse.json({ profile: { id: profile.id, name: profile.name } });
  } catch {
    return NextResponse.json({ profile: { id: "local-user", name: "Local User" } });
  }
}
