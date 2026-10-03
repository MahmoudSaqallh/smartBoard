/**
 * Turns an uploaded file into a board asset: validate → decode → downscale →
 * re-encode as a raster data URL.
 *
 * SVG is rasterised through an <img> element, where browsers never run
 * scripts or fetch external resources, and only the resulting PNG is stored.
 * SVG markup never reaches the DOM or the board document.
 */
import type { BoardAsset } from "../types";
import { createId } from "../utils/id";
import { checkUpload, fitWithin, sniffImageType, type ImageKind } from "./image-validation";

export class ImageImportError extends Error {}

/** Re-encode large PNGs to keep documents (and future sync payloads) reasonable. */
const PNG_SOFT_LIMIT = 6_000_000;

type Drawable = (ImageBitmap | HTMLImageElement) & { width: number; height: number };

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode failed"));
    img.src = url;
  });
}

async function decodeRaster(file: File): Promise<{ source: Drawable; release: () => void }> {
  if (typeof createImageBitmap === "function") {
    // Applies EXIF orientation, so phone photos are not sideways.
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, release: () => bitmap.close() };
  }
  const url = URL.createObjectURL(file);
  const img = await loadImage(url);
  return { source: img, release: () => URL.revokeObjectURL(url) };
}

async function decodeSvg(file: File): Promise<{ source: Drawable; release: () => void }> {
  const blob = new Blob([await file.arrayBuffer()], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    if (!img.naturalWidth || !img.naturalHeight) throw new ImageImportError("This SVG has no size. Add width and height to it.");
    return { source: img, release: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function encode(canvas: HTMLCanvasElement, kind: ImageKind): { src: string; mimeType: BoardAsset["mimeType"] } {
  const preferred: BoardAsset["mimeType"] = kind === "jpeg" ? "image/jpeg" : kind === "webp" ? "image/webp" : "image/png";
  let src = canvas.toDataURL(preferred, 0.9);
  // Browsers without WebP encoding silently return PNG; trust the actual prefix.
  let mimeType = (src.slice(5, src.indexOf(";")) as BoardAsset["mimeType"]) || "image/png";

  if (mimeType === "image/png" && src.length > PNG_SOFT_LIMIT) {
    const webp = canvas.toDataURL("image/webp", 0.88);
    if (webp.startsWith("data:image/webp")) {
      src = webp;
      mimeType = "image/webp";
    }
  }
  return { src, mimeType };
}

/**
 * @param maxSide longest side after downscaling; protects memory and frame rate.
 * @throws ImageImportError with a message suitable for the user.
 */
export async function prepareImageAsset(file: File, maxSide: number): Promise<BoardAsset> {
  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  const check = checkUpload(file.size, sniffImageType(head));
  if (!check.ok) throw new ImageImportError(check.error);

  let decoded: { source: Drawable; release: () => void };
  try {
    decoded = check.kind === "svg" ? await decodeSvg(file) : await decodeRaster(file);
  } catch (error) {
    if (error instanceof ImageImportError) throw error;
    throw new ImageImportError("Couldn't read this image. The file may be damaged.");
  }

  try {
    const { width, height } = fitWithin(decoded.source.width, decoded.source.height, maxSide);
    if (!width || !height) throw new ImageImportError("Couldn't read this image's size.");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageImportError("Your browser couldn't process this image.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(decoded.source, 0, 0, width, height);

    let encoded: { src: string; mimeType: BoardAsset["mimeType"] };
    try {
      encoded = encode(canvas, check.kind);
    } catch {
      // A tainted canvas (e.g. an SVG embedding foreign content) cannot be exported.
      throw new ImageImportError("This SVG can't be used because it embeds external content.");
    }
    return { id: createId(), kind: "image", ...encoded, width, height };
  } finally {
    decoded.release();
  }
}
