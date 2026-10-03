"use client";

import gsap from "gsap";
import { ImagePlus, Ban } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { prefersReducedMotion } from "@/lib/hooks/useMediaQuery";
import type { DropState } from "./useImageDropAndPaste";

/** Feedback while a file is dragged over the board. Purely visual; never intercepts the drop. */
export function DropOverlay({ state }: { state: Exclude<DropState, "idle"> }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!ref.current || prefersReducedMotion()) return;
    const tween = gsap.fromTo(ref.current, { opacity: 0, scale: 0.985 }, { opacity: 1, scale: 1, duration: 0.18, ease: "power2.out" });
    return () => {
      tween.kill();
    };
  }, []);

  const valid = state === "valid";
  return (
    <div
      ref={ref}
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-[10px] border-2 border-dashed",
        valid ? "border-accent bg-accent/5" : "border-line-strong bg-ink/5",
      )}
    >
      <span
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium shadow-pop",
          valid ? "bg-accent text-white" : "bg-surface text-ink-muted",
        )}
      >
        {valid ? <ImagePlus className="size-4" strokeWidth={2} /> : <Ban className="size-4" strokeWidth={2} />}
        {valid ? "Drop to add image" : "Only PNG, JPG, WebP or SVG images"}
      </span>
    </div>
  );
}
