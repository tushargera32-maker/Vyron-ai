"use client";
import { motion, useReducedMotion } from "motion/react";

export type VyronCoreState = "idle" | "listening" | "thinking" | "generating" | "speaking" | "executing" | "error" | "responding";

export function VyronCore({ state = "idle", size = 220 }: { state?: VyronCoreState; size?: number }) {
  const reduce = useReducedMotion();
  const s: VyronCoreState = state === "responding" ? "speaking" : state;
  const active = s === "thinking" || s === "generating" || s === "executing" || s === "speaking" || s === "listening";
  const intense = s === "generating" || s === "executing";
  const error = s === "error";
  const accent = error ? "#F16C78" : "#9565F5";
  const accent2 = error ? "#f7a1aa" : "#A970FF";
  const glow = error
    ? "radial-gradient(circle, rgba(241,108,120,0.16) 0%, transparent 70%)"
    : "radial-gradient(circle, rgba(149,101,245,0.18) 0%, rgba(169,112,255,0.08) 45%, transparent 72%)";

  return (
    <div className="relative mx-auto flex items-center justify-center" style={{ width: size, height: size }} aria-label={`VYRON ${s}`}>
      {/* controlled ambient illumination */}
      <motion.div
        className="absolute rounded-full blur-2xl"
        style={{ width: size * 0.9, height: size * 0.9, background: glow }}
        animate={reduce ? {} : { scale: intense ? [1, 1.06, 1] : [1, 1.03, 1], opacity: active ? [0.28, 0.42, 0.28] : [0.18, 0.26, 0.18] }}
        transition={{ duration: intense ? 3.2 : 6.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* refined obsidian sphere */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size * 0.84,
          height: size * 0.84,
          background: "radial-gradient(120% 120% at 32% 24%, rgba(70,70,82,0.30) 0%, rgba(34,34,41,0.42) 28%, rgba(17,17,22,0.82) 55%, rgba(7,7,9,0.96) 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -14px 24px rgba(0,0,0,0.4), 0 16px 36px rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
        animate={reduce ? {} : { y: [0, -2, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="absolute left-[16%] top-[14%] h-[24%] w-[34%] rounded-full bg-gradient-to-br from-white/10 to-transparent" />
        <div className="absolute inset-[7%] rounded-full border border-white/[0.03]" />
      </motion.div>

      {/* single restrained orbital ring */}
      <motion.div
        className="absolute rounded-full border border-white/10"
        style={{ width: size * 0.9, height: size * 0.52, transform: "rotateX(70deg) rotateZ(-10deg)", borderColor: error ? "rgba(241,108,120,0.18)" : "rgba(210,181,255,0.14)" }}
        animate={reduce ? {} : { rotateZ: s === "thinking" ? [-10, 350] : [-10, -370] }}
        transition={{ duration: s === "thinking" ? 22 : intense ? 16 : 34, repeat: Infinity, ease: "linear" }}
      >
        <span className="absolute left-1/2 top-0 h-1 w-1 -translate-x-1/2 rounded-full" style={{ background: error ? "#F16C78" : "#D2B5FF", boxShadow: `0 0 8px ${accent}` }} />
      </motion.div>

      {/* crisp sculptural V */}
      <motion.svg
        viewBox="0 0 200 200"
        className="relative z-10"
        style={{ width: size * 0.5, height: size * 0.5, filter: `drop-shadow(0 0 10px ${error ? "rgba(241,108,120,0.22)" : "rgba(149,101,245,0.22)"})` }}
        animate={reduce ? {} : { scale: intense ? [1, 1.02, 1] : [1, 1.008, 1] }}
        transition={{ duration: intense ? 2.2 : 5.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <defs>
          <linearGradient id="v-obsidian" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34343e" />
            <stop offset="45%" stopColor="#1c1c23" />
            <stop offset="100%" stopColor="#0a0a0d" />
          </linearGradient>
          <linearGradient id="v-edge2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F4EAFF" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#D2B5FF" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#9565F5" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="v-energy2" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor={error ? "#ffd5da" : "#F4EAFF"} />
            <stop offset="55%" stopColor={error ? "#f16c78" : "#A970FF"} />
            <stop offset="100%" stopColor={error ? "#7a2d36" : "#9565F5"} />
          </linearGradient>
        </defs>
        <path d="M30 26 L100 174 L170 26 L146 26 L100 126 L54 26 Z" fill="url(#v-obsidian)" stroke="url(#v-edge2)" strokeWidth="1.2" />
        <motion.path
          d="M60 40 L100 132 L140 40 L126 40 L100 104 L74 40 Z"
          fill={error ? "rgba(241,108,120,0.12)" : "rgba(149,101,245,0.14)"}
          stroke="url(#v-energy2)"
          strokeWidth="1.8"
          animate={reduce ? {} : { opacity: s === "idle" ? [0.55, 0.75, 0.55] : [0.7, 0.95, 0.7] }}
          transition={{ duration: intense ? 1.8 : 3.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.path
          d="M100 46 C99 80, 101 110, 100 148"
          fill="none"
          stroke={accent2}
          strokeWidth="2.4"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${accent})` }}
          animate={reduce ? {} : { opacity: s === "speaking" ? [0.5, 0.95, 0.5, 0.95, 0.5] : active ? [0.45, 0.85, 0.45] : [0.3, 0.5, 0.3] }}
          transition={{ duration: s === "speaking" ? 1.4 : intense ? 1.8 : 3.8, repeat: Infinity, ease: "easeInOut" }}
        />
        {[{cx:100,cy:58,r:2.8,c:"#F4EAFF"},{cx:100,cy:112,r:2.4,c:"#D2B5FF"}].map((p,i)=>(
          <motion.circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={p.c}
            animate={reduce?{}:{opacity:[0.55,0.9,0.55]}}
            transition={{duration:3.2, repeat:Infinity, delay:i*0.2, ease:"easeInOut"}} />
        ))}
      </motion.svg>

      {/* subtle active state ring */}
      {active && !reduce && (
        <motion.div className="absolute rounded-full border" style={{ width: size * 0.74, height: size * 0.74, borderColor: error ? "rgba(241,108,120,0.16)" : "rgba(169,112,255,0.14)" }} animate={{ scale: [1, 1.18], opacity: [0.18, 0] }} transition={{ duration: intense ? 1.8 : 2.6, repeat: Infinity, ease: "easeOut" }} />
      )}
    </div>
  );
}
