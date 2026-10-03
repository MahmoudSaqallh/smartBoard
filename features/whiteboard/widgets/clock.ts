/** Pure clock formatting and geometry; locale-independent digits for a stable layout. */

const pad = (n: number) => String(n).padStart(2, "0");

export interface ClockFormat {
  hour12: boolean;
  showSeconds: boolean;
}

/** "14:05", "2:05:09" + "PM", etc. The period is returned separately so it can be drawn smaller. */
export function formatClockTime(date: Date, { hour12, showSeconds }: ClockFormat): { time: string; period: string | null } {
  const h = date.getHours();
  const hours = hour12 ? h % 12 || 12 : h;
  const head = hour12 ? String(hours) : pad(hours);
  const time = `${head}:${pad(date.getMinutes())}${showSeconds ? `:${pad(date.getSeconds())}` : ""}`;
  return { time, period: hour12 ? (h < 12 ? "AM" : "PM") : null };
}

const dateFormat = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });

export function formatClockDate(date: Date): string {
  return dateFormat.format(date);
}

/** Hand angles in degrees clockwise from 12 o'clock. Hours and minutes sweep smoothly. */
export function handAngles(date: Date): { hour: number; minute: number; second: number } {
  const seconds = date.getSeconds();
  const minutes = date.getMinutes() + seconds / 60;
  return {
    hour: ((date.getHours() % 12) + minutes / 60) * 30,
    minute: minutes * 6,
    second: seconds * 6,
  };
}
