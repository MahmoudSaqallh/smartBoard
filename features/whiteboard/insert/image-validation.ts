/**
 * Upload validation. The file type is decided from its leading bytes (magic
 * numbers), never from the browser-supplied MIME type or the extension, both
 * of which are trivially spoofed.
 */
import { MAX_SVG_BYTES, MAX_UPLOAD_BYTES } from "../constants";

export type ImageKind = "png" | "jpeg" | "webp" | "svg";

/** Value for <input accept>; the real check is `sniffImageType`. */
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg";

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, i) => bytes[offset + i] === byte);

const SVG_HEAD = /^(?:﻿)?\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!doctype\s+svg[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i;

export function sniffImageType(bytes: Uint8Array): ImageKind | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  // RIFF....WEBP
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  // A real UTF-8 decode, so files saved with a byte-order mark (common on Windows) are recognised.
  const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, 1024));
  if (SVG_HEAD.test(head)) return "svg";
  return null;
}

export type UploadCheck = { ok: true; kind: ImageKind } | { ok: false; error: string };

export function checkUpload(size: number, kind: ImageKind | null): UploadCheck {
  if (size === 0) return { ok: false, error: "That file is empty." };
  if (!kind) return { ok: false, error: "Unsupported file. Use a PNG, JPG, WebP or SVG image." };
  if (size > MAX_UPLOAD_BYTES) return { ok: false, error: `Images must be under ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` };
  if (kind === "svg" && size > MAX_SVG_BYTES) return { ok: false, error: `SVG files must be under ${MAX_SVG_BYTES / 1024 / 1024} MB.` };
  return { ok: true, kind };
}

/** Largest size within `maxSide` that keeps the aspect ratio (never upscales). */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
