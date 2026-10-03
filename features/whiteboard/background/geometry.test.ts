import { describe, expect, it } from "vitest";
import { adaptiveSpacing, fitImageRect, isDarkColor, lineOffsets, visibleWorldRect } from "./geometry";

const frame = { x: 0, y: 0, width: 1920, height: 1080 };

describe("pattern spacing", () => {
  it("keeps the spacing when lines are far enough apart", () => {
    expect(adaptiveSpacing(24, 1)).toBe(24);
  });

  it("doubles the spacing when zoomed out so lines never crowd", () => {
    expect(adaptiveSpacing(24, 0.1)).toBe(96); // 24*0.1=2.4px → 96*0.1=9.6px
    expect(adaptiveSpacing(24, 0.1) * 0.1).toBeGreaterThanOrEqual(8);
  });

  it("survives degenerate input", () => {
    expect(adaptiveSpacing(0, 1)).toBe(1);
    expect(adaptiveSpacing(24, 0)).toBe(24);
  });

  it("lists line positions covering a range, including negative coordinates", () => {
    expect(lineOffsets(-30, 30, 20)).toEqual([-20, 0, 20]);
    expect(lineOffsets(5, 4, 10)).toEqual([]);
    expect(lineOffsets(0, 1e9, 1).length).toBeLessThanOrEqual(2000);
  });
});

describe("background image fit", () => {
  const wide = { width: 400, height: 100 };

  it("covers the frame, cropping overflow", () => {
    expect(fitImageRect("cover", frame, wide)).toEqual({ x: -1200, y: 0, width: 4320, height: 1080 });
  });

  it("contains the image within the frame", () => {
    expect(fitImageRect("contain", frame, wide)).toEqual({ x: 0, y: 300, width: 1920, height: 480 });
  });

  it("stretches, centres at natural size, and tiles from the origin", () => {
    expect(fitImageRect("stretch", frame, wide)).toEqual(frame);
    expect(fitImageRect("center", frame, wide)).toEqual({ x: 760, y: 490, width: 400, height: 100 });
    expect(fitImageRect("tile", frame, wide)).toBeNull();
  });
});

describe("visible world rect", () => {
  it("inverts the canvas transform (offset + scale + pixel ratio)", () => {
    // Stage at (100, 50), zoom 2, pixel ratio 2 → device matrix scale 4.
    const rect = visibleWorldRect({ a: 4, b: 0, c: 0, d: 4, e: 200, f: 100 }, 800, 400);
    expect(rect).toEqual({ x: -50, y: -25, width: 200, height: 100 });
  });

  it("returns an empty rect for a singular transform", () => {
    expect(visibleWorldRect({ a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 }, 10, 10).width).toBe(0);
  });
});

describe("colour darkness", () => {
  it("recognises dark boards", () => {
    expect(isDarkColor("#1f2622")).toBe(true);
    expect(isDarkColor("#ffffff")).toBe(false);
    expect(isDarkColor("not a colour")).toBe(false);
  });
});
