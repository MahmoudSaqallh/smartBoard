"use client";

import { Minus, Plus, Scan } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { getActiveViewport, useBoardStore } from "@/features/whiteboard/store/board-store";
import { canZoomIn, canZoomOut, formatZoom } from "@/features/whiteboard/utils/viewport";

export function ZoomControls() {
  const scale = useBoardStore((s) => getActiveViewport(s).scale);
  const zoomIn = useBoardStore((s) => s.zoomIn);
  const zoomOut = useBoardStore((s) => s.zoomOut);
  const resetZoom = useBoardStore((s) => s.resetZoom);
  const zoomToFit = useBoardStore((s) => s.zoomToFit);

  return (
    <div role="group" aria-label="Zoom" className="flex items-center">
      <IconButton label="Zoom out" shortcut="Ctrl −" tooltipSide="top" size="sm" onClick={zoomOut} disabled={!canZoomOut(scale)}>
        <Minus aria-hidden className="size-4" strokeWidth={1.75} />
      </IconButton>
      <Tooltip label="Reset to 100%" shortcut="Ctrl 0" side="top">
        <button
          type="button"
          onClick={resetZoom}
          aria-label={`Zoom ${formatZoom(scale)}, reset to 100%`}
          className="focus-ring h-8 w-12 rounded-md text-xs font-medium text-ink-muted tabular-nums transition-colors hover:bg-hover hover:text-ink"
        >
          {formatZoom(scale)}
        </button>
      </Tooltip>
      <IconButton label="Zoom in" shortcut="Ctrl +" tooltipSide="top" size="sm" onClick={zoomIn} disabled={!canZoomIn(scale)}>
        <Plus aria-hidden className="size-4" strokeWidth={1.75} />
      </IconButton>
      <IconButton label="Zoom to fit" shortcut="⇧ 1" tooltipSide="top" size="sm" onClick={zoomToFit} className="max-sm:hidden">
        <Scan aria-hidden className="size-4" strokeWidth={1.75} />
      </IconButton>
    </div>
  );
}
