/**
 * Board document schema: creation, serialization and validated parsing.
 *
 * Every load path (autosave, version history, templates, imports, data from a
 * sync server) must go through `parseDocument`, which treats input as
 * untrusted. Bump BOARD_SCHEMA_VERSION and add a migration step when the
 * persisted shape changes.
 */
import { DEFAULT_BACKGROUND } from "../background/presets";
import {
  BOARD_TITLE_MAX_LENGTH,
  MAX_ASSETS,
  MAX_PAGES,
  PAGE_NAME_MAX_LENGTH,
  QR_LABEL_MAX_LENGTH,
  QR_MAX_LENGTH,
  TEXT_MAX_LENGTH,
  TIMER_MAX_MS,
  WIDGET_LABEL_MAX_LENGTH,
} from "../constants";
import type {
  BackgroundFit,
  BackgroundPattern,
  BoardAsset,
  BoardDocument,
  BoardElement,
  BoardPage,
  ImageCrop,
  PageBackground,
} from "../types";

/** v2: page backgrounds, document assets, image/qr/clock/timer elements. */
export const BOARD_SCHEMA_VERSION = 2;

/** Upper bound for a single page; protects rendering and memory from hostile payloads. */
export const MAX_ELEMENTS_PER_PAGE = 20_000;
const MAX_POINTS = 200_000;
const MAX_COORDINATE = 1e7;
/** ~15 MB of base64 per asset. */
const MAX_ASSET_SRC_LENGTH = 15_000_000;
/** Raster-only data URLs: no SVG markup, no script or remote URLs can enter a board. */
const ASSET_SRC = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export function createDocument(input: {
  id: string;
  title: string;
  pages: BoardPage[];
  assets?: Record<string, BoardAsset>;
}): BoardDocument {
  return { schemaVersion: BOARD_SCHEMA_VERSION, id: input.id, title: input.title, pages: input.pages, assets: input.assets ?? {} };
}

export function serializeDocument(doc: BoardDocument): string {
  return JSON.stringify(doc);
}

export type ParseResult = { ok: true; document: BoardDocument } | { ok: false; error: string };

class SchemaError extends Error {}

function fail(path: string, expected: string): never {
  throw new SchemaError(`${path}: expected ${expected}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown, path: string, maxLength: number, allowEmpty = true): string {
  if (typeof value !== "string" || value.length > maxLength || (!allowEmpty && value.length === 0)) {
    fail(path, `string up to ${maxLength} characters`);
  }
  return value;
}

function num(value: unknown, path: string, min = -MAX_COORDINATE, max = MAX_COORDINATE): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    fail(path, `number between ${min} and ${max}`);
  }
  return value;
}

function color(value: unknown, path: string): string {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) fail(path, "hex colour #rrggbb");
  return value;
}

function bool(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(path, "boolean");
  return value;
}

function oneOf<T extends string>(value: unknown, path: string, options: readonly T[]): T {
  if (typeof value !== "string" || !options.includes(value as T)) fail(path, options.join(" | "));
  return value as T;
}

function points(value: unknown, path: string, exact?: number): number[] {
  if (!Array.isArray(value) || value.length < 2 || value.length % 2 !== 0 || value.length > MAX_POINTS) {
    fail(path, "even-length array of coordinates");
  }
  if (exact !== undefined && value.length !== exact) fail(path, `${exact} coordinates`);
  return value.map((v, i) => num(v, `${path}[${i}]`));
}

function parseCrop(value: unknown, path: string): ImageCrop | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) fail(path, "crop object or null");
  const edge = (key: keyof ImageCrop) => num(value[key], `${path}.${key}`, 0, 0.9);
  const crop = { top: edge("top"), right: edge("right"), bottom: edge("bottom"), left: edge("left") };
  if (crop.left + crop.right > 0.9 || crop.top + crop.bottom > 0.9) fail(path, "at least 10% of the image visible");
  return crop;
}

/** Rebuilds the element field by field, so unknown properties never reach the app. */
function parseElement(value: unknown, path: string, assets: Record<string, BoardAsset>): BoardElement {
  if (!isRecord(value)) fail(path, "object");
  const base = {
    id: str(value.id, `${path}.id`, 128, false),
    x: num(value.x, `${path}.x`),
    y: num(value.y, `${path}.y`),
    // Normalised rather than rejected: an odd angle must not make a saved board unloadable.
    rotation: num(value.rotation, `${path}.rotation`) % 360,
    ...(value.locked === undefined ? {} : { locked: bool(value.locked, `${path}.locked`) }),
  };
  const size = (key: string, min = 0) => num(value[key], `${path}.${key}`, min, MAX_COORDINATE);
  const stroke = () => num(value.strokeWidth, `${path}.strokeWidth`, 0.1, 500);

  switch (value.type) {
    case "freehand":
      return { ...base, type: "freehand", points: points(value.points, `${path}.points`), color: color(value.color, `${path}.color`), strokeWidth: stroke() };
    case "line": {
      const [x1, y1, x2, y2] = points(value.points, `${path}.points`, 4);
      return { ...base, type: "line", points: [x1, y1, x2, y2], color: color(value.color, `${path}.color`), strokeWidth: stroke() };
    }
    case "rectangle":
      return {
        ...base,
        type: "rectangle",
        width: size("width"),
        height: size("height"),
        color: color(value.color, `${path}.color`),
        strokeWidth: stroke(),
        filled: bool(value.filled, `${path}.filled`),
      };
    case "ellipse":
      return {
        ...base,
        type: "ellipse",
        radiusX: size("radiusX"),
        radiusY: size("radiusY"),
        color: color(value.color, `${path}.color`),
        strokeWidth: stroke(),
        filled: bool(value.filled, `${path}.filled`),
      };
    case "text":
      return {
        ...base,
        type: "text",
        text: str(value.text, `${path}.text`, TEXT_MAX_LENGTH),
        width: size("width"),
        height: size("height"),
        fontSize: num(value.fontSize, `${path}.fontSize`, 1, 1000),
        color: color(value.color, `${path}.color`),
      };
    case "sticky":
      return {
        ...base,
        type: "sticky",
        text: str(value.text, `${path}.text`, TEXT_MAX_LENGTH),
        width: size("width"),
        height: size("height"),
        color: color(value.color, `${path}.color`),
      };
    case "image": {
      const assetId = str(value.assetId, `${path}.assetId`, 128, false);
      if (!assets[assetId]) fail(`${path}.assetId`, "an id present in document assets");
      return {
        ...base,
        type: "image",
        assetId,
        width: size("width", 1),
        height: size("height", 1),
        opacity: num(value.opacity, `${path}.opacity`, 0, 1),
        crop: parseCrop(value.crop, `${path}.crop`),
      };
    }
    case "qr":
      return {
        ...base,
        type: "qr",
        content: str(value.content, `${path}.content`, QR_MAX_LENGTH, false),
        label: str(value.label, `${path}.label`, QR_LABEL_MAX_LENGTH),
        size: size("size", 16),
      };
    case "clock":
      return {
        ...base,
        type: "clock",
        variant: oneOf(value.variant, `${path}.variant`, ["digital", "analog"] as const),
        width: size("width", 1),
        height: size("height", 1),
        hour12: bool(value.hour12, `${path}.hour12`),
        showSeconds: bool(value.showSeconds, `${path}.showSeconds`),
        showDate: bool(value.showDate, `${path}.showDate`),
        color: color(value.color, `${path}.color`),
      };
    case "timer":
      return {
        ...base,
        type: "timer",
        mode: oneOf(value.mode, `${path}.mode`, ["countdown", "stopwatch"] as const),
        durationMs: num(value.durationMs, `${path}.durationMs`, 0, TIMER_MAX_MS),
        label: str(value.label, `${path}.label`, WIDGET_LABEL_MAX_LENGTH),
        sound: bool(value.sound, `${path}.sound`),
        width: size("width", 1),
        height: size("height", 1),
        color: color(value.color, `${path}.color`),
      };
    default:
      return fail(`${path}.type`, "known element type");
  }
}

function parsePattern(value: unknown, path: string): BackgroundPattern {
  if (!isRecord(value)) fail(path, "pattern object");
  const opacity = () => num(value.opacity, `${path}.opacity`, 0, 1);
  const spacing = (key: string) => num(value[key], `${path}.${key}`, 4, 1000);
  switch (value.type) {
    case "none":
      return { type: "none" };
    case "grid":
      return { type: "grid", size: spacing("size"), color: color(value.color, `${path}.color`), opacity: opacity() };
    case "dots":
      return {
        type: "dots",
        spacing: spacing("spacing"),
        dotSize: num(value.dotSize, `${path}.dotSize`, 0.5, 40),
        color: color(value.color, `${path}.color`),
        opacity: opacity(),
      };
    case "lines":
      return { type: "lines", spacing: spacing("spacing"), color: color(value.color, `${path}.color`), opacity: opacity() };
    case "graph":
      return {
        type: "graph",
        size: spacing("size"),
        majorEvery: num(value.majorEvery, `${path}.majorEvery`, 2, 20),
        color: color(value.color, `${path}.color`),
        opacity: opacity(),
      };
    default:
      return fail(`${path}.type`, "known pattern type");
  }
}

const FITS: readonly BackgroundFit[] = ["cover", "contain", "stretch", "center", "tile"];

function parseBackground(value: unknown, path: string, assets: Record<string, BoardAsset>): PageBackground {
  if (!isRecord(value)) fail(path, "background object");
  let image: PageBackground["image"] = null;
  if (value.image !== null && value.image !== undefined) {
    const raw = value.image;
    if (!isRecord(raw)) fail(`${path}.image`, "object or null");
    const assetId = str(raw.assetId, `${path}.image.assetId`, 128, false);
    if (!assets[assetId]) fail(`${path}.image.assetId`, "an id present in document assets");
    image = {
      assetId,
      fit: oneOf(raw.fit, `${path}.image.fit`, FITS),
      opacity: num(raw.opacity, `${path}.image.opacity`, 0, 1),
      blur: num(raw.blur, `${path}.image.blur`, 0, 50),
      brightness: num(raw.brightness, `${path}.image.brightness`, 0.2, 2),
    };
  }
  return { color: color(value.color, `${path}.color`), pattern: parsePattern(value.pattern, `${path}.pattern`), image };
}

function parseAsset(value: unknown, path: string): BoardAsset {
  if (!isRecord(value)) fail(path, "object");
  const src = value.src;
  if (typeof src !== "string" || src.length > MAX_ASSET_SRC_LENGTH || !ASSET_SRC.test(src)) {
    fail(`${path}.src`, "PNG, JPEG or WebP data URL");
  }
  const mimeType = oneOf(value.mimeType, `${path}.mimeType`, ["image/png", "image/jpeg", "image/webp"] as const);
  if (!src.startsWith(`data:${mimeType};`)) fail(`${path}.mimeType`, "type matching src");
  if (value.kind !== "image") fail(`${path}.kind`, '"image"');
  return {
    id: str(value.id, `${path}.id`, 128, false),
    kind: "image",
    src,
    mimeType,
    width: num(value.width, `${path}.width`, 1, 20_000),
    height: num(value.height, `${path}.height`, 1, 20_000),
  };
}

function parsePage(value: unknown, path: string, assets: Record<string, BoardAsset>): BoardPage {
  if (!isRecord(value)) fail(path, "object");
  if (!Array.isArray(value.elements) || value.elements.length > MAX_ELEMENTS_PER_PAGE) {
    fail(`${path}.elements`, `array of up to ${MAX_ELEMENTS_PER_PAGE} elements`);
  }
  const elements = value.elements.map((el, i) => parseElement(el, `${path}.elements[${i}]`, assets));
  if (new Set(elements.map((el) => el.id)).size !== elements.length) fail(`${path}.elements`, "unique element ids");
  return {
    id: str(value.id, `${path}.id`, 128, false),
    name: str(value.name, `${path}.name`, PAGE_NAME_MAX_LENGTH, false),
    background: parseBackground(value.background, `${path}.background`, assets),
    elements,
  };
}

/** Upgrades older documents step by step to the current shape. */
function migrate(input: Record<string, unknown>): Record<string, unknown> {
  const version = input.schemaVersion;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) fail("schemaVersion", "positive integer");
  if (version > BOARD_SCHEMA_VERSION) {
    throw new SchemaError(`schemaVersion ${version} is newer than this app supports (${BOARD_SCHEMA_VERSION})`);
  }
  let doc = input;
  if (version < 2) {
    // v1 → v2: pages gain a background (the original look), documents gain assets.
    const pages = Array.isArray(doc.pages) ? doc.pages : [];
    doc = {
      ...doc,
      schemaVersion: 2,
      assets: {},
      pages: pages.map((page) => (isRecord(page) ? { ...page, background: DEFAULT_BACKGROUND } : page)),
    };
  }
  return doc;
}

/** Validates untrusted input (parsed JSON) into a document. Never throws. */
export function parseDocument(input: unknown): ParseResult {
  try {
    if (!isRecord(input)) fail("document", "object");
    const raw = migrate(input);

    if (!isRecord(raw.assets)) fail("assets", "object");
    const assetEntries = Object.entries(raw.assets);
    if (assetEntries.length > MAX_ASSETS) fail("assets", `at most ${MAX_ASSETS} assets`);
    const assets: Record<string, BoardAsset> = {};
    for (const [key, value] of assetEntries) {
      const asset = parseAsset(value, `assets.${key}`);
      if (asset.id !== key) fail(`assets.${key}.id`, "id matching its key");
      assets[key] = asset;
    }

    if (!Array.isArray(raw.pages) || raw.pages.length === 0 || raw.pages.length > MAX_PAGES) {
      fail("pages", `1 to ${MAX_PAGES} pages`);
    }
    const pages = raw.pages.map((page, i) => parsePage(page, `pages[${i}]`, assets));
    if (new Set(pages.map((p) => p.id)).size !== pages.length) fail("pages", "unique page ids");
    return {
      ok: true,
      document: createDocument({
        id: str(raw.id, "id", 128, false),
        title: str(raw.title, "title", BOARD_TITLE_MAX_LENGTH, false),
        pages,
        assets,
      }),
    };
  } catch (error) {
    if (error instanceof SchemaError) return { ok: false, error: error.message };
    return { ok: false, error: "Invalid board document" };
  }
}
