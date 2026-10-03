import { describe, expect, it } from "vitest";
import { DEFAULT_STYLE } from "../constants";
import type { BoardElement } from "../types";
import {
  applyImageCrop,
  applyStylePatch,
  appendFreehandPoint,
  bakeTransform,
  bringForward,
  bringToFront,
  createClockElement,
  createFreehand,
  createImageElement,
  createQrElement,
  createShapeFromDrag,
  createTimerElement,
  duplicateElements,
  hexToRgba,
  qrHeight,
  removeElements,
  replaceImageAsset,
  sendBackward,
  sendToBack,
} from "./elements";

describe("createShapeFromDrag", () => {
  it("normalises rectangles dragged in any direction", () => {
    const rect = createShapeFromDrag("rectangle", { x: 100, y: 100 }, { x: 40, y: 20 }, DEFAULT_STYLE, false, "r");
    expect(rect).toMatchObject({ type: "rectangle", x: 40, y: 20, width: 60, height: 80 });
  });

  it("discards accidental clicks", () => {
    expect(createShapeFromDrag("rectangle", { x: 5, y: 5 }, { x: 6, y: 6 }, DEFAULT_STYLE)).toBeNull();
    expect(createShapeFromDrag("line", { x: 5, y: 5 }, { x: 5, y: 5 }, DEFAULT_STYLE)).toBeNull();
  });

  it("constrains to a circle and snaps lines to 45°", () => {
    const circle = createShapeFromDrag("ellipse", { x: 0, y: 0 }, { x: 100, y: 40 }, DEFAULT_STYLE, true, "c");
    expect(circle).toMatchObject({ radiusX: 50, radiusY: 50, x: 50, y: 50 });

    const line = createShapeFromDrag("line", { x: 0, y: 0 }, { x: 100, y: 8 }, DEFAULT_STYLE, true, "l");
    expect(line?.type).toBe("line");
    if (line?.type === "line") expect(line.points[3]).toBeCloseTo(0);
  });

  it("uses the current drawing style", () => {
    const style = { ...DEFAULT_STYLE, color: "#d92d20", strokeWidth: 8, filled: true };
    const rect = createShapeFromDrag("rectangle", { x: 0, y: 0 }, { x: 50, y: 50 }, style, false, "r");
    expect(rect).toMatchObject({ color: "#d92d20", strokeWidth: 8, filled: true });
  });
});

describe("freehand", () => {
  it("skips points closer than the minimum distance", () => {
    const stroke = createFreehand({ x: 10, y: 10 }, DEFAULT_STYLE, "f");
    const same = appendFreehandPoint(stroke, { x: 10.5, y: 10 }, 2);
    expect(same).toBe(stroke);
    const longer = appendFreehandPoint(stroke, { x: 20, y: 10 }, 2);
    expect(longer.points).toEqual([0, 0, 10, 0]);
  });
});

describe("applyStylePatch", () => {
  const rect = createShapeFromDrag("rectangle", { x: 0, y: 0 }, { x: 50, y: 50 }, DEFAULT_STYLE, false, "r")!;
  const sticky: BoardElement = {
    id: "s",
    type: "sticky",
    x: 0,
    y: 0,
    rotation: 0,
    text: "",
    width: 200,
    height: 200,
    color: "#fff0a6",
  };

  it("returns the same reference when nothing applicable changes", () => {
    expect(applyStylePatch(rect, { fontSize: 99 })).toBe(rect);
    expect(applyStylePatch(rect, { color: rect.type === "rectangle" ? rect.color : "" })).toBe(rect);
  });

  it("applies ink colour to shapes but sticky colour to notes", () => {
    expect(applyStylePatch(rect, { color: "#2b8a3e" })).toMatchObject({ color: "#2b8a3e" });
    expect(applyStylePatch(sticky, { color: "#2b8a3e" })).toBe(sticky);
    expect(applyStylePatch(sticky, { stickyColor: "#d3e5ff" })).toMatchObject({ color: "#d3e5ff" });
  });
});

describe("bakeTransform", () => {
  it("bakes scale into geometry instead of keeping it on the element", () => {
    const rect = createShapeFromDrag("rectangle", { x: 0, y: 0 }, { x: 100, y: 50 }, DEFAULT_STYLE, false, "r")!;
    const baked = bakeTransform(rect, { x: 5, y: 6, rotation: 30, scaleX: 2, scaleY: -0.5 });
    expect(baked).toMatchObject({ x: 5, y: 6, rotation: 30, width: 200, height: 25 });
    expect(baked).not.toHaveProperty("scaleX");
  });

  it("enforces a minimum size", () => {
    const rect = createShapeFromDrag("rectangle", { x: 0, y: 0 }, { x: 100, y: 50 }, DEFAULT_STYLE, false, "r")!;
    const tiny = bakeTransform(rect, { x: 0, y: 0, rotation: 0, scaleX: 0.001, scaleY: 0.001 });
    expect(tiny.type === "rectangle" && tiny.width).toBeGreaterThanOrEqual(8);
  });
});

describe("collection operations", () => {
  const a = createFreehand({ x: 0, y: 0 }, DEFAULT_STYLE, "a");
  const b = createFreehand({ x: 0, y: 0 }, DEFAULT_STYLE, "b");
  const c = createFreehand({ x: 0, y: 0 }, DEFAULT_STYLE, "c");
  const all = [a, b, c];

  it("returns the original array for no-op removals", () => {
    expect(removeElements(all, [])).toBe(all);
    expect(removeElements(all, ["missing"])).toBe(all);
    expect(removeElements(all, ["b"]).map((el) => el.id)).toEqual(["a", "c"]);
  });

  it("reorders layers and detects no-ops", () => {
    expect(bringToFront(all, ["a"]).map((el) => el.id)).toEqual(["b", "c", "a"]);
    expect(sendToBack(all, ["c"]).map((el) => el.id)).toEqual(["c", "a", "b"]);
    expect(bringToFront(all, ["c"])).toBe(all);
    expect(sendToBack(all, ["missing"])).toBe(all);
  });

  it("duplicates with new ids and an offset", () => {
    let n = 0;
    const { elements, newIds } = duplicateElements(all, ["a"], 24, () => `copy-${++n}`);
    expect(newIds).toEqual(["copy-1"]);
    expect(elements).toHaveLength(4);
    expect(elements[3]).toMatchObject({ id: "copy-1", x: 24, y: 24 });
  });
});

describe("inserted objects", () => {
  const asset = { id: "asset", width: 2000, height: 1000 };

  it("fits images within a size limit without distortion, centred on a point", () => {
    const image = createImageElement(asset, { x: 500, y: 500 }, 640, "img");
    expect(image).toMatchObject({ width: 640, height: 320, x: 180, y: 340, opacity: 1, crop: null });
  });

  it("keeps the pixel scale when cropping and when the crop is reset", () => {
    const image = createImageElement(asset, { x: 0, y: 0 }, 640, "img");
    const cropped = applyImageCrop(image, { top: 0, right: 0.25, bottom: 0.5, left: 0.25 });
    expect(cropped.width).toBeCloseTo(320);
    expect(cropped.height).toBeCloseTo(160);
    const restored = applyImageCrop(cropped, null);
    expect(restored.width).toBeCloseTo(640);
    expect(restored.height).toBeCloseTo(320);
    expect(restored.crop).toBeNull();
  });

  it("replacing an image keeps the width and adopts the new aspect ratio", () => {
    const image = createImageElement(asset, { x: 0, y: 0 }, 640, "img");
    const replaced = replaceImageAsset(image, { id: "tall", width: 500, height: 1000 });
    expect(replaced).toMatchObject({ assetId: "tall", width: 640, height: 1280, crop: null });
  });

  it("bakes transforms: QR stays square, images scale both sides", () => {
    const qr = createQrElement("hello", "Homework", { x: 0, y: 0 }, "qr");
    const baked = bakeTransform(qr, { x: 0, y: 0, rotation: 0, scaleX: 2, scaleY: 1.5 });
    expect(baked.type === "qr" && baked.size).toBe(qr.size * 2);
    const image = createImageElement(asset, { x: 0, y: 0 }, 640, "img");
    expect(bakeTransform(image, { x: 0, y: 0, rotation: 0, scaleX: 0.5, scaleY: 0.5 })).toMatchObject({ width: 320, height: 160 });
  });

  it("adds caption height only for labelled QR codes", () => {
    expect(qrHeight({ size: 200, label: "" })).toBe(200);
    expect(qrHeight({ size: 200, label: "  " })).toBe(200);
    expect(qrHeight({ size: 200, label: "Join" })).toBe(232);
  });

  it("creates widgets with sensible defaults", () => {
    expect(createTimerElement("countdown", { x: 0, y: 0 }, "#1f2328", "t")).toMatchObject({ durationMs: 300_000, sound: true });
    expect(createTimerElement("stopwatch", { x: 0, y: 0 }, "#1f2328", "s")).toMatchObject({ durationMs: 0 });
    const analog = createClockElement("analog", { x: 100, y: 100 }, "#1f2328", "c");
    expect(analog.width).toBe(analog.height);
  });
});

describe("single-step layer order", () => {
  const ids = (els: BoardElement[]) => els.map((el) => el.id);
  const a = createFreehand({ x: 0, y: 0 }, DEFAULT_STYLE, "a");
  const b = createFreehand({ x: 0, y: 0 }, DEFAULT_STYLE, "b");
  const c = createFreehand({ x: 0, y: 0 }, DEFAULT_STYLE, "c");

  it("moves forward and backward by one, stopping at the ends", () => {
    expect(ids(bringForward([a, b, c], ["a"]))).toEqual(["b", "a", "c"]);
    expect(ids(sendBackward([a, b, c], ["c"]))).toEqual(["a", "c", "b"]);
    const all = [a, b, c];
    expect(bringForward(all, ["c"])).toBe(all);
    expect(sendBackward(all, ["a"])).toBe(all);
  });

  it("keeps a multi-selection together", () => {
    expect(ids(bringForward([a, b, c], ["a", "b"]))).toEqual(["c", "a", "b"]);
  });
});

describe("hexToRgba", () => {
  it("converts valid colours and falls back safely", () => {
    expect(hexToRgba("#1d4ed8", 0.5)).toBe("rgba(29, 78, 216, 0.5)");
    expect(hexToRgba("not-a-colour", 0.2)).toBe("rgba(0, 0, 0, 0.2)");
  });
});
