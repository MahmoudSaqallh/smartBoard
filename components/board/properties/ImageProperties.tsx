"use client";

import { Replace } from "lucide-react";
import { useRef } from "react";
import { FieldGroup, SliderField } from "@/components/ui/controls";
import { IMAGE_ACCEPT } from "@/features/whiteboard/insert/image-validation";
import { replaceImage } from "@/features/whiteboard/insert/insert-actions";
import { useBoardStore } from "@/features/whiteboard/store/board-store";
import type { ImageCrop, ImageElement } from "@/features/whiteboard/types";
import { applyImageCrop } from "@/features/whiteboard/utils/elements";

const NO_CROP: ImageCrop = { top: 0, right: 0, bottom: 0, left: 0 };
const EDGES: { key: keyof ImageCrop; label: string }[] = [
  { key: "top", label: "Top" },
  { key: "right", label: "Right" },
  { key: "bottom", label: "Bottom" },
  { key: "left", label: "Left" },
];
const percent = (v: number) => `${Math.round(v * 100)}%`;

export function ImageProperties({ element }: { element: ImageElement }) {
  const updateElement = useBoardStore((s) => s.updateElement);
  const asset = useBoardStore((s) => s.doc.assets[element.assetId]);
  const fileRef = useRef<HTMLInputElement>(null);
  const crop = element.crop ?? NO_CROP;
  const update = (recipe: (el: ImageElement) => ImageElement, key: string) =>
    updateElement(element.id, (el) => (el.type === "image" ? recipe(el) : el), `${key}:${element.id}`);

  return (
    <div className="space-y-4">
      {asset && (
        <p className="text-xs text-ink-faint tabular-nums">
          {asset.width} × {asset.height} px · {asset.mimeType.replace("image/", "").toUpperCase()}
        </p>
      )}

      <SliderField
        label="Opacity"
        value={element.opacity}
        min={0.1}
        max={1}
        step={0.05}
        format={percent}
        onChange={(opacity) => update((el) => ({ ...el, opacity }), "opacity")}
      />

      <FieldGroup
        title="Crop"
        action={
          element.crop && (
            <button
              type="button"
              onClick={() => update((el) => applyImageCrop(el, null), "crop-reset")}
              className="focus-ring rounded px-1 text-xs text-accent hover:underline"
            >
              Reset
            </button>
          )
        }
      >
        <div className="space-y-2">
          {EDGES.map(({ key, label }) => (
            <SliderField
              key={key}
              label={label}
              value={crop[key]}
              min={0}
              max={0.45}
              step={0.01}
              format={percent}
              onChange={(value) => update((el) => applyImageCrop(el, { ...(el.crop ?? NO_CROP), [key]: value }), "crop")}
            />
          ))}
        </div>
      </FieldGroup>

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="focus-ring flex h-8 w-full items-center justify-center gap-2 rounded-md border border-line-strong text-sm font-medium text-ink transition-colors hover:bg-subtle"
      >
        <Replace aria-hidden className="size-4" strokeWidth={1.75} />
        Replace image
      </button>
      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_ACCEPT}
        hidden
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void replaceImage(element.id, file);
        }}
      />
    </div>
  );
}
