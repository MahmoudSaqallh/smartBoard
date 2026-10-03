"use client";

import { AlarmClock, Clock, Hourglass, ImagePlus, QrCode, SquarePlus, Timer, type LucideIcon } from "lucide-react";
import { useRef, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { Popover } from "@/components/ui/Popover";
import { useCan } from "@/features/permissions/store";
import { IMAGE_ACCEPT } from "@/features/whiteboard/insert/image-validation";
import { insertImageFiles, insertWidget, type WidgetKind } from "@/features/whiteboard/insert/insert-actions";
import { QrDialog } from "./QrDialog";

function MenuButton({ icon: Icon, label, hint, onClick }: { icon: LucideIcon; label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-start text-sm text-ink transition-colors hover:bg-hover"
    >
      <Icon aria-hidden className="size-4 shrink-0 text-ink-muted" strokeWidth={1.75} />
      <span className="flex-1">{label}</span>
      {hint && <span className="text-xs text-ink-faint">{hint}</span>}
    </button>
  );
}

const WIDGETS: { kind: WidgetKind; label: string; icon: LucideIcon }[] = [
  { kind: "digital-clock", label: "Digital clock", icon: AlarmClock },
  { kind: "analog-clock", label: "Analog clock", icon: Clock },
  { kind: "timer", label: "Timer", icon: Hourglass },
  { kind: "stopwatch", label: "Stopwatch", icon: Timer },
];

/** Insert menu: media (image, QR) and live widgets, grouped behind one toolbar button. */
export function InsertMenu({ vertical }: { vertical: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const canEdit = useCan({ type: "board.edit" });

  return (
    <>
      <Popover
        label="Insert"
        side={vertical ? "right" : "top"}
        align={vertical ? "start" : "end"}
        className="w-56 p-1.5"
        trigger={(props) => (
          <IconButton
            {...props}
            label={canEdit ? "Insert" : "Insert (disabled by teacher)"}
            tooltipSide={vertical ? "right" : "top"}
            tabIndex={-1}
            disabled={!canEdit}
            className="size-10 rounded-lg"
            data-enter={vertical ? "" : undefined}
          >
            <SquarePlus aria-hidden className="size-[19px]" strokeWidth={1.75} />
          </IconButton>
        )}
      >
        {(close) => (
          <div className="flex flex-col">
            <p className="px-2 pt-1 pb-1 text-xs font-medium text-ink-faint">Media</p>
            <MenuButton
              icon={ImagePlus}
              label="Image…"
              hint="or paste / drop"
              onClick={() => {
                close();
                fileRef.current?.click();
              }}
            />
            <MenuButton
              icon={QrCode}
              label="QR code…"
              onClick={() => {
                close();
                setQrOpen(true);
              }}
            />
            <div role="separator" className="my-1 h-px bg-line" />
            <p className="px-2 pt-1 pb-1 text-xs font-medium text-ink-faint">Widgets</p>
            {WIDGETS.map((widget) => (
              <MenuButton
                key={widget.kind}
                icon={widget.icon}
                label={widget.label}
                onClick={() => {
                  close();
                  insertWidget(widget.kind);
                }}
              />
            ))}
          </div>
        )}
      </Popover>

      {/* Hidden picker: keyboard and screen-reader users never need drag & drop. */}
      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        hidden
        tabIndex={-1}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          // Reset so choosing the same file again still fires a change.
          event.target.value = "";
          if (files.length) void insertImageFiles(files);
        }}
      />
      <QrDialog open={qrOpen} onClose={() => setQrOpen(false)} />
    </>
  );
}
