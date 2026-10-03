import { create } from "zustand";
import {
  completeTimer,
  IDLE_RUNTIME,
  lapTimer,
  pauseTimer,
  resetTimer,
  startTimer,
  type TimerRuntime,
} from "./time";

/**
 * Running state for timers and stopwatches, keyed by element id. Local and
 * transient by design: it is not part of the board document, never enters
 * undo history and is not saved. It survives page switches and deleting the
 * element (so undo brings back a running timer).
 */
interface TimerRuntimeState {
  runtimes: Record<string, TimerRuntime>;
  start: (id: string) => void;
  pause: (id: string) => void;
  reset: (id: string) => void;
  lap: (id: string) => void;
  /** Returns true only on the transition into "done", so completion side effects run once. */
  complete: (id: string, durationMs: number) => boolean;
}

export const useTimerRuntime = create<TimerRuntimeState>()((set, get) => {
  const update = (id: string, next: (runtime: TimerRuntime) => TimerRuntime) => {
    const current = get().runtimes[id] ?? IDLE_RUNTIME;
    const updated = next(current);
    if (updated !== current) set((s) => ({ runtimes: { ...s.runtimes, [id]: updated } }));
    return updated !== current;
  };

  return {
    runtimes: {},
    start: (id) => update(id, (r) => startTimer(r, Date.now())),
    pause: (id) => update(id, (r) => pauseTimer(r, Date.now())),
    reset: (id) => update(id, () => resetTimer()),
    lap: (id) => update(id, (r) => lapTimer(r, Date.now())),
    complete: (id, durationMs) => update(id, (r) => completeTimer(r, durationMs)),
  };
});

export function getTimerRuntime(id: string): TimerRuntime {
  return useTimerRuntime.getState().runtimes[id] ?? IDLE_RUNTIME;
}

export function useTimerRuntimeFor(id: string): TimerRuntime {
  return useTimerRuntime((s) => s.runtimes[id] ?? IDLE_RUNTIME);
}
