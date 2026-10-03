import { describe, expect, it } from "vitest";
import { MAX_ZOOM, MIN_ZOOM } from "../constants";
import {
  canZoomIn,
  canZoomOut,
  clampZoom,
  fitBounds,
  nextZoomStep,
  previousZoomStep,
  screenToWorld,
  worldToScreen,
  zoomAtPoint,
} from "./viewport";

describe("zoom limits", () => {
  it("clamps to the supported range and recovers from invalid input", () => {
    expect(clampZoom(100)).toBe(MAX_ZOOM);
    expect(clampZoom(0)).toBe(MIN_ZOOM);
    expect(clampZoom(-3)).toBe(MIN_ZOOM);
    expect(clampZoom(Number.NaN)).toBe(1);
    expect(clampZoom(Number.POSITIVE_INFINITY)).toBe(1);
  });

  it("steps through zoom stops and stops at the limits", () => {
    expect(nextZoomStep(1)).toBe(1.25);
    expect(previousZoomStep(1)).toBe(0.75);
    expect(nextZoomStep(MAX_ZOOM)).toBe(MAX_ZOOM);
    expect(previousZoomStep(MIN_ZOOM)).toBe(MIN_ZOOM);
    // Between stops (e.g. after wheel zoom) the next stop is chosen.
    expect(nextZoomStep(1.1)).toBe(1.25);
    expect(previousZoomStep(1.1)).toBe(1);
  });

  it("tolerates floating point drift near a stop", () => {
    expect(nextZoomStep(1.2499999)).toBe(1.5);
    expect(canZoomIn(MAX_ZOOM - 1e-9)).toBe(false);
    expect(canZoomOut(MIN_ZOOM + 1e-9)).toBe(false);
  });
});

describe("coordinate conversion", () => {
  it("round-trips between screen and world space", () => {
    const viewport = { x: 120, y: -40, scale: 2.5 };
    const world = screenToWorld({ x: 300, y: 200 }, viewport);
    expect(worldToScreen(world, viewport)).toEqual({ x: 300, y: 200 });
  });

  it("keeps the anchored point fixed while zooming", () => {
    const viewport = { x: 50, y: 30, scale: 1 };
    const anchor = { x: 400, y: 300 };
    const before = screenToWorld(anchor, viewport);
    const zoomed = zoomAtPoint(viewport, anchor, 2);
    const after = screenToWorld(anchor, zoomed);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("returns the same viewport when the clamped zoom does not change", () => {
    const viewport = { x: 0, y: 0, scale: MAX_ZOOM };
    expect(zoomAtPoint(viewport, { x: 10, y: 10 }, MAX_ZOOM * 2)).toBe(viewport);
  });
});

describe("fitBounds", () => {
  it("centres content without zooming in past 100%", () => {
    const viewport = fitBounds({ x: 0, y: 0, width: 100, height: 100 }, { width: 1000, height: 800 });
    expect(viewport.scale).toBe(1);
    expect(viewport.x).toBe(450);
    expect(viewport.y).toBe(350);
  });

  it("zooms out for large content", () => {
    const viewport = fitBounds({ x: 0, y: 0, width: 4000, height: 1000 }, { width: 1000, height: 800 }, 0);
    expect(viewport.scale).toBeCloseTo(0.25);
  });

  it("falls back to the default viewport for a zero-sized stage", () => {
    expect(fitBounds({ x: 0, y: 0, width: 10, height: 10 }, { width: 0, height: 0 })).toEqual({
      x: 0,
      y: 0,
      scale: 1,
    });
  });
});
