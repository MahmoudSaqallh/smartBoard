import { describe, expect, it } from "vitest";
import { TIMER_MAX_MS } from "../constants";
import {
  completeTimer,
  elapsedMs,
  formatDuration,
  IDLE_RUNTIME,
  isCountdownFinished,
  joinDuration,
  lapTimer,
  MAX_LAPS,
  pauseTimer,
  remainingMs,
  resetTimer,
  splitDuration,
  startTimer,
} from "./time";

describe("timer state machine", () => {
  it("accumulates elapsed time across pause and resume", () => {
    let rt = startTimer(IDLE_RUNTIME, 1000);
    expect(elapsedMs(rt, 4000)).toBe(3000);
    rt = pauseTimer(rt, 4000);
    expect(elapsedMs(rt, 99_999)).toBe(3000); // paused: frozen
    rt = startTimer(rt, 10_000); // resume
    expect(elapsedMs(rt, 12_000)).toBe(5000);
  });

  it("ignores repeated start/pause clicks", () => {
    const running = startTimer(IDLE_RUNTIME, 0);
    expect(startTimer(running, 500)).toBe(running);
    const paused = pauseTimer(running, 1000);
    expect(pauseTimer(paused, 2000)).toBe(paused);
    expect(pauseTimer(IDLE_RUNTIME, 0)).toBe(IDLE_RUNTIME);
  });

  it("finishes a countdown exactly once", () => {
    const rt = startTimer(IDLE_RUNTIME, 0);
    expect(isCountdownFinished(5000, rt, 4999)).toBe(false);
    expect(isCountdownFinished(5000, rt, 5000)).toBe(true);
    const done = completeTimer(rt, 5000);
    expect(done.status).toBe("done");
    expect(completeTimer(done, 5000)).toBe(done);
    expect(startTimer(done, 6000)).toBe(done); // must reset before restarting
    expect(remainingMs(5000, done, 1e9)).toBe(0);
  });

  it("treats a zero-duration countdown as already finished", () => {
    expect(isCountdownFinished(0, startTimer(IDLE_RUNTIME, 0), 0)).toBe(true);
  });

  it("records laps only while running, up to a limit", () => {
    let rt = startTimer(IDLE_RUNTIME, 0);
    rt = lapTimer(rt, 1200);
    rt = lapTimer(rt, 2500);
    expect(rt.laps).toEqual([1200, 2500]);
    expect(lapTimer(pauseTimer(rt, 3000), 4000).laps).toHaveLength(2);
    let many = startTimer(IDLE_RUNTIME, 0);
    for (let i = 0; i < MAX_LAPS + 10; i += 1) many = lapTimer(many, i);
    expect(many.laps).toHaveLength(MAX_LAPS);
  });

  it("resets to idle", () => {
    expect(resetTimer()).toEqual(IDLE_RUNTIME);
  });
});

describe("duration formatting", () => {
  it("rounds countdowns up and stopwatches down", () => {
    expect(formatDuration(4200, { roundUp: true })).toBe("00:05");
    expect(formatDuration(4200)).toBe("00:04");
    expect(formatDuration(0, { roundUp: true })).toBe("00:00");
  });

  it("shows hours only when needed, and tenths on request", () => {
    expect(formatDuration(3_725_000)).toBe("1:02:05");
    expect(formatDuration(65_430, { tenths: true })).toBe("01:05.4");
  });

  it("survives invalid input", () => {
    expect(formatDuration(-5)).toBe("00:00");
    expect(formatDuration(Number.NaN)).toBe("00:00");
  });

  it("splits and joins durations with clamping", () => {
    expect(splitDuration(3_725_000)).toEqual({ hours: 1, minutes: 2, seconds: 5 });
    expect(joinDuration(1, 2, 5)).toBe(3_725_000);
    expect(joinDuration(-1, 99, Number.NaN)).toBe(59 * 60_000);
    expect(joinDuration(99, 99, 99)).toBe(TIMER_MAX_MS);
  });
});
