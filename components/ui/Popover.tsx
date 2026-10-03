"use client";

import gsap from "gsap";
import { useCallback, useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/cn";
import { prefersReducedMotion } from "@/lib/hooks/useMediaQuery";
import { MOTION } from "@/lib/motion";

type Side = "top" | "right" | "bottom" | "left";
type Align = "start" | "center" | "end";

interface TriggerProps {
  ref: RefObject<HTMLButtonElement | null>;
  popoverTarget: string;
  "aria-haspopup": "dialog";
  "aria-controls": string;
}

interface PopoverProps {
  /** Accessible name for the popover region. */
  label: string;
  side?: Side;
  align?: Align;
  className?: string;
  trigger: (props: TriggerProps) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
}

const GAP = 8;
const EDGE = 8;
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Native `popover="auto"` gives top-layer rendering (never clipped by scroll
 * containers), light dismiss, Escape handling and focus return for free.
 * Only positioning is done here.
 */
export function Popover({ label, side = "bottom", align = "start", className, trigger, children }: PopoverProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Looked up by id (not ref) so it can be handed to render-prop children.
  const close = useCallback(() => {
    const el = document.getElementById(id);
    if (el?.matches(":popover-open")) el.hidePopover();
  }, [id]);

  useEffect(() => {
    const el = popoverRef.current;
    if (!el) return;

    const place = () => {
      const anchor = triggerRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const { width, height } = el.getBoundingClientRect();
      let top: number;
      let left: number;

      if (side === "top" || side === "bottom") {
        top = side === "bottom" ? anchor.bottom + GAP : anchor.top - height - GAP;
        left =
          align === "start" ? anchor.left : align === "end" ? anchor.right - width : anchor.left + anchor.width / 2 - width / 2;
      } else {
        left = side === "right" ? anchor.right + GAP : anchor.left - width - GAP;
        top =
          align === "start" ? anchor.top : align === "end" ? anchor.bottom - height : anchor.top + anchor.height / 2 - height / 2;
      }

      el.style.left = `${Math.max(EDGE, Math.min(left, window.innerWidth - width - EDGE))}px`;
      el.style.top = `${Math.max(EDGE, Math.min(top, window.innerHeight - height - EDGE))}px`;
    };

    const onToggle = (event: Event) => {
      if ((event as ToggleEvent).newState !== "open") return;
      place();
      el.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
      // A short lift-in from the trigger's side; skipped for reduced motion.
      if (!prefersReducedMotion()) {
        const offset = 6;
        const from =
          side === "top" ? { y: offset } : side === "bottom" ? { y: -offset } : side === "right" ? { x: -offset } : { x: offset };
        gsap.fromTo(
          el,
          { ...from, opacity: 0, scale: 0.98 },
          { x: 0, y: 0, opacity: 1, scale: 1, duration: MOTION.fast, ease: MOTION.easeOut, clearProps: "transform,opacity" },
        );
      }
    };
    const onResize = () => close();

    el.addEventListener("toggle", onToggle);
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("toggle", onToggle);
      window.removeEventListener("resize", onResize);
    };
  }, [side, align, close]);

  return (
    <>
      {trigger({ ref: triggerRef, popoverTarget: id, "aria-haspopup": "dialog", "aria-controls": id })}
      <div
        ref={popoverRef}
        id={id}
        popover="auto"
        role="dialog"
        aria-label={label}
        className={cn(
          "board-popover fixed max-h-[calc(100dvh-16px)] overflow-y-auto rounded-lg border border-line bg-surface p-3 text-sm text-ink shadow-pop",
          className,
        )}
      >
        {typeof children === "function" ? children(close) : children}
      </div>
    </>
  );
}
