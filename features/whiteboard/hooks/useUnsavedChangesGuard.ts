"use client";

import { useEffect } from "react";
import { useBoardStore } from "../store/board-store";

/**
 * Boards live in memory for this phase. Warn before a refresh or tab close
 * would discard content.
 */
export function useUnsavedChangesGuard() {
  const hasContent = useBoardStore((s) => s.doc.pages.some((page) => page.elements.length > 0));

  useEffect(() => {
    if (!hasContent) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasContent]);
}
