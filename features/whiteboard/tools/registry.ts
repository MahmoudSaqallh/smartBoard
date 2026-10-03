import type { ToolId } from "../types";
import { createShapeTool, eraserTool, penTool } from "./drawing-tools";
import { createPlacementTool, createSelectTool, panTool } from "./interaction-tools";
import type { ToolHandler } from "./types";

/**
 * Tool id → behaviour. Adding a tool means adding a ToolId, its metadata in
 * constants (label, shortcut), an icon, and a handler here. The canvas hook
 * never changes. Presence-only tools (e.g. a laser pointer) implement the same
 * interface and simply never call store mutations.
 */
export function createToolRegistry(): Record<ToolId, ToolHandler> {
  return {
    select: createSelectTool(),
    hand: panTool,
    pen: penTool,
    eraser: eraserTool,
    line: createShapeTool("line"),
    rectangle: createShapeTool("rectangle"),
    ellipse: createShapeTool("ellipse"),
    text: createPlacementTool("text"),
    sticky: createPlacementTool("sticky"),
  };
}
