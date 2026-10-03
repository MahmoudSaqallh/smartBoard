import gsap from "gsap";
import { prefersReducedMotion } from "@/lib/hooks/useMediaQuery";
import { getCanvas } from "../utils/canvas-handle";

/**
 * One-shot entrance for a newly inserted object: a short fade with a slight
 * scale around its centre. Runs after React has mounted the node, never
 * loops, and gives way immediately if the user grabs the object.
 */
export function animateInsertion(elementId: string): void {
  if (typeof window === "undefined" || prefersReducedMotion()) return;
  requestAnimationFrame(() => {
    const node = getCanvas()?.stage.find((n: { id: () => string }) => n.id() === elementId)[0];
    if (!node) return;
    const x = node.x();
    const y = node.y();
    const width = node.width();
    const height = node.height();
    const opacity = node.opacity();
    const state = { t: 0 };

    const settle = () => {
      node.scale({ x: 1, y: 1 });
      node.position({ x, y });
      node.opacity(opacity);
      node.getLayer()?.batchDraw();
    };

    gsap.to(state, {
      t: 1,
      duration: 0.22,
      ease: "power2.out",
      onUpdate: () => {
        if (node.isDragging()) {
          gsap.killTweensOf(state);
          node.scale({ x: 1, y: 1 });
          node.opacity(opacity);
          return;
        }
        const s = 0.94 + 0.06 * state.t;
        node.scale({ x: s, y: s });
        node.position({ x: x + (width * (1 - s)) / 2, y: y + (height * (1 - s)) / 2 });
        node.opacity(opacity * state.t);
        node.getLayer()?.batchDraw();
      },
      onComplete: settle,
    });
  });
}
