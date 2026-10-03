"use client";

import Konva from "konva";
import { useEffect, useMemo, useRef } from "react";
import { Layer, Rect, Stage } from "react-konva";
import { useShallow } from "zustand/react/shallow";
import { can } from "@/features/permissions/policy";
import { useCan, usePermissionStore } from "@/features/permissions/store";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { BackgroundLayer } from "../background/BackgroundLayer";
import { isDarkColor } from "../background/geometry";
import { CANVAS_FONT_FAMILY, TEXT_LINE_HEIGHT } from "../constants";
import { useCanvasInteractions } from "../hooks/useCanvasInteractions";
import { useStageSize } from "../hooks/useStageSize";
import { DropOverlay } from "../insert/DropOverlay";
import { useImageDropAndPaste } from "../insert/useImageDropAndPaste";
import { getActivePage, getActiveViewport, useBoardStore } from "../store/board-store";
import type { BoardElement, StickyElement, TextElement, ToolId } from "../types";
import { registerCanvas } from "../utils/canvas-handle";
import { setTextMeasurer } from "../utils/text";
import { TimerControls } from "../widgets/TimerControls";
import { ElementNode, ElementsList } from "./ElementNode";
import { EmptyBoardHint } from "./EmptyBoardHint";
import { LockBadges } from "./LockBadges";
import { SelectionTransformer } from "./SelectionTransformer";
import { TextEditorOverlay } from "./TextEditorOverlay";

// Sharp on HiDPI screens without paying for 3x+ canvases on phones.
Konva.pixelRatio = Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, 2);
// Small jitter on tap should select, not move.
Konva.dragDistance = 3;
// Keep hit detection alive while a node is dragged (needed for multi-touch).
Konva.hitOnDragEnabled = true;

const ERASER_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22'%3E%3Ccircle cx='11' cy='11' r='9' fill='white' fill-opacity='.6' stroke='%2318181b' stroke-width='1.5'/%3E%3C/svg%3E\") 11 11, crosshair";

/**
 * Widgets that tick live in their own layer: a clock updating every second
 * redraws only that layer, never the (potentially heavy) drawing content.
 * Trade-off: live widgets always paint above static content.
 */
const LIVE_TYPES: ReadonlySet<BoardElement["type"]> = new Set(["clock", "timer"]);

function cursorFor(tool: ToolId, panning: boolean): string {
  switch (tool) {
    case "hand":
      return panning ? "grabbing" : "grab";
    case "select":
      return "default";
    case "eraser":
      return ERASER_CURSOR;
    case "text":
      return "text";
    default:
      return "crosshair";
  }
}

export default function BoardCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const backgroundLayerRef = useRef<Konva.Layer>(null);
  const contentLayerRef = useRef<Konva.Layer>(null);
  const liveLayerRef = useRef<Konva.Layer>(null);
  const size = useStageSize(containerRef);
  const coarsePointer = useMediaQuery("(pointer: coarse)");

  const { page, viewport, tool, selectedIds, editingId } = useBoardStore(
    useShallow((s) => ({
      page: getActivePage(s),
      viewport: getActiveViewport(s),
      tool: s.isSpacePanning ? ("hand" as const) : s.activeTool,
      selectedIds: s.selectedIds,
      editingId: s.editingId,
    })),
  );
  const setStageSize = useBoardStore((s) => s.setStageSize);
  const canEdit = useCan({ type: "board.edit" });
  const permissions = usePermissionStore((s) => s.context);
  const { draft, marquee, erasingIds, isPanning, handlers } = useCanvasInteractions(containerRef, stageRef);
  const { dropState, dropHandlers } = useImageDropAndPaste(containerRef);

  useEffect(() => setStageSize(size), [size, setStageSize]);

  // Exact text heights from Konva's own layout engine, so selection boxes,
  // eraser hits and export bounds match what is drawn.
  useEffect(() => {
    const measure = new Konva.Text({ fontFamily: CANVAS_FONT_FAMILY, lineHeight: TEXT_LINE_HEIGHT, wrap: "word" });
    setTextMeasurer((text, width, fontSize) => {
      measure.setAttrs({ text: text || " ", width, fontSize });
      return Math.ceil(measure.height());
    });
    return () => {
      setTextMeasurer(null);
      measure.destroy();
    };
  }, []);

  const hasStage = size.width > 0 && size.height > 0;
  useEffect(() => {
    const layers = [backgroundLayerRef.current, contentLayerRef.current, liveLayerRef.current];
    if (!hasStage || !stageRef.current || layers.some((layer) => !layer)) return;
    registerCanvas({ stage: stageRef.current, layers: layers as Konva.Layer[] });
    return () => registerCanvas(null);
  }, [hasStage]);

  const staticElements = useMemo(() => page.elements.filter((el) => !LIVE_TYPES.has(el.type)), [page.elements]);
  const liveElements = useMemo(() => page.elements.filter((el) => LIVE_TYPES.has(el.type)), [page.elements]);

  const editingElement = editingId
    ? (page.elements.find((el) => el.id === editingId && (el.type === "text" || el.type === "sticky")) as
        | TextElement
        | StickyElement
        | undefined)
    : undefined;

  const objectCount = page.elements.length;
  const lockedSelection = page.elements.filter((el) => el.locked && selectedIds.includes(el.id));
  const selectedTimer =
    tool === "select" && selectedIds.length === 1
      ? page.elements.find((el) => el.id === selectedIds[0] && el.type === "timer")
      : undefined;
  const draggable = tool === "select" && canEdit;
  const darkBackground = isDarkColor(page.background.color);

  return (
    <div
      ref={containerRef}
      role="application"
      aria-roledescription="whiteboard"
      aria-label={`${page.name}. ${objectCount === 0 ? "Empty" : `${objectCount} ${objectCount === 1 ? "object" : "objects"}`}. Use the toolbar or keyboard shortcuts to draw, or drop an image here.`}
      tabIndex={0}
      className="absolute inset-0 touch-none overflow-hidden outline-none select-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      // The background colour shows instantly, before the canvas paints.
      style={{ backgroundColor: page.background.color, cursor: cursorFor(tool, isPanning) }}
      {...handlers}
      {...dropHandlers}
    >
      {hasStage && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          x={viewport.x}
          y={viewport.y}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
        >
          <BackgroundLayer layerRef={backgroundLayerRef} background={page.background} />
          <Layer ref={contentLayerRef}>
            <ElementsList elements={staticElements} draggable={draggable} editingId={editingId} erasingIds={erasingIds} />
          </Layer>
          <Layer ref={liveLayerRef}>
            <ElementsList elements={liveElements} draggable={draggable} editingId={editingId} erasingIds={erasingIds} />
          </Layer>
          <Layer listening={false}>
            {draft && <ElementNode element={draft} listening={false} />}
            {marquee && (
              <Rect
                x={marquee.x}
                y={marquee.y}
                width={marquee.width}
                height={marquee.height}
                fill="rgba(41, 82, 227, 0.08)"
                stroke="#2952e3"
                strokeWidth={1 / viewport.scale}
                dash={[4 / viewport.scale, 3 / viewport.scale]}
              />
            )}
          </Layer>
          <Layer>
            {tool === "select" && (
              <SelectionTransformer
                stageRef={stageRef}
                selectedIds={selectedIds}
                elements={page.elements}
                coarsePointer={coarsePointer}
                canEdit={canEdit}
              />
            )}
          </Layer>
        </Stage>
      )}

      {editingElement && <TextEditorOverlay key={editingElement.id} element={editingElement} viewport={viewport} />}
      {/* Running a timer is runtime state, not an edit, so locked timers stay controllable. */}
      {selectedTimer?.type === "timer" && <TimerControls element={selectedTimer} viewport={viewport} />}
      {tool === "select" && lockedSelection.length > 0 && (
        <LockBadges
          elements={lockedSelection}
          viewport={viewport}
          canUnlock={can(permissions, { type: "element.lock", element: lockedSelection[0] })}
          onUnlock={(id) => {
            const store = useBoardStore.getState();
            store.select([id]);
            store.setSelectionLocked(false);
          }}
        />
      )}
      {objectCount === 0 && !draft && !editingId && <EmptyBoardHint tool={tool} dark={darkBackground} />}
      {dropState !== "idle" && <DropOverlay state={dropState} />}
    </div>
  );
}
