import {
  DEFAULT_TEXT_WIDTH,
  ELEMENT_LABELS,
  MIN_ELEMENT_SIZE,
  MIN_SHAPE_SIZE,
  QR_DEFAULT_SIZE,
  STICKY_SIZE,
} from "../constants";
import type {
  BoardAsset,
  BoardElement,
  ClockElement,
  DrawingStyle,
  FreehandElement,
  ImageCrop,
  ImageElement,
  Point,
  QrElement,
  StickyElement,
  TextElement,
  TimerElement,
} from "../types";
import { createId } from "./id";
import { measureTextHeight } from "./text";

export type ShapeTool = "line" | "rectangle" | "ellipse";

function snapAngle(dx: number, dy: number): { dx: number; dy: number } {
  const length = Math.hypot(dx, dy);
  const step = Math.PI / 4;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  return { dx: Math.cos(angle) * length, dy: Math.sin(angle) * length };
}

/**
 * Builds a shape from a drag gesture. Returns null for drags too small to be
 * intentional, so a stray click never leaves an invisible element behind.
 * `constrain` (Shift) snaps lines to 45° and forces squares / circles.
 */
export function createShapeFromDrag(
  tool: ShapeTool,
  start: Point,
  end: Point,
  style: DrawingStyle,
  constrain = false,
  id: string = createId(),
): BoardElement | null {
  let dx = end.x - start.x;
  let dy = end.y - start.y;

  if (tool === "line") {
    if (constrain) ({ dx, dy } = snapAngle(dx, dy));
    if (Math.hypot(dx, dy) < MIN_SHAPE_SIZE) return null;
    return {
      id,
      type: "line",
      x: start.x,
      y: start.y,
      rotation: 0,
      points: [0, 0, dx, dy],
      color: style.color,
      strokeWidth: style.strokeWidth,
    };
  }

  if (constrain) {
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    dx = Math.sign(dx || 1) * size;
    dy = Math.sign(dy || 1) * size;
  }
  const width = Math.abs(dx);
  const height = Math.abs(dy);
  if (Math.max(width, height) < MIN_SHAPE_SIZE) return null;

  const left = Math.min(start.x, start.x + dx);
  const top = Math.min(start.y, start.y + dy);
  const common = {
    id,
    rotation: 0,
    color: style.color,
    strokeWidth: style.strokeWidth,
    filled: style.filled,
  };

  if (tool === "rectangle") {
    return { ...common, type: "rectangle", x: left, y: top, width: Math.max(1, width), height: Math.max(1, height) };
  }
  return {
    ...common,
    type: "ellipse",
    x: left + width / 2,
    y: top + height / 2,
    radiusX: Math.max(0.5, width / 2),
    radiusY: Math.max(0.5, height / 2),
  };
}

export function createFreehand(start: Point, style: DrawingStyle, id: string = createId()): FreehandElement {
  return {
    id,
    type: "freehand",
    x: start.x,
    y: start.y,
    rotation: 0,
    points: [0, 0],
    color: style.color,
    strokeWidth: style.strokeWidth,
  };
}

/** Appends a world point, skipping points closer than `minDistance` to keep strokes light. */
export function appendFreehandPoint(
  element: FreehandElement,
  point: Point,
  minDistance: number,
): FreehandElement {
  const { points } = element;
  const localX = point.x - element.x;
  const localY = point.y - element.y;
  const lastX = points[points.length - 2];
  const lastY = points[points.length - 1];
  if (Math.hypot(localX - lastX, localY - lastY) < minDistance) return element;
  return { ...element, points: [...points, localX, localY] };
}

export function createText(at: Point, style: DrawingStyle, id: string = createId()): TextElement {
  return {
    id,
    type: "text",
    x: at.x,
    y: at.y - style.fontSize * 0.6,
    rotation: 0,
    text: "",
    width: DEFAULT_TEXT_WIDTH,
    height: measureTextHeight("", DEFAULT_TEXT_WIDTH, style.fontSize),
    fontSize: style.fontSize,
    color: style.color,
  };
}

export function createSticky(center: Point, style: DrawingStyle, id: string = createId()): StickyElement {
  return {
    id,
    type: "sticky",
    x: center.x - STICKY_SIZE / 2,
    y: center.y - STICKY_SIZE / 2,
    rotation: 0,
    text: "",
    width: STICKY_SIZE,
    height: STICKY_SIZE,
    color: style.stickyColor,
  };
}

/** Recomputes derived text height; returns the same object when unchanged. */
export function withMeasuredText(element: BoardElement): BoardElement {
  if (element.type !== "text") return element;
  const height = measureTextHeight(element.text, element.width, element.fontSize);
  return height === element.height ? element : { ...element, height };
}

/** Height of a QR element: the square code plus a caption strip when labelled. */
export function qrHeight(element: Pick<QrElement, "size" | "label">): number {
  return element.size + (element.label.trim() ? Math.round(element.size * 0.16) : 0);
}

/** Display name for an element, distinguishing stopwatches and clock variants. */
export function elementLabel(element: BoardElement): string {
  if (element.type === "timer" && element.mode === "stopwatch") return "Stopwatch";
  if (element.type === "clock") return element.variant === "analog" ? "Analog clock" : "Digital clock";
  return ELEMENT_LABELS[element.type];
}

/** Object types placed whole (no ink): kept out of the eraser and kept at their aspect ratio. */
export const INSERTED_TYPES: ReadonlySet<BoardElement["type"]> = new Set(["image", "qr", "clock", "timer"]);

/** Places a box of `width` × `height` centred on a point. */
function centred(center: Point, width: number, height: number) {
  return { x: center.x - width / 2, y: center.y - height / 2 };
}

/** Image sized to fit within `maxSide` (world units) without distortion. */
export function createImageElement(
  asset: Pick<BoardAsset, "id" | "width" | "height">,
  center: Point,
  maxSide: number,
  id: string = createId(),
): ImageElement {
  const scale = Math.min(1, maxSide / Math.max(asset.width, asset.height));
  const width = Math.max(1, asset.width * scale);
  const height = Math.max(1, asset.height * scale);
  return { id, type: "image", ...centred(center, width, height), rotation: 0, assetId: asset.id, width, height, opacity: 1, crop: null };
}

/**
 * Keeps the on-screen pixel scale when the crop changes: the displayed size
 * shrinks or grows with the visible portion instead of stretching it.
 */
export function applyImageCrop(element: ImageElement, crop: ImageCrop | null): ImageElement {
  const visible = (c: ImageCrop | null) => ({
    w: 1 - (c ? c.left + c.right : 0),
    h: 1 - (c ? c.top + c.bottom : 0),
  });
  const before = visible(element.crop);
  const after = visible(crop);
  const isEmpty = !crop || (crop.top === 0 && crop.right === 0 && crop.bottom === 0 && crop.left === 0);
  return {
    ...element,
    crop: isEmpty ? null : crop,
    width: Math.max(MIN_ELEMENT_SIZE, (element.width / before.w) * after.w),
    height: Math.max(MIN_ELEMENT_SIZE, (element.height / before.h) * after.h),
  };
}

/** Swaps in a new image, keeping the current width and adopting the new aspect ratio. */
export function replaceImageAsset(element: ImageElement, asset: Pick<BoardAsset, "id" | "width" | "height">): ImageElement {
  const height = Math.max(MIN_ELEMENT_SIZE, element.width * (asset.height / asset.width));
  return { ...element, assetId: asset.id, height, crop: null };
}

export function createQrElement(content: string, label: string, center: Point, id: string = createId()): QrElement {
  const element: QrElement = { id, type: "qr", x: 0, y: 0, rotation: 0, content, label, size: QR_DEFAULT_SIZE };
  return { ...element, ...centred(center, element.size, qrHeight(element)) };
}

const CLOCK_SIZES = { digital: { width: 280, height: 104 }, analog: { width: 200, height: 200 } } as const;

export function createClockElement(variant: ClockElement["variant"], center: Point, color: string, id: string = createId()): ClockElement {
  const { width, height } = CLOCK_SIZES[variant];
  return {
    id,
    type: "clock",
    ...centred(center, width, height),
    rotation: 0,
    variant,
    width,
    height,
    hour12: false,
    showSeconds: variant === "digital",
    showDate: false,
    color,
  };
}

export function createTimerElement(mode: TimerElement["mode"], center: Point, color: string, id: string = createId()): TimerElement {
  const width = 260;
  const height = 128;
  return {
    id,
    type: "timer",
    ...centred(center, width, height),
    rotation: 0,
    mode,
    durationMs: mode === "countdown" ? 5 * 60_000 : 0,
    label: "",
    sound: true,
    width,
    height,
    color,
  };
}

/** Which style properties an element type responds to. */
export function getStyleCapabilities(type: BoardElement["type"]) {
  return {
    color: !["sticky", "image", "qr"].includes(type),
    strokeWidth: type === "freehand" || type === "line" || type === "rectangle" || type === "ellipse",
    filled: type === "rectangle" || type === "ellipse",
    fontSize: type === "text",
    stickyColor: type === "sticky",
  };
}

/**
 * Applies only the style properties that make sense for the element.
 * Returns the original reference when nothing changes, so callers can
 * detect no-op updates and skip history entries.
 */
export function applyStylePatch(element: BoardElement, patch: Partial<DrawingStyle>): BoardElement {
  const can = getStyleCapabilities(element.type);
  const next: Record<string, unknown> = {};

  if (can.color && patch.color !== undefined && "color" in element && element.color !== patch.color) {
    next.color = patch.color;
  }
  if (can.stickyColor && patch.stickyColor !== undefined && "color" in element && element.color !== patch.stickyColor) {
    next.color = patch.stickyColor;
  }
  if (can.strokeWidth && patch.strokeWidth !== undefined && "strokeWidth" in element && element.strokeWidth !== patch.strokeWidth) {
    next.strokeWidth = patch.strokeWidth;
  }
  if (can.filled && patch.filled !== undefined && "filled" in element && element.filled !== patch.filled) {
    next.filled = patch.filled;
  }
  if (can.fontSize && patch.fontSize !== undefined && element.type === "text" && element.fontSize !== patch.fontSize) {
    next.fontSize = patch.fontSize;
  }

  if (Object.keys(next).length === 0) return element;
  return withMeasuredText({ ...element, ...next } as BoardElement);
}

export interface TransformSnapshot {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  /** Live-resized nodes (text, sticky) report their final size directly. */
  width?: number;
  height?: number;
  fontSize?: number;
}

/** Bakes a Konva transform into element geometry so scale never accumulates. */
export function bakeTransform(element: BoardElement, t: TransformSnapshot): BoardElement {
  const sx = Math.abs(t.scaleX) || 1;
  const sy = Math.abs(t.scaleY) || 1;
  const base = { x: t.x, y: t.y, rotation: t.rotation };

  switch (element.type) {
    case "freehand":
      return { ...element, ...base, points: element.points.map((v, i) => (i % 2 === 0 ? v * sx : v * sy)) };
    case "line": {
      const [x1, y1, x2, y2] = element.points;
      return { ...element, ...base, points: [x1 * sx, y1 * sy, x2 * sx, y2 * sy] };
    }
    case "rectangle":
      return {
        ...element,
        ...base,
        width: Math.max(MIN_ELEMENT_SIZE, element.width * sx),
        height: Math.max(MIN_ELEMENT_SIZE, element.height * sy),
      };
    case "ellipse":
      return {
        ...element,
        ...base,
        radiusX: Math.max(MIN_ELEMENT_SIZE / 2, element.radiusX * sx),
        radiusY: Math.max(MIN_ELEMENT_SIZE / 2, element.radiusY * sy),
      };
    case "text":
      return withMeasuredText({
        ...element,
        ...base,
        width: Math.max(MIN_ELEMENT_SIZE * 4, (t.width ?? element.width) * sx),
        fontSize: Math.min(400, Math.max(6, Math.round((t.fontSize ?? element.fontSize) * sy))),
      });
    case "sticky":
      return {
        ...element,
        ...base,
        width: Math.max(MIN_ELEMENT_SIZE * 8, (t.width ?? element.width) * sx),
        height: Math.max(MIN_ELEMENT_SIZE * 8, (t.height ?? element.height) * sy),
      };
    case "image":
    case "clock":
    case "timer":
      return {
        ...element,
        ...base,
        width: Math.max(MIN_ELEMENT_SIZE * 2, element.width * sx),
        height: Math.max(MIN_ELEMENT_SIZE * 2, element.height * sy),
      };
    case "qr":
      // Always square: use the larger factor so corner drags feel natural.
      return { ...element, ...base, size: Math.max(32, element.size * Math.max(sx, sy)) };
  }
}

/** Moves the selection one step up the paint order. */
export function bringForward(elements: BoardElement[], ids: readonly string[]): BoardElement[] {
  const set = new Set(ids);
  const next = elements.slice();
  for (let i = next.length - 2; i >= 0; i -= 1) {
    if (set.has(next[i].id) && !set.has(next[i + 1].id)) [next[i], next[i + 1]] = [next[i + 1], next[i]];
  }
  return next.every((el, i) => el === elements[i]) ? elements : next;
}

/** Moves the selection one step down the paint order. */
export function sendBackward(elements: BoardElement[], ids: readonly string[]): BoardElement[] {
  const set = new Set(ids);
  const next = elements.slice();
  for (let i = 1; i < next.length; i += 1) {
    if (set.has(next[i].id) && !set.has(next[i - 1].id)) [next[i], next[i - 1]] = [next[i - 1], next[i]];
  }
  return next.every((el, i) => el === elements[i]) ? elements : next;
}

export function removeElements(elements: BoardElement[], ids: readonly string[]): BoardElement[] {
  if (ids.length === 0) return elements;
  const remove = new Set(ids);
  const next = elements.filter((el) => !remove.has(el.id));
  return next.length === elements.length ? elements : next;
}

export function moveElements(elements: BoardElement[], ids: readonly string[], dx: number, dy: number): BoardElement[] {
  if (ids.length === 0 || (dx === 0 && dy === 0)) return elements;
  const move = new Set(ids);
  return elements.map((el) => (move.has(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el));
}

export function duplicateElements(
  elements: BoardElement[],
  ids: readonly string[],
  offset = 24,
  makeId: () => string = createId,
): { elements: BoardElement[]; newIds: string[] } {
  const source = new Set(ids);
  const copies = elements
    .filter((el) => source.has(el.id))
    // Copies start unlocked: duplicating is how you get an editable version of a locked object.
    .map((el) => ({ ...el, id: makeId(), x: el.x + offset, y: el.y + offset, locked: undefined }));
  return { elements: copies.length ? [...elements, ...copies] : elements, newIds: copies.map((c) => c.id) };
}

export function bringToFront(elements: BoardElement[], ids: readonly string[]): BoardElement[] {
  const set = new Set(ids);
  const moving = elements.filter((el) => set.has(el.id));
  if (moving.length === 0) return elements;
  const rest = elements.filter((el) => !set.has(el.id));
  const next = [...rest, ...moving];
  return next.every((el, i) => el === elements[i]) ? elements : next;
}

export function sendToBack(elements: BoardElement[], ids: readonly string[]): BoardElement[] {
  const set = new Set(ids);
  const moving = elements.filter((el) => set.has(el.id));
  if (moving.length === 0) return elements;
  const rest = elements.filter((el) => !set.has(el.id));
  const next = [...moving, ...rest];
  return next.every((el, i) => el === elements[i]) ? elements : next;
}

export function describeElements(elements: readonly BoardElement[]): string {
  if (elements.length === 0) return "Nothing";
  if (elements.length === 1) return elementLabel(elements[0]);
  return `${elements.length} objects`;
}

/** Converts #rrggbb to rgba() for translucent shape fills. */
export function hexToRgba(hex: string, alpha: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return `rgba(0, 0, 0, ${alpha})`;
  const value = parseInt(match[1], 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}
