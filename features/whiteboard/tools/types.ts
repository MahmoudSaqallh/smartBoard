import type { BoardStore } from "../store/board-store";
import type { BoardElement, Bounds, Point, Viewport } from "../types";

/** One pointer sample, already converted to both coordinate spaces. */
export interface PointerInput {
  screen: Point;
  world: Point;
  /** Intermediate samples since the last event (coalesced pointer events), in world space. */
  samples: Point[];
  shiftKey: boolean;
  /** True when this press only finished an open text edit. */
  endedEdit: boolean;
}

export type HitResult = { kind: "element"; id: string } | { kind: "transformer" } | null;

/** What a tool may do. Tools never touch React state or Konva directly. */
export interface ToolContext {
  /** Fresh store state; never stale inside long gestures. */
  store: () => BoardStore;
  viewport: () => Viewport;
  hitTest: (screen: Point) => HitResult;
  /** Routes the rest of this pointer's events to the canvas, even outside it. */
  capture: () => void;
  // Transient render output, cleared automatically when the gesture ends.
  setDraft: (element: BoardElement | null) => void;
  setMarquee: (bounds: Bounds | null) => void;
  setErasingIds: (ids: ReadonlySet<string>) => void;
  setPanning: (panning: boolean) => void;
}

/** An in-progress press-drag-release interaction. */
export interface ToolGesture {
  move?: (input: PointerInput) => void;
  /** Commit the result. */
  end?: (input: PointerInput) => void;
  /** Discard without committing (pointer cancelled, pinch started). */
  cancel?: () => void;
}

export interface ToolHandler {
  /** Returns a gesture to follow the pointer, or null for single-press tools. */
  start: (input: PointerInput, ctx: ToolContext) => ToolGesture | null;
}

/** Draft elements are rendered but never stored; they get a real id on commit. */
export const DRAFT_ID = "__draft__";
