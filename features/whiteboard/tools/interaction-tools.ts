import { getActivePage } from "../store/board-store";
import { createSticky, createText } from "../utils/elements";
import { boundsIntersect, getElementBounds, normalizeRect } from "../utils/geometry";
import type { ToolHandler } from "./types";

const DOUBLE_TAP_MS = 350;

/**
 * Select: tap selects (Shift toggles), double-tap edits text, dragging empty
 * space draws a selection box. Dragging elements is handled by Konva itself.
 */
export function createSelectTool(): ToolHandler {
  // Per-instance state that spans gestures (double-tap detection).
  let lastTap: { id: string; time: number } | null = null;

  return {
    start(input, ctx) {
      const store = ctx.store();
      const hit = ctx.hitTest(input.screen);
      if (hit?.kind === "transformer") return null;

      if (hit?.kind === "element") {
        const now = performance.now();
        const element = getActivePage(store).elements.find((el) => el.id === hit.id);
        const hasText = element?.type === "text" || element?.type === "sticky";
        // Only text can be double-tap edited; for anything else a quick second
        // tap is an ordinary tap and must still select.
        if (hasText && lastTap?.id === hit.id && now - lastTap.time < DOUBLE_TAP_MS) {
          lastTap = null;
          store.startEditing(hit.id);
          return null;
        }
        lastTap = { id: hit.id, time: now };
        if (input.shiftKey) store.toggleSelected(hit.id);
        else if (!store.selectedIds.includes(hit.id)) store.select([hit.id]);
        return null;
      }

      lastTap = null;
      ctx.capture();
      const start = input.world;
      const additive = input.shiftKey;
      const baseIds = additive ? store.selectedIds : [];
      if (!additive) store.clearSelection();

      return {
        move({ world }) {
          ctx.setMarquee(normalizeRect(start, world));
        },
        end({ world }) {
          const rect = normalizeRect(start, world);
          const { scale } = ctx.viewport();
          // A click (not a drag) on empty space only clears the selection.
          if (rect.width * scale <= 3 && rect.height * scale <= 3) return;
          // Locked objects are only selectable by clicking them directly.
          const ids = getActivePage(ctx.store())
            .elements.filter((el) => !el.locked && boundsIntersect(rect, getElementBounds(el)))
            .map((el) => el.id);
          ctx.store().select(additive ? [...baseIds, ...ids] : ids);
        },
      };
    },
  };
}

export const panTool: ToolHandler = {
  start(input, ctx) {
    ctx.capture();
    ctx.setPanning(true);
    const origin = input.screen;
    const startViewport = ctx.viewport();
    return {
      move({ screen }) {
        ctx.store().setViewport({
          ...startViewport,
          x: startViewport.x + screen.x - origin.x,
          y: startViewport.y + screen.y - origin.y,
        });
      },
    };
  },
};

/** Text and sticky notes: click places a new one (or edits an existing one) in the HTML editor. */
export function createPlacementTool(kind: "text" | "sticky"): ToolHandler {
  return {
    start(input, ctx) {
      // The press that closes an open editor never creates another note.
      if (input.endedEdit) return null;
      const store = ctx.store();
      const hit = ctx.hitTest(input.screen);
      if (hit?.kind === "element") {
        const existing = getActivePage(store).elements.find((el) => el.id === hit.id);
        if (existing?.type === kind) {
          store.startEditing(existing.id);
          return null;
        }
      }
      store.createAndEdit(kind === "text" ? createText(input.world, store.style) : createSticky(input.world, store.style));
      return null;
    },
  };
}
