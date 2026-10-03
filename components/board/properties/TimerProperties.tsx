"use client";

import { Flag, RotateCcw } from "lucide-react";
import { useId } from "react";
import { Segmented, SwitchField } from "@/components/ui/controls";
import { TIMER_PRESETS_MIN, WIDGET_LABEL_MAX_LENGTH } from "@/features/whiteboard/constants";
import { useBoardStore } from "@/features/whiteboard/store/board-store";
import type { TimerElement } from "@/features/whiteboard/types";
import { timerPrimaryAction, useTimerActions } from "@/features/whiteboard/widgets/TimerControls";
import { formatDuration, joinDuration, splitDuration } from "@/features/whiteboard/widgets/time";

const STATUS_LABEL = { idle: "Ready", running: "Running", paused: "Paused", done: "Time's up" } as const;

function DurationInput({ label, value, max, disabled, onChange }: { label: string; value: number; max: number; disabled: boolean; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <label htmlFor={id} className="text-[11px] text-ink-faint">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="focus-ring block h-8 w-full rounded-md border border-line-strong bg-surface px-2 text-sm text-ink tabular-nums disabled:opacity-50"
      />
    </div>
  );
}

export function TimerProperties({ element }: { element: TimerElement }) {
  const updateElement = useBoardStore((s) => s.updateElement);
  const { runtime, canStart, primary, reset, lap } = useTimerActions(element);
  const labelId = useId();
  const statusId = useId();
  const update = (recipe: (el: TimerElement) => TimerElement, key?: string) =>
    updateElement(element.id, (el) => (el.type === "timer" ? recipe(el) : el), key ? `${key}:${element.id}` : undefined);

  const countdown = element.mode === "countdown";
  // Configuration is frozen mid-run so the displayed time can't jump.
  const locked = runtime.status === "running" || runtime.status === "paused";
  const { hours, minutes, seconds } = splitDuration(element.durationMs);
  const setDuration = (h: number, m: number, s: number) => update((el) => ({ ...el, durationMs: joinDuration(h, m, s) }), "duration");
  const action = timerPrimaryAction(runtime.status);

  return (
    <div className="space-y-4">
      <Segmented
        label="Mode"
        value={element.mode}
        disabled={runtime.status !== "idle"}
        options={[
          { value: "countdown", label: "Timer" },
          { value: "stopwatch", label: "Stopwatch" },
        ]}
        onChange={(mode) => update((el) => ({ ...el, mode, durationMs: mode === "countdown" && el.durationMs === 0 ? 5 * 60_000 : el.durationMs }))}
      />

      {countdown && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <DurationInput label="Hours" value={hours} max={23} disabled={locked} onChange={(h) => setDuration(h, minutes, seconds)} />
            <DurationInput label="Minutes" value={minutes} max={59} disabled={locked} onChange={(m) => setDuration(hours, m, seconds)} />
            <DurationInput label="Seconds" value={seconds} max={59} disabled={locked} onChange={(s) => setDuration(hours, minutes, s)} />
          </div>
          <div role="group" aria-label="Quick durations" className="flex flex-wrap gap-1.5">
            {TIMER_PRESETS_MIN.map((min) => {
              const active = element.durationMs === min * 60_000;
              return (
                <button
                  key={min}
                  type="button"
                  disabled={locked}
                  aria-pressed={active}
                  onClick={() => update((el) => ({ ...el, durationMs: min * 60_000 }))}
                  className="focus-ring h-7 rounded-md border border-line px-2 text-xs text-ink-muted transition-colors hover:bg-subtle hover:text-ink aria-pressed:border-accent aria-pressed:font-semibold aria-pressed:text-accent disabled:pointer-events-none disabled:opacity-40"
                >
                  {min} min
                </button>
              );
            })}
          </div>
          {locked && <p className="text-xs text-ink-faint">Reset the timer to change its duration.</p>}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={primary}
            disabled={runtime.status === "done" || (runtime.status === "idle" && !canStart)}
            aria-describedby={statusId}
            className="focus-ring flex h-9 flex-1 items-center justify-center gap-2 rounded-md bg-accent text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-40"
          >
            <action.icon aria-hidden className="size-4" strokeWidth={2} />
            {action.label}
          </button>
          {!countdown && (
            <button
              type="button"
              onClick={lap}
              disabled={runtime.status !== "running"}
              className="focus-ring flex h-9 items-center gap-1.5 rounded-md border border-line-strong px-3 text-sm text-ink transition-colors hover:bg-subtle disabled:pointer-events-none disabled:opacity-40"
            >
              <Flag aria-hidden className="size-4" strokeWidth={1.75} />
              Lap
            </button>
          )}
          <button
            type="button"
            onClick={reset}
            disabled={runtime.status === "idle"}
            className="focus-ring flex h-9 items-center gap-1.5 rounded-md border border-line-strong px-3 text-sm text-ink transition-colors hover:bg-subtle disabled:pointer-events-none disabled:opacity-40"
          >
            <RotateCcw aria-hidden className="size-4" strokeWidth={1.75} />
            Reset
          </button>
        </div>
        <p id={statusId} role="status" className="text-xs text-ink-muted">
          {STATUS_LABEL[runtime.status]}
          {countdown && runtime.status === "idle" && !canStart && " · set a duration to start"}
        </p>
      </div>

      {!countdown && runtime.laps.length > 0 && (
        <ol aria-label="Laps" className="max-h-32 divide-y divide-line overflow-y-auto rounded-md border border-line text-xs tabular-nums">
          {runtime.laps
            .map((total, i) => ({ n: i + 1, total, split: total - (runtime.laps[i - 1] ?? 0) }))
            .reverse()
            .map(({ n, total, split }) => (
              <li key={n} className="flex justify-between px-2.5 py-1.5">
                <span className="text-ink-faint">Lap {n}</span>
                <span className="text-ink">{formatDuration(split, { tenths: true })}</span>
                <span className="text-ink-muted">{formatDuration(total, { tenths: true })}</span>
              </li>
            ))}
        </ol>
      )}

      <div className="space-y-1.5">
        <label htmlFor={labelId} className="text-xs font-medium text-ink-faint">
          Label
        </label>
        <input
          id={labelId}
          value={element.label}
          maxLength={WIDGET_LABEL_MAX_LENGTH}
          placeholder={countdown ? "Timer" : "Stopwatch"}
          onChange={(event) => update((el) => ({ ...el, label: event.target.value }), "label")}
          className="focus-ring block h-8 w-full rounded-md border border-line-strong bg-surface px-2.5 text-sm text-ink placeholder:text-ink-faint"
        />
      </div>
      {countdown && <SwitchField label="Chime when finished" checked={element.sound} onChange={(sound) => update((el) => ({ ...el, sound }))} />}
    </div>
  );
}
