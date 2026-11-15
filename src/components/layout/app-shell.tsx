"use client";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { AnimatedBackground } from "@/components/motion/animated-background";
import { PageTransition } from "@/components/motion/page-transition";
import { cn } from "@/lib/utils";

export function AppShell({ children, profileName = "Local User" }: { children: React.ReactNode; profileName?: string }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isChat = pathname === "/chat";

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-transparent text-foreground">
      <AnimatedBackground />
      <div className="relative z-10 flex h-[100dvh] w-full overflow-hidden">
        <Sidebar profileName={profileName} />
        <main className="flex h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden">
          <div
            className={cn(
              "flex-1",
              isHome
                ? "overflow-y-auto px-0 pb-[calc(5.25rem+env(safe-area-inset-bottom))] pt-0 md:pb-0"
                : isChat
                  ? "overflow-hidden px-0 pb-[calc(4.75rem+env(safe-area-inset-bottom))] pt-0 md:px-4 md:pb-4 md:pt-4 lg:px-6"
                  : "overflow-y-auto px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 md:pb-8 lg:px-8"
            )}
          >
            <PageTransition>{children}</PageTransition>
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
