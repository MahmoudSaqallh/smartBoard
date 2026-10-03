"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { useBoardStore } from "@/features/whiteboard/store/board-store";

const TOAST_MS = 5000;

/** Transient feedback (cleared page, export result) with an optional Undo. */
export function BoardToast() {
  const toast = useBoardStore((s) => s.toast);
  const dismiss = useBoardStore((s) => s.dismissToast);
  const undo = useBoardStore((s) => s.undo);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(dismiss, TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast, dismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-4 md:bottom-16"
    >
      {toast && (
        <div
          key={toast.id}
          className="pointer-events-auto flex max-w-md items-center gap-3 rounded-lg bg-ink py-2 ps-3.5 pe-2 text-sm text-white shadow-pop"
        >
          <span>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                const { action } = toast;
                if (action === "undo") undo();
                else action?.run();
                dismiss();
              }}
              className="rounded-md px-2 py-1 font-semibold text-[#a9bcff] outline-offset-2 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
            >
              {toast.action === "undo" ? "Undo" : toast.action.label}
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismiss}
            className="rounded-md p-1 text-white/70 outline-offset-2 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
          >
            <X aria-hidden className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      )}
    </div>
  );
}

/** Screen-reader announcements for actions with no visible text change (undo, tool switch, zoom). */
export function LiveAnnouncer() {
  const announcement = useBoardStore((s) => s.announcement);
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      <span key={announcement.id}>{announcement.text}</span>
    </div>
  );
}
