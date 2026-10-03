"use client";

import { RefreshCw } from "lucide-react";
import { useId, useState } from "react";
import { QR_LABEL_MAX_LENGTH, QR_MAX_LENGTH } from "@/features/whiteboard/constants";
import { looksLikeUrl, validateQrContent } from "@/features/whiteboard/insert/qr";
import { useBoardStore } from "@/features/whiteboard/store/board-store";
import type { QrElement } from "@/features/whiteboard/types";

/** Edits are drafted locally and applied together with "Update QR code" (one undo step). */
export function QrProperties({ element }: { element: QrElement }) {
  const updateElement = useBoardStore((s) => s.updateElement);
  const [content, setContent] = useState(element.content);
  const [label, setLabel] = useState(element.label);
  const contentId = useId();
  const labelId = useId();
  const hintId = useId();

  const error = validateQrContent(content);
  const changed = content.trim() !== element.content || label.trim() !== element.label;

  const apply = () => {
    if (error || !changed) return;
    updateElement(element.id, (el) => (el.type === "qr" ? { ...el, content: content.trim(), label: label.trim() } : el));
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor={contentId} className="text-xs font-medium text-ink-faint">
          Content
        </label>
        <textarea
          id={contentId}
          value={content}
          rows={3}
          maxLength={QR_MAX_LENGTH}
          aria-invalid={error ? true : undefined}
          aria-describedby={hintId}
          onChange={(event) => setContent(event.target.value)}
          className="focus-ring block w-full resize-none rounded-md border border-line-strong bg-surface px-2.5 py-2 text-sm text-ink aria-invalid:border-danger"
        />
        <p id={hintId} className={`text-xs ${error ? "text-danger" : "text-ink-faint"}`}>
          {error ?? (looksLikeUrl(content) ? "Encodes a link" : "Encodes plain text")}
        </p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={labelId} className="text-xs font-medium text-ink-faint">
          Caption
        </label>
        <input
          id={labelId}
          value={label}
          maxLength={QR_LABEL_MAX_LENGTH}
          placeholder="None"
          onChange={(event) => setLabel(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && apply()}
          className="focus-ring block h-8 w-full rounded-md border border-line-strong bg-surface px-2.5 text-sm text-ink placeholder:text-ink-faint"
        />
      </div>
      <button
        type="button"
        onClick={apply}
        disabled={Boolean(error) || !changed}
        className="focus-ring flex h-8 w-full items-center justify-center gap-2 rounded-md bg-accent text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-40"
      >
        <RefreshCw aria-hidden className="size-4" strokeWidth={2} />
        Update QR code
      </button>
    </div>
  );
}
