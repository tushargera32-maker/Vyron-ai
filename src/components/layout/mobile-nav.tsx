"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { mobilePrimary, mobileMore, moreIcon } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const MoreIcon = moreIcon;
  const moreActive = mobileMore.some(i => pathname === i.href);

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setOpen(false)} />
            <motion.div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 md:hidden" initial={{opacity:0, y:16, scale:0.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:12,scale:0.98}} transition={{type:"spring", stiffness:320, damping:26}}>
              <div className="rounded-2xl border border-white/10 bg-[#111116]/95 p-2 shadow-2xl backdrop-blur-xl">
                <div className="grid grid-cols-2 gap-1">
                  {mobileMore.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href;
                    return (
                      <Link key={item.href} href={item.href} onClick={()=>setOpen(false)} className={cn("flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm", active ? "bg-primary/15 text-foreground border border-primary/20" : "text-muted-foreground hover:bg-white/5 hover:text-foreground")}> 
                        <Icon className="h-4 w-4" /><span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#292932] bg-[#070709]/90 backdrop-blur-xl supports-[backdrop-filter]:bg-[#070709]/80 md:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-lg grid-cols-5 px-2 py-1">
          {mobilePrimary.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className="relative flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-2 text-[10px]">
                {active && <motion.span layoutId="mobile-nav-active" className="absolute top-0 left-1/2 h-[2px] w-6 -translate-x-1/2 rounded-full bg-[#9565F5]" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
                <Icon className={cn("relative h-5 w-5", active ? "text-[#F5F3FA]" : "text-[#777582]")} />
                <span className={cn("relative", active ? "text-[#F5F3FA]" : "text-[#777582]")}>{item.label}</span>
              </Link>
            );
          })}
          <button onClick={()=>setOpen(v=>!v)} className="relative flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-2 text-[10px]">
            {(open || moreActive) && <motion.span layoutId="mobile-nav-active" className="absolute top-0 left-1/2 h-[2px] w-6 -translate-x-1/2 rounded-full bg-[#9565F5]" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
            <MoreIcon className={cn("relative h-5 w-5", open || moreActive ? "text-[#F5F3FA]" : "text-[#777582]")} />
            <span className={cn("relative", open || moreActive ? "text-[#F5F3FA]" : "text-[#777582]")}>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
