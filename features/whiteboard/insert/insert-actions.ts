/**
 * Insert commands shared by the toolbar, drag & drop, paste and the
 * properties panel. They turn files and settings into assets and elements
 * through normal store actions, so permissions, undo and sync apply.
 */
import { MAX_BACKGROUND_DIMENSION, MAX_IMAGE_DIMENSION } from "../constants";
import { getActivePage, getActiveViewport, useBoardStore } from "../store/board-store";
import type { BoardElement, Point } from "../types";
import {
  createClockElement,
  createImageElement,
  createQrElement,
  createTimerElement,
  replaceImageAsset,
} from "../utils/elements";
import { screenToWorld } from "../utils/viewport";
import { ImageImportError, prepareImageAsset } from "./image-files";
import { animateInsertion } from "./insert-animation";
import { cascadeOffset } from "./placement";

const MAX_FILES_PER_DROP = 10;
/** Successive images from one drop are offset so they don't stack exactly. */
const CASCADE = 28;

function viewportCenter(): Point {
  const state = useBoardStore.getState();
  return screenToWorld({ x: state.stageSize.width / 2, y: state.stageSize.height / 2 }, getActiveViewport(state));
}

/** Inserted images start at most ~60% of the visible area (in world units), and never over 640. */
function initialMaxSide(): number {
  const state = useBoardStore.getState();
  const { scale } = getActiveViewport(state);
  const visible = Math.min(state.stageSize.width, state.stageSize.height) / scale;
  return Math.max(120, Math.min(640, visible * 0.6));
}

/** Inserts through the store (cascading off occupied spots); animates only if accepted. */
function place(candidate: BoardElement): boolean {
  const offset = cascadeOffset(candidate, getActivePage(useBoardStore.getState()).elements);
  const element = { ...candidate, x: candidate.x + offset.x, y: candidate.y + offset.y };
  useBoardStore.getState().insertObject(element);
  const accepted = useBoardStore.getState().selectedIds.includes(element.id);
  if (accepted) animateInsertion(element.id);
  return accepted;
}

function errorMessage(error: unknown): string {
  return error instanceof ImageImportError ? error.message : "Couldn't add that image. Please try another file.";
}

// Serialise imports so rapid repeated inserts can't interleave half-finished work.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

/** Inserts image files at a world point (default: viewport centre). Returns how many were added. */
export function insertImageFiles(files: readonly File[], at?: Point): Promise<number> {
  return enqueue(async () => {
    const store = useBoardStore.getState();
    const list = files.slice(0, MAX_FILES_PER_DROP);
    if (files.length > MAX_FILES_PER_DROP) store.notify(`Only the first ${MAX_FILES_PER_DROP} images were added`);
    const origin = at ?? viewportCenter();
    let added = 0;
    for (const file of list) {
      try {
        const asset = await prepareImageAsset(file, MAX_IMAGE_DIMENSION);
        if (!useBoardStore.getState().addAsset(asset)) break;
        const center = { x: origin.x + added * CASCADE, y: origin.y + added * CASCADE };
        if (!place(createImageElement(asset, center, initialMaxSide()))) break;
        added += 1;
      } catch (error) {
        useBoardStore.getState().notify(errorMessage(error));
      }
    }
    return added;
  });
}

/** Replaces the pixels of an existing image element, keeping its width and position. */
export function replaceImage(elementId: string, file: File): Promise<void> {
  return enqueue(async () => {
    try {
      const asset = await prepareImageAsset(file, MAX_IMAGE_DIMENSION);
      const store = useBoardStore.getState();
      if (!store.addAsset(asset)) return;
      store.updateElement(elementId, (el) => (el.type === "image" ? replaceImageAsset(el, asset) : el));
    } catch (error) {
      useBoardStore.getState().notify(errorMessage(error));
    }
  });
}

/** Sets an uploaded image as the active page's background (higher resolution limit). */
export function setBackgroundImage(file: File): Promise<void> {
  return enqueue(async () => {
    try {
      const asset = await prepareImageAsset(file, MAX_BACKGROUND_DIMENSION);
      const store = useBoardStore.getState();
      if (!store.addAsset(asset)) return;
      const current = getActivePage(useBoardStore.getState()).background;
      store.setPageBackground({
        ...current,
        image: { assetId: asset.id, fit: current.image?.fit ?? "contain", opacity: 1, blur: 0, brightness: 1 },
      });
    } catch (error) {
      useBoardStore.getState().notify(errorMessage(error));
    }
  });
}

export function insertQr(content: string, label: string, at?: Point): boolean {
  return place(createQrElement(content.trim(), label.trim(), at ?? viewportCenter()));
}

export type WidgetKind = "digital-clock" | "analog-clock" | "timer" | "stopwatch";

export function insertWidget(kind: WidgetKind, at?: Point): void {
  const state = useBoardStore.getState();
  const center = at ?? viewportCenter();
  const color = state.style.color === "#ffffff" ? "#1f2328" : state.style.color;
  const element =
    kind === "digital-clock" || kind === "analog-clock"
      ? createClockElement(kind === "analog-clock" ? "analog" : "digital", center, color)
      : createTimerElement(kind === "stopwatch" ? "stopwatch" : "countdown", center, color);
  place(element);
}

/** Image files from a DataTransfer (drop or paste), ignoring everything else. */
export function imageFilesFrom(data: DataTransfer | null): File[] {
  if (!data) return [];
  const fromItems = Array.from(data.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
  const files = fromItems.length ? fromItems : Array.from(data.files ?? []);
  // Type is only a hint here; prepareImageAsset verifies the bytes.
  return files.filter((file) => file.type.startsWith("image/") || /\.(png|jpe?g|webp|svg)$/i.test(file.name));
}
