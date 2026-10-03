"use client";

import { ChevronLeft, ChevronRight, Copy, Ellipsis, Pencil, Plus, Trash } from "lucide-react";
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { IconButton } from "@/components/ui/IconButton";
import { Popover } from "@/components/ui/Popover";
import { MAX_PAGES, PAGE_NAME_MAX_LENGTH } from "@/features/whiteboard/constants";
import { useBoardStore } from "@/features/whiteboard/store/board-store";
import type { BoardPage } from "@/features/whiteboard/types";
import { cn } from "@/lib/cn";

function RenameInput({ page, onDone }: { page: BoardPage; onDone: () => void }) {
  const renamePage = useBoardStore((s) => s.renamePage);
  const [value, setValue] = useState(page.name);
  const inputRef = useRef<HTMLInputElement>(null);
  // A ref, not state: Escape must cancel synchronously, before blur commits.
  const cancelled = useRef(false);

  // Focus follows the explicit rename action.
  useLayoutEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") {
      cancelled.current = true;
      event.currentTarget.blur();
    }
  };

  return (
    <input
      ref={inputRef}
      aria-label={`Rename ${page.name}`}
      value={value}
      maxLength={PAGE_NAME_MAX_LENGTH}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => {
        if (!cancelled.current) renamePage(page.id, value);
        onDone();
      }}
      onKeyDown={handleKeyDown}
      className="h-7 w-32 rounded-md border border-accent bg-surface px-2 text-xs font-medium text-ink outline-none"
    />
  );
}

function PageActions({ page, onRename }: { page: BoardPage; onRename: () => void }) {
  const pageCount = useBoardStore((s) => s.doc.pages.length);
  const duplicatePage = useBoardStore((s) => s.duplicatePage);
  const deletePage = useBoardStore((s) => s.deletePage);

  const handleDelete = () => {
    // Page deletion is not undoable, so confirm when there is content to lose.
    if (page.elements.length > 0 && !window.confirm(`Delete "${page.name}"? Its content cannot be recovered.`)) return;
    deletePage(page.id);
  };

  return (
    <Popover
      label={`${page.name} actions`}
      side="top"
      align="start"
      className="w-48 p-1.5"
      trigger={(props) => (
        <IconButton {...props} label={`${page.name} actions`} tooltipSide="top" size="sm" className="size-7">
          <Ellipsis aria-hidden className="size-4" strokeWidth={1.75} />
        </IconButton>
      )}
    >
      {(close) => (
        <div className="flex flex-col">
          {[
            { icon: Pencil, label: "Rename", onClick: onRename },
            { icon: Copy, label: "Duplicate", onClick: () => duplicatePage(page.id), disabled: pageCount >= MAX_PAGES },
            { icon: Trash, label: "Delete page", onClick: handleDelete, disabled: pageCount <= 1, danger: true },
          ].map(({ icon: Icon, label, onClick, disabled, danger }) => (
            <button
              key={label}
              type="button"
              disabled={disabled}
              onClick={() => {
                close();
                onClick();
              }}
              className={cn(
                "focus-ring flex h-8 items-center gap-2.5 rounded-md px-2 text-start text-sm transition-colors disabled:pointer-events-none disabled:opacity-40",
                danger ? "text-danger hover:bg-danger-soft" : "text-ink hover:bg-hover",
              )}
            >
              <Icon aria-hidden className="size-4" strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

export function PagesBar() {
  const { pages, activePageId } = useBoardStore(useShallow((s) => ({ pages: s.doc.pages, activePageId: s.activePageId })));
  const switchPage = useBoardStore((s) => s.switchPage);
  const addPage = useBoardStore((s) => s.addPage);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const activeIndex = Math.max(0, pages.findIndex((p) => p.id === activePageId));
  const activePage = pages[activeIndex];
  const atLimit = pages.length >= MAX_PAGES;

  const addButton = (
    <IconButton label={atLimit ? `Page limit reached (${MAX_PAGES})` : "Add page"} tooltipSide="top" size="sm" onClick={addPage} disabled={atLimit}>
      <Plus aria-hidden className="size-4" strokeWidth={1.75} />
    </IconButton>
  );

  return (
    <nav aria-label="Pages" className="flex min-w-0 flex-1 items-center gap-1">
      {/* Tablet and desktop: page tabs */}
      <ol className="no-scrollbar hidden min-w-0 items-center gap-0.5 overflow-x-auto md:flex">
        {pages.map((page, index) => {
          const active = page.id === activePageId;
          return (
            <li key={page.id} className="flex shrink-0 items-center">
              {renamingId === page.id ? (
                <RenameInput page={page} onDone={() => setRenamingId(null)} />
              ) : (
                <button
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => switchPage(page.id)}
                  onDoubleClick={() => setRenamingId(page.id)}
                  title={active ? "Double-click to rename" : undefined}
                  className={cn(
                    "focus-ring flex h-7 max-w-40 items-center gap-1.5 rounded-md px-2 text-xs transition-colors",
                    active
                      ? "bg-subtle font-semibold text-ink shadow-[inset_0_0_0_1px_var(--color-line)]"
                      : "text-ink-muted hover:bg-hover hover:text-ink",
                  )}
                >
                  {/* The position only adds information once a page has a custom name. */}
                  {page.name !== `Page ${index + 1}` && (
                    <span aria-hidden className="text-ink-faint tabular-nums">
                      {index + 1}
                    </span>
                  )}
                  <span className="truncate">{page.name}</span>
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {/* One actions button after the list: tabs never shift when the active page
          changes, so double-click-to-rename lands on the same tab. */}
      <div className="hidden md:block">
        {renamingId !== activePage.id && <PageActions page={activePage} onRename={() => setRenamingId(activePage.id)} />}
      </div>

      {/* Mobile: compact stepper */}
      <div className="flex min-w-0 items-center md:hidden">
        <IconButton label="Previous page" tooltipSide="top" size="sm" disabled={activeIndex === 0} onClick={() => switchPage(pages[activeIndex - 1].id)}>
          <ChevronLeft aria-hidden className="size-4" strokeWidth={1.75} />
        </IconButton>
        {renamingId === activePage.id ? (
          <RenameInput page={activePage} onDone={() => setRenamingId(null)} />
        ) : (
          <p className="min-w-0 px-1 text-xs text-ink-muted" aria-live="polite">
            <span className="block max-w-28 truncate font-semibold text-ink">{activePage.name}</span>
          </p>
        )}
        <IconButton
          label="Next page"
          tooltipSide="top"
          size="sm"
          disabled={activeIndex === pages.length - 1}
          onClick={() => switchPage(pages[activeIndex + 1].id)}
        >
          <ChevronRight aria-hidden className="size-4" strokeWidth={1.75} />
        </IconButton>
        {renamingId !== activePage.id && <PageActions page={activePage} onRename={() => setRenamingId(activePage.id)} />}
      </div>

      {addButton}

      <span className="hidden shrink-0 ps-1 text-xs text-ink-faint tabular-nums sm:inline">
        Page {activeIndex + 1} of {pages.length}
      </span>
    </nav>
  );
}
