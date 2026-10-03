import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEPS } from "../constants";
import type { Bounds, Point, Size, Viewport } from "../types";

export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, scale: 1 };

export function clampZoom(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

export function screenToWorld(point: Point, viewport: Viewport): Point {
  return {
    x: (point.x - viewport.x) / viewport.scale,
    y: (point.y - viewport.y) / viewport.scale,
  };
}

export function worldToScreen(point: Point, viewport: Viewport): Point {
  return {
    x: point.x * viewport.scale + viewport.x,
    y: point.y * viewport.scale + viewport.y,
  };
}

/** Zooms so the world point under `anchor` (screen coords) stays fixed. */
export function zoomAtPoint(viewport: Viewport, anchor: Point, nextScale: number): Viewport {
  const scale = clampZoom(nextScale);
  if (scale === viewport.scale) return viewport;
  const world = screenToWorld(anchor, viewport);
  return {
    scale,
    x: anchor.x - world.x * scale,
    y: anchor.y - world.y * scale,
  };
}

// Small epsilon so float drift (e.g. 1.2499999) still advances to the next stop.
const STEP_EPSILON = 0.001;

export function nextZoomStep(scale: number): number {
  return ZOOM_STEPS.find((step) => step > scale + STEP_EPSILON) ?? MAX_ZOOM;
}

export function previousZoomStep(scale: number): number {
  for (let i = ZOOM_STEPS.length - 1; i >= 0; i -= 1) {
    if (ZOOM_STEPS[i] < scale - STEP_EPSILON) return ZOOM_STEPS[i];
  }
  return MIN_ZOOM;
}

export function canZoomIn(scale: number): boolean {
  return scale < MAX_ZOOM - STEP_EPSILON;
}

export function canZoomOut(scale: number): boolean {
  return scale > MIN_ZOOM + STEP_EPSILON;
}

/** Fits `bounds` into the stage with padding, never zooming in past 100%. */
export function fitBounds(bounds: Bounds, stage: Size, padding = 64): Viewport {
  if (stage.width <= 0 || stage.height <= 0 || bounds.width <= 0 || bounds.height <= 0) {
    return DEFAULT_VIEWPORT;
  }
  const availableWidth = Math.max(1, stage.width - padding * 2);
  const availableHeight = Math.max(1, stage.height - padding * 2);
  const scale = clampZoom(
    Math.min(1, availableWidth / bounds.width, availableHeight / bounds.height),
  );
  return {
    scale,
    x: stage.width / 2 - (bounds.x + bounds.width / 2) * scale,
    y: stage.height / 2 - (bounds.y + bounds.height / 2) * scale,
  };
}

export function formatZoom(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}
