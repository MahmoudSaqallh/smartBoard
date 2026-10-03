"use client";

import { Lock } from "lucide-react";
import { ELEMENT_LABELS } from "../constants";
import type { BoardElement, Viewport } from "../types";
import { getElementBounds } from "../utils/geometry";
import { worldToScreen } from "../utils/viewport";

interface LockBadgesProps {
  /** Selected locked elements. */
  elements: BoardElement[];
  viewport: Viewport;
  canUnlock: boolean;
  onUnlock: (id: string) => void;
}

/**
 * Lock marker at the top-right of each selected locked element. A real
 * button (not canvas pixels) so it is focusable and announced; a static badge
 * for users who may not unlock.
 */
export function LockBadges({ elements, viewport, canUnlock, onUnlock }: LockBadgesProps) {
  return elements.map((element) => {
    const bounds = getElementBounds(element);
    const corner = worldToScreen({ x: bounds.x + bounds.width, y: bounds.y }, viewport);
    const style = { left: corner.x, top: corner.y };
    const className =
      "absolute z-10 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line-strong bg-surface text-ink-muted shadow-sm";
    const label = ELEMENT_LABELS[element.type];

    if (!canUnlock) {
      return (
        <span key={element.id} role="img" aria-label={`${label} is locked`} style={style} className={`pointer-events-none ${className}`}>
          <Lock aria-hidden className="size-3" strokeWidth={2.25} />
        </span>
      );
    }
    return (
      <button
        key={element.id}
        type="button"
        aria-label={`Unlock ${label.toLowerCase()}`}
        title="Unlock"
        style={style}
        // Keep the press away from the canvas tool handlers underneath.
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => onUnlock(element.id)}
        className={`focus-ring ${className} transition-colors hover:border-accent hover:text-accent`}
      >
        <Lock aria-hidden className="size-3" strokeWidth={2.25} />
      </button>
    );
  });
}
