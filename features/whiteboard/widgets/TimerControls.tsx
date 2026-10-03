"use client";

import { Flag, Pause, Play, RotateCcw } from "lucide-react";
import type { TimerElement, Viewport } from "../types";
import { getElementBounds } from "../utils/geometry";
import { worldToScreen } from "../utils/viewport";
import { useTimerRuntime, useTimerRuntimeFor } from "./runtime-store";
import { primeAudio } from "./sound";

/** Primary action for a timer state, shared by the canvas controls and the properties panel. */
export function timerPrimaryAction(status: string) {
  if (status === "running") return { label: "Pause", icon: Pause };
  if (status === "paused") return { label: "Resume", icon: Play };
  return { label: "Start", icon: Play };
}

export function useTimerActions(element: TimerElement) {
  const runtime = useTimerRuntimeFor(element.id);
  const { start, pause, reset, lap } = useTimerRuntime.getState();
  const canStart = element.mode === "stopwatch" || element.durationMs > 0;
  return {
    runtime,
    canStart,
    primary: () => {
      if (runtime.status === "running") pause(element.id);
      else if (runtime.status !== "done" && canStart) {
        // Start is a user gesture: the only moment browsers allow enabling audio.
        if (element.mode === "countdown" && element.sound) primeAudio();
        start(element.id);
      }
    },
    reset: () => reset(element.id),
    lap: () => lap(element.id),
  };
}

const BUTTON =
  "focus-ring flex size-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-hover hover:text-ink disabled:pointer-events-none disabled:opacity-40";

/**
 * Compact controls floating above a selected timer, so it can be run
 * without opening the panel (the panel has the full set).
 */
export function TimerControls({ element, viewport }: { element: TimerElement; viewport: Viewport }) {
  const { runtime, canStart, primary, reset, lap } = useTimerActions(element);
  const bounds = getElementBounds(element);
  const anchor = worldToScreen({ x: bounds.x + bounds.width / 2, y: bounds.y }, viewport);
  const action = timerPrimaryAction(runtime.status);
  const name = element.mode === "stopwatch" ? "stopwatch" : "timer";

  return (
    <div
      role="toolbar"
      aria-label={`${element.mode === "stopwatch" ? "Stopwatch" : "Timer"} controls`}
      style={{ left: anchor.x, top: anchor.y }}
      onPointerDown={(event) => event.stopPropagation()}
      className="absolute z-10 flex -translate-x-1/2 -translate-y-[calc(100%+12px)] items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5 shadow-pop"
    >
      <button
        type="button"
        className={BUTTON}
        aria-label={`${action.label} ${name}`}
        title={action.label}
        disabled={runtime.status === "done" || (!canStart && runtime.status === "idle")}
        onClick={primary}
      >
        <action.icon aria-hidden className="size-4" strokeWidth={2} />
      </button>
      {element.mode === "stopwatch" && (
        <button type="button" className={BUTTON} aria-label="Lap" title="Lap" disabled={runtime.status !== "running"} onClick={lap}>
          <Flag aria-hidden className="size-4" strokeWidth={2} />
        </button>
      )}
      <button
        type="button"
        className={BUTTON}
        aria-label={`Reset ${name}`}
        title="Reset"
        disabled={runtime.status === "idle"}
        onClick={reset}
      >
        <RotateCcw aria-hidden className="size-4" strokeWidth={2} />
      </button>
    </div>
  );
}
