import { describe, expect, it } from "vitest";
import { DEFAULT_BACKGROUND } from "../background/presets";
import type { BoardDocument } from "../types";
import { BOARD_SCHEMA_VERSION, createDocument, parseDocument, serializeDocument } from "./document";

const valid: BoardDocument = createDocument({
  id: "board-1",
  title: "Photosynthesis",
  pages: [
    {
      id: "p1",
      name: "Page 1",
      background: DEFAULT_BACKGROUND,
      elements: [
        { id: "f", type: "freehand", x: 1, y: 2, rotation: 0, points: [0, 0, 5, 5], color: "#1f2328", strokeWidth: 4 },
        { id: "l", type: "line", x: 0, y: 0, rotation: 0, points: [0, 0, 10, 10], color: "#1f2328", strokeWidth: 2 },
        { id: "r", type: "rectangle", x: 0, y: 0, rotation: 45, width: 10, height: 5, color: "#d92d20", strokeWidth: 2, filled: true, locked: true },
        { id: "e", type: "ellipse", x: 0, y: 0, rotation: 0, radiusX: 4, radiusY: 3, color: "#2b8a3e", strokeWidth: 2, filled: false },
        { id: "t", type: "text", x: 0, y: 0, rotation: 0, text: "Hello", width: 200, height: 30, fontSize: 24, color: "#1f2328" },
        { id: "s", type: "sticky", x: 0, y: 0, rotation: 0, text: "Note", width: 200, height: 200, color: "#fff0a6" },
      ],
    },
  ],
});

/** Deep clone with a modification, simulating untrusted JSON. */
function mutate(change: (raw: Record<string, unknown> & { pages: Array<Record<string, unknown> & { elements: Record<string, unknown>[] }> }) => void) {
  const raw = JSON.parse(serializeDocument(valid));
  change(raw);
  return raw;
}

const PNG_SRC = "data:image/png;base64,iVBORw0KGgo=";

/** A v2 document using every new feature: assets, images, QR, widgets, background image. */
const rich: BoardDocument = createDocument({
  id: "board-2",
  title: "Rich",
  assets: { a1: { id: "a1", kind: "image", src: PNG_SRC, mimeType: "image/png", width: 10, height: 10 } },
  pages: [
    {
      id: "p1",
      name: "Page 1",
      background: {
        color: "#ffffff",
        pattern: { type: "graph", size: 20, majorEvery: 5, color: "#0284c7", opacity: 0.4 },
        image: { assetId: "a1", fit: "contain", opacity: 0.8, blur: 2, brightness: 1.1 },
      },
      elements: [
        { id: "i", type: "image", x: 0, y: 0, rotation: 0, assetId: "a1", width: 10, height: 10, opacity: 0.5, crop: { top: 0.1, right: 0, bottom: 0, left: 0.2 } },
        { id: "q", type: "qr", x: 0, y: 0, rotation: 0, content: "https://example.com", label: "Join", size: 200 },
        { id: "c", type: "clock", x: 0, y: 0, rotation: 0, variant: "digital", width: 280, height: 104, hour12: true, showSeconds: false, showDate: true, color: "#1f2328" },
        { id: "t", type: "timer", x: 0, y: 0, rotation: 0, mode: "countdown", durationMs: 60_000, label: "Quiz", sound: true, width: 260, height: 128, color: "#1f2328" },
      ],
    },
  ],
});

describe("parseDocument v2 content", () => {
  it("round-trips assets, inserted objects and background images", () => {
    expect(parseDocument(JSON.parse(serializeDocument(rich)))).toEqual({ ok: true, document: rich });
  });

  it.each([
    ["an SVG data URL", "data:image/svg+xml;base64,PHN2Zz4="],
    ["a script URL", "javascript:alert(1)"],
    ["a remote URL", "https://evil.example/x.png"],
    ["a mismatched type", "data:image/jpeg;base64,AAAA"],
  ])("rejects asset sources containing %s", (_, src) => {
    const raw = JSON.parse(serializeDocument(rich));
    raw.assets.a1.src = src;
    expect(parseDocument(raw).ok).toBe(false);
  });

  it("rejects images and backgrounds that reference missing assets", () => {
    const missingElement = JSON.parse(serializeDocument(rich));
    missingElement.pages[0].elements[0].assetId = "nope";
    expect(parseDocument(missingElement).ok).toBe(false);

    const missingBackground = JSON.parse(serializeDocument(rich));
    missingBackground.pages[0].background.image.assetId = "nope";
    expect(parseDocument(missingBackground).ok).toBe(false);
  });

  it("rejects crops that hide the whole image and empty QR content", () => {
    const crop = JSON.parse(serializeDocument(rich));
    crop.pages[0].elements[0].crop = { top: 0, right: 0.5, bottom: 0, left: 0.5 };
    expect(parseDocument(crop).ok).toBe(false);

    const qr = JSON.parse(serializeDocument(rich));
    qr.pages[0].elements[1].content = "";
    expect(parseDocument(qr).ok).toBe(false);
  });
});

describe("parseDocument", () => {
  it("round-trips every element type", () => {
    const result = parseDocument(JSON.parse(serializeDocument(valid)));
    expect(result).toEqual({ ok: true, document: valid });
  });

  it("strips unknown properties instead of passing them into the app", () => {
    const raw = mutate((d) => {
      d.pages[0].elements[0].onload = "alert(1)";
      d.extra = { nested: true };
    });
    const result = parseDocument(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.pages[0].elements[0]).not.toHaveProperty("onload");
      expect(result.document).not.toHaveProperty("extra");
    }
  });

  it.each([
    ["not an object", () => "nope"],
    ["newer schema version", () => mutate((d) => (d.schemaVersion = BOARD_SCHEMA_VERSION + 1))],
    ["missing schema version", () => mutate((d) => delete d.schemaVersion)],
    ["no pages", () => mutate((d) => (d.pages = []))],
    ["non-finite coordinate", () => mutate((d) => (d.pages[0].elements[0].x = "Infinity"))],
    ["css colour instead of hex", () => mutate((d) => (d.pages[0].elements[2].color = "url(javascript:alert(1))"))],
    ["odd number of points", () => mutate((d) => (d.pages[0].elements[0].points = [0, 0, 1]))],
    ["unknown element type", () => mutate((d) => (d.pages[0].elements[0].type = "script"))],
    ["duplicate element ids", () => mutate((d) => (d.pages[0].elements[1].id = "f"))],
    ["duplicate page ids", () => mutate((d) => d.pages.push({ ...d.pages[0] }))],
    ["empty title", () => mutate((d) => (d.title = ""))],
  ])("rejects %s with a readable error", (_, input) => {
    const result = parseDocument(input());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });

  it("migrates version 1 documents: default backgrounds and empty assets", () => {
    const v1 = {
      schemaVersion: 1,
      id: "old",
      title: "Old board",
      pages: [{ id: "p", name: "Page 1", elements: [] }],
    };
    const result = parseDocument(v1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.schemaVersion).toBe(BOARD_SCHEMA_VERSION);
      expect(result.document.assets).toEqual({});
      expect(result.document.pages[0].background).toEqual(DEFAULT_BACKGROUND);
    }
  });

  it("normalises out-of-range rotations instead of rejecting the board", () => {
    const result = parseDocument(mutate((d) => (d.pages[0].elements[0].rotation = 450)));
    expect(result.ok && result.document.pages[0].elements[0].rotation).toBe(90);
  });
});
