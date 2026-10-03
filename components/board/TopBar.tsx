"use client";

import { CloudOff, ImageDown, PanelRight, PanelRightClose, Redo2, Share2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState, type KeyboardEvent } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { Popover } from "@/components/ui/Popover";
import { Tooltip } from "@/components/ui/Tooltip";
import { BOARD_TITLE_MAX_LENGTH } from "@/features/whiteboard/constants";
import { getActiveHistory, getActivePage, useBoardStore } from "@/features/whiteboard/store/board-store";
import { exportWithFeedback } from "@/features/whiteboard/utils/export";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { Logo } from "./Logo";
import { AvatarStack } from "./Participants";
import { SIDE_PANEL_ID } from "./SidePanel";

function BoardTitle() {
  const title = useBoardStore((s) => s.doc.title);
  const setBoardTitle = useBoardStore((s) => s.setBoardTitle);
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft !== null) setBoardTitle(draft);
    setDraft(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") {
      setDraft(null);
      // Blur after the reset so the committed value is the original title.
      requestAnimationFrame(() => (event.target as HTMLInputElement).blur());
    }
  };

  return (
    <input
      aria-label="Board title"
      value={draft ?? title}
      maxLength={BOARD_TITLE_MAX_LENGTH}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      // field-sizing hugs the text where supported; elsewhere the max width applies.
      className="focus-ring h-8 w-full max-w-[16rem] min-w-0 truncate rounded-md [field-sizing:content] sm:w-auto sm:min-w-24 bg-transparent px-2 text-sm font-medium text-ink transition-colors hover:bg-subtle focus:bg-surface focus:shadow-[0_0_0_1px_var(--color-line-strong)]"
    />
  );
}

function SaveStatus() {
  return (
    <Tooltip label="Kept in this tab only — refresh or close loses changes" side="bottom">
      <span className="hidden shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-ink-faint sm:inline-flex">
        <CloudOff aria-hidden className="size-3.5" strokeWidth={1.75} />
        <span>Session only</span>
        <span className="sr-only">. Changes are kept in this tab until it is refreshed or closed.</span>
      </span>
    </Tooltip>
  );
}

function ShareButton() {
  const isEmpty = useBoardStore((s) => {
    const page = getActivePage(s);
    return page.elements.length === 0 && !page.background.image;
  });

  return (
    <Popover
      label="Share board"
      side="bottom"
      align="end"
      className="w-72"
      trigger={(props) => (
        <button
          {...props}
          type="button"
          className="focus-ring inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-accent px-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover sm:px-3"
        >
          <Share2 aria-hidden className="size-4" strokeWidth={2} />
          <span className="max-sm:sr-only">Share</span>
        </button>
      )}
    >
      {(close) => (
        <div className="space-y-3">
          <div>
            <p className="font-semibold">Share this board</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              Live sharing with your class arrives with real-time collaboration. For now, export the current page and
              send it as an image.
            </p>
          </div>
          <button
            type="button"
            disabled={isEmpty}
            onClick={() => {
              close();
              void exportWithFeedback();
            }}
            className="focus-ring flex h-9 w-full items-center justify-center gap-2 rounded-md border border-line-strong text-sm font-medium text-ink transition-colors hover:bg-subtle disabled:pointer-events-none disabled:opacity-40"
          >
            <ImageDown aria-hidden className="size-4" strokeWidth={1.75} />
            {isEmpty ? "Page is empty" : "Export page as PNG"}
          </button>
        </div>
      )}
    </Popover>
  );
}

export function TopBar() {
  const canUndo = useBoardStore((s) => getActiveHistory(s).past.length > 0 || s.editingId !== null);
  const canRedo = useBoardStore((s) => getActiveHistory(s).future.length > 0);
  const undo = useBoardStore((s) => s.undo);
  const redo = useBoardStore((s) => s.redo);
  const panelOpen = useBoardStore((s) => s.panelOpen);
  const setPanelOpen = useBoardStore((s) => s.setPanelOpen);
  const isDesktop = useMediaQuery(DESKTOP_QUERY, true);
  const open = panelOpen ?? isDesktop;

  return (
    <header
      data-enter=""
      data-enter-group="top"
      className="relative z-30 flex h-12 shrink-0 items-center gap-2 border-b border-line bg-surface px-2 sm:px-3"
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
        <Link href="/board" className="focus-ring flex shrink-0 items-center gap-2 rounded-md pe-1" aria-label="Smartboard home">
          <Logo className="size-7" />
          <span className="hidden text-sm font-semibold tracking-tight text-ink lg:inline">Smartboard</span>
        </Link>
        <span aria-hidden className="hidden h-5 w-px bg-line sm:block" />
        <BoardTitle />
        <SaveStatus />
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <IconButton label="Undo" shortcut="Ctrl Z" size="sm" disabled={!canUndo} onClick={undo}>
          <Undo2 aria-hidden className="size-[18px]" strokeWidth={1.75} />
        </IconButton>
        <IconButton label="Redo" shortcut="Ctrl ⇧ Z" size="sm" disabled={!canRedo} onClick={redo}>
          <Redo2 aria-hidden className="size-[18px]" strokeWidth={1.75} />
        </IconButton>
      </div>

      <span aria-hidden className="hidden h-5 w-px bg-line md:block" />

      <div className="flex shrink-0 items-center gap-2">
        <div className="hidden md:block">
          <AvatarStack />
        </div>
        <ShareButton />
        <IconButton
          label={open ? "Hide side panel" : "Show side panel"}
          size="sm"
          aria-expanded={open}
          aria-controls={SIDE_PANEL_ID}
          onClick={() => setPanelOpen(!open)}
        >
          {open ? (
            <PanelRightClose aria-hidden className="size-[18px]" strokeWidth={1.75} />
          ) : (
            <PanelRight aria-hidden className="size-[18px]" strokeWidth={1.75} />
          )}
        </IconButton>
      </div>
    </header>
  );
}
