"use client";
import { motion, useReducedMotion } from "motion/react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={reduce ? {} : { opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="text-[28px] font-medium tracking-tight text-[#F5F3FA] md:text-[34px]">
          {title}
        </h1>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#AAA7B5]">{description}</p> : null}
      </motion.div>
      {actions ? (
        <motion.div initial={reduce ? false : { opacity: 0 }} animate={reduce ? {} : { opacity: 1 }} className="flex items-center gap-2">
          {actions}
        </motion.div>
      ) : null}
    </div>
  );
}
