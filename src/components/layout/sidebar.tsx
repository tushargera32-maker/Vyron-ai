"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, ChevronDown, User, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems } from "@/lib/navigation";

function VyronMark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id="vyron-mark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F4EAFF" />
          <stop offset="55%" stopColor="#D2B5FF" />
          <stop offset="100%" stopColor="#9565F5" />
        </linearGradient>
      </defs>
      <path d="M4 4 L12 20 L20 4 L17.5 4 L12 15 L6.5 4 Z" fill="url(#vyron-mark)" />
    </svg>
  );
}

export function Sidebar({ profileName = "Local User" }: { profileName?: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false); // default expanded on desktop
  const [profileOpen, setProfileOpen] = useState(false);
  const [name, setName] = useState(profileName);
  const reduce = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(d => {
      if (!cancelled && d?.profile?.name) setName(d.profile.name);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const sidebarWidth = collapsed ? 76 : 256;

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarWidth }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 28 }}
      className="sticky top-0 z-20 hidden h-[100dvh] min-w-0 shrink-0 flex-col overflow-hidden border-r border-[#292932] bg-[#070709]/95 backdrop-blur-xl supports-[backdrop-filter]:bg-[#070709]/85 md:flex"
    >
      {/* Brand header */}
      <div className={cn("flex h-16 shrink-0 items-center border-b border-[#292932]", collapsed ? "justify-center px-2" : "justify-between px-3")}>
        {collapsed ? (
          <div className="flex w-full items-center justify-center gap-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#18181F]" title="VYRON">
              <VyronMark className="h-4.5 w-4.5" />
            </div>
            <button
              onClick={() => setCollapsed(false)}
              className="ml-1 rounded-md p-1.5 text-[#777582] hover:bg-white/5 hover:text-[#F5F3FA]"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-2.5 overflow-hidden">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#18181F]">
                <VyronMark className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold tracking-[0.2em] text-[#F5F3FA]">VYRON</div>
                <div className="truncate text-[10px] leading-tight text-[#777582]">Personal intelligence system</div>
              </div>
            </div>
            <button
              onClick={() => setCollapsed(true)}
              className="shrink-0 rounded-md p-1.5 text-[#777582] hover:bg-white/5 hover:text-[#F5F3FA]"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 space-y-1 overflow-y-auto py-3", collapsed ? "px-2" : "px-2")}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className="group relative block" title={collapsed ? item.label : undefined}>
              {active && (
                <>
                  <motion.div
                    layoutId="nav-active-bar"
                    className={cn("absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-[#9565F5]", collapsed && "left-0.5")}
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 350, damping: 30 }}
                  />
                  <motion.div
                    layoutId="nav-active-bg"
                    className="absolute inset-0 rounded-md bg-white/[0.025]"
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 350, damping: 30 }}
                  />
                </>
              )}
              <div
                className={cn(
                  "relative flex items-center rounded-md py-2 text-[13px] transition-colors",
                  collapsed ? "justify-center px-0" : "gap-3 px-3",
                  active ? "text-[#F5F3FA]" : "text-[#AAA7B5] hover:bg-white/[0.02] hover:text-[#F5F3FA]"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-[#D2B5FF]" : "text-[#777582]")} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </div>
              {collapsed && (
                <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-[#292932] bg-[#111116] px-2 py-1 text-[12px] text-[#F5F3FA] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="relative shrink-0 border-t border-[#292932] p-2.5">
        {collapsed ? (
          <div className="group relative flex justify-center">
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-gradient-to-b from-[#222229] to-[#111116] text-xs font-medium text-violet-100 hover:border-white/20"
              title={name}
            >
              {name.slice(0, 1).toUpperCase()}
            </button>
            <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-[#292932] bg-[#111116] px-2 py-1 text-[12px] text-[#F5F3FA] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              {name} · Local user
            </span>
          </div>
        ) : (
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-white/[0.03]"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-b from-[#222229] to-[#111116] text-xs font-medium text-violet-100">
              {name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="truncate text-xs font-medium text-[#F5F3FA]">{name}</div>
              <div className="flex items-center gap-1 text-[11px] text-[#777582]"><Circle className="h-2 w-2 fill-emerald-400 text-emerald-400" /> Local user • Connected</div>
            </div>
            <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-[#777582] transition-transform", profileOpen && "rotate-180")} />
          </button>
        )}
        <AnimatePresence>
          {profileOpen && !collapsed && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="absolute bottom-full left-2.5 right-2.5 mb-2 rounded-lg border border-[#292932] bg-[#111116] p-1.5 shadow-xl">
              <Link href="/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-[#AAA7B5] hover:bg-white/5 hover:text-[#F5F3FA]"><User className="h-4 w-4" />Profile</Link>
              <Link href="/settings" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-[#AAA7B5] hover:bg-white/5 hover:text-[#F5F3FA]">Settings</Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
