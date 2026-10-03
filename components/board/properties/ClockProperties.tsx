"use client";

import { Segmented, SwitchField } from "@/components/ui/controls";
import { useBoardStore } from "@/features/whiteboard/store/board-store";
import type { ClockElement } from "@/features/whiteboard/types";

type Size = "s" | "m" | "l";
const DIGITAL_HEIGHTS: Record<Size, number> = { s: 72, m: 104, l: 150 };
const ANALOG_SIDES: Record<Size, number> = { s: 140, m: 200, l: 280 };

/** Resizes around the element's centre so it doesn't jump. */
function resized(el: ClockElement, width: number, height: number): ClockElement {
  return { ...el, x: el.x + (el.width - width) / 2, y: el.y + (el.height - height) / 2, width, height };
}

function currentSize(el: ClockElement): Size | null {
  const table = el.variant === "analog" ? ANALOG_SIDES : DIGITAL_HEIGHTS;
  const entry = (Object.entries(table) as [Size, number][]).find(([, v]) => Math.abs(v - el.height) < 1);
  return entry?.[0] ?? null;
}

export function ClockProperties({ element }: { element: ClockElement }) {
  const updateElement = useBoardStore((s) => s.updateElement);
  const update = (recipe: (el: ClockElement) => ClockElement) =>
    updateElement(element.id, (el) => (el.type === "clock" ? recipe(el) : el));
  const digital = element.variant === "digital";
  const size = currentSize(element);

  return (
    <div className="space-y-3">
      <Segmented
        label="Clock type"
        value={element.variant}
        options={[
          { value: "digital", label: "Digital" },
          { value: "analog", label: "Analog" },
        ]}
        onChange={(variant) =>
          update((el) => {
            if (variant === "analog") {
              const side = ANALOG_SIDES.m;
              return { ...resized(el, side, side), variant, showSeconds: true };
            }
            return { ...resized(el, DIGITAL_HEIGHTS.m * 2.7, DIGITAL_HEIGHTS.m), variant };
          })
        }
      />
      {digital && (
        <Segmented
          label="Time format"
          value={element.hour12 ? "12" : "24"}
          options={[
            { value: "24", label: "24-hour" },
            { value: "12", label: "12-hour" },
          ]}
          onChange={(value) => update((el) => ({ ...el, hour12: value === "12" }))}
        />
      )}
      <SwitchField
        label={digital ? "Show seconds" : "Seconds hand"}
        checked={element.showSeconds}
        onChange={(showSeconds) => update((el) => ({ ...el, showSeconds }))}
      />
      {digital && <SwitchField label="Show date" checked={element.showDate} onChange={(showDate) => update((el) => ({ ...el, showDate }))} />}
      <div className="space-y-1.5">
        <p className="text-xs text-ink-muted">Size</p>
        <Segmented
          label="Clock size"
          value={size ?? ("" as Size)}
          options={[
            { value: "s", label: "Small" },
            { value: "m", label: "Medium" },
            { value: "l", label: "Large" },
          ]}
          onChange={(next) =>
            update((el) => {
              if (el.variant === "analog") return resized(el, ANALOG_SIDES[next], ANALOG_SIDES[next]);
              const height = DIGITAL_HEIGHTS[next];
              return resized(el, height * (el.width / el.height), height);
            })
          }
        />
      </div>
    </div>
  );
}
