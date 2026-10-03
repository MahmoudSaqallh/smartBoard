import type { ToolId } from "../types";

const HINTS: Partial<Record<ToolId, string>> = {
  pen: "Draw anywhere to start",
  line: "Drag to draw a line — hold Shift to snap angles",
  rectangle: "Drag to draw a rectangle — hold Shift for a square",
  ellipse: "Drag to draw a circle — hold Shift to keep it round",
  text: "Click anywhere to add text",
  sticky: "Click anywhere to place a sticky note",
};

/** Quiet first-run guidance; never intercepts pointer events. Readable on light and dark boards. */
export function EmptyBoardHint({ tool, dark = false }: { tool: ToolId; dark?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
      <div className="max-w-xs text-center">
        <p className={`text-sm font-medium ${dark ? "text-white/75" : "text-ink-muted"}`}>{HINTS[tool] ?? "This page is empty"}</p>
        <p className={`mt-1 hidden text-xs md:block ${dark ? "text-white/60" : "text-ink-faint"}`}>
          <kbd className="font-sans">P</kbd> pen · <kbd className="font-sans">R</kbd> rectangle ·{" "}
          <kbd className="font-sans">T</kbd> text · <kbd className="font-sans">S</kbd> sticky note
        </p>
      </div>
    </div>
  );
}
