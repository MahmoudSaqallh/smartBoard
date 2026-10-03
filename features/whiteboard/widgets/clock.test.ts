import { describe, expect, it } from "vitest";
import { formatClockTime, handAngles } from "./clock";

const at = (h: number, m: number, s: number) => new Date(2026, 9, 3, h, m, s);

describe("clock formatting", () => {
  it("formats 24-hour time with optional seconds", () => {
    expect(formatClockTime(at(14, 5, 9), { hour12: false, showSeconds: true })).toEqual({ time: "14:05:09", period: null });
    expect(formatClockTime(at(9, 5, 9), { hour12: false, showSeconds: false })).toEqual({ time: "09:05", period: null });
  });

  it("formats 12-hour time including midnight and noon", () => {
    expect(formatClockTime(at(0, 1, 0), { hour12: true, showSeconds: false })).toEqual({ time: "12:01", period: "AM" });
    expect(formatClockTime(at(12, 0, 0), { hour12: true, showSeconds: false })).toEqual({ time: "12:00", period: "PM" });
    expect(formatClockTime(at(23, 59, 0), { hour12: true, showSeconds: false })).toEqual({ time: "11:59", period: "PM" });
  });

  it("computes smoothly sweeping hand angles", () => {
    expect(handAngles(at(3, 0, 0))).toEqual({ hour: 90, minute: 0, second: 0 });
    const half = handAngles(at(6, 30, 30));
    expect(half.hour).toBeCloseTo(195.25);
    expect(half.minute).toBeCloseTo(183);
    expect(half.second).toBe(180);
  });
});
