import type Konva from "konva";

export interface CanvasHandle {
  stage: Konva.Stage;
  /** Bottom to top: background, static content, live widgets. Composited in this order on export. */
  layers: Konva.Layer[];
}

/**
 * The mounted canvas registers itself here so chrome outside the canvas
 * (export buttons, menus, insert animations) can reach the Konva stage
 * without prop drilling.
 */
let handle: CanvasHandle | null = null;

export function registerCanvas(next: CanvasHandle | null): void {
  handle = next;
}

export function getCanvas(): CanvasHandle | null {
  return handle;
}
