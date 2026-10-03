"use client";

import gsap from "gsap";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { useBoardStore } from "@/features/whiteboard/store/board-store";
import type { PanelTab } from "@/features/whiteboard/types";
import { cn } from "@/lib/cn";
import { DESKTOP_QUERY, useMediaQuery, useReducedMotion } from "@/lib/hooks/useMediaQuery";
import { MOTION } from "@/lib/motion";
import { ActivityFeed } from "./ActivityFeed";
import { ParticipantsList } from "./Participants";
import { PropertiesPanel } from "./PropertiesPanel";

const TABS: { id: PanelTab; label: string }[] = [
  { id: "properties", label: "Properties" },
  { id: "people", label: "People" },
  { id: "activity", label: "Activity" },
];

export const SIDE_PANEL_ID = "board-side-panel";

/**
 * Inline column on desktop, overlay drawer below 1024px. While the user has
 * not toggled it (`panelOpen === null`) CSS decides visibility, so server and
 * client markup match and mobile never flashes an open drawer.
 */
export function SidePanel() {
  const panelOpen = useBoardStore((s) => s.panelOpen);
  const setPanelOpen = useBoardStore((s) => s.setPanelOpen);
  const tab = useBoardStore((s) => s.panelTab);
  const setTab = useBoardStore((s) => s.setPanelTab);
  const isDesktop = useMediaQuery(DESKTOP_QUERY, true);
  const reducedMotion = useReducedMotion();
  const panelRef = useRef<HTMLElement>(null);

  // Stays true while the exit animation runs.
  const [rendered, setRendered] = useState(true);
  if (panelOpen === true && !rendered) setRendered(true);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || panelOpen === null) return;
    if (panelOpen) {
      gsap.fromTo(
        panel,
        { x: 16, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: reducedMotion ? 0 : MOTION.base,
          ease: MOTION.easeOutStrong,
          overwrite: true,
          clearProps: "transform,opacity",
        },
      );
    } else {
      gsap.to(panel, {
        x: 16,
        opacity: 0,
        duration: reducedMotion ? 0 : MOTION.fast,
        ease: MOTION.easeIn,
        overwrite: true,
        onComplete: () => setRendered(false),
      });
    }
  }, [panelOpen, reducedMotion]);

  const close = useCallback(() => {
    setPanelOpen(false);
    document.querySelector<HTMLElement>(`[aria-controls="${SIDE_PANEL_ID}"]`)?.focus();
  }, [setPanelOpen]);

  // As an overlay the panel covers the canvas, so Escape closes it from anywhere,
  // unless something else (text editor, modal) already handled the key.
  const isOverlayOpen = panelOpen === true && !isDesktop;
  useEffect(() => {
    if (!isOverlayOpen) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || document.querySelector("dialog[open]")) return;
      close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOverlayOpen, close]);

  const handleTabKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = TABS.findIndex((t) => t.id === tab);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault();
    setTab(TABS[next].id);
    document.getElementById(`panel-tab-${TABS[next].id}`)?.focus();
  };

  const visibility = panelOpen === null ? "hidden lg:flex" : rendered ? "flex" : "hidden";

  return (
    <aside
      ref={panelRef}
      id={SIDE_PANEL_ID}
      aria-label="Board details"
      data-enter=""
      data-enter-group="panel"
      className={cn(
        visibility,
        "flex-col border-s border-line bg-surface",
        "absolute inset-y-0 end-0 z-20 w-full max-w-sm shadow-panel",
        "lg:static lg:z-auto lg:w-72 lg:max-w-none lg:shrink-0 lg:shadow-none",
      )}
    >
      <div className="flex h-11 shrink-0 items-end justify-between border-b border-line px-2">
        <div role="tablist" aria-label="Panel sections" onKeyDown={handleTabKeys} className="flex h-full">
          {TABS.map((t) => {
            const selected = t.id === tab;
            return (
              <button
                key={t.id}
                id={`panel-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`panel-section-${t.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(t.id)}
                className={cn(
                  "focus-ring relative -mb-px flex h-full items-center border-b-2 px-2.5 text-sm transition-colors",
                  selected
                    ? "border-accent font-medium text-ink"
                    : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <IconButton label="Close panel" size="sm" onClick={close} className="mb-1.5">
          <X aria-hidden className="size-4" strokeWidth={1.75} />
        </IconButton>
      </div>

      <div
        id={`panel-section-${tab}`}
        role="tabpanel"
        aria-labelledby={`panel-tab-${tab}`}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto pb-4 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        {tab === "properties" && <PropertiesPanel />}
        {tab === "people" && (
          <div className="pt-4">
            <ParticipantsList />
          </div>
        )}
        {tab === "activity" && <ActivityFeed />}
      </div>
    </aside>
  );
}
