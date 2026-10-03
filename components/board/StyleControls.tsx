"use client";

import { useId, type ReactNode } from "react";
import { ColorSwatches, SwitchField } from "@/components/ui/controls";
import {
  FONT_SIZE_PRESETS,
  INK_COLORS,
  MAX_STROKE_WIDTH,
  MIN_STROKE_WIDTH,
  STICKY_COLORS,
  STROKE_WIDTH_PRESETS,
} from "@/features/whiteboard/constants";
import type { StyleContext } from "@/features/whiteboard/hooks/useStyleContext";
import { useBoardStore } from "@/features/whiteboard/store/board-store";
import { cn } from "@/lib/cn";

function Section({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <div role="group" aria-labelledby={id} className="space-y-2">
      <h3 id={id} className="text-xs font-medium text-ink-faint">
        {title}
      </h3>
      {children}
    </div>
  );
}

function SegmentedRadio<T extends number>({
  name,
  options,
  value,
  onChange,
  render,
}: {
  name: string;
  options: { label: string; name?: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  render: (option: { label: string; value: T }) => ReactNode;
}) {
  return (
    <div className="grid grid-flow-col gap-1 rounded-lg bg-subtle p-0.5">
      {options.map((option) => (
        <label key={option.value} className="relative cursor-pointer">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="peer sr-only"
            aria-label={option.name ?? option.label}
          />
          <span
            className={cn(
              "flex h-7 items-center justify-center rounded-md text-xs text-ink-muted transition-colors",
              "peer-checked:bg-surface peer-checked:font-semibold peer-checked:text-ink peer-checked:shadow-[0_0_0_1px_var(--color-line)]",
              "peer-focus-visible:outline-2 peer-focus-visible:outline-accent hover:text-ink",
            )}
          >
            {render(option)}
          </span>
        </label>
      ))}
    </div>
  );
}

interface StyleControlsProps {
  context: StyleContext;
}

/** Colour, stroke, fill and text size controls for the selection or the active tool. */
export function StyleControls({ context }: StyleControlsProps) {
  const uid = useId();
  const setStyle = useBoardStore((s) => s.setStyle);
  const { capabilities: can, values } = context;

  if (!Object.values(can).some(Boolean)) return null;

  return (
    <div className="space-y-4">
      {can.color && (
        <Section title="Colour" id={`${uid}-color`}>
          <ColorSwatches label="Colour" colors={INK_COLORS} value={values.color} onChange={(color) => setStyle({ color })} />
        </Section>
      )}

      {can.stickyColor && (
        <Section title="Note colour" id={`${uid}-sticky`}>
          <ColorSwatches
            label="Note colour"
            colors={STICKY_COLORS}
            value={values.stickyColor}
            onChange={(stickyColor) => setStyle({ stickyColor })}
          />
        </Section>
      )}

      {can.strokeWidth && (
        <Section title="Stroke" id={`${uid}-stroke`}>
          <SegmentedRadio
            name={`${uid}-stroke-radio`}
            options={STROKE_WIDTH_PRESETS}
            value={values.strokeWidth}
            onChange={(strokeWidth) => setStyle({ strokeWidth })}
            render={(option) => (
              <span
                aria-hidden
                className="block w-5 rounded-full bg-current"
                style={{ height: Math.max(1.5, Math.min(option.value, 10)) }}
              />
            )}
          />
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={MIN_STROKE_WIDTH}
              max={MAX_STROKE_WIDTH}
              step={1}
              value={values.strokeWidth}
              onChange={(event) => setStyle({ strokeWidth: Number(event.target.value) })}
              aria-label="Stroke width"
              aria-valuetext={`${values.strokeWidth} pixels`}
              className="focus-ring h-1.5 flex-1 cursor-pointer accent-accent"
            />
            <output className="w-9 text-end text-xs text-ink-muted tabular-nums">{values.strokeWidth}px</output>
          </div>
        </Section>
      )}

      {can.filled && <SwitchField label="Fill shape" checked={values.filled} onChange={(filled) => setStyle({ filled })} />}

      {can.fontSize && (
        <Section title="Text size" id={`${uid}-font`}>
          <SegmentedRadio
            name={`${uid}-font-radio`}
            options={FONT_SIZE_PRESETS}
            value={
              FONT_SIZE_PRESETS.reduce((closest, preset) =>
                Math.abs(preset.value - values.fontSize) < Math.abs(closest.value - values.fontSize) ? preset : closest,
              ).value
            }
            onChange={(fontSize) => setStyle({ fontSize })}
            render={(option) => option.label}
          />
        </Section>
      )}
    </div>
  );
}
