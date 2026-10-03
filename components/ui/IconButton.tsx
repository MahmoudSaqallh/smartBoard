"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Tooltip } from "./Tooltip";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  shortcut?: string;
  tooltipSide?: "top" | "right" | "bottom" | "left";
  size?: "sm" | "md";
  active?: boolean;
  children: ReactNode;
}

/** Icon-only button: always labelled, always focus-visible, tooltip on hover/focus. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, shortcut, tooltipSide = "bottom", size = "md", active, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <Tooltip label={label} shortcut={shortcut} side={tooltipSide}>
      <button
        ref={ref}
        type={type}
        aria-label={label}
        aria-keyshortcuts={shortcut}
        className={cn(
          "focus-ring inline-flex shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors",
          "hover:bg-hover hover:text-ink disabled:pointer-events-none disabled:opacity-40",
          size === "sm" ? "size-8" : "size-9",
          active && "bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent",
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    </Tooltip>
  );
});
