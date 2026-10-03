/**
 * Shared time logic for countdown timers and stopwatches. Both are one
 * state machine: a stopwatch shows elapsed time, a countdown shows
 * `duration - elapsed`. Pure functions, so every transition is testable and
 * repeated clicks are idempotent.
 */
import { TIMER_MAX_MS } from "../constants";

export type TimerStatus = "idle" | "running" | "paused" | "done";

/** Local runtime state; never stored in the board document. */
export interface TimerRuntime {
  status: TimerStatus;
  /** Wall-clock ms when the current run started; null unless running. */
  startedAt: number | null;
  /** Elapsed ms from previous runs (before the current one). */
  accumulatedMs: number;
  /** Elapsed ms at each lap (stopwatch). */
  laps: number[];
}

export const IDLE_RUNTIME: TimerRuntime = { status: "idle", startedAt: null, accumulatedMs: 0, laps: [] };
export const MAX_LAPS = 99;

export function elapsedMs(runtime: TimerRuntime, now: number): number {
  const current = runtime.status === "running" && runtime.startedAt !== null ? Math.max(0, now - runtime.startedAt) : 0;
  return runtime.accumulatedMs + current;
}

export function remainingMs(durationMs: number, runtime: TimerRuntime, now: number): number {
  return Math.max(0, durationMs - elapsedMs(runtime, now));
}

/** Starts from idle or resumes from paused. No-op while running or done. */
export function startTimer(runtime: TimerRuntime, now: number): TimerRuntime {
  if (runtime.status === "running" || runtime.status === "done") return runtime;
  return { ...runtime, status: "running", startedAt: now };
}

export function pauseTimer(runtime: TimerRuntime, now: number): TimerRuntime {
  if (runtime.status !== "running") return runtime;
  return { ...runtime, status: "paused", startedAt: null, accumulatedMs: elapsedMs(runtime, now) };
}

export function resetTimer(): TimerRuntime {
  return IDLE_RUNTIME;
}

export function lapTimer(runtime: TimerRuntime, now: number): TimerRuntime {
  if (runtime.status !== "running" || runtime.laps.length >= MAX_LAPS) return runtime;
  return { ...runtime, laps: [...runtime.laps, elapsedMs(runtime, now)] };
}

/** Marks a running countdown as finished. No-op in any other state, so it fires once. */
export function completeTimer(runtime: TimerRuntime, durationMs: number): TimerRuntime {
  if (runtime.status !== "running") return runtime;
  return { status: "done", startedAt: null, accumulatedMs: durationMs, laps: runtime.laps };
}

export function isCountdownFinished(durationMs: number, runtime: TimerRuntime, now: number): boolean {
  return runtime.status === "running" && elapsedMs(runtime, now) >= durationMs;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * "MM:SS" or "H:MM:SS". Countdowns round up (a timer with 4.2 s left shows
 * 00:05, reaching 00:00 exactly when it finishes); stopwatches round down
 * and can show tenths.
 */
export function formatDuration(ms: number, options: { roundUp?: boolean; tenths?: boolean } = {}): string {
  const safe = Math.max(0, Number.isFinite(ms) ? ms : 0);
  const totalSeconds = options.roundUp ? Math.ceil(safe / 1000) : Math.floor(safe / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const base = hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
  return options.tenths ? `${base}.${Math.floor((safe % 1000) / 100)}` : base;
}

export function splitDuration(ms: number): { hours: number; minutes: number; seconds: number } {
  const total = Math.max(0, Math.floor(ms / 1000));
  return { hours: Math.floor(total / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 };
}

/** Clamps each part and the total; non-numeric input counts as zero. */
export function joinDuration(hours: number, minutes: number, seconds: number): number {
  const clean = (n: number, max: number) => (Number.isFinite(n) ? Math.min(max, Math.max(0, Math.floor(n))) : 0);
  const ms = (clean(hours, 23) * 3600 + clean(minutes, 59) * 60 + clean(seconds, 59)) * 1000;
  return Math.min(ms, TIMER_MAX_MS);
}
