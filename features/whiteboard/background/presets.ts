import type { BackgroundPattern, PageBackground } from "../types";

/** Matches the board's original look: warm off-white with a subtle dot grid. */
export const DEFAULT_BACKGROUND: PageBackground = {
  color: "#f5f5f3",
  pattern: { type: "dots", spacing: 24, dotSize: 2, color: "#c4c4c0", opacity: 1 },
  image: null,
};

export interface BackgroundPreset {
  id: string;
  name: string;
  background: PageBackground;
}

const plain = (color: string, pattern: BackgroundPattern): PageBackground => ({ color, pattern, image: null });

/**
 * Starting points shown in the picker. Educational templates (coordinate
 * plane, handwriting lines, music staff, …) are added here once their
 * pattern exists in `BackgroundPattern` and `background/render.ts`.
 */
export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { id: "blank", name: "Blank", background: plain("#ffffff", { type: "none" }) },
  { id: "classroom", name: "Classroom", background: DEFAULT_BACKGROUND },
  { id: "grid-small", name: "Small grid", background: plain("#ffffff", { type: "grid", size: 20, color: "#94a3b8", opacity: 0.35 }) },
  { id: "grid-large", name: "Large grid", background: plain("#ffffff", { type: "grid", size: 60, color: "#94a3b8", opacity: 0.4 }) },
  { id: "dotted", name: "Dotted", background: plain("#ffffff", { type: "dots", spacing: 32, dotSize: 3, color: "#94a3b8", opacity: 0.7 }) },
  { id: "notebook", name: "Notebook", background: plain("#fffef7", { type: "lines", spacing: 32, color: "#60a5fa", opacity: 0.45 }) },
  {
    id: "graph",
    name: "Graph paper",
    background: plain("#ffffff", { type: "graph", size: 20, majorEvery: 5, color: "#0284c7", opacity: 0.4 }),
  },
  { id: "dark", name: "Dark board", background: plain("#1f2622", { type: "grid", size: 40, color: "#ffffff", opacity: 0.06 }) },
];

/** Default pattern settings when switching pattern type in the picker. */
export const PATTERN_DEFAULTS: { [K in BackgroundPattern["type"]]: Extract<BackgroundPattern, { type: K }> } = {
  none: { type: "none" },
  grid: { type: "grid", size: 24, color: "#94a3b8", opacity: 0.35 },
  dots: { type: "dots", spacing: 24, dotSize: 2, color: "#94a3b8", opacity: 0.7 },
  lines: { type: "lines", spacing: 32, color: "#60a5fa", opacity: 0.45 },
  graph: { type: "graph", size: 20, majorEvery: 5, color: "#0284c7", opacity: 0.4 },
};

export const BACKGROUND_COLORS = [
  { name: "White", value: "#ffffff" },
  { name: "Warm white", value: "#f5f5f3" },
  { name: "Paper", value: "#fffef7" },
  { name: "Mist", value: "#eef2f6" },
  { name: "Mint", value: "#ecf6f0" },
  { name: "Chalkboard", value: "#1f2622" },
  { name: "Slate", value: "#1e232b" },
];

export const PATTERN_COLORS = [
  { name: "Grey", value: "#94a3b8" },
  { name: "Blue", value: "#0284c7" },
  { name: "Light blue", value: "#60a5fa" },
  { name: "Green", value: "#16a34a" },
  { name: "Red", value: "#dc2626" },
  { name: "White", value: "#ffffff" },
];

function sameBackground(a: PageBackground, b: PageBackground): boolean {
  return a.color === b.color && JSON.stringify(a.pattern) === JSON.stringify(b.pattern);
}

/** The preset a background corresponds to (ignoring any image), for highlighting in the picker. */
export function matchPreset(background: PageBackground): string | null {
  return BACKGROUND_PRESETS.find((preset) => sameBackground(preset.background, background))?.id ?? null;
}
