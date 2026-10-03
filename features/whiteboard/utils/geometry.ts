import type { BoardElement, Bounds, Point } from "../types";
import { qrHeight } from "./elements";

const DEG_TO_RAD = Math.PI / 180;

function boundsFromPoints(points: number[], pad: number): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < points.length; i += 2) {
    minX = Math.min(minX, points[i]);
    maxX = Math.max(maxX, points[i]);
    minY = Math.min(minY, points[i + 1]);
    maxY = Math.max(maxY, points[i + 1]);
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX - pad, y: minY - pad, width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 };
}

/** Bounds in the element's own (unrotated, untranslated) coordinate frame. */
export function getLocalBounds(element: BoardElement): Bounds {
  switch (element.type) {
    case "freehand":
    case "line":
      return boundsFromPoints(element.points, element.strokeWidth / 2);
    case "rectangle": {
      const pad = element.strokeWidth / 2;
      return { x: -pad, y: -pad, width: element.width + pad * 2, height: element.height + pad * 2 };
    }
    case "ellipse": {
      const pad = element.strokeWidth / 2;
      return {
        x: -element.radiusX - pad,
        y: -element.radiusY - pad,
        width: (element.radiusX + pad) * 2,
        height: (element.radiusY + pad) * 2,
      };
    }
    case "text":
    case "sticky":
    case "image":
    case "clock":
    case "timer":
      return { x: 0, y: 0, width: element.width, height: element.height };
    case "qr":
      return { x: 0, y: 0, width: element.size, height: qrHeight(element) };
  }
}

export function rotatePoint(point: Point, degrees: number): Point {
  if (!degrees) return point;
  const angle = degrees * DEG_TO_RAD;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos };
}

/** Axis-aligned bounds in world coordinates, accounting for rotation. */
export function getElementBounds(element: BoardElement): Bounds {
  const local = getLocalBounds(element);
  const corners = [
    { x: local.x, y: local.y },
    { x: local.x + local.width, y: local.y },
    { x: local.x, y: local.y + local.height },
    { x: local.x + local.width, y: local.y + local.height },
  ].map((corner) => rotatePoint(corner, element.rotation));

  const xs = corners.map((c) => c.x + element.x);
  const ys = corners.map((c) => c.y + element.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

/** Union of all element bounds, or null for an empty page. */
export function getContentBounds(elements: readonly BoardElement[]): Bounds | null {
  if (elements.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const element of elements) {
    const b = getElementBounds(element);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;
}

export function normalizeRect(a: Point, b: Point): Bounds {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distanceToPolyline(p: Point, points: number[]): number {
  if (points.length < 2) return Infinity;
  if (points.length < 4) return Math.hypot(p.x - points[0], p.y - points[1]);
  let min = Infinity;
  for (let i = 0; i + 3 < points.length; i += 2) {
    const d = distanceToSegment(
      p,
      { x: points[i], y: points[i + 1] },
      { x: points[i + 2], y: points[i + 3] },
    );
    if (d < min) min = d;
  }
  return min;
}

function toLocal(point: Point, element: BoardElement): Point {
  return rotatePoint({ x: point.x - element.x, y: point.y - element.y }, -element.rotation);
}

function insideBox(p: Point, x: number, y: number, w: number, h: number): boolean {
  return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
}

/**
 * Whether a circle (world coords) touches the element. Outlined shapes only
 * register on their outline so erasing a stroke drawn inside a rectangle
 * does not delete the rectangle as well.
 */
export function hitTestElement(element: BoardElement, point: Point, radius: number): boolean {
  const p = toLocal(point, element);

  switch (element.type) {
    case "freehand":
    case "line":
      return distanceToPolyline(p, element.points) <= radius + element.strokeWidth / 2;

    case "rectangle": {
      const tol = radius + element.strokeWidth / 2;
      const { width: w, height: h } = element;
      if (!insideBox(p, -tol, -tol, w + tol * 2, h + tol * 2)) return false;
      if (element.filled) return true;
      const innerW = w - tol * 2;
      const innerH = h - tol * 2;
      if (innerW <= 0 || innerH <= 0) return true;
      return !insideBox(p, tol, tol, innerW, innerH);
    }

    case "ellipse": {
      const tol = radius + element.strokeWidth / 2;
      const outerX = element.radiusX + tol;
      const outerY = element.radiusY + tol;
      if ((p.x / outerX) ** 2 + (p.y / outerY) ** 2 > 1) return false;
      if (element.filled) return true;
      const innerX = element.radiusX - tol;
      const innerY = element.radiusY - tol;
      if (innerX <= 0 || innerY <= 0) return true;
      return (p.x / innerX) ** 2 + (p.y / innerY) ** 2 >= 1;
    }

    case "text":
    case "sticky":
    case "image":
    case "clock":
    case "timer":
      return insideBox(p, -radius, -radius, element.width + radius * 2, element.height + radius * 2);
    case "qr":
      return insideBox(p, -radius, -radius, element.size + radius * 2, qrHeight(element) + radius * 2);
  }
}

/**
 * Points spaced along a segment so fast pointer movement does not skip
 * over thin strokes between two pointer events.
 */
export function samplePointsAlong(from: Point, to: Point, spacing: number): Point[] {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(distance / Math.max(spacing, 0.5)));
  const points: Point[] = [];
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    points.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
  }
  return points;
}

/** Ids of elements touched by an eraser moving from `from` to `to`. */
export function findErasedIds(
  elements: readonly BoardElement[],
  from: Point,
  to: Point,
  radius: number,
): string[] {
  const samples = [from, ...samplePointsAlong(from, to, radius / 2)];
  const sweep = normalizeRect(from, to);
  const sweepBounds = {
    x: sweep.x - radius,
    y: sweep.y - radius,
    width: sweep.width + radius * 2,
    height: sweep.height + radius * 2,
  };
  const hits: string[] = [];
  for (const element of elements) {
    if (!boundsIntersect(sweepBounds, getElementBounds(element))) continue;
    if (samples.some((sample) => hitTestElement(element, sample, radius))) {
      hits.push(element.id);
    }
  }
  return hits;
}
