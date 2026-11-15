import { Suspense } from "react";
import { connection } from "next/server";
import { ensureDbReady } from "@/lib/db";
import { ensureLocalUser } from "@/lib/db/repositories/profile";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

async function ProfileContent() {
  await connection();
  const db = ensureDbReady();
  const profile = ensureLocalUser(db);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="border-white/10 bg-black/30 backdrop-blur-xl">
        <CardHeader><CardTitle className="text-base">Local Profile</CardTitle><CardDescription>Stored locally in SQLite (no external account required).</CardDescription></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2"><span className="text-muted-foreground">User ID</span><span className="font-mono text-xs">{profile.id}</span></div>
          <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2"><span className="text-muted-foreground">Name</span><span>{profile.name}</span></div>
          <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2"><span className="text-muted-foreground">Created</span><span>{new Date(profile.created_at).toLocaleString()}</span></div>
          <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2"><span className="text-muted-foreground">Updated</span><span>{new Date(profile.updated_at).toLocaleString()}</span></div>
        </CardContent>
      </Card>
      <Card className="border-white/10 bg-black/30 backdrop-blur-xl">
        <CardHeader><CardTitle className="text-base">Identity & Memory</CardTitle><CardDescription>How VYRON remembers you across conversations.</CardDescription></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Approved memories stored in Memory Explorer are retrieved and injected into chat context when relevant.</p>
          <p>To save profile information, explicitly ask VYRON to remember/save it (e.g. “Save my profile…”). Explicit saves create approved memories with provenance.</p>
          <p className="rounded-md border border-violet-400/20 bg-violet-500/10 p-3 text-violet-100/90">This is a real local profile record from your local database.</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Profile" description="Local user profile and identity context used by VYRON's single-user experience." />
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl border border-white/10 bg-white/5" />}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}
