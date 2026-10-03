"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";

type Side = "top" | "right" | "bottom" | "left";

interface TooltipProps {
  label: string;
  shortcut?: string;
  side?: Side;
  children: ReactElement<{ "aria-describedby"?: string }>;
}

const GAP = 8;
const SHOW_DELAY = 350;

function triggerOf(wrapper: HTMLElement): HTMLElement {
  return (wrapper.firstElementChild as HTMLElement | null) ?? wrapper;
}

/**
 * Visual label for icon-only controls. The trigger keeps its own aria-label;
 * the shortcut is exposed through aria-describedby while visible. Rendered in
 * a portal with fixed positioning so scroll containers never clip it.
 * Listeners sit on a `display: contents` wrapper, which adds no layout box.
 */
export function Tooltip({ label, shortcut, side = "bottom", children }: TooltipProps) {
  const id = useId();
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Hide on scroll / resize; the anchor rect would be stale.
  useEffect(() => {
    if (!anchor) return;
    const hide = () => setAnchor(null);
    window.addEventListener("resize", hide);
    window.addEventListener("scroll", hide, true);
    return () => {
      window.removeEventListener("resize", hide);
      window.removeEventListener("scroll", hide, true);
    };
  }, [anchor]);

  // Placement depends on the rendered tooltip size, so it runs after layout.
  useEffect(() => {
    const tip = tipRef.current;
    if (!anchor || !tip) return;
    const { width, height } = tip.getBoundingClientRect();
    let top: number;
    let left: number;
    if (side === "right" || side === "left") {
      top = anchor.top + anchor.height / 2 - height / 2;
      left = side === "right" ? anchor.right + GAP : anchor.left - width - GAP;
    } else {
      top = side === "top" ? anchor.top - height - GAP : anchor.bottom + GAP;
      left = anchor.left + anchor.width / 2 - width / 2;
    }
    setPosition({
      top: Math.max(4, Math.min(top, window.innerHeight - height - 4)),
      left: Math.max(4, Math.min(left, window.innerWidth - width - 4)),
    });
  }, [anchor, side]);

  if (!isValidElement(children)) return children;

  const show = (wrapper: HTMLElement, delay: number) => {
    window.clearTimeout(timer.current);
    const trigger = triggerOf(wrapper);
    timer.current = window.setTimeout(() => setAnchor(trigger.getBoundingClientRect()), delay);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setAnchor(null);
    setPosition(null);
  };

  return (
    <>
      <span
        className="contents"
        onPointerEnter={(event: PointerEvent<HTMLSpanElement>) => {
          if (event.pointerType === "mouse") show(event.currentTarget, SHOW_DELAY);
        }}
        onPointerLeave={hide}
        onPointerDown={hide}
        onFocus={(event: FocusEvent<HTMLSpanElement>) => {
          if (event.target.matches(":focus-visible")) show(event.currentTarget, 0);
        }}
        onBlur={hide}
      >
        {cloneElement(children, {
          "aria-describedby": anchor && shortcut ? id : children.props["aria-describedby"],
        })}
      </span>
      {anchor &&
        createPortal(
          <div
            ref={tipRef}
            id={id}
            role="tooltip"
            style={{ top: position?.top ?? -9999, left: position?.left ?? -9999 }}
            className="pointer-events-none fixed z-[100] flex items-center gap-2 rounded-md bg-ink px-2 py-1 text-xs font-medium whitespace-nowrap text-white"
          >
            {label}
            {shortcut && (
              <kbd className="rounded-[4px] bg-white/15 px-1 font-sans text-[11px] text-white/85">{shortcut}</kbd>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
