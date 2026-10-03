import { ERASER_RADIUS } from "../constants";
import { getActivePage } from "../store/board-store";
import { appendFreehandPoint, createFreehand, createShapeFromDrag, INSERTED_TYPES, type ShapeTool } from "../utils/elements";
import { findErasedIds } from "../utils/geometry";
import { createId } from "../utils/id";
import { DRAFT_ID, type ToolHandler } from "./types";

export const penTool: ToolHandler = {
  start(input, ctx) {
    ctx.capture();
    let element = createFreehand(input.world, ctx.store().style, DRAFT_ID);
    ctx.setDraft(element);

    return {
      move({ samples }) {
        const minDistance = 1 / ctx.viewport().scale;
        let next = element;
        for (const point of samples) next = appendFreehandPoint(next, point, minDistance);
        if (next !== element) {
          element = next;
          ctx.setDraft(element);
        }
      },
      end() {
        // A single tap leaves a dot; a zero-length segment would not render.
        const points = element.points.length === 2 ? [0, 0, 0.01, 0] : element.points;
        ctx.store().addElement({ ...element, id: createId(), points });
      },
    };
  },
};

export function createShapeTool(tool: ShapeTool): ToolHandler {
  return {
    start(input, ctx) {
      ctx.capture();
      const { world: start } = input;
      return {
        move({ world, shiftKey }) {
          ctx.setDraft(createShapeFromDrag(tool, start, world, ctx.store().style, shiftKey, DRAFT_ID));
        },
        end({ world, shiftKey }) {
          // Too-small drags return null, so a stray click never leaves an invisible shape.
          const shape = createShapeFromDrag(tool, start, world, ctx.store().style, shiftKey);
          if (shape) ctx.store().addElement(shape);
        },
      };
    },
  };
}

/**
 * Object eraser: marks touched elements during the drag, deletes them in one
 * undo step on release. Locked elements and inserted objects (images, QR
 * codes, widgets) are ignored, so pen marks over a worksheet image can be
 * erased without deleting the worksheet. Those are removed with Delete.
 */
export const eraserTool: ToolHandler = {
  start(input, ctx) {
    ctx.capture();
    const radius = () => ERASER_RADIUS / ctx.viewport().scale;
    const elements = () =>
      getActivePage(ctx.store()).elements.filter((el) => !el.locked && !INSERTED_TYPES.has(el.type));
    const hits = new Set(findErasedIds(elements(), input.world, input.world, radius()));
    let last = input.world;
    ctx.setErasingIds(new Set(hits));

    return {
      move({ world }) {
        const fresh = findErasedIds(elements(), last, world, radius()).filter((id) => !hits.has(id));
        last = world;
        if (fresh.length) {
          fresh.forEach((id) => hits.add(id));
          ctx.setErasingIds(new Set(hits));
        }
      },
      end() {
        ctx.store().eraseElements(Array.from(hits));
      },
    };
  },
};
