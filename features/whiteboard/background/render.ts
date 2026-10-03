/**
 * Draws a page background in world space onto a 2D canvas context whose
 * transform already maps world units to device pixels. Used by the live
 * background layer and by export, so both always match.
 */
import { PAGE_FRAME } from "../constants";
import type { BackgroundPattern, Bounds, PageBackground } from "../types";
import { adaptiveSpacing, fitImageRect, lineOffsets } from "./geometry";

export interface DrawScale {
  /** Device pixels per world unit (for filter radii). */
  devicePerWorld: number;
  /** CSS pixels per world unit (for hairline widths and pattern density). */
  cssPerWorld: number;
}

type PatternRenderer<P extends BackgroundPattern> = (
  ctx: CanvasRenderingContext2D,
  pattern: P,
  view: Bounds,
  scale: DrawScale,
) => void;

function strokeLines(ctx: CanvasRenderingContext2D, view: Bounds, xs: number[], ys: number[], width: number) {
  ctx.beginPath();
  for (const x of xs) {
    ctx.moveTo(x, view.y);
    ctx.lineTo(x, view.y + view.height);
  }
  for (const y of ys) {
    ctx.moveTo(view.x, y);
    ctx.lineTo(view.x + view.width, y);
  }
  ctx.lineWidth = width;
  ctx.stroke();
}

const hairline = (scale: DrawScale, cssPx = 1) => cssPx / scale.cssPerWorld;

/** Registry of pattern renderers; add new educational patterns here. */
const PATTERN_RENDERERS: { [K in BackgroundPattern["type"]]: PatternRenderer<Extract<BackgroundPattern, { type: K }>> } = {
  none: () => {},

  grid: (ctx, pattern, view, scale) => {
    const step = adaptiveSpacing(pattern.size, scale.cssPerWorld);
    ctx.strokeStyle = pattern.color;
    ctx.globalAlpha = pattern.opacity;
    strokeLines(
      ctx,
      view,
      lineOffsets(view.x, view.x + view.width, step),
      lineOffsets(view.y, view.y + view.height, step),
      hairline(scale),
    );
  },

  dots: (ctx, pattern, view, scale) => {
    const step = adaptiveSpacing(pattern.spacing, scale.cssPerWorld);
    // Dots keep a minimum on-screen size so they never vanish when zoomed out.
    const size = Math.max(pattern.dotSize, hairline(scale, 1.5));
    const half = size / 2;
    ctx.fillStyle = pattern.color;
    ctx.globalAlpha = pattern.opacity;
    const xs = lineOffsets(view.x, view.x + view.width, step);
    const ys = lineOffsets(view.y, view.y + view.height, step);
    const round = size * scale.cssPerWorld >= 3;
    ctx.beginPath();
    for (const x of xs) {
      for (const y of ys) {
        if (round) {
          ctx.moveTo(x + half, y);
          ctx.arc(x, y, half, 0, Math.PI * 2);
        } else {
          ctx.rect(x - half, y - half, size, size);
        }
      }
    }
    ctx.fill();
  },

  lines: (ctx, pattern, view, scale) => {
    const step = adaptiveSpacing(pattern.spacing, scale.cssPerWorld);
    ctx.strokeStyle = pattern.color;
    ctx.globalAlpha = pattern.opacity;
    strokeLines(ctx, view, [], lineOffsets(view.y, view.y + view.height, step), hairline(scale));
  },

  graph: (ctx, pattern, view, scale) => {
    const major = pattern.size * pattern.majorEvery;
    const minor = adaptiveSpacing(pattern.size, scale.cssPerWorld);
    ctx.strokeStyle = pattern.color;
    // Minor lines disappear before they crowd; major lines always stay.
    if (minor < major) {
      ctx.globalAlpha = pattern.opacity * 0.55;
      strokeLines(
        ctx,
        view,
        lineOffsets(view.x, view.x + view.width, minor),
        lineOffsets(view.y, view.y + view.height, minor),
        hairline(scale),
      );
    }
    const majorStep = adaptiveSpacing(major, scale.cssPerWorld);
    ctx.globalAlpha = pattern.opacity;
    strokeLines(
      ctx,
      view,
      lineOffsets(view.x, view.x + view.width, majorStep),
      lineOffsets(view.y, view.y + view.height, majorStep),
      hairline(scale, 1.25),
    );
  },
};

function drawPattern(ctx: CanvasRenderingContext2D, pattern: BackgroundPattern, view: Bounds, scale: DrawScale) {
  // The mapped-type registry guarantees a renderer per pattern type.
  (PATTERN_RENDERERS[pattern.type] as PatternRenderer<BackgroundPattern>)(ctx, pattern, view, scale);
}

function drawImage(
  ctx: CanvasRenderingContext2D,
  background: PageBackground,
  image: CanvasImageSource & { width: number; height: number },
  view: Bounds,
  scale: DrawScale,
) {
  const config = background.image;
  if (!config || image.width <= 0 || image.height <= 0) return;
  ctx.globalAlpha = config.opacity;
  const filters: string[] = [];
  if (config.blur > 0) filters.push(`blur(${(config.blur * scale.devicePerWorld).toFixed(2)}px)`);
  if (config.brightness !== 1) filters.push(`brightness(${config.brightness})`);
  // Canvas filters are unsupported in a few browsers; the image still draws, unfiltered.
  if ("filter" in ctx) ctx.filter = filters.length ? filters.join(" ") : "none";

  if (config.fit === "tile") {
    const pattern = ctx.createPattern(image, "repeat");
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(view.x, view.y, view.width, view.height);
    }
  } else {
    const rect = fitImageRect(config.fit, PAGE_FRAME, image);
    if (rect) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(PAGE_FRAME.x, PAGE_FRAME.y, PAGE_FRAME.width, PAGE_FRAME.height);
      ctx.clip();
      ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
      ctx.restore();
    }
  }
  if ("filter" in ctx) ctx.filter = "none";
}

/** Base colour, then pattern, then image (so an image covers the pattern inside the frame). */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  background: PageBackground,
  view: Bounds,
  scale: DrawScale,
  image: (CanvasImageSource & { width: number; height: number }) | null,
): void {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = background.color;
  ctx.fillRect(view.x, view.y, view.width, view.height);
  drawPattern(ctx, background.pattern, view, scale);
  if (image) drawImage(ctx, background, image, view, scale);
  ctx.restore();
}
