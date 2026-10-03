"use client";

import gsap from "gsap";
import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { useBoardStore } from "@/features/whiteboard/store/board-store";
import { useReducedMotion } from "@/lib/hooks/useMediaQuery";
import { MOTION } from "@/lib/motion";

// Konva needs the DOM; load it on the client only and keep it out of the initial bundle.
const BoardCanvas = dynamic(() => import("@/features/whiteboard/components/BoardCanvas"), {
  ssr: false,
  loading: () => (
    <div aria-busy="true" className="absolute inset-0 flex items-center justify-center">
      <p className="text-sm text-ink-faint">Loading board…</p>
    </div>
  ),
});

export function Whiteboard() {
  const activePageId = useBoardStore((s) => s.activePageId);
  const activeIndex = useBoardStore((s) => s.doc.pages.findIndex((page) => page.id === s.activePageId));
  const reducedMotion = useReducedMotion();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const previous = useRef<{ id: string; index: number } | null>(null);

  // Page switch: content swaps instantly, then settles in with a slight depth
  // shift in the direction of travel. Never delays the switch itself.
  useEffect(() => {
    const last = previous.current;
    previous.current = { id: activePageId, index: activeIndex };
    const surface = surfaceRef.current;
    if (!last || last.id === activePageId || reducedMotion || !surface) return;
    const direction = activeIndex >= last.index ? 1 : -1;
    gsap.fromTo(
      surface,
      { opacity: 0.4, x: 14 * direction, scale: 0.985, rotationY: -2 * direction, transformPerspective: 1400 },
      {
        opacity: 1,
        x: 0,
        scale: 1,
        rotationY: 0,
        duration: MOTION.base,
        ease: MOTION.easeOutStrong,
        overwrite: true,
        clearProps: "transform,opacity",
      },
    );
  }, [activePageId, activeIndex, reducedMotion]);

  return (
    <div ref={surfaceRef} data-enter="" data-enter-group="stage" className="absolute inset-0">
      <BoardCanvas />
    </div>
  );
}
