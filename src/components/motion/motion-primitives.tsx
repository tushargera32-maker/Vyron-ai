"use client";
import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 relative overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90 shadow-[0_0_20px_rgba(149,101,245,0.18)]",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background/60 shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary/80 text-secondary-foreground shadow-sm hover:bg-secondary",
        ghost: "hover:bg-accent/60 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: { default: "h-9 px-4 py-2", sm: "h-8 rounded-md px-3 text-xs", lg: "h-10 rounded-md px-8", icon: "h-9 w-9" },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface MotionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const MotionButton = React.forwardRef<HTMLButtonElement, MotionButtonProps>(({ className, variant, size, ...props }, ref) => {
  const reduce = useReducedMotion();
  return (
    <motion.button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      whileHover={reduce ? undefined : { y: -1, scale: 1.01 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      {...(props as any)}
    />
  );
});
MotionButton.displayName = "MotionButton";

export function MotionCard({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cn("rounded-xl border border-white/10 bg-card/50 text-card-foreground shadow backdrop-blur-sm glow-border", className)}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={reduce ? {} : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      whileHover={reduce ? undefined : { y: -2, boxShadow: "0 12px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(149,101,245,0.14)" }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      {...(props as any)}
    >
      {children}
    </motion.div>
  );
}
