import { describe, expect, it } from "vitest";
import type { BoardElement } from "../types";
import { findErasedIds, getContentBounds, getElementBounds, hitTestElement } from "./geometry";

const outlinedRect: BoardElement = {
  id: "rect",
  type: "rectangle",
  x: 0,
  y: 0,
  rotation: 0,
  width: 200,
  height: 100,
  color: "#000000",
  strokeWidth: 2,
  filled: false,
};

const stroke: BoardElement = {
  id: "stroke",
  type: "freehand",
  x: 50,
  y: 50,
  rotation: 0,
  points: [0, 0, 100, 0],
  color: "#000000",
  strokeWidth: 4,
};

describe("bounds", () => {
  it("includes stroke width in shape bounds", () => {
    expect(getElementBounds(outlinedRect)).toEqual({ x: -1, y: -1, width: 202, height: 102 });
  });

  it("accounts for rotation", () => {
    const rotated = getElementBounds({ ...outlinedRect, strokeWidth: 0, rotation: 90 });
    expect(rotated.width).toBeCloseTo(100);
    expect(rotated.height).toBeCloseTo(200);
  });

  it("returns null content bounds for an empty page", () => {
    expect(getContentBounds([])).toBeNull();
  });
});

describe("hit testing", () => {
  it("hits an outlined rectangle on its border only", () => {
    expect(hitTestElement(outlinedRect, { x: 0, y: 50 }, 5)).toBe(true);
    expect(hitTestElement(outlinedRect, { x: 100, y: 50 }, 5)).toBe(false);
  });

  it("hits a filled rectangle anywhere inside", () => {
    expect(hitTestElement({ ...outlinedRect, filled: true }, { x: 100, y: 50 }, 5)).toBe(true);
  });

  it("hits a stroke within radius plus half its width", () => {
    expect(hitTestElement(stroke, { x: 100, y: 56 }, 5)).toBe(true);
    expect(hitTestElement(stroke, { x: 100, y: 60 }, 5)).toBe(false);
  });

  it("handles a single-point stroke (a dot)", () => {
    const dot: BoardElement = { ...stroke, points: [0, 0] };
    expect(hitTestElement(dot, { x: 52, y: 50 }, 2)).toBe(true);
  });
});

describe("findErasedIds", () => {
  it("returns nothing on an empty board", () => {
    expect(findErasedIds([], { x: 0, y: 0 }, { x: 10, y: 10 }, 10)).toEqual([]);
  });

  it("catches strokes crossed by a fast eraser movement between samples", () => {
    // The eraser jumps from above to below the stroke in one pointer event.
    const ids = findErasedIds([stroke, outlinedRect], { x: 100, y: 20 }, { x: 100, y: 80 }, 4);
    expect(ids).toEqual(["stroke"]);
  });
});
