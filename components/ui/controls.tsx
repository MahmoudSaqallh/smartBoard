"use client";

import { Check } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Compact, labelled form controls for panels and popovers. All are native
 * inputs (radio groups, checkbox switches, ranges), so keyboard behaviour and
 * screen-reader semantics come for free.
 */

export function FieldGroup({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 id={id} className="text-xs font-medium text-ink-faint">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  disabled?: boolean;
}

export function SliderField({ label, value, min, max, step = 1, onChange, format = String, disabled }: SliderFieldProps) {
  const id = useId();
  return (
    <div className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2">
      <label htmlFor={id} className="truncate text-xs text-ink-muted">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={format(value)}
        onChange={(event) => onChange(Number(event.target.value))}
        className="focus-ring h-1.5 w-full cursor-pointer accent-accent disabled:cursor-not-allowed disabled:opacity-40"
      />
      <output htmlFor={id} className="text-end text-xs text-ink-muted tabular-nums">
        {format(value)}
      </output>
    </div>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function Segmented<T extends string>({ label, value, options, onChange, disabled }: SegmentedProps<T>) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex gap-0.5 rounded-lg bg-subtle p-0.5", disabled && "opacity-50")}>
      {options.map((option) => (
        <label key={option.value} className="relative min-w-0 flex-1 cursor-pointer">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={disabled}
            onChange={() => onChange(option.value)}
            className="peer sr-only"
          />
          <span
            className={cn(
              "flex h-7 items-center justify-center truncate rounded-md px-1.5 text-xs text-ink-muted transition-colors",
              "peer-checked:bg-surface peer-checked:font-semibold peer-checked:text-ink peer-checked:shadow-[0_0_0_1px_var(--color-line)]",
              "peer-focus-visible:outline-2 peer-focus-visible:outline-accent hover:text-ink",
            )}
          >
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}

export function SwitchField({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex items-center justify-between gap-3", disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
      <span className="text-xs text-ink-muted">{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
          checked ? "bg-accent" : "bg-line-strong",
        )}
      >
        <span
          className={cn(
            "absolute start-0.5 top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform",
            checked && "translate-x-4 rtl:-translate-x-4",
          )}
        />
      </span>
    </label>
  );
}

interface ColorSwatchesProps {
  label: string;
  colors: { name: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
  /** Adds a native colour picker for any custom value. */
  allowCustom?: boolean;
}

function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 186;
}

export function ColorSwatches({ label, colors, value, onChange, allowCustom }: ColorSwatchesProps) {
  const name = useId();
  const customId = useId();
  const isCustom = !colors.some((c) => c.value.toLowerCase() === value.toLowerCase());
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {colors.map((color) => {
        const checked = color.value.toLowerCase() === value.toLowerCase();
        return (
          <label key={color.value} className="cursor-pointer" title={color.name}>
            <input
              type="radio"
              name={name}
              checked={checked}
              onChange={() => onChange(color.value)}
              aria-label={color.name}
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-md border border-black/10",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
                checked && "ring-2 ring-ink/80 ring-offset-2 ring-offset-surface",
              )}
              style={{ backgroundColor: color.value }}
            >
              {checked && <Check aria-hidden className={cn("size-3.5", isLight(color.value) ? "text-ink" : "text-white")} strokeWidth={3} />}
            </span>
          </label>
        );
      })}
      {allowCustom && (
        <label
          htmlFor={customId}
          title="Custom colour"
          className={cn(
            "relative flex size-7 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-black/10",
            "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
            isCustom && "ring-2 ring-ink/80 ring-offset-2 ring-offset-surface",
          )}
          style={{
            background: isCustom ? value : "conic-gradient(#ef4444, #f59e0b, #22c55e, #3b82f6, #8b5cf6, #ef4444)",
          }}
        >
          <span className="sr-only">Custom colour</span>
          <input
            id={customId}
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      )}
    </div>
  );
}
