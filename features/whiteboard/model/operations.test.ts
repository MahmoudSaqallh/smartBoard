import { describe, expect, it } from "vitest";
import { DEFAULT_BACKGROUND } from "../background/presets";
import type { BoardDocument, BoardElement, BoardPage } from "../types";
import { createDocument } from "./document";
import { applyOperation, applyOperations, diffDocuments, diffElements } from "./operations";

const rect = (id: string, x = 0): BoardElement => ({
  id,
  type: "rectangle",
  x,
  y: 0,
  rotation: 0,
  width: 10,
  height: 10,
  color: "#000000",
  strokeWidth: 2,
  filled: false,
});

const page = (id: string, elements: BoardElement[] = [], name = id): BoardPage => ({
  id,
  name,
  background: DEFAULT_BACKGROUND,
  elements,
});
const doc = (...pages: BoardPage[]): BoardDocument => createDocument({ id: "b", title: "Lesson", pages });

/** diff(prev → next) applied to prev must reproduce next exactly. */
function expectRoundTrip(prev: BoardDocument, next: BoardDocument) {
  expect(applyOperations(prev, diffDocuments(prev, next))).toEqual(next);
}

describe("diff + apply round trip", () => {
  const a = rect("a");
  const b = rect("b");
  const c = rect("c");

  it.each([
    ["add to empty page", [], [a]],
    ["add on top", [a], [a, b]],
    ["add at the bottom", [a], [b, a]],
    ["insert in the middle", [a, c], [a, b, c]],
    ["delete", [a, b, c], [a, c]],
    ["update in place", [a, b], [rect("a", 99), b]],
    ["reorder", [a, b, c], [c, a, b]],
    ["mixed delete, update, add and reorder", [a, b, c], [rect("c", 5), rect("d"), a]],
    ["clear", [a, b], []],
  ])("%s", (_, before, after) => {
    expectRoundTrip(doc(page("p", before)), doc(page("p", after)));
  });

  it("covers page-level changes and the title", () => {
    const prev = doc(page("p1", [a]), page("p2"), page("p3"));
    const next = { ...doc(page("p3"), page("new", [b]), page("p1", [a], "Renamed")), title: "New title" };
    expectRoundTrip(prev, next);
  });

  it("covers backgrounds and assets, sending assets before the elements that use them", () => {
    const prev = doc(page("p", [a]));
    const asset = { id: "img", kind: "image" as const, src: "data:image/png;base64,AA==", mimeType: "image/png" as const, width: 4, height: 4 };
    const image: BoardElement = { id: "i", type: "image", x: 0, y: 0, rotation: 0, assetId: "img", width: 4, height: 4, opacity: 1, crop: null };
    const next: BoardDocument = {
      ...doc({ ...page("p", [a, image]), background: { color: "#1f2622", pattern: { type: "none" }, image: null } }),
      assets: { img: asset },
    };
    expectRoundTrip(prev, next);
    const types = diffDocuments(prev, next).map((op) => op.type);
    expect(types.indexOf("asset.put")).toBeLessThan(types.indexOf("element.put"));
    expect(types).toContain("page.background");
  });

  it("can replace the only page", () => {
    expectRoundTrip(doc(page("old", [a])), doc(page("new")));
  });

  it("emits nothing for identical documents and only touches changed elements", () => {
    const d = doc(page("p", [a, b]));
    expect(diffDocuments(d, d)).toEqual([]);
    const ops = diffElements("p", [a, b], [a, rect("b", 1)]);
    expect(ops).toEqual([{ type: "element.put", pageId: "p", element: rect("b", 1), after: "a" }]);
  });
});

describe("applying operations", () => {
  it("is idempotent, so replayed remote operations are harmless", () => {
    const start = doc(page("p", [rect("a")]));
    const op = { type: "element.put" as const, pageId: "p", element: rect("b"), after: "a" };
    const once = applyOperation(start, op);
    expect(applyOperation(once, op)).toBe(once);
    const del = { type: "element.delete" as const, pageId: "p", id: "a" };
    const deleted = applyOperation(once, del);
    expect(applyOperation(deleted, del)).toBe(deleted);
  });

  it("tolerates operations referring to things that no longer exist", () => {
    const start = doc(page("p", [rect("a")]));
    // Anchor deleted by someone else: the element still lands, on top.
    const placed = applyOperation(start, { type: "element.put", pageId: "p", element: rect("b"), after: "gone" });
    expect(placed.pages[0].elements.map((el) => el.id)).toEqual(["a", "b"]);
    // Unknown page or element: no change, same reference.
    expect(applyOperation(start, { type: "element.delete", pageId: "nope", id: "a" })).toBe(start);
    expect(applyOperation(start, { type: "page.update", pageId: "nope", name: "x" })).toBe(start);
  });

  it("never deletes the last page", () => {
    const start = doc(page("only"));
    expect(applyOperation(start, { type: "page.delete", pageId: "only" })).toBe(start);
  });

  it("keeps unlisted elements when applying a stale order", () => {
    const start = doc(page("p", [rect("a"), rect("b"), rect("late")]));
    const reordered = applyOperation(start, { type: "element.order", pageId: "p", order: ["b", "a"] });
    expect(reordered.pages[0].elements.map((el) => el.id)).toEqual(["b", "a", "late"]);
  });
});
