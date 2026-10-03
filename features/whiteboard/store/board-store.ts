import { create } from "zustand";
import { can, type PermissionContext } from "@/features/permissions/policy";
import { getPermissionContext } from "@/features/permissions/store";
import {
  ACTIVITY_LIMIT,
  BOARD_TITLE_MAX_LENGTH,
  DEFAULT_STYLE,
  ELEMENT_LABELS,
  MAX_ASSETS,
  MAX_PAGES,
  PAGE_NAME_MAX_LENGTH,
  TEXT_MAX_LENGTH,
} from "../constants";
import { createDocument } from "../model/document";
import { applyOperations, touchedElementIds } from "../model/operations";
import { DEFAULT_BACKGROUND } from "../background/presets";
import type {
  ActivityEntry,
  BoardAsset,
  BoardDocument,
  BoardElement,
  BoardOperation,
  BoardPage,
  DrawingStyle,
  PageBackground,
  PageHistory,
  PanelTab,
  Size,
  ToastMessage,
  ToolId,
  Viewport,
} from "../types";
import {
  applyStylePatch,
  bakeTransform,
  bringForward,
  bringToFront,
  describeElements,
  elementLabel,
  sendBackward,
  duplicateElements,
  moveElements,
  removeElements,
  sendToBack,
  withMeasuredText,
  type TransformSnapshot,
} from "../utils/elements";
import { getContentBounds } from "../utils/geometry";
import { createEntry, createHistory, recordHistory, redoHistory, undoHistory } from "../utils/history";
import { createId } from "../utils/id";
import { createPage, neighbourPageId, sanitizeName } from "../utils/pages";
import {
  DEFAULT_VIEWPORT,
  clampZoom,
  fitBounds,
  formatZoom,
  nextZoomStep,
  previousZoomStep,
  zoomAtPoint,
} from "../utils/viewport";

/**
 * State is split by ownership:
 * - `doc` is the shared, persistable board (synced and saved in later phases).
 * - Everything else is local to this user and never leaves the browser.
 */
export interface BoardState {
  doc: BoardDocument;

  // Local session
  activePageId: string;
  /** Per page, per user. Holds operations, so undo never reverts other people's edits. */
  histories: Record<string, PageHistory>;
  /** Per page, so each page keeps its own zoom and position. */
  viewports: Record<string, Viewport>;
  stageSize: Size;
  activeTool: ToolId;
  isSpacePanning: boolean;
  style: DrawingStyle;
  selectedIds: string[];
  editingId: string | null;
  /** Page elements before the current text edit began; becomes the undo step on finish. */
  editSnapshot: BoardElement[] | null;

  // Local UI
  /** null = automatic (open on desktop, closed on smaller screens). */
  panelOpen: boolean | null;
  panelTab: PanelTab;
  activity: ActivityEntry[];
  announcement: { id: number; text: string };
  toast: ToastMessage | null;
}

export interface BoardActions {
  setBoardTitle: (title: string) => void;

  setTool: (tool: ToolId) => void;
  setSpacePanning: (active: boolean) => void;
  setStyle: (patch: Partial<DrawingStyle>) => void;

  addElement: (element: BoardElement) => void;
  /** Adds binary content (image pixels). Not undoable: assets are append-only and referenced by id. */
  addAsset: (asset: BoardAsset) => boolean;
  /** Adds an inserted object (image, QR, widget), selects it and switches to Select. */
  insertObject: (element: BoardElement) => void;
  /** Updates one element via a recipe; returning the same object is a no-op. */
  updateElement: (id: string, recipe: (element: BoardElement) => BoardElement, coalesceKey?: string) => void;
  bringSelectedForward: () => void;
  sendSelectedBackward: () => void;
  /** Replaces the active page's background as one undo step. */
  setPageBackground: (background: PageBackground, coalesceKey?: string) => void;
  transformElements: (snapshots: Record<string, TransformSnapshot>, coalesceKey?: string) => void;
  nudgeSelected: (dx: number, dy: number) => void;
  eraseElements: (ids: string[]) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  bringSelectedToFront: () => void;
  sendSelectedToBack: () => void;
  setSelectionLocked: (locked: boolean) => void;
  /** Locks the selection, or unlocks it when everything selected is already locked. */
  toggleSelectionLock: () => void;
  clearPage: () => void;
  undo: () => void;
  redo: () => void;

  select: (ids: string[]) => void;
  toggleSelected: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;

  createAndEdit: (element: BoardElement) => void;
  startEditing: (id: string) => void;
  updateEditingText: (text: string) => void;
  finishEditing: () => void;

  addPage: () => void;
  switchPage: (id: string) => void;
  renamePage: (id: string, name: string) => void;
  duplicatePage: (id: string) => void;
  deletePage: (id: string) => void;

  /**
   * Applies operations that originated elsewhere (another participant, a
   * restored version). They bypass the local permission gate (the server is
   * authoritative) and never enter this user's undo history.
   */
  applyRemoteOperations: (ops: BoardOperation[], meta?: { actorId?: string }) => void;

  setStageSize: (size: Size) => void;
  setViewport: (viewport: Viewport) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  zoomToFit: () => void;

  setPanelOpen: (open: boolean) => void;
  setPanelTab: (tab: PanelTab) => void;
  announce: (text: string) => void;
  notify: (message: string, action?: ToastMessage["action"]) => void;
  dismissToast: () => void;
  logActivity: (message: string) => void;
}

export type BoardStore = BoardState & BoardActions;

const FIRST_PAGE_ID = "page-1";

/** Deterministic initial state: identical on server and client, so no hydration mismatch. */
export function createInitialState(): BoardState {
  return {
    doc: createDocument({
      id: "local-board",
      title: "Untitled lesson",
      pages: [{ id: FIRST_PAGE_ID, name: "Page 1", background: DEFAULT_BACKGROUND, elements: [] }],
    }),
    activePageId: FIRST_PAGE_ID,
    histories: { [FIRST_PAGE_ID]: createHistory() },
    viewports: { [FIRST_PAGE_ID]: DEFAULT_VIEWPORT },
    stageSize: { width: 0, height: 0 },
    activeTool: "pen",
    isSpacePanning: false,
    style: DEFAULT_STYLE,
    selectedIds: [],
    editingId: null,
    editSnapshot: null,
    panelOpen: null,
    panelTab: "properties",
    activity: [],
    announcement: { id: 0, text: "" },
    toast: null,
  };
}

// ---------------------------------------------------------------------------
// Pure state helpers
// ---------------------------------------------------------------------------

export function getActivePage(state: BoardState): BoardPage {
  return state.doc.pages.find((page) => page.id === state.activePageId) ?? state.doc.pages[0];
}

export function getActiveViewport(state: BoardState): Viewport {
  return state.viewports[state.activePageId] ?? DEFAULT_VIEWPORT;
}

export function getActiveHistory(state: BoardState): PageHistory {
  return state.histories[state.activePageId] ?? createHistory();
}

function withPages(state: BoardState, pages: BoardPage[]): BoardDocument {
  return { ...state.doc, pages };
}

function withActiveElements(state: BoardState, elements: BoardElement[]): BoardDocument {
  return withPages(
    state,
    state.doc.pages.map((page) => (page.id === state.activePageId ? { ...page, elements } : page)),
  );
}

function withActivity(activity: ActivityEntry[], message: string, now = Date.now()): ActivityEntry[] {
  // Repeated identical actions (e.g. many pen strokes) refresh one entry instead of flooding the feed.
  if (activity[0]?.message === message) {
    return [{ ...activity[0], at: now }, ...activity.slice(1)];
  }
  return [{ id: createId(), message, at: now }, ...activity].slice(0, ACTIVITY_LIMIT);
}

let announcementId = 0;
let toastId = 0;

const announcement = (text: string) => ({ id: ++announcementId, text });
const toast = (message: string, action?: ToastMessage["action"]): ToastMessage => ({ id: ++toastId, message, action });
type DenyReason = "forbidden" | "locked";

const DENY_MESSAGES: Record<DenyReason, string> = {
  forbidden: "You don't have permission to change this board",
  locked: "This object is locked. Unlock it to make changes.",
};

const denied = (reason: DenyReason = "forbidden"): Partial<BoardState> => ({ toast: toast(DENY_MESSAGES[reason]) });

/** True when `after` differs from `before` only in its lock flag. */
function isLockToggle(before: BoardElement, after: BoardElement): boolean {
  if (Boolean(before.locked) === Boolean(after.locked)) return false;
  const a: Record<string, unknown> = { ...before, locked: undefined };
  const b: Record<string, unknown> = { ...after, locked: undefined };
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) if (a[key] !== b[key]) return false;
  return true;
}

/**
 * Permission gate for content changes. The actor must be allowed to edit the
 * board and every element the operations touch, checked against the element
 * as it was before the change. A change that only flips the lock flag needs
 * the lock permission instead, so unlocking is possible while editing is not.
 */
function checkApply(
  context: PermissionContext,
  before: readonly BoardElement[],
  ops: readonly BoardOperation[],
): DenyReason | null {
  if (!can(context, { type: "board.edit" })) return "forbidden";
  const beforeById = new Map(before.map((el) => [el.id, el]));
  const afterById = new Map(
    ops.flatMap((op) => (op.type === "element.put" ? [[op.element.id, op.element] as const] : [])),
  );
  for (const id of touchedElementIds(ops)) {
    const element = beforeById.get(id);
    if (!element) continue; // new element: covered by board.edit
    const after = afterById.get(id);
    if (after && isLockToggle(element, after)) {
      if (!can(context, { type: "element.lock", element })) return "forbidden";
      continue;
    }
    if (!can(context, { type: "element.edit", element })) return element.locked ? "locked" : "forbidden";
  }
  return null;
}

/**
 * The single path for local content changes on the active page: permission
 * check, document update and an undo step. No-op changes are ignored.
 */
function commit(
  state: BoardState,
  elements: BoardElement[],
  options: { coalesceKey?: string } = {},
): Partial<BoardState> {
  const page = getActivePage(state);
  if (elements === page.elements) return {};
  const entry = createEntry(page.id, page.elements, elements);
  if (!entry) return {};
  const deny = checkApply(getPermissionContext(), page.elements, entry.ops);
  if (deny) return denied(deny);

  const validIds = new Set(elements.map((el) => el.id));
  return {
    doc: withActiveElements(state, elements),
    histories: {
      ...state.histories,
      [page.id]: recordHistory(getActiveHistory(state), entry, options),
    },
    selectedIds: state.selectedIds.filter((id) => validIds.has(id)),
  };
}

/**
 * Ends any in-progress text edit. Text is written into the element live,
 * so this only decides whether the edit becomes an undo step, and removes
 * text elements left empty. Every action that changes context calls this
 * first, so switching page or tool can never drop typed text.
 */
function finalizeEdit<T extends BoardState>(state: T): T {
  if (!state.editingId) return state;
  const page = getActivePage(state);
  const element = page.elements.find((el) => el.id === state.editingId);
  const snapshot = state.editSnapshot ?? page.elements;
  const base = { ...state, editingId: null, editSnapshot: null };
  if (!element) return base;

  const isNew = !snapshot.some((el) => el.id === element.id);
  const elements =
    element.type === "text" && element.text.trim() === ""
      ? removeElements(page.elements, [element.id])
      : page.elements;

  const entry = createEntry(page.id, snapshot, elements);
  if (!entry) return { ...base, doc: withActiveElements(state, elements) };

  const kept = elements.some((el) => el.id === element.id);
  return {
    ...base,
    doc: withActiveElements(state, elements),
    histories: {
      ...state.histories,
      [page.id]: recordHistory(getActiveHistory(state), entry),
    },
    selectedIds: kept && state.activeTool === "select" ? [element.id] : [],
    activity:
      isNew && kept
        ? withActivity(state.activity, `Added ${ELEMENT_LABELS[element.type].toLowerCase()} · ${page.name}`)
        : state.activity,
  };
}

function isEditable(element: BoardElement | undefined): boolean {
  return element?.type === "text" || element?.type === "sticky";
}

/** Selected ids that may be changed in bulk; locked elements are skipped, not fatal. */
function unlockedIds(elements: readonly BoardElement[], ids: readonly string[]): string[] {
  const wanted = new Set(ids);
  return elements.filter((el) => wanted.has(el.id) && !el.locked).map((el) => el.id);
}

const objects = (n: number) => (n === 1 ? "1 object" : `${n} objects`);

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/** > 0 while remote operations are being applied; lets subscribers tell origins apart. */
let remoteDepth = 0;
let remoteActorId: string | null = null;

export function isApplyingRemoteOperations(): boolean {
  return remoteDepth > 0;
}

/** Who caused the change currently being applied (the local user unless remote). */
export function currentActorId(): string {
  return remoteDepth > 0 ? remoteActorId ?? "unknown" : getPermissionContext().userId;
}

export const useBoardStore = create<BoardStore>()((set, get) => {
  /** Applies a viewport change to the active page with zoom clamping. */
  const applyViewport = (state: BoardState, viewport: Viewport): Partial<BoardState> => {
    const safe: Viewport = {
      x: Number.isFinite(viewport.x) ? viewport.x : 0,
      y: Number.isFinite(viewport.y) ? viewport.y : 0,
      scale: clampZoom(viewport.scale),
    };
    const current = getActiveViewport(state);
    if (current.x === safe.x && current.y === safe.y && current.scale === safe.scale) return {};
    return { viewports: { ...state.viewports, [state.activePageId]: safe } };
  };

  const stageCenter = (state: BoardState) => ({
    x: state.stageSize.width / 2,
    y: state.stageSize.height / 2,
  });

  const zoomTo = (scale: number) =>
    set((state) => {
      const current = getActiveViewport(state);
      const next = zoomAtPoint(current, stageCenter(state), scale);
      if (next === current) return {};
      return { ...applyViewport(state, next), announcement: announcement(`Zoom ${formatZoom(next.scale)}`) };
    });

  /** Runs an element transformation on the current selection. */
  const updateSelection = (
    transform: (elements: BoardElement[], ids: string[]) => BoardElement[],
    coalesceKey?: string,
  ) =>
    set((state) => {
      if (state.selectedIds.length === 0) return {};
      const page = getActivePage(state);
      return commit(state, transform(page.elements, state.selectedIds), { coalesceKey });
    });

  /** Undo/redo: applies one side of a history entry, subject to the permission gate. */
  const travel = (direction: "undo" | "redo") =>
    set((state) => {
      const s = finalizeEdit(state);
      const page = getActivePage(s);
      const step = direction === "undo" ? undoHistory(getActiveHistory(s)) : redoHistory(getActiveHistory(s));
      if (!step) return s;
      const ops = direction === "undo" ? step.entry.inverse : step.entry.ops;
      const deny = checkApply(getPermissionContext(), page.elements, ops);
      if (deny) return { ...s, ...denied(deny) };
      const doc = applyOperations(s.doc, ops);
      const ids = new Set(doc.pages.find((p) => p.id === page.id)?.elements.map((el) => el.id) ?? []);
      return {
        ...s,
        doc,
        histories: { ...s.histories, [page.id]: step.history },
        selectedIds: s.selectedIds.filter((id) => ids.has(id)),
        announcement: announcement(direction === "undo" ? "Undo" : "Redo"),
      };
    });

  const pagesAllowed = () => can(getPermissionContext(), { type: "page.manage" });

  return {
    ...createInitialState(),

    setBoardTitle: (title) => {
      const name = sanitizeName(title, BOARD_TITLE_MAX_LENGTH);
      const { doc } = get();
      if (!name || name === doc.title) return;
      if (!can(getPermissionContext(), { type: "board.manage" })) return set(denied());
      set({ doc: { ...doc, title: name } });
    },

    // --- Tools -----------------------------------------------------------
    setTool: (tool) =>
      set((state) => {
        if (!can(getPermissionContext(), { type: "tool.use", tool })) return {};
        const s = finalizeEdit(state);
        return {
          ...s,
          activeTool: tool,
          selectedIds: tool === "select" ? s.selectedIds : [],
        };
      }),

    setSpacePanning: (active) => {
      if (get().isSpacePanning !== active) set({ isSpacePanning: active });
    },

    setStyle: (patch) =>
      set((state) => {
        const style = { ...state.style, ...patch };
        if (state.selectedIds.length === 0) return { style };
        const page = getActivePage(state);
        const ids = new Set(unlockedIds(page.elements, state.selectedIds));
        let changed = false;
        const elements = page.elements.map((el) => {
          if (!ids.has(el.id)) return el;
          const next = applyStylePatch(el, patch);
          if (next !== el) changed = true;
          return next;
        });
        if (!changed) return { style };
        // Slider drags emit many changes; the key merges them into a single undo step.
        const coalesceKey = `style:${Object.keys(patch).join(",")}:${state.selectedIds.join(",")}`;
        return { style, ...commit(state, elements, { coalesceKey }) };
      }),

    // --- Elements --------------------------------------------------------
    addElement: (element) =>
      set((state) => {
        const s = finalizeEdit(state);
        const page = getActivePage(s);
        const result = commit(s, [...page.elements, withMeasuredText(element)]);
        if (!result.doc) return { ...s, ...result };
        return {
          ...s,
          ...result,
          activity: withActivity(s.activity, `Added ${ELEMENT_LABELS[element.type].toLowerCase()} · ${page.name}`),
        };
      }),

    addAsset: (asset) => {
      const state = get();
      if (state.doc.assets[asset.id]) return true;
      if (!can(getPermissionContext(), { type: "board.edit" })) {
        set(denied());
        return false;
      }
      if (Object.keys(state.doc.assets).length >= MAX_ASSETS) {
        set({ toast: toast(`A board can hold up to ${MAX_ASSETS} images`) });
        return false;
      }
      set({ doc: { ...state.doc, assets: { ...state.doc.assets, [asset.id]: asset } } });
      return true;
    },

    insertObject: (element) =>
      set((state) => {
        const s = finalizeEdit(state);
        const page = getActivePage(s);
        const result = commit(s, [...page.elements, element]);
        if (!result.doc) return { ...s, ...result };
        const label = elementLabel(element);
        return {
          ...s,
          ...result,
          activeTool: "select",
          selectedIds: [element.id],
          announcement: announcement(`${label} added`),
          activity: withActivity(s.activity, `Added ${label.toLowerCase()} · ${page.name}`),
        };
      }),

    updateElement: (id, recipe, coalesceKey) =>
      set((state) => {
        const page = getActivePage(state);
        let changed = false;
        const elements = page.elements.map((el) => {
          if (el.id !== id) return el;
          const next = recipe(el);
          if (next !== el) changed = true;
          return next;
        });
        return changed ? commit(state, elements, { coalesceKey }) : {};
      }),

    bringSelectedForward: () => updateSelection(bringForward),
    sendSelectedBackward: () => updateSelection(sendBackward),

    setPageBackground: (background, coalesceKey) =>
      set((state) => {
        const page = getActivePage(state);
        if (page.background === background) return {};
        if (!can(getPermissionContext(), { type: "page.manage" })) return denied();
        const entry = {
          ops: [{ type: "page.background" as const, pageId: page.id, background }],
          inverse: [{ type: "page.background" as const, pageId: page.id, background: page.background }],
        };
        return {
          doc: withPages(state, state.doc.pages.map((p) => (p.id === page.id ? { ...p, background } : p))),
          histories: {
            ...state.histories,
            [page.id]: recordHistory(getActiveHistory(state), entry, { coalesceKey }),
          },
          activity: withActivity(state.activity, `Changed background · ${page.name}`),
        };
      }),

    transformElements: (snapshots, coalesceKey) =>
      set((state) => {
        const page = getActivePage(state);
        let changed = false;
        const elements = page.elements.map((el) => {
          const snapshot = snapshots[el.id];
          if (!snapshot) return el;
          changed = true;
          return bakeTransform(el, snapshot);
        });
        return changed ? commit(state, elements, { coalesceKey }) : {};
      }),

    nudgeSelected: (dx, dy) =>
      updateSelection((elements, ids) => moveElements(elements, unlockedIds(elements, ids), dx, dy), "nudge"),

    eraseElements: (ids) =>
      set((state) => {
        if (ids.length === 0) return {};
        const page = getActivePage(state);
        const next = removeElements(page.elements, unlockedIds(page.elements, ids));
        if (next === page.elements) return {};
        const result = commit(state, next);
        if (!result.doc) return result;
        const removed = page.elements.length - next.length;
        return {
          ...result,
          activity: withActivity(state.activity, `Erased ${objects(removed)} · ${page.name}`),
        };
      }),

    deleteSelected: () =>
      set((state) => {
        if (state.selectedIds.length === 0) return {};
        const page = getActivePage(state);
        const deletable = unlockedIds(page.elements, state.selectedIds);
        const keptLocked = state.selectedIds.filter((id) => !deletable.includes(id) && page.elements.some((el) => el.id === id));
        if (deletable.length === 0) return keptLocked.length ? denied("locked") : { selectedIds: [] };

        const removed = page.elements.filter((el) => deletable.includes(el.id));
        const result = commit(state, removeElements(page.elements, deletable));
        if (!result.doc) return result;
        const label = describeElements(removed);
        return {
          ...result,
          // Locked objects stay selected so it is clear what was kept.
          selectedIds: keptLocked,
          announcement: announcement(`${label} deleted`),
          activity: withActivity(state.activity, `Deleted ${label.toLowerCase()} · ${page.name}`),
          ...(keptLocked.length ? { toast: toast(`${label} deleted · ${objects(keptLocked.length)} locked, kept`) } : {}),
        };
      }),

    duplicateSelected: () =>
      set((state) => {
        if (state.selectedIds.length === 0) return {};
        const page = getActivePage(state);
        const { elements, newIds } = duplicateElements(page.elements, state.selectedIds);
        if (newIds.length === 0) return {};
        const result = commit(state, elements);
        if (!result.doc) return result;
        return { ...result, selectedIds: newIds, announcement: announcement("Duplicated") };
      }),

    // Paint order is not protected by locks: a locked background can still be sent to the back.
    bringSelectedToFront: () => updateSelection(bringToFront),
    sendSelectedToBack: () => updateSelection(sendToBack),

    setSelectionLocked: (locked) =>
      set((state) => {
        if (state.selectedIds.length === 0) return {};
        const page = getActivePage(state);
        const ids = new Set(state.selectedIds);
        let count = 0;
        const elements = page.elements.map((el) => {
          if (!ids.has(el.id) || Boolean(el.locked) === locked) return el;
          count += 1;
          return { ...el, locked: locked ? true : undefined };
        });
        if (count === 0) return {};
        const result = commit(state, elements);
        if (!result.doc) return result;
        const verb = locked ? "Locked" : "Unlocked";
        return {
          ...result,
          announcement: announcement(`${verb} ${objects(count)}`),
          activity: withActivity(state.activity, `${verb} ${objects(count)} · ${page.name}`),
        };
      }),

    toggleSelectionLock: () => {
      const state = get();
      const ids = new Set(state.selectedIds);
      const selected = getActivePage(state).elements.filter((el) => ids.has(el.id));
      if (selected.length === 0) return;
      get().setSelectionLocked(!selected.every((el) => el.locked));
    },

    clearPage: () =>
      set((state) => {
        const s = finalizeEdit(state);
        const page = getActivePage(s);
        if (page.elements.length === 0) return s;
        // Locked objects (backgrounds, worksheets) survive a clear.
        const kept = page.elements.filter((el) => el.locked);
        if (kept.length === page.elements.length) return { ...s, ...denied("locked") };
        const result = commit(s, kept);
        if (!result.doc) return { ...s, ...result };
        return {
          ...s,
          ...result,
          selectedIds: [],
          activity: withActivity(s.activity, `Cleared ${page.name}`),
          toast: toast(kept.length ? `${page.name} cleared · ${objects(kept.length)} locked, kept` : `${page.name} cleared`, "undo"),
        };
      }),

    undo: () => travel("undo"),
    redo: () => travel("redo"),

    // --- Selection -------------------------------------------------------
    select: (ids) =>
      set((state) => {
        const s = finalizeEdit(state);
        const unique = Array.from(new Set(ids));
        if (sameIds(unique, s.selectedIds) && s === state) return {};
        return { ...s, selectedIds: unique };
      }),

    toggleSelected: (id) =>
      set((state) => ({
        selectedIds: state.selectedIds.includes(id)
          ? state.selectedIds.filter((x) => x !== id)
          : [...state.selectedIds, id],
      })),

    selectAll: () =>
      set((state) => {
        const s = finalizeEdit(state);
        const page = getActivePage(s);
        // Like box selection, select-all skips locked objects so bulk moves never stall on them.
        return { ...s, activeTool: "select", selectedIds: page.elements.filter((el) => !el.locked).map((el) => el.id) };
      }),

    clearSelection: () => {
      if (get().selectedIds.length > 0) set({ selectedIds: [] });
    },

    // --- Text editing ----------------------------------------------------
    createAndEdit: (element) =>
      set((state) => {
        const s = finalizeEdit(state);
        if (!can(getPermissionContext(), { type: "board.edit" })) return { ...s, ...denied() };
        const page = getActivePage(s);
        return {
          ...s,
          doc: withActiveElements(s, [...page.elements, withMeasuredText(element)]),
          editingId: element.id,
          editSnapshot: page.elements,
          selectedIds: [],
        };
      }),

    startEditing: (id) =>
      set((state) => {
        const s = finalizeEdit(state);
        const page = getActivePage(s);
        const element = page.elements.find((el) => el.id === id);
        if (!element || !isEditable(element)) return s;
        const context = getPermissionContext();
        if (!can(context, { type: "board.edit" })) return { ...s, ...denied() };
        if (!can(context, { type: "element.edit", element })) return { ...s, ...denied(element.locked ? "locked" : "forbidden") };
        return { ...s, editingId: id, editSnapshot: page.elements, selectedIds: [] };
      }),

    updateEditingText: (text) =>
      set((state) => {
        if (!state.editingId) return {};
        const page = getActivePage(state);
        const safeText = text.slice(0, TEXT_MAX_LENGTH);
        let changed = false;
        const elements = page.elements.map((el) => {
          if (el.id !== state.editingId || !isEditable(el) || !("text" in el) || el.text === safeText) return el;
          changed = true;
          return withMeasuredText({ ...el, text: safeText });
        });
        // Live text is part of the document (collaborators will see typing);
        // the undo step is recorded once, when editing finishes.
        return changed ? { doc: withActiveElements(state, elements) } : {};
      }),

    finishEditing: () => set((state) => finalizeEdit(state)),

    // --- Pages -----------------------------------------------------------
    addPage: () =>
      set((state) => {
        const s = finalizeEdit(state);
        if (!pagesAllowed()) return { ...s, ...denied() };
        if (s.doc.pages.length >= MAX_PAGES) {
          return { ...s, toast: toast(`A board can have up to ${MAX_PAGES} pages`) };
        }
        // A new page continues the current page's paper (grid, notebook, …).
        const page = createPage(s.doc.pages, getActivePage(s).background);
        const index = s.doc.pages.findIndex((p) => p.id === s.activePageId);
        const pages = [...s.doc.pages.slice(0, index + 1), page, ...s.doc.pages.slice(index + 1)];
        return {
          ...s,
          doc: withPages(s, pages),
          activePageId: page.id,
          histories: { ...s.histories, [page.id]: createHistory() },
          viewports: { ...s.viewports, [page.id]: DEFAULT_VIEWPORT },
          selectedIds: [],
          announcement: announcement(`${page.name} added. Page ${index + 2} of ${pages.length}`),
          activity: withActivity(s.activity, `Added ${page.name}`),
        };
      }),

    switchPage: (id) =>
      set((state) => {
        if (id === state.activePageId) return {};
        const index = state.doc.pages.findIndex((page) => page.id === id);
        if (index === -1) return {};
        const s = finalizeEdit(state);
        return {
          ...s,
          activePageId: id,
          selectedIds: [],
          announcement: announcement(`${s.doc.pages[index].name}, page ${index + 1} of ${s.doc.pages.length}`),
        };
      }),

    renamePage: (id, name) =>
      set((state) => {
        const clean = sanitizeName(name, PAGE_NAME_MAX_LENGTH);
        const page = state.doc.pages.find((p) => p.id === id);
        if (!clean || !page || page.name === clean) return {};
        if (!pagesAllowed()) return denied();
        return {
          doc: withPages(state, state.doc.pages.map((p) => (p.id === id ? { ...p, name: clean } : p))),
          activity: withActivity(state.activity, `Renamed ${page.name} to ${clean}`),
        };
      }),

    duplicatePage: (id) =>
      set((state) => {
        const s = finalizeEdit(state);
        const index = s.doc.pages.findIndex((p) => p.id === id);
        if (index === -1) return s;
        if (!pagesAllowed()) return { ...s, ...denied() };
        if (s.doc.pages.length >= MAX_PAGES) {
          return { ...s, toast: toast(`A board can have up to ${MAX_PAGES} pages`) };
        }
        const source = s.doc.pages[index];
        const copy: BoardPage = {
          id: createId(),
          name: `${source.name} copy`.slice(0, PAGE_NAME_MAX_LENGTH),
          background: source.background,
          elements: source.elements.map((el) => ({ ...el, id: createId() })),
        };
        const pages = [...s.doc.pages.slice(0, index + 1), copy, ...s.doc.pages.slice(index + 1)];
        return {
          ...s,
          doc: withPages(s, pages),
          activePageId: copy.id,
          histories: { ...s.histories, [copy.id]: createHistory() },
          viewports: { ...s.viewports, [copy.id]: s.viewports[source.id] ?? DEFAULT_VIEWPORT },
          selectedIds: [],
          announcement: announcement(`${copy.name} created`),
          activity: withActivity(s.activity, `Duplicated ${source.name}`),
        };
      }),

    deletePage: (id) =>
      set((state) => {
        const page = state.doc.pages.find((p) => p.id === id);
        if (!page) return {};
        if (!pagesAllowed()) return denied();
        if (state.doc.pages.length <= 1) {
          return { toast: toast("A board needs at least one page") };
        }
        const s = id === state.activePageId ? finalizeEdit(state) : state;
        const nextActive = id === s.activePageId ? neighbourPageId(s.doc.pages, id) ?? s.activePageId : s.activePageId;
        const histories = { ...s.histories };
        const viewports = { ...s.viewports };
        delete histories[id];
        delete viewports[id];
        return {
          ...s,
          doc: withPages(s, s.doc.pages.filter((p) => p.id !== id)),
          activePageId: nextActive,
          histories,
          viewports,
          selectedIds: id === s.activePageId ? [] : s.selectedIds,
          announcement: announcement(`${page.name} deleted`),
          activity: withActivity(s.activity, `Deleted ${page.name}`),
        };
      }),

    // --- Remote changes --------------------------------------------------
    applyRemoteOperations: (ops, meta) => {
      remoteDepth += 1;
      remoteActorId = meta?.actorId ?? null;
      try {
        set((state) => {
          const doc = applyOperations(state.doc, ops);
          if (doc === state.doc) return {};
          // Keep local session state consistent with what the document now contains.
          const activePageId = doc.pages.some((p) => p.id === state.activePageId) ? state.activePageId : doc.pages[0].id;
          const elementIds = new Set(doc.pages.find((p) => p.id === activePageId)?.elements.map((el) => el.id));
          const editingGone = state.editingId !== null && !elementIds.has(state.editingId);
          return {
            doc,
            activePageId,
            histories: state.histories[activePageId] ? state.histories : { ...state.histories, [activePageId]: createHistory() },
            selectedIds: state.selectedIds.filter((id) => elementIds.has(id)),
            ...(editingGone ? { editingId: null, editSnapshot: null } : {}),
          };
        });
      } finally {
        remoteDepth -= 1;
        remoteActorId = null;
      }
    },

    // --- Viewport --------------------------------------------------------
    setStageSize: (size) => {
      const { stageSize } = get();
      const width = Math.max(0, Math.round(size.width));
      const height = Math.max(0, Math.round(size.height));
      if (stageSize.width !== width || stageSize.height !== height) set({ stageSize: { width, height } });
    },

    setViewport: (viewport) => set((state) => applyViewport(state, viewport)),
    zoomIn: () => zoomTo(nextZoomStep(getActiveViewport(get()).scale)),
    zoomOut: () => zoomTo(previousZoomStep(getActiveViewport(get()).scale)),
    resetZoom: () => zoomTo(1),

    zoomToFit: () =>
      set((state) => {
        const bounds = getContentBounds(getActivePage(state).elements);
        const next = bounds ? fitBounds(bounds, state.stageSize) : DEFAULT_VIEWPORT;
        return { ...applyViewport(state, next), announcement: announcement(`Zoom ${formatZoom(next.scale)}`) };
      }),

    // --- UI --------------------------------------------------------------
    setPanelOpen: (open) => set({ panelOpen: open }),
    setPanelTab: (tab) => set({ panelTab: tab }),
    announce: (text) => set({ announcement: announcement(text) }),
    notify: (message, action) => set({ toast: toast(message, action) }),
    dismissToast: () => set({ toast: null }),
    logActivity: (message) => set((state) => ({ activity: withActivity(state.activity, message) })),
  };
});

/** Restores a pristine board. Intended for tests. */
export function resetBoardStore(): void {
  useBoardStore.setState(createInitialState());
}
