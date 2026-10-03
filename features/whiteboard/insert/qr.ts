/**
 * QR encoding via `uqr` (pure computation, no DOM, no external scripts).
 * Content is only ever encoded, never opened or rendered as a link, so any
 * text, valid URL or not, is safe to accept.
 */
import { encode } from "uqr";
import { QR_MAX_LENGTH } from "../constants";

export type QrMatrix = { ok: true; modules: boolean[][]; count: number } | { ok: false; error: string };

const cache = new Map<string, QrMatrix>();
const CACHE_LIMIT = 64;

/** User-facing problem with QR content, or null when it can be encoded. */
export function validateQrContent(content: string): string | null {
  if (!content.trim()) return "Enter a link or some text to encode.";
  if (content.length > QR_MAX_LENGTH) return `Keep it under ${QR_MAX_LENGTH} characters so phones can scan it reliably.`;
  return null;
}

/** Module matrix including a 2-module quiet zone. Memoised by content. */
export function encodeQr(content: string): QrMatrix {
  const cached = cache.get(content);
  if (cached) return cached;
  const problem = validateQrContent(content);
  let result: QrMatrix;
  if (problem) {
    result = { ok: false, error: problem };
  } else {
    try {
      const { data, size } = encode(content, { ecc: "M", border: 2 });
      result = { ok: true, modules: data, count: size };
    } catch {
      result = { ok: false, error: "This content can't be turned into a QR code. Try shortening it." };
    }
  }
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  cache.set(content, result);
  return result;
}

/** SVG path for dark modules, merging horizontal runs (one unit per module). */
export function qrPathData(modules: boolean[][]): string {
  let d = "";
  modules.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < row.length && row[x]) x += 1;
      d += `M${start} ${y}h${x - start}v1h${start - x}z`;
    }
  });
  return d;
}

/** For a "Link" hint in the UI only; the content is never navigated to. */
export function looksLikeUrl(content: string): boolean {
  try {
    const url = new URL(content.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
