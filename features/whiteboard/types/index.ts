export type ToolId =
  | "select"
  | "hand"
  | "pen"
  | "eraser"
  | "line"
  | "rectangle"
  | "ellipse"
  | "text"
  | "sticky";

export type ElementType =
  | "freehand"
  | "line"
  | "rectangle"
  | "ellipse"
  | "text"
  | "sticky"
  | "image"
  | "qr"
  | "clock"
  | "timer";

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Every element is positioned by (x, y) in world coordinates and rotated
 * (degrees) around that origin. Scale is always baked into geometry, so
 * elements never carry scaleX / scaleY.
 */
interface ElementBase {
  id: string;
  x: number;
  y: number;
  rotation: number;
  /** Teacher lock: the element cannot be moved, edited or erased by anyone else. */
  locked?: boolean;
}

/** Points are relative to (x, y): [x0, y0, x1, y1, ...]. */
export interface FreehandElement extends ElementBase {
  type: "freehand";
  points: number[];
  color: string;
  strokeWidth: number;
}

export interface LineElement extends ElementBase {
  type: "line";
  points: [number, number, number, number];
  color: string;
  strokeWidth: number;
}

/** (x, y) is the top-left corner. */
export interface RectangleElement extends ElementBase {
  type: "rectangle";
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
  filled: boolean;
}

/** (x, y) is the centre. */
export interface EllipseElement extends ElementBase {
  type: "ellipse";
  radiusX: number;
  radiusY: number;
  color: string;
  strokeWidth: number;
  filled: boolean;
}

/** (x, y) is the top-left corner. Height is derived from the text layout. */
export interface TextElement extends ElementBase {
  type: "text";
  text: string;
  width: number;
  height: number;
  fontSize: number;
  color: string;
}

/** (x, y) is the top-left corner. */
export interface StickyElement extends ElementBase {
  type: "sticky";
  text: string;
  width: number;
  height: number;
  color: string;
}

/** Fractions (0–0.9) trimmed from each edge of the source image. */
export interface ImageCrop {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** (x, y) is the top-left corner. Pixels live in `BoardDocument.assets`, never in the element. */
export interface ImageElement extends ElementBase {
  type: "image";
  assetId: string;
  width: number;
  height: number;
  opacity: number;
  crop: ImageCrop | null;
}

/** (x, y) is the top-left corner. The module matrix is derived from `content`, never stored. */
export interface QrElement extends ElementBase {
  type: "qr";
  content: string;
  label: string;
  /** Side length of the square code; the label adds height below it. */
  size: number;
}

/** Live widget showing the real current time. Only configuration is stored. */
export interface ClockElement extends ElementBase {
  type: "clock";
  variant: "digital" | "analog";
  width: number;
  height: number;
  hour12: boolean;
  showSeconds: boolean;
  showDate: boolean;
  color: string;
}

/**
 * Countdown timer or stopwatch. The element stores configuration only;
 * running state (started at, paused, laps) is local runtime state.
 */
export interface TimerElement extends ElementBase {
  type: "timer";
  mode: "countdown" | "stopwatch";
  durationMs: number;
  label: string;
  /** Play a short chime when a countdown finishes (if the browser allows audio). */
  sound: boolean;
  width: number;
  height: number;
  color: string;
}

export type BoardElement =
  | FreehandElement
  | LineElement
  | RectangleElement
  | EllipseElement
  | TextElement
  | StickyElement
  | ImageElement
  | QrElement
  | ClockElement
  | TimerElement;

/**
 * Binary content referenced by elements and backgrounds. Stored once per
 * document, so moving an image never re-sends its pixels. `src` is a
 * validated raster data URL today; the files module can switch it to a
 * storage URL without touching elements.
 */
export interface BoardAsset {
  id: string;
  kind: "image";
  src: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  width: number;
  height: number;
}

/**
 * Background patterns. Add a member here and a renderer in
 * `background/render.ts` to introduce a new pattern (e.g. music staff,
 * handwriting lines, coordinate plane).
 */
export type BackgroundPattern =
  | { type: "none" }
  | { type: "grid"; size: number; color: string; opacity: number }
  | { type: "dots"; spacing: number; dotSize: number; color: string; opacity: number }
  | { type: "lines"; spacing: number; color: string; opacity: number }
  | { type: "graph"; size: number; majorEvery: number; color: string; opacity: number };

export type BackgroundFit = "cover" | "contain" | "stretch" | "center" | "tile";

/** Anchored to the page frame in world space, so annotations stay aligned on pan and zoom. */
export interface BackgroundImage {
  assetId: string;
  fit: BackgroundFit;
  opacity: number;
  /** World-unit blur radius. */
  blur: number;
  /** 1 = unchanged. */
  brightness: number;
}

export interface PageBackground {
  color: string;
  pattern: BackgroundPattern;
  image: BackgroundImage | null;
}

export interface BoardPage {
  id: string;
  name: string;
  background: PageBackground;
  /** Back-to-front paint order. Always addressed by element id, never by index. */
  elements: BoardElement[];
}

/**
 * The persisted, synchronised part of a board. Everything else in the store
 * (tool, selection, viewport, panels, undo stacks, timer runtime) is local.
 */
export interface BoardDocument {
  schemaVersion: number;
  id: string;
  title: string;
  pages: BoardPage[];
  assets: Record<string, BoardAsset>;
}

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Defaults applied to newly created elements. */
export interface DrawingStyle {
  color: string;
  strokeWidth: number;
  filled: boolean;
  fontSize: number;
  stickyColor: string;
}

/**
 * One undoable step: the operations that made the change and the operations
 * that revert it. Operation-based (not snapshots) so undo only reverts this
 * user's own changes once other people edit the same board.
 */
export interface HistoryEntry {
  ops: BoardOperation[];
  inverse: BoardOperation[];
}

export interface PageHistory {
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** Consecutive changes sharing a key within the window merge into one step. */
  lastKey: string | null;
  lastAt: number;
}

/**
 * Serializable, transport-agnostic description of a document change. This is
 * the contract shared by undo/redo, realtime sync, autosave and version history.
 * Elements are addressed by id and placed relative to a neighbour, so
 * operations stay meaningful when other users change the same page.
 */
export type BoardOperation =
  | { type: "board.update"; title: string }
  | { type: "page.insert"; page: BoardPage; after: string | null }
  | { type: "page.update"; pageId: string; name: string }
  | { type: "page.delete"; pageId: string }
  | { type: "page.order"; order: string[] }
  | { type: "page.background"; pageId: string; background: PageBackground }
  /** Assets are added before the elements that reference them. */
  | { type: "asset.put"; asset: BoardAsset }
  | { type: "asset.delete"; assetId: string }
  /** Insert or replace. New elements go directly above `after` (null = bottom). */
  | { type: "element.put"; pageId: string; element: BoardElement; after: string | null }
  | { type: "element.delete"; pageId: string; id: string }
  /** Full back-to-front order of the page's elements. */
  | { type: "element.order"; pageId: string; order: string[] };

export type PanelTab = "properties" | "people" | "activity";

export interface ActivityEntry {
  id: string;
  message: string;
  at: number;
}

export interface ToastMessage {
  id: number;
  message: string;
  /** "undo" triggers the store's undo; custom actions run their own callback. */
  action?: "undo" | { label: string; run: () => void };
}
