"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { TOOLS } from "@/features/whiteboard/constants";

const GROUPS: { title: string; items: [string, string][] }[] = [
  { title: "Tools", items: TOOLS.map((tool) => [tool.label, tool.shortcut]) },
  {
    title: "Editing",
    items: [
      ["Undo", "Ctrl Z"],
      ["Redo", "Ctrl ⇧ Z"],
      ["Duplicate", "Ctrl D"],
      ["Select all", "Ctrl A"],
      ["Delete selection", "Del"],
      ["Move selection", "Arrows"],
      ["Lock / unlock", "Ctrl ⇧ L"],
      ["Bring forward / backward", "Ctrl ] / ["],
      ["Bring to front / back", "Ctrl ⇧ ] / ["],
      ["Paste image", "Ctrl V"],
      ["Deselect", "Esc"],
      ["Finish text", "Esc"],
    ],
  },
  {
    title: "View",
    items: [
      ["Pan", "Space + drag"],
      ["Zoom", "Ctrl + scroll"],
      ["Zoom in / out", "Ctrl + / −"],
      ["Reset zoom", "Ctrl 0"],
      ["Zoom to fit", "⇧ 1"],
      ["Next / previous page", "PgDn / PgUp"],
    ],
  },
];

interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Native modal dialog: focus trap, Escape and inert background come built in. */
export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="shortcuts-title"
      onClose={onClose}
      onClick={(event) => {
        // Clicking the backdrop (the dialog element itself) closes it.
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-[10px] border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-ink/30"
    >
      <div className="flex items-center justify-between border-b border-line py-2 ps-5 pe-2">
        <h2 id="shortcuts-title" className="text-sm font-semibold">
          Keyboard shortcuts
        </h2>
        <IconButton label="Close" size="sm" onClick={onClose}>
          <X aria-hidden className="size-4" strokeWidth={1.75} />
        </IconButton>
      </div>
      <div className="grid max-h-[70vh] gap-x-8 gap-y-5 overflow-y-auto px-5 py-4 sm:grid-cols-2">
        {GROUPS.map((group) => (
          <section key={group.title} className={group.title === "Tools" ? "sm:row-span-2" : undefined}>
            <h3 className="mb-1.5 text-xs font-medium text-ink-faint">{group.title}</h3>
            <dl className="divide-y divide-line">
              {group.items.map(([label, keys]) => (
                <div key={`${group.title}-${label}`} className="flex items-center justify-between py-1.5 text-sm">
                  <dt className="text-ink-muted">{label}</dt>
                  <dd>
                    <kbd className="rounded-[4px] border border-line bg-subtle px-1.5 py-0.5 font-sans text-xs text-ink">
                      {keys}
                    </kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </dialog>
  );
}
