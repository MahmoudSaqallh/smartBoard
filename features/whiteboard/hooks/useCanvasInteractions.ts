"use client";

import type Konva from "konva";
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from "react";
import { can } from "@/features/permissions/policy";
import { getPermissionContext } from "@/features/permissions/store";
import { getActiveViewport, useBoardStore } from "../store/board-store";
import { createToolRegistry } from "../tools/registry";
import type { HitResult, PointerInput, ToolContext, ToolGesture } from "../tools/types";
import type { BoardElement, Bounds, Point, Viewport } from "../types";
import { clampZoom, screenToWorld, zoomAtPoint } from "../utils/viewport";

type ActiveGesture =
  | { kind: "tool"; pointerId: number; gesture: ToolGesture }
  | { kind: "pinch"; startDistance: number; startCenter: Point; startViewport: Viewport };

const EMPTY_SET: ReadonlySet<string> = new Set();

/**
 * Canvas input: pointer bookkeeping, pinch zoom and wheel are handled here;
 * everything tool-specific is delegated to the tool registry. Gesture state
 * lives in refs; only what must render (draft, marquee, erase preview) is state.
 */
export function useCanvasInteractions(
  containerRef: RefObject<HTMLDivElement | null>,
  stageRef: RefObject<Konva.Stage | null>,
) {
  const active = useRef<ActiveGesture | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const [tools] = useState(createToolRegistry);

  const [draft, setDraft] = useState<BoardElement | null>(null);
  const [marquee, setMarquee] = useState<Bounds | null>(null);
  const [erasingIds, setErasingIds] = useState<ReadonlySet<string>>(EMPTY_SET);
  const [isPanning, setIsPanning] = useState(false);

  // Wheel: pan by default, zoom with Ctrl/Cmd (also trackpad pinch). Needs a
  // non-passive native listener so the browser does not zoom the page.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const state = useBoardStore.getState();
      const viewport = getActiveViewport(state);
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? container.clientHeight : 1;
      const dx = event.deltaX * unit;
      const dy = event.deltaY * unit;

      if (event.ctrlKey || event.metaKey) {
        const rect = container.getBoundingClientRect();
        const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        const factor = Math.exp(-Math.max(-50, Math.min(50, dy)) * 0.006);
        state.setViewport(zoomAtPoint(viewport, anchor, viewport.scale * factor));
        return;
      }
      const horizontal = event.shiftKey && dx === 0;
      state.setViewport({
        ...viewport,
        x: viewport.x - (horizontal ? dy : dx),
        y: viewport.y - (horizontal ? 0 : dy),
      });
    };
    // Safari pinch emits gesture events instead of ctrl+wheel; stop page zoom.
    const preventGesture = (event: Event) => event.preventDefault();

    container.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("gesturestart", preventGesture);
    return () => {
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("gesturestart", preventGesture);
    };
  }, [containerRef]);

  // Pinch pointers are not captured, so a finger lifted outside the canvas
  // never reaches the container. Without this, the stale pointer would turn
  // the next single touch into a phantom pinch.
  useEffect(() => {
    const tracked = pointers.current;
    const forget = (event: globalThis.PointerEvent) => {
      tracked.delete(event.pointerId);
      if (active.current?.kind === "pinch" && tracked.size < 2) active.current = null;
    };
    window.addEventListener("pointerup", forget);
    window.addEventListener("pointercancel", forget);
    return () => {
      window.removeEventListener("pointerup", forget);
      window.removeEventListener("pointercancel", forget);
    };
  }, []);

  const toScreen = (event: { clientX: number; clientY: number }): Point => {
    const rect = containerRef.current?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  };

  const toInput = (event: PointerEvent<HTMLDivElement>, endedEdit = false): PointerInput => {
    const viewport = getActiveViewport(useBoardStore.getState());
    const screen = toScreen(event);
    // Coalesced events restore intermediate samples for smoother strokes.
    const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? [];
    const samples = (coalesced.length ? coalesced : [event.nativeEvent]).map((sample) =>
      screenToWorld(toScreen(sample), viewport),
    );
    return { screen, world: screenToWorld(screen, viewport), samples, shiftKey: event.shiftKey, endedEdit };
  };

  /** Element under a screen point via Konva's pixel-accurate hit graph. */
  const hitTest = (screen: Point): HitResult => {
    const shape = stageRef.current?.getIntersection(screen);
    if (!shape) return null;
    if (shape.getParent()?.getClassName() === "Transformer") return { kind: "transformer" };
    const node = shape.hasName("element") ? shape : shape.findAncestor(".element");
    const id = node?.id();
    return id ? { kind: "element", id } : null;
  };

  const reset = () => {
    active.current = null;
    setDraft(null);
    setMarquee(null);
    setErasingIds(EMPTY_SET);
    setIsPanning(false);
  };

  const cancelActive = () => {
    if (active.current?.kind === "tool") active.current.gesture.cancel?.();
    reset();
  };

  const startPinch = () => {
    const [a, b] = Array.from(pointers.current.values());
    // A second finger cancels whatever the first one started; nothing is committed.
    stageRef.current?.find(".element").forEach((node) => {
      if (node.isDragging()) node.stopDrag();
    });
    cancelActive();
    active.current = {
      kind: "pinch",
      startDistance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      startCenter: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      startViewport: getActiveViewport(useBoardStore.getState()),
    };
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0 && event.button !== 1) return;
    pointers.current.set(event.pointerId, toScreen(event));

    if (pointers.current.size === 2) {
      startPinch();
      return;
    }
    if (pointers.current.size > 2 || active.current) return;

    const state = useBoardStore.getState();
    const toolId = state.isSpacePanning || event.button === 1 ? "hand" : state.activeTool;

    // A press while editing commits the text first; tools decide whether the
    // same press should do anything else (see PointerInput.endedEdit).
    const endedEdit = state.editingId !== null;
    if (endedEdit) state.finishEditing();

    if (!can(getPermissionContext(), { type: "tool.use", tool: toolId })) return;

    const target = event.currentTarget;
    const pointerId = event.pointerId;
    const ctx: ToolContext = {
      store: useBoardStore.getState,
      viewport: () => getActiveViewport(useBoardStore.getState()),
      hitTest,
      capture: () => {
        try {
          target.setPointerCapture(pointerId);
        } catch {
          // The pointer may already be gone (e.g. a very fast tap); safe to ignore.
        }
      },
      setDraft,
      setMarquee,
      setErasingIds,
      setPanning: setIsPanning,
    };

    const gesture = tools[toolId].start(toInput(event, endedEdit), ctx);
    if (gesture) active.current = { kind: "tool", pointerId, gesture };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, toScreen(event));
    const current = active.current;
    if (!current) return;

    if (current.kind === "pinch") {
      const points = Array.from(pointers.current.values());
      if (points.length < 2) return;
      const [a, b] = points;
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const scale = clampZoom((current.startViewport.scale * distance) / current.startDistance);
      const anchorWorld = screenToWorld(current.startCenter, current.startViewport);
      useBoardStore.getState().setViewport({ scale, x: center.x - anchorWorld.x * scale, y: center.y - anchorWorld.y * scale });
      return;
    }

    if (event.pointerId === current.pointerId) current.gesture.move?.(toInput(event));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    const current = active.current;
    if (!current) return;

    if (current.kind === "pinch") {
      // The remaining finger stays inert until lifted.
      if (pointers.current.size < 2) active.current = null;
      return;
    }
    if (event.pointerId !== current.pointerId) return;
    current.gesture.end?.(toInput(event));
    reset();
  };

  /** Cancelled pointers (system gestures, palm rejection) discard the gesture. */
  const onPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    const current = active.current;
    if (!current) return;
    if (current.kind === "pinch" || current.pointerId === event.pointerId) cancelActive();
  };

  /**
   * Prevents mousedown from moving focus to the canvas, which would blur a
   * text editor that was just opened. Other inputs (e.g. the board title) are
   * blurred manually so global shortcuts work again after clicking the board.
   */
  const onMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && focused !== document.body && !focused.hasAttribute("data-board-editor")) {
      focused.blur();
    }
  };

  return {
    draft,
    marquee,
    erasingIds,
    isPanning,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onMouseDown },
  };
}
