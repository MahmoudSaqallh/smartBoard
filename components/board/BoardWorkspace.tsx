"use client";

import gsap from "gsap";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useKeyboardShortcuts } from "@/features/whiteboard/hooks/useKeyboardShortcuts";
import { useUnsavedChangesGuard } from "@/features/whiteboard/hooks/useUnsavedChangesGuard";
import { useBoardStore } from "@/features/whiteboard/store/board-store";
import { prefersReducedMotion } from "@/lib/hooks/useMediaQuery";
import { MOTION } from "@/lib/motion";
import { useTimerWatcher } from "@/features/whiteboard/widgets/useTimerWatcher";
import { BackgroundPicker } from "./BackgroundPicker";
import { BoardToast, LiveAnnouncer } from "./BoardToast";
import { PagesBar } from "./PagesBar";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { SidePanel } from "./SidePanel";
import { Toolbar } from "./Toolbar";
import { TopBar } from "./TopBar";
import { Whiteboard } from "./Whiteboard";
import { ZoomControls } from "./ZoomControls";

/**
 * Workspace shell. Owns layout, global shortcuts and the entrance sequence;
 * everything stateful lives in the board store and feature hooks.
 */
export function BoardWorkspace() {
  const rootRef = useRef<HTMLDivElement>(null);
  const boardTitle = useBoardStore((s) => s.doc.title);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const showShortcuts = useCallback(() => setShortcutsOpen(true), []);

  useKeyboardShortcuts(showShortcuts);
  useUnsavedChangesGuard();
  useTimerWatcher();

  // Entrance: the board settles from a slight backward tilt while chrome
  // slides in around it. ~0.7s total and never blocks input.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (prefersReducedMotion()) {
      root.setAttribute("data-entered", "");
      return;
    }

    const ctx = gsap.context(() => {
      gsap
        .timeline({
          defaults: { ease: MOTION.easeOutStrong },
          onComplete: () => root.setAttribute("data-entered", ""),
        })
        .fromTo(
          '[data-enter-group="stage"]',
          { opacity: 0, y: 18, scale: 0.97, rotationX: 7, transformPerspective: 1600, transformOrigin: "50% 0%" },
          { opacity: 1, y: 0, scale: 1, rotationX: 0, duration: MOTION.slow + 0.05, clearProps: "transform" },
          0,
        )
        .fromTo('[data-enter-group="top"]', { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: 0.35, clearProps: "transform" }, 0)
        .fromTo(
          '[data-enter-group="tools"] [data-enter]',
          { opacity: 0, x: -8 },
          { opacity: 1, x: 0, duration: 0.3, stagger: 0.025, clearProps: "transform" },
          0.1,
        )
        .fromTo("[data-tool-indicator]", { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.18)
        .fromTo('[data-enter-group="panel"]', { opacity: 0, x: 12 }, { opacity: 1, x: 0, duration: 0.4, clearProps: "transform" }, 0.12)
        .fromTo('[data-enter-group="bottom"]', { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35, clearProps: "transform" }, 0.12);
    }, root);

    return () => {
      ctx.revert();
      root.removeAttribute("data-entered");
    };
  }, []);

  return (
    <div ref={rootRef} data-workspace="" className="flex h-dvh flex-col overflow-hidden bg-canvas text-ink">
      <TopBar />

      <div className="relative flex min-h-0 flex-1">
        <div
          data-enter-group="tools"
          className="no-scrollbar hidden w-14 shrink-0 flex-col overflow-y-auto border-e border-line bg-surface md:flex"
        >
          <Toolbar orientation="vertical" onShowShortcuts={showShortcuts} />
        </div>

        <main className="relative min-w-0 flex-1 overflow-hidden">
          <h1 className="sr-only">{boardTitle}</h1>
          <Whiteboard />
        </main>

        <SidePanel />
      </div>

      <footer
        data-enter=""
        data-enter-group="bottom"
        className="flex h-11 shrink-0 items-center gap-2 border-t border-line bg-surface px-1.5 sm:px-2"
      >
        <PagesBar />
        <BackgroundPicker />
        <span aria-hidden className="h-5 w-px shrink-0 bg-line max-sm:hidden" />
        <ZoomControls />
      </footer>

      {/* Phones: tools move to a thumb-reachable bottom strip. */}
      <div className="shrink-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        <Toolbar orientation="horizontal" onShowShortcuts={showShortcuts} />
      </div>

      <BoardToast />
      <LiveAnnouncer />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
