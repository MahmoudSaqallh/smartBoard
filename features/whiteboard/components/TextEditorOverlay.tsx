"use client";

import { useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";
import {
  CANVAS_FONT_FAMILY,
  STICKY_FONT_SIZE,
  STICKY_PADDING,
  STICKY_TEXT_COLOR,
  TEXT_LINE_HEIGHT,
  TEXT_MAX_LENGTH,
} from "../constants";
import { useBoardStore } from "../store/board-store";
import type { StickyElement, TextElement, Viewport } from "../types";
import { worldToScreen } from "../utils/viewport";

interface TextEditorOverlayProps {
  element: TextElement | StickyElement;
  viewport: Viewport;
}

/**
 * Native textarea positioned over the hidden canvas node: real caret,
 * selection, IME and screen reader support. Text is written to the store on
 * every keystroke, so nothing is lost if editing ends unexpectedly.
 */
export function TextEditorOverlay({ element, viewport }: TextEditorOverlayProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const updateEditingText = useBoardStore((s) => s.updateEditingText);
  const finishEditing = useBoardStore((s) => s.finishEditing);

  useLayoutEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;
    textarea.focus({ preventScroll: true });
    const end = textarea.value.length;
    textarea.setSelectionRange(end, end);
  }, [element.id]);

  const { scale } = viewport;
  const origin = worldToScreen({ x: element.x, y: element.y }, viewport);
  const isSticky = element.type === "sticky";
  const fontSize = (isSticky ? STICKY_FONT_SIZE : element.fontSize) * scale;

  const style: CSSProperties = {
    left: origin.x,
    top: origin.y,
    width: element.width * scale,
    height: element.height * scale,
    fontSize,
    lineHeight: TEXT_LINE_HEIGHT,
    fontFamily: CANVAS_FONT_FAMILY,
    color: isSticky ? STICKY_TEXT_COLOR : element.color,
    background: isSticky ? element.color : "transparent",
    padding: isSticky ? STICKY_PADDING * scale : 0,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    transformOrigin: "top left",
    borderRadius: isSticky ? 3 * scale : 0,
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape" || (event.key === "Enter" && (event.metaKey || event.ctrlKey))) {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  return (
    <textarea
      ref={ref}
      data-board-editor=""
      aria-label={isSticky ? "Sticky note text" : "Text"}
      value={element.text}
      maxLength={TEXT_MAX_LENGTH}
      // Arabic and English text each flow in their own direction while typing.
      dir="auto"
      spellCheck
      onChange={(event) => updateEditingText(event.target.value)}
      onBlur={finishEditing}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => event.stopPropagation()}
      placeholder={isSticky ? "Write a note…" : "Type something…"}
      style={style}
      className={`absolute z-10 m-0 resize-none border-0 ${isSticky ? "overflow-auto" : "overflow-hidden"} break-words whitespace-pre-wrap outline-2 outline-offset-4 outline-accent/60 outline-dashed placeholder:text-ink-faint/70`}
    />
  );
}
