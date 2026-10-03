import type { DrawingStyle, ToolId } from "./types";

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;
/** Discrete stops used by the zoom buttons and keyboard shortcuts. */
export const ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5];

export const HISTORY_LIMIT = 100;
export const HISTORY_COALESCE_MS = 1000;

export const MAX_PAGES = 50;
export const PAGE_NAME_MAX_LENGTH = 40;
export const BOARD_TITLE_MAX_LENGTH = 80;
export const TEXT_MAX_LENGTH = 4000;
export const ACTIVITY_LIMIT = 50;

/** Shapes dragged smaller than this (in world units) are discarded as accidental clicks. */
export const MIN_SHAPE_SIZE = 3;
export const MIN_ELEMENT_SIZE = 8;
/** Eraser radius in screen pixels; divided by zoom to get world units. */
export const ERASER_RADIUS = 10;

export const CANVAS_FONT_FAMILY =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
export const TEXT_LINE_HEIGHT = 1.3;
export const STICKY_PADDING = 14;
export const STICKY_SIZE = 200;
export const STICKY_FONT_SIZE = 18;
export const STICKY_TEXT_COLOR = "#1f2328";
export const DEFAULT_TEXT_WIDTH = 280;

export interface NamedColor {
  name: string;
  value: string;
}

export const INK_COLORS: NamedColor[] = [
  { name: "Ink", value: "#1f2328" },
  { name: "Graphite", value: "#6b7280" },
  { name: "Red", value: "#d92d20" },
  { name: "Orange", value: "#e8590c" },
  { name: "Green", value: "#2b8a3e" },
  { name: "Blue", value: "#1d4ed8" },
  { name: "Violet", value: "#6d28d9" },
  // For dark boards, where every other ink is hard to read.
  { name: "White", value: "#ffffff" },
];

export const STICKY_COLORS: NamedColor[] = [
  { name: "Yellow", value: "#fff0a6" },
  { name: "Pink", value: "#ffd8e1" },
  { name: "Green", value: "#cdf1d4" },
  { name: "Blue", value: "#d3e5ff" },
  { name: "Lavender", value: "#e4dcff" },
];

export const STROKE_WIDTH_PRESETS = [
  { label: "Fine", value: 2 },
  { label: "Medium", value: 4 },
  { label: "Bold", value: 8 },
  { label: "Marker", value: 14 },
];
export const MIN_STROKE_WIDTH = 1;
export const MAX_STROKE_WIDTH = 32;

export const FONT_SIZE_PRESETS = [
  { label: "S", name: "Small", value: 16 },
  { label: "M", name: "Medium", value: 24 },
  { label: "L", name: "Large", value: 36 },
  { label: "XL", name: "Extra large", value: 56 },
];

export const DEFAULT_STYLE: DrawingStyle = {
  color: INK_COLORS[0].value,
  strokeWidth: 4,
  filled: false,
  fontSize: 24,
  stickyColor: STICKY_COLORS[0].value,
};

export interface ToolMeta {
  id: ToolId;
  label: string;
  shortcut: string;
}

export const TOOLS: ToolMeta[] = [
  { id: "select", label: "Select", shortcut: "V" },
  { id: "hand", label: "Pan", shortcut: "H" },
  { id: "pen", label: "Pen", shortcut: "P" },
  { id: "eraser", label: "Eraser", shortcut: "E" },
  { id: "line", label: "Line", shortcut: "L" },
  { id: "rectangle", label: "Rectangle", shortcut: "R" },
  { id: "ellipse", label: "Circle", shortcut: "O" },
  { id: "text", label: "Text", shortcut: "T" },
  { id: "sticky", label: "Sticky note", shortcut: "S" },
];

export const TOOL_BY_SHORTCUT: Record<string, ToolId> = Object.fromEntries(
  TOOLS.map((tool) => [tool.shortcut.toLowerCase(), tool.id]),
);

export const ELEMENT_LABELS = {
  freehand: "Drawing",
  line: "Line",
  rectangle: "Rectangle",
  ellipse: "Circle",
  text: "Text",
  sticky: "Sticky note",
  image: "Image",
  qr: "QR code",
  clock: "Clock",
  timer: "Timer",
} as const;

/**
 * The page frame: a 16:9 area at the world origin. Background images are
 * fitted to it (world-anchored, so annotations stay aligned), and export
 * includes it whenever a page has a background image.
 */
export const PAGE_FRAME = { x: 0, y: 0, width: 1920, height: 1080 } as const;

// Uploads
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_SVG_BYTES = 2 * 1024 * 1024;
/** Inserted images are downscaled to this longest side to protect canvas performance. */
export const MAX_IMAGE_DIMENSION = 2560;
export const MAX_BACKGROUND_DIMENSION = 3840;
export const MAX_ASSETS = 200;

// QR codes
export const QR_MAX_LENGTH = 900;
export const QR_LABEL_MAX_LENGTH = 60;
export const QR_DEFAULT_SIZE = 220;

// Widgets
export const TIMER_MAX_MS = (23 * 3600 + 59 * 60 + 59) * 1000;
export const TIMER_PRESETS_MIN = [1, 5, 10, 15, 30];
export const WIDGET_LABEL_MAX_LENGTH = 40;
