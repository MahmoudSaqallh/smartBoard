"use client";

import { useEffect } from "react";
import { useBoardStore } from "../store/board-store";
import type { BoardDocument, BoardPage, TimerElement } from "../types";
import { useTimerRuntime } from "./runtime-store";
import { playChime } from "./sound";
import { subscribeTick } from "./ticker";
import { isCountdownFinished } from "./time";

function findTimer(doc: BoardDocument, id: string): { element: TimerElement; page: BoardPage } | null {
  for (const page of doc.pages) {
    const element = page.elements.find((el) => el.id === id);
    if (element?.type === "timer") return { element, page };
  }
  return null;
}

/**
 * Detects finished countdowns at workspace level, so a timer still completes
 * (and notifies) while the user is on another page. Only subscribes to the
 * ticker while at least one timer is running.
 */
export function useTimerWatcher() {
  const hasRunning = useTimerRuntime((s) => Object.values(s.runtimes).some((r) => r.status === "running"));

  useEffect(() => {
    if (!hasRunning) return;
    return subscribeTick((now) => {
      const { runtimes, complete, reset } = useTimerRuntime.getState();
      const board = useBoardStore.getState();
      for (const [id, runtime] of Object.entries(runtimes)) {
        if (runtime.status !== "running") continue;
        const found = findTimer(board.doc, id);
        // Deleted timers simply wait; undo brings them back still running.
        if (!found || found.element.mode !== "countdown") continue;
        if (!isCountdownFinished(found.element.durationMs, runtime, now)) continue;
        if (!complete(id, found.element.durationMs)) continue;

        const name = found.element.label.trim() || "Timer";
        const where = found.page.id === board.activePageId ? "" : ` on ${found.page.name}`;
        board.notify(`${name} finished${where}`, { label: "Reset", run: () => reset(id) });
        if (found.element.sound) playChime();
      }
    });
  }, [hasRunning]);
}
