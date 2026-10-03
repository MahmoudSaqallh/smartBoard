import { PAGE_FRAME } from "../constants";
import { getActivePage, useBoardStore } from "../store/board-store";
import type { Bounds } from "../types";
import { getCanvas } from "./canvas-handle";
import { getContentBounds } from "./geometry";

const EXPORT_PADDING = 32;
const MAX_EXPORT_SIDE = 8192;

function padBounds(b: Bounds, pad: number): Bounds {
  return { x: b.x - pad, y: b.y - pad, width: b.width + pad * 2, height: b.height + pad * 2 };
}

function unionBounds(a: Bounds | null, b: Bounds): Bounds {
  if (!a) return { ...b };
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
}

/** Filesystem-safe name that keeps non-Latin titles readable. */
export function toFileName(...parts: string[]): string {
  const name = Array.from(parts.join(" "))
    .filter((char) => char.charCodeAt(0) >= 32)
    .join("")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return `${name || "board"}.png`;
}

export type ExportResult = "exported" | "empty" | "unavailable" | "failed";

/**
 * Exports the active page's content (not the visible viewport) as a PNG at
 * 2x world resolution, capped so huge boards cannot exhaust canvas memory.
 */
export async function exportActivePageAsPng(): Promise<ExportResult> {
  const store = useBoardStore.getState();
  store.finishEditing();

  const state = useBoardStore.getState();
  const page = getActivePage(state);
  const contentBounds = getContentBounds(page.elements);
  // A page with only a background image still exports: the image's frame.
  const bounds = page.background.image
    ? unionBounds(contentBounds, PAGE_FRAME)
    : contentBounds && padBounds(contentBounds, EXPORT_PADDING);
  if (!bounds) return "empty";

  const canvas = getCanvas();
  if (!canvas) return "unavailable";

  try {
    const { stage, layers } = canvas;
    const scale = stage.scaleX();
    const longestSide = Math.max(bounds.width, bounds.height);
    const pixelRatio = Math.min(2 / scale, MAX_EXPORT_SIDE / (longestSide * scale));
    const region = {
      x: bounds.x * scale + stage.x(),
      y: bounds.y * scale + stage.y(),
      width: bounds.width * scale,
      height: bounds.height * scale,
      pixelRatio,
    };

    // Background, content and live widgets (showing their current time), in paint order.
    const parts = layers.map((layer) => layer.toCanvas(region));
    const output = document.createElement("canvas");
    output.width = parts[0].width;
    output.height = parts[0].height;
    const context = output.getContext("2d");
    if (!context) return "failed";
    context.fillStyle = page.background.color;
    context.fillRect(0, 0, output.width, output.height);
    for (const part of parts) context.drawImage(part, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, "image/png"));
    if (!blob) return "failed";

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = toFileName(state.doc.title, page.name);
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    useBoardStore.getState().logActivity(`Exported ${page.name} as PNG`);
    return "exported";
  } catch {
    return "failed";
  }
}

let exporting = false;

/** Export with user feedback; ignores repeated clicks while an export runs. */
export async function exportWithFeedback(): Promise<void> {
  if (exporting) return;
  exporting = true;
  try {
    const result = await exportActivePageAsPng();
    const { notify } = useBoardStore.getState();
    if (result === "exported") notify("PNG exported");
    else if (result === "empty") notify("Nothing to export: this page is empty");
    else notify("Export failed. Try again.");
  } finally {
    exporting = false;
  }
}
