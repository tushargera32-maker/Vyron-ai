"use client";
import { useEffect, useState } from "react";

export function AnimatedBackground() {
  const [active, setActive] = useState(true);
  useEffect(() => {
    const onVis = () => setActive(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  // Pause decorative animations when tab inactive to save CPU/GPU
  if (!active) return <div className="aether-bg" aria-hidden />;
  return (
    <div className="aether-bg" aria-hidden>
      <div className="aether-mesh" />
      <div className="aether-grid" />
      <div className="aether-particles" />
    </div>
  );
}
