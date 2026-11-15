import { Suspense } from "react";
import { ChatClient } from "@/components/chat/chat-client";

export default function ChatPage() {
  return (
    <div className="flex h-full flex-col">
      <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading chat…</div>}>
        <ChatClient />
      </Suspense>
    </div>
  );
}
