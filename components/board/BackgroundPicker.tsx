"use client";

import { ImageUp, Replace, Trash, Wallpaper } from "lucide-react";
import { useRef } from "react";
import { ColorSwatches, FieldGroup, Segmented, SliderField } from "@/components/ui/controls";
import { Popover } from "@/components/ui/Popover";
import { Tooltip } from "@/components/ui/Tooltip";
import { useCan } from "@/features/permissions/store";
import {
  BACKGROUND_COLORS,
  BACKGROUND_PRESETS,
  matchPreset,
  PATTERN_COLORS,
  PATTERN_DEFAULTS,
} from "@/features/whiteboard/background/presets";
import { backgroundPreviewStyle } from "@/features/whiteboard/background/preview";
import { useAssetImage } from "@/features/whiteboard/insert/asset-cache";
import { IMAGE_ACCEPT } from "@/features/whiteboard/insert/image-validation";
import { setBackgroundImage } from "@/features/whiteboard/insert/insert-actions";
import { getActivePage, useBoardStore } from "@/features/whiteboard/store/board-store";
import type { BackgroundFit, BackgroundPattern, PageBackground } from "@/features/whiteboard/types";
import { cn } from "@/lib/cn";

const PATTERN_OPTIONS: { value: BackgroundPattern["type"]; label: string }[] = [
  { value: "none", label: "None" },
  { value: "grid", label: "Grid" },
  { value: "dots", label: "Dots" },
  { value: "lines", label: "Lines" },
  { value: "graph", label: "Graph" },
];

const FIT_OPTIONS: { value: BackgroundFit; label: string }[] = [
  { value: "cover", label: "Cover" },
  { value: "contain", label: "Contain" },
  { value: "stretch", label: "Stretch" },
  { value: "center", label: "Center" },
  { value: "tile", label: "Tile" },
];

const percent = (v: number) => `${Math.round(v * 100)}%`;
const px = (v: number) => `${v}px`;

function BackgroundEditor() {
  // Select only what is shown: this stays mounted (hidden) and must not re-render on every stroke.
  const background = useBoardStore((s) => getActivePage(s).background);
  const pageName = useBoardStore((s) => getActivePage(s).name);
  const setPageBackground = useBoardStore((s) => s.setPageBackground);
  const asset = useBoardStore((s) => (background.image ? s.doc.assets[background.image.assetId] : undefined));
  const { status } = useAssetImage(asset);
  const fileRef = useRef<HTMLInputElement>(null);
  const activePreset = matchPreset(background);
  const { pattern, image } = background;

  /** Each control merges its drag into one undo step via its own key. */
  const update = (next: PageBackground, key: string) => setPageBackground(next, `bg:${key}`);
  const updatePattern = (patch: Partial<BackgroundPattern>, key: string) =>
    update({ ...background, pattern: { ...pattern, ...patch } as BackgroundPattern }, key);
  const updateImage = (patch: Partial<NonNullable<PageBackground["image"]>>, key: string) =>
    image && update({ ...background, image: { ...image, ...patch } }, key);

  return (
    <div className="space-y-4">
      <div>
        <p className="font-semibold">Page background</p>
        <p className="text-xs text-ink-faint">Applies to {pageName} only</p>
      </div>

      <div role="group" aria-label="Presets" className="grid grid-cols-4 gap-2">
        {BACKGROUND_PRESETS.map((preset) => {
          const active = activePreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              onClick={() => update({ ...preset.background, image: background.image }, `preset:${preset.id}`)}
              className="focus-ring group flex flex-col items-center gap-1 rounded-md p-0.5"
            >
              <span
                aria-hidden
                style={backgroundPreviewStyle(preset.background)}
                className={cn(
                  "block h-9 w-full rounded-[5px] border",
                  active ? "border-accent ring-2 ring-accent/30" : "border-line group-hover:border-line-strong",
                )}
              />
              <span className={cn("w-full truncate text-center text-[11px] leading-tight", active ? "font-semibold text-ink" : "text-ink-muted")}>
                {preset.name}
              </span>
            </button>
          );
        })}
      </div>

      <div className="border-t border-line pt-3">
        <FieldGroup title="Colour">
          <ColorSwatches
            label="Background colour"
            colors={BACKGROUND_COLORS}
            value={background.color}
            onChange={(color) => update({ ...background, color }, "color")}
            allowCustom
          />
        </FieldGroup>
      </div>

      <div className="space-y-3 border-t border-line pt-3">
        <FieldGroup title="Pattern">
          <Segmented
            label="Pattern type"
            value={pattern.type}
            options={PATTERN_OPTIONS}
            onChange={(type) => update({ ...background, pattern: PATTERN_DEFAULTS[type] }, `pattern:${type}`)}
          />
        </FieldGroup>
        {pattern.type !== "none" && (
          <div className="space-y-2.5">
            {(pattern.type === "grid" || pattern.type === "graph") && (
              <SliderField label="Cell size" value={pattern.size} min={8} max={120} step={2} format={px} onChange={(size) => updatePattern({ size }, "size")} />
            )}
            {(pattern.type === "dots" || pattern.type === "lines") && (
              <SliderField
                label="Spacing"
                value={pattern.spacing}
                min={8}
                max={120}
                step={2}
                format={px}
                onChange={(spacing) => updatePattern({ spacing }, "spacing")}
              />
            )}
            {pattern.type === "dots" && (
              <SliderField
                label="Dot size"
                value={pattern.dotSize}
                min={1}
                max={10}
                step={0.5}
                format={px}
                onChange={(dotSize) => updatePattern({ dotSize }, "dot")}
              />
            )}
            <SliderField
              label="Opacity"
              value={pattern.opacity}
              min={0.05}
              max={1}
              step={0.05}
              format={percent}
              onChange={(opacity) => updatePattern({ opacity }, "pattern-opacity")}
            />
            <ColorSwatches
              label="Pattern colour"
              colors={PATTERN_COLORS}
              value={pattern.color}
              onChange={(color) => updatePattern({ color }, "pattern-color")}
              allowCustom
            />
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-line pt-3">
        <FieldGroup title="Image">
          {!image ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="focus-ring flex h-9 w-full items-center justify-center gap-2 rounded-md border border-dashed border-line-strong text-sm text-ink-muted transition-colors hover:border-accent hover:text-ink"
            >
              <ImageUp aria-hidden className="size-4" strokeWidth={1.75} />
              Upload background image
            </button>
          ) : (
            <div className="space-y-2.5">
              {status === "error" && (
                <p role="alert" className="text-xs text-danger">
                  This background image couldn&apos;t be loaded. Replace or remove it.
                </p>
              )}
              <Segmented label="Image fit" value={image.fit} options={FIT_OPTIONS} onChange={(fit) => updateImage({ fit }, "fit")} />
              <SliderField label="Opacity" value={image.opacity} min={0.1} max={1} step={0.05} format={percent} onChange={(opacity) => updateImage({ opacity }, "img-opacity")} />
              <SliderField label="Blur" value={image.blur} min={0} max={20} step={1} format={px} onChange={(blur) => updateImage({ blur }, "blur")} />
              <SliderField
                label="Brightness"
                value={image.brightness}
                min={0.4}
                max={1.6}
                step={0.05}
                format={percent}
                onChange={(brightness) => updateImage({ brightness }, "brightness")}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="focus-ring flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-line-strong text-sm text-ink transition-colors hover:bg-subtle"
                >
                  <Replace aria-hidden className="size-4" strokeWidth={1.75} />
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => update({ ...background, image: null }, "remove-image")}
                  className="focus-ring flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-line-strong text-sm text-danger transition-colors hover:bg-danger-soft"
                >
                  <Trash aria-hidden className="size-4" strokeWidth={1.75} />
                  Remove
                </button>
              </div>
              <p className="text-xs leading-relaxed text-ink-faint">
                The image is fixed to the page and stays behind your drawings, so notes stay aligned when you zoom.
              </p>
            </div>
          )}
        </FieldGroup>
        <input
          ref={fileRef}
          type="file"
          accept={IMAGE_ACCEPT}
          hidden
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void setBackgroundImage(file);
          }}
        />
      </div>
    </div>
  );
}

/** Bottom-bar entry point for the per-page background. */
export function BackgroundPicker() {
  const canManage = useCan({ type: "page.manage" });
  return (
    <Popover
      label="Page background"
      side="top"
      align="end"
      className="w-[min(21rem,calc(100vw-1rem))]"
      trigger={(props) => (
        <Tooltip label={canManage ? "Page background" : "Background (teacher only)"} side="top">
          <button
            {...props}
            type="button"
            disabled={!canManage}
            aria-label="Page background"
            className="focus-ring flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-ink-muted transition-colors hover:bg-hover hover:text-ink disabled:pointer-events-none disabled:opacity-40"
          >
            <Wallpaper aria-hidden className="size-4" strokeWidth={1.75} />
            <span className="max-md:sr-only">Background</span>
          </button>
        </Tooltip>
      )}
    >
      <BackgroundEditor />
    </Popover>
  );
}
