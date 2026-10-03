"use client";

import gsap from "gsap";
import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { QR_LABEL_MAX_LENGTH, QR_MAX_LENGTH } from "@/features/whiteboard/constants";
import { insertQr } from "@/features/whiteboard/insert/insert-actions";
import { looksLikeUrl, validateQrContent } from "@/features/whiteboard/insert/qr";
import { prefersReducedMotion } from "@/lib/hooks/useMediaQuery";
import { MOTION } from "@/lib/motion";
import { QrPreview } from "./QrPreview";

const LABEL_SUGGESTIONS = ["Scan to open lesson", "Homework", "Join session"];

interface QrDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Compact modal to create a QR code: content, optional caption, live preview. */
export function QrDialog({ open, onClose }: QrDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const contentId = useId();
  const labelId = useId();
  const errorId = useId();
  const [content, setContent] = useState("");
  const [label, setLabel] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      if (!prefersReducedMotion()) {
        gsap.fromTo(dialog, { opacity: 0, y: 8, scale: 0.985 }, { opacity: 1, y: 0, scale: 1, duration: MOTION.base, ease: MOTION.easeOutStrong, clearProps: "transform,opacity" });
      }
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const error = validateQrContent(content);
  const showError = touched && error;

  const close = () => {
    setContent("");
    setLabel("");
    setTouched(false);
    onClose();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (error) return;
    if (insertQr(content, label)) close();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${contentId}-title`}
      onClose={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      className="m-auto w-[min(34rem,calc(100vw-1rem))] rounded-[10px] border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-ink/30 max-sm:mb-2 max-sm:w-[calc(100vw-1rem)]"
    >
      <form onSubmit={submit} noValidate>
        <div className="flex items-center justify-between border-b border-line py-2 ps-5 pe-2">
          <h2 id={`${contentId}-title`} className="text-sm font-semibold">
            Add QR code
          </h2>
          <IconButton label="Close" size="sm" onClick={close}>
            <X aria-hidden className="size-4" strokeWidth={1.75} />
          </IconButton>
        </div>

        <div className="grid gap-5 px-5 py-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor={contentId} className="text-xs font-medium text-ink-muted">
                Link or text
              </label>
              <textarea
                id={contentId}
                value={content}
                maxLength={QR_MAX_LENGTH}
                rows={3}
                required
                placeholder="https://… or any text"
                aria-invalid={showError ? true : undefined}
                aria-describedby={errorId}
                onChange={(event) => setContent(event.target.value)}
                onBlur={() => setTouched(true)}
                className="focus-ring block w-full resize-none rounded-md border border-line-strong bg-surface px-2.5 py-2 text-sm text-ink placeholder:text-ink-faint aria-invalid:border-danger"
              />
              <p id={errorId} className={`text-xs ${showError ? "text-danger" : "text-ink-faint"}`}>
                {showError
                  ? error
                  : content.trim()
                    ? looksLikeUrl(content)
                      ? "Encodes a link. Phones will offer to open it."
                      : "Encodes plain text."
                    : "Lesson links, meeting links or any short text."}
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor={labelId} className="text-xs font-medium text-ink-muted">
                Caption <span className="font-normal text-ink-faint">(optional)</span>
              </label>
              <input
                id={labelId}
                value={label}
                maxLength={QR_LABEL_MAX_LENGTH}
                placeholder="Shown under the code"
                onChange={(event) => setLabel(event.target.value)}
                className="focus-ring block h-9 w-full rounded-md border border-line-strong bg-surface px-2.5 text-sm text-ink placeholder:text-ink-faint"
              />
              <div className="flex flex-wrap gap-1.5">
                {LABEL_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setLabel(suggestion)}
                    className="focus-ring rounded-md border border-line px-2 py-1 text-xs text-ink-muted transition-colors hover:bg-subtle hover:text-ink"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1.5 max-sm:order-first">
            <QrPreview content={content} />
            {label.trim() && <p className="max-w-[148px] truncate text-xs font-semibold text-ink">{label.trim()}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button
            type="button"
            onClick={close}
            className="focus-ring h-9 rounded-md px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-subtle hover:text-ink"
          >
            Cancel
          </button>
          {/* Always enabled: submitting invalid content shows why, instead of a silently dead button. */}
          <button
            type="submit"
            className="focus-ring h-9 rounded-md bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Insert
          </button>
        </div>
      </form>
    </dialog>
  );
}
