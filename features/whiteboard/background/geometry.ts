/**
 * Pure background geometry, shared by the live canvas and PNG export.
 * No DOM or canvas access, so it is unit-testable.
 */
import type { BackgroundFit, Bounds } from "../types";

/** Never draw pattern lines closer than this many CSS pixels apart. */
export const MIN_PATTERN_GAP_PX = 8;
/** Hard cap on lines per axis, a guard against degenerate transforms. */
const MAX_LINES_PER_AXIS = 2000;

/**
 * Doubles the spacing until lines are at least `minPx` apart on screen, so
 * zooming out never produces an unreadable (or expensive) wall of lines.
 */
export function adaptiveSpacing(spacing: number, cssPxPerWorld: number, minPx = MIN_PATTERN_GAP_PX): number {
  if (!(spacing > 0) || !(cssPxPerWorld > 0)) return Math.max(spacing, 1);
  let step = spacing;
  for (let i = 0; i < 30 && step * cssPxPerWorld < minPx; i += 1) step *= 2;
  return step;
}

/** World positions of lines at multiples of `step` covering [from, to]. */
export function lineOffsets(from: number, to: number, step: number): number[] {
  if (!(step > 0) || !Number.isFinite(from) || !Number.isFinite(to) || to < from) return [];
  const first = Math.ceil(from / step) * step;
  const count = Math.min(MAX_LINES_PER_AXIS, Math.floor((to - first) / step) + 1);
  return Array.from({ length: Math.max(0, count) }, (_, i) => first + i * step);
}

/**
 * Where an image of `natural` size lands inside `frame` for a fit mode.
 * Returns null for "tile", which repeats from the world origin instead.
 * World units equal source pixels for "center" and "tile".
 */
export function fitImageRect(
  fit: BackgroundFit,
  frame: Bounds,
  natural: { width: number; height: number },
): Bounds | null {
  if (fit === "tile") return null;
  if (fit === "stretch" || natural.width <= 0 || natural.height <= 0) return { ...frame };
  let width = natural.width;
  let height = natural.height;
  if (fit === "cover" || fit === "contain") {
    const scaleX = frame.width / natural.width;
    const scaleY = frame.height / natural.height;
    const scale = fit === "cover" ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
    width = natural.width * scale;
    height = natural.height * scale;
  }
  return {
    x: frame.x + (frame.width - width) / 2,
    y: frame.y + (frame.height - height) / 2,
    width,
    height,
  };
}

/** 2D affine transform in canvas order (a, b, c, d, e, f). */
export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

/**
 * World-space rectangle covered by a canvas of the given size under a
 * transform. Derived from the transform itself, so the same drawing code
 * fills the visible viewport live and an arbitrary region during export.
 */
export function visibleWorldRect(m: Affine, canvasWidth: number, canvasHeight: number): Bounds {
  const det = m.a * m.d - m.b * m.c;
  if (!det || !Number.isFinite(det)) return { x: 0, y: 0, width: 0, height: 0 };
  const toWorld = (x: number, y: number) => ({
    x: (m.d * (x - m.e) - m.c * (y - m.f)) / det,
    y: (-m.b * (x - m.e) + m.a * (y - m.f)) / det,
  });
  const corners = [toWorld(0, 0), toWorld(canvasWidth, 0), toWorld(0, canvasHeight), toWorld(canvasWidth, canvasHeight)];
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Relative luminance (0 = black, 1 = white) of a #rrggbb colour. */
export function luminance(hex: string): number {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return 1;
  const value = parseInt(match[1], 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((value >> 16) & 255) + 0.7152 * channel((value >> 8) & 255) + 0.0722 * channel(value & 255);
}

export function isDarkColor(hex: string): boolean {
  return luminance(hex) < 0.2;
}
