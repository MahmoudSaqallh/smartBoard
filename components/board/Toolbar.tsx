"use client";

import gsap from "gsap";
import {
  BrushCleaning,
  Circle,
  Ellipsis,
  Eraser,
  Hand,
  ImageDown,
  Keyboard,
  MousePointer2,
  Pencil,
  Scan,
  Slash,
  Square,
  StickyNote,
  Trash,
  Type,
  type LucideIcon,
} from "lucide-react";
import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { Popover } from "@/components/ui/Popover";
import { Tooltip } from "@/components/ui/Tooltip";
import { can } from "@/features/permissions/policy";
import { usePermissionStore } from "@/features/permissions/store";
import { INK_COLORS, STICKY_COLORS, TOOLS } from "@/features/whiteboard/constants";
import { useStyleContext } from "@/features/whiteboard/hooks/useStyleContext";
import { getActivePage, useBoardStore } from "@/features/whiteboard/store/board-store";
import type { ToolId } from "@/features/whiteboard/types";
import { exportWithFeedback } from "@/features/whiteboard/utils/export";
import { cn } from "@/lib/cn";
import { useReducedMotion } from "@/lib/hooks/useMediaQuery";
import { MOTION } from "@/lib/motion";
import { InsertMenu } from "./InsertMenu";
import { StyleControls } from "./StyleControls";

const TOOL_ICONS: Record<ToolId, LucideIcon> = {
  select: MousePointer2,
  hand: Hand,
  pen: Pencil,
  eraser: Eraser,
  line: Slash,
  rectangle: Square,
  ellipse: Circle,
  text: Type,
  sticky: StickyNote,
};

type Orientation = "vertical" | "horizontal";

interface ToolbarProps {
  orientation: Orientation;
  onShowShortcuts: () => void;
}

function Divider({ orientation }: { orientation: Orientation }) {
  return (
    <div
      role="separator"
      aria-orientation={orientation === "vertical" ? "horizontal" : "vertical"}
      className={cn("shrink-0 bg-line", orientation === "vertical" ? "mx-auto my-1.5 h-px w-6" : "mx-1 h-6 w-px self-center")}
    />
  );
}

function MenuItem({
  icon: Icon,
  label,
  hint,
  onClick,
  disabled,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "focus-ring flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-start text-sm transition-colors disabled:pointer-events-none disabled:opacity-40",
        danger ? "text-danger hover:bg-danger-soft" : "text-ink hover:bg-hover",
      )}
    >
      <Icon aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
      <span className="flex-1">{label}</span>
      {hint && <kbd className="font-sans text-xs text-ink-faint">{hint}</kbd>}
    </button>
  );
}

export function Toolbar({ orientation, onShowShortcuts }: ToolbarProps) {
  const vertical = orientation === "vertical";
  const activeTool = useBoardStore((s) => s.activeTool);
  const setTool = useBoardStore((s) => s.setTool);
  const hasDeletable = useBoardStore((s) => {
    if (s.selectedIds.length === 0) return false;
    const ids = new Set(s.selectedIds);
    return getActivePage(s).elements.some((el) => ids.has(el.id) && !el.locked);
  });
  const isEmpty = useBoardStore((s) => getActivePage(s).elements.length === 0);
  // A background image alone is exportable content (e.g. a worksheet).
  const nothingToExport = useBoardStore((s) => {
    const page = getActivePage(s);
    return page.elements.length === 0 && !page.background.image;
  });
  const deleteSelected = useBoardStore((s) => s.deleteSelected);
  const clearPage = useBoardStore((s) => s.clearPage);
  const zoomToFit = useBoardStore((s) => s.zoomToFit);
  const styleContext = useStyleContext();
  const reducedMotion = useReducedMotion();
  const permissions = usePermissionStore((s) => s.context);

  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const hasPositioned = useRef(false);

  // Active-tool indicator glides between buttons instead of jumping.
  useLayoutEffect(() => {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    if (!list || !indicator) return;

    const place = (animate: boolean) => {
      const button = list.querySelector<HTMLElement>(`[data-tool="${activeTool}"]`);
      // offsetParent is null while this toolbar variant is hidden by CSS.
      if (!button || button.offsetParent === null) return;
      const target = { x: button.offsetLeft, y: button.offsetTop, width: button.offsetWidth, height: button.offsetHeight };
      if (animate) {
        gsap.to(indicator, { ...target, opacity: 1, duration: MOTION.base, ease: MOTION.easeOutStrong, overwrite: true });
      } else {
        gsap.set(indicator, { ...target, opacity: 1 });
      }
      if (!vertical) button.scrollIntoView({ block: "nearest", inline: "nearest" });
    };

    place(hasPositioned.current && !reducedMotion);
    hasPositioned.current = true;
    const observer = new ResizeObserver(() => place(false));
    observer.observe(list);
    return () => observer.disconnect();
  }, [activeTool, reducedMotion, vertical]);

  /** Arrow keys move focus across the toolbar (ARIA toolbar pattern). */
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = vertical ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
    if (![...keys, "Home", "End"].includes(event.key)) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1) return;
    event.preventDefault();
    let next = index;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = buttons.length - 1;
    else next = (index + (event.key === keys[1] ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
  };

  const popoverSide = vertical ? "right" : "top";
  const swatchColor =
    styleContext.capabilities.stickyColor && !styleContext.capabilities.color
      ? styleContext.values.stickyColor
      : styleContext.values.color;
  const swatchName =
    [...INK_COLORS, ...STICKY_COLORS].find((c) => c.value.toLowerCase() === swatchColor.toLowerCase())?.name ?? "Custom";

  const toolButtons: ReactNode = TOOLS.map((tool) => {
    const Icon = TOOL_ICONS[tool.id];
    const active = tool.id === activeTool;
    const allowed = can(permissions, { type: "tool.use", tool: tool.id });
    return (
      <Tooltip
        key={tool.id}
        label={allowed ? tool.label : `${tool.label} (disabled by teacher)`}
        shortcut={tool.shortcut}
        side={vertical ? "right" : "top"}
      >
        <button
          type="button"
          data-tool={tool.id}
          data-enter={vertical ? "" : undefined}
          aria-label={tool.label}
          aria-pressed={active}
          aria-keyshortcuts={tool.shortcut}
          // aria-disabled (not disabled) keeps the tooltip reachable to explain why;
          // setTool enforces the permission.
          aria-disabled={allowed ? undefined : true}
          tabIndex={active ? 0 : -1}
          onClick={() => setTool(tool.id)}
          className={cn(
            "focus-ring relative z-10 inline-flex size-10 shrink-0 items-center justify-center rounded-lg transition-[color,background-color,transform] duration-150",
            !allowed && "cursor-not-allowed opacity-35",
            allowed && "active:scale-[0.94]",
            active ? "text-accent" : allowed ? "text-ink-muted hover:bg-hover hover:text-ink" : "text-ink-muted",
          )}
        >
          <Icon aria-hidden className="size-[19px]" strokeWidth={active ? 2.1 : 1.75} />
        </button>
      </Tooltip>
    );
  });

  return (
    <div
      ref={listRef}
      role="toolbar"
      aria-label="Drawing tools"
      aria-orientation={orientation}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative flex gap-1",
        vertical ? "flex-col items-center py-2" : "no-scrollbar items-center overflow-x-auto px-2 py-1.5",
      )}
    >
      {/* Shape + accent bar mark the active tool, so state never relies on colour alone. */}
      <span
        ref={indicatorRef}
        data-tool-indicator=""
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 rounded-lg bg-accent-soft opacity-0"
      >
        <span
          className={cn(
            "absolute rounded-full bg-accent",
            vertical ? "top-2.5 bottom-2.5 -start-[7px] w-[3px]" : "right-2.5 -bottom-[5px] left-2.5 h-[3px]",
          )}
        />
      </span>

      {toolButtons}

      <Divider orientation={orientation} />

      <InsertMenu vertical={vertical} />

      <Popover
        label="Style"
        side={popoverSide}
        align="end"
        className="w-64"
        trigger={(props) => (
          <IconButton
            {...props}
            label={`Style: ${swatchName}`}
            tooltipSide={vertical ? "right" : "top"}
            tabIndex={-1}
            className="size-10 rounded-lg"
            data-enter={vertical ? "" : undefined}
          >
            <span
              aria-hidden
              className="block size-5 rounded-full border border-black/15 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.65)]"
              style={{ backgroundColor: swatchColor }}
            />
          </IconButton>
        )}
      >
        <p className="mb-3 text-sm font-semibold">
          {styleContext.mode === "selection" ? styleContext.subject : `${styleContext.subject} style`}
        </p>
        {styleContext.mode === "none" ? (
          <p className="text-sm text-ink-muted">Select an object or a drawing tool to change its style.</p>
        ) : styleContext.lockState === "all" ? (
          <p className="text-sm text-ink-muted">Locked objects can&apos;t be restyled. Unlock them first (Ctrl ⇧ L).</p>
        ) : (
          <StyleControls context={styleContext} />
        )}
      </Popover>

      <IconButton
        label="Delete selection"
        shortcut="Del"
        tooltipSide={vertical ? "right" : "top"}
        disabled={!hasDeletable}
        onClick={deleteSelected}
        tabIndex={-1}
        className="size-10 rounded-lg"
        data-enter={vertical ? "" : undefined}
      >
        <Trash aria-hidden className="size-[18px]" strokeWidth={1.75} />
      </IconButton>

      <Popover
        label="More actions"
        side={popoverSide}
        align="end"
        className="w-60 p-1.5"
        trigger={(props) => (
          <IconButton
            {...props}
            label="More actions"
            tooltipSide={vertical ? "right" : "top"}
            tabIndex={-1}
            className="size-10 rounded-lg"
            data-enter={vertical ? "" : undefined}
          >
            <Ellipsis aria-hidden className="size-[18px]" strokeWidth={1.75} />
          </IconButton>
        )}
      >
        {(close) => (
          <div className="flex flex-col">
            <MenuItem
              icon={ImageDown}
              label="Export page as PNG"
              disabled={nothingToExport}
              onClick={() => {
                close();
                void exportWithFeedback();
              }}
            />
            <MenuItem
              icon={Scan}
              label="Zoom to fit"
              hint="⇧1"
              onClick={() => {
                close();
                zoomToFit();
              }}
            />
            <MenuItem
              icon={Keyboard}
              label="Keyboard shortcuts"
              hint="?"
              onClick={() => {
                close();
                onShowShortcuts();
              }}
            />
            <div role="separator" className="my-1 h-px bg-line" />
            <MenuItem
              icon={BrushCleaning}
              label="Clear page"
              danger
              disabled={isEmpty}
              onClick={() => {
                close();
                clearPage();
              }}
            />
          </div>
        )}
      </Popover>
    </div>
  );
}
