import type { CSSProperties } from "react";
import type { PageBackground } from "../types";
import { hexToRgba } from "../utils/elements";

/**
 * Small CSS approximation of a background for preset thumbnails. The real
 * board uses the canvas renderer; this only needs to read correctly at
 * thumbnail size.
 */
export function backgroundPreviewStyle(background: PageBackground, scale = 0.4): CSSProperties {
  const { pattern } = background;
  const base: CSSProperties = { backgroundColor: background.color };
  const line = (color: string, opacity: number) => hexToRgba(color, Math.min(1, opacity * 1.6));

  switch (pattern.type) {
    case "none":
      return base;
    case "grid": {
      const s = Math.max(4, pattern.size * scale);
      const c = line(pattern.color, pattern.opacity);
      return {
        ...base,
        backgroundImage: `linear-gradient(to right, ${c} 1px, transparent 1px), linear-gradient(to bottom, ${c} 1px, transparent 1px)`,
        backgroundSize: `${s}px ${s}px`,
      };
    }
    case "dots": {
      const s = Math.max(4, pattern.spacing * scale);
      const r = Math.max(0.8, (pattern.dotSize * scale) / 1.5);
      return {
        ...base,
        backgroundImage: `radial-gradient(circle, ${line(pattern.color, pattern.opacity)} ${r}px, transparent ${r + 0.6}px)`,
        backgroundSize: `${s}px ${s}px`,
      };
    }
    case "lines": {
      const s = Math.max(4, pattern.spacing * scale);
      return {
        ...base,
        backgroundImage: `linear-gradient(to bottom, ${line(pattern.color, pattern.opacity)} 1px, transparent 1px)`,
        backgroundSize: `100% ${s}px`,
      };
    }
    case "graph": {
      const minor = Math.max(3, pattern.size * scale);
      const major = minor * pattern.majorEvery;
      const strong = line(pattern.color, pattern.opacity);
      const faint = line(pattern.color, pattern.opacity * 0.5);
      return {
        ...base,
        backgroundImage: [
          `linear-gradient(to right, ${strong} 1px, transparent 1px)`,
          `linear-gradient(to bottom, ${strong} 1px, transparent 1px)`,
          `linear-gradient(to right, ${faint} 1px, transparent 1px)`,
          `linear-gradient(to bottom, ${faint} 1px, transparent 1px)`,
        ].join(","),
        backgroundSize: `${major}px ${major}px, ${major}px ${major}px, ${minor}px ${minor}px, ${minor}px ${minor}px`,
      };
    }
  }
}
