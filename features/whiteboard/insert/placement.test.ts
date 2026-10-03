import { describe, expect, it } from "vitest";
import { createQrElement, createTimerElement } from "../utils/elements";
import { cascadeOffset } from "./placement";

describe("cascadeOffset", () => {
  it("keeps the requested spot when it is free", () => {
    const qr = createQrElement("a", "", { x: 500, y: 500 }, "q");
    expect(cascadeOffset(qr, [])).toEqual({ x: 0, y: 0 });
  });

  it("steps diagonally past every object already at that spot", () => {
    const first = createTimerElement("countdown", { x: 500, y: 500 }, "#000000", "t1");
    const second = { ...createTimerElement("countdown", { x: 500, y: 500 }, "#000000", "t2"), x: first.x + 32, y: first.y + 32 };
    const next = createTimerElement("countdown", { x: 500, y: 500 }, "#000000", "t3");
    expect(cascadeOffset(next, [first, second])).toEqual({ x: 64, y: 64 });
  });

  it("ignores objects elsewhere on the board", () => {
    const far = createQrElement("a", "", { x: 2000, y: 2000 }, "far");
    const qr = createQrElement("b", "", { x: 500, y: 500 }, "q");
    expect(cascadeOffset(qr, [far])).toEqual({ x: 0, y: 0 });
  });
});
