"use client";

import gsap from "gsap";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Copy,
  Lock,
  LockOpen,
  MousePointer2,
  Trash,
  type LucideIcon,
} from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { can } from "@/features/permissions/policy";
import { usePermissionStore } from "@/features/permissions/store";
import type { BoardElement } from "@/features/whiteboard/types";
import { prefersReducedMotion } from "@/lib/hooks/useMediaQuery";
import { MOTION } from "@/lib/motion";
import { ClockProperties } from "./properties/ClockProperties";
import { ImageProperties } from "./properties/ImageProperties";
import { QrProperties } from "./properties/QrProperties";
import { TimerProperties } from "./properties/TimerProperties";
import { useStyleContext } from "@/features/whiteboard/hooks/useStyleContext";
import { getActivePage, useBoardStore } from "@/features/whiteboard/store/board-store";
import { cn } from "@/lib/cn";
import { StyleControls } from "./StyleControls";

function ActionButton({
  icon: Icon,
  label,
  hint,
  onClick,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-keyshortcuts={hint}
      className={cn(
        "focus-ring flex h-8 items-center gap-2 rounded-md px-2 text-start text-sm transition-colors",
        danger ? "text-danger hover:bg-danger-soft" : "text-ink hover:bg-hover",
      )}
    >
      <Icon aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
      <span className="flex-1 truncate">{label}</span>
      {hint && <kbd className="font-sans text-xs text-ink-faint">{hint}</kbd>}
    </button>
  );
}

const TYPE_SECTIONS: ReadonlySet<BoardElement["type"]> = new Set(["image", "qr", "clock", "timer"]);

/** Controls specific to one object type; only rendered for a single selection. */
function TypeSection({ element }: { element: BoardElement }) {
  const ref = useSectionEntrance(element.id);
  const body = (() => {
    switch (element.type) {
      case "image":
        return <ImageProperties element={element} />;
      case "qr":
        // Keyed on content so undo or another selection resets the drafted fields.
        return <QrProperties key={`${element.id}:${element.content}:${element.label}`} element={element} />;
      case "clock":
        return <ClockProperties element={element} />;
      case "timer":
        return <TimerProperties element={element} />;
      default:
        return null;
    }
  })();
  if (!body) return null;
  return (
    <div ref={ref} className="px-4 py-4">
      {body}
    </div>
  );
}

/** Light fade-up when the panel switches to a different object (contextual transition). */
function useSectionEntrance(key: string) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current || prefersReducedMotion()) return;
    const tween = gsap.fromTo(ref.current, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: MOTION.fast, ease: MOTION.easeOut, clearProps: "transform,opacity" });
    return () => {
      tween.kill();
    };
  }, [key]);
  return ref;
}

export function PropertiesPanel() {
  const context = useStyleContext();
  const pageName = useBoardStore((s) => getActivePage(s).name);
  const objectCount = useBoardStore((s) => getActivePage(s).elements.length);
  const pageCount = useBoardStore((s) => s.doc.pages.length);
  const duplicateSelected = useBoardStore((s) => s.duplicateSelected);
  const bringSelectedToFront = useBoardStore((s) => s.bringSelectedToFront);
  const sendSelectedToBack = useBoardStore((s) => s.sendSelectedToBack);
  const deleteSelected = useBoardStore((s) => s.deleteSelected);
  const bringSelectedForward = useBoardStore((s) => s.bringSelectedForward);
  const sendSelectedBackward = useBoardStore((s) => s.sendSelectedBackward);
  const setSelectionLocked = useBoardStore((s) => s.setSelectionLocked);
  const permissions = usePermissionStore((s) => s.context);

  if (context.mode === "none") {
    return (
      <div className="px-4 py-5">
        <div className="flex items-start gap-3">
          <MousePointer2 aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
          <div>
            <h2 className="text-sm font-semibold text-ink">Nothing selected</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              Select an object to edit it, or choose a drawing tool to set its style.
            </p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 border-t border-line pt-4 text-sm">
          <div>
            <dt className="text-xs text-ink-faint">On {pageName}</dt>
            <dd className="mt-0.5 font-medium text-ink tabular-nums">
              {objectCount} {objectCount === 1 ? "object" : "objects"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">Board</dt>
            <dd className="mt-0.5 font-medium text-ink tabular-nums">
              {pageCount} {pageCount === 1 ? "page" : "pages"}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  const isSelection = context.mode === "selection";
  const allLocked = context.lockState === "all";
  const single = context.selection.length === 1 ? context.selection[0] : null;
  const lockable = context.selection.length > 0 && can(permissions, { type: "element.lock", element: context.selection[0] });

  return (
    <div>
      <div className="border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          {allLocked && <Lock aria-hidden className="size-3.5 text-ink-muted" strokeWidth={2} />}
          {isSelection ? context.subject : `${context.subject} defaults`}
        </h2>
        <p className="mt-0.5 text-xs text-ink-faint">
          {!isSelection
            ? "Applied to everything you draw next"
            : allLocked
              ? "Locked · can't be moved, edited or deleted"
              : context.lockState === "some"
                ? `Selected on ${pageName} · locked objects are skipped`
                : `Selected on ${pageName}`}
        </p>
      </div>

      {allLocked ? (
        <div className="px-4 py-4">
          {lockable ? (
            <button
              type="button"
              onClick={() => setSelectionLocked(false)}
              className="focus-ring flex h-8 w-full items-center justify-center gap-2 rounded-md border border-line-strong text-sm font-medium text-ink transition-colors hover:bg-subtle"
            >
              <LockOpen aria-hidden className="size-4" strokeWidth={1.75} />
              Unlock to edit
            </button>
          ) : (
            <p className="text-sm text-ink-muted">Only the teacher can unlock this.</p>
          )}
        </div>
      ) : (
        <>
          {single && <TypeSection element={single} />}
          {Object.values(context.capabilities).some(Boolean) && (
            <div className={cn("px-4 py-4", single && TYPE_SECTIONS.has(single.type) && "border-t border-line")}>
              <StyleControls context={context} />
            </div>
          )}
        </>
      )}

      {isSelection && (
        <div className="border-t border-line px-2 py-2">
          <h3 className="px-2 pt-1 pb-1.5 text-xs font-medium text-ink-faint">Arrange</h3>
          <div className="flex flex-col">
            <ActionButton icon={Copy} label="Duplicate" hint="Ctrl D" onClick={duplicateSelected} />
            <ActionButton icon={ArrowUp} label="Bring forward" hint="Ctrl ]" onClick={bringSelectedForward} />
            <ActionButton icon={ArrowDown} label="Send backward" hint="Ctrl [" onClick={sendSelectedBackward} />
            <ActionButton icon={ArrowUpToLine} label="Bring to front" hint="Ctrl ⇧ ]" onClick={bringSelectedToFront} />
            <ActionButton icon={ArrowDownToLine} label="Send to back" hint="Ctrl ⇧ [" onClick={sendSelectedToBack} />
            {lockable && (
              <ActionButton
                icon={allLocked ? LockOpen : Lock}
                label={allLocked ? "Unlock" : "Lock"}
                hint="Ctrl ⇧ L"
                onClick={() => setSelectionLocked(!allLocked)}
              />
            )}
            {!allLocked && <ActionButton icon={Trash} label="Delete" hint="Del" onClick={deleteSelected} danger />}
          </div>
        </div>
      )}
    </div>
  );
}
