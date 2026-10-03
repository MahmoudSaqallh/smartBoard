"use client";

import { useEffect, useRef, useState, type DragEvent, type RefObject } from "react";
import { getActiveViewport, useBoardStore } from "../store/board-store";
import { screenToWorld } from "../utils/viewport";
import { imageFilesFrom, insertImageFiles } from "./insert-actions";

export type DropState = "idle" | "valid" | "invalid";

const UNSUPPORTED = "Unsupported file. Use a PNG, JPG, WebP or SVG image.";

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

/** During dragover only item types are visible (not the files); empty type means "unknown, allow". */
function looksLikeImage(event: DragEvent): boolean {
  const items = Array.from(event.dataTransfer?.items ?? []).filter((item) => item.kind === "file");
  return items.length === 0 || items.some((item) => item.type === "" || item.type.startsWith("image/"));
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

/**
 * Drag & drop images onto the canvas (placed at the drop point) and paste
 * images from the clipboard (placed at the viewport centre). Paste uses the
 * native paste event, which needs no clipboard permission; nothing happens if
 * the clipboard holds no image.
 */
export function useImageDropAndPaste(containerRef: RefObject<HTMLDivElement | null>) {
  const [dropState, setDropState] = useState<DropState>("idle");
  // dragenter/dragleave fire for every child; a depth counter avoids flicker.
  const depth = useRef(0);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (isTyping(event.target) || document.querySelector("dialog[open]")) return;
      const files = imageFilesFrom(event.clipboardData);
      if (files.length === 0) return;
      event.preventDefault();
      void insertImageFiles(files);
    };
    // A file dropped anywhere outside the board would make the browser navigate
    // to it, discarding the session. Swallow those drops.
    const outsideBoard = (event: globalThis.DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes("Files") &&
      !(event.target instanceof Node && containerRef.current?.contains(event.target));
    const blockDragOver = (event: globalThis.DragEvent) => {
      if (!outsideBoard(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "none";
    };
    const blockDrop = (event: globalThis.DragEvent) => {
      if (outsideBoard(event)) event.preventDefault();
    };

    window.addEventListener("paste", onPaste);
    window.addEventListener("dragover", blockDragOver);
    window.addEventListener("drop", blockDrop);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("dragover", blockDragOver);
      window.removeEventListener("drop", blockDrop);
    };
  }, [containerRef]);

  const handlers = {
    onDragEnter: (event: DragEvent<HTMLDivElement>) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth.current += 1;
      setDropState(looksLikeImage(event) ? "valid" : "invalid");
    },
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = looksLikeImage(event) ? "copy" : "none";
    },
    onDragLeave: (event: DragEvent<HTMLDivElement>) => {
      if (!hasFiles(event)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDropState("idle");
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth.current = 0;
      setDropState("idle");
      const files = imageFilesFrom(event.dataTransfer);
      if (files.length === 0) {
        useBoardStore.getState().notify(UNSUPPORTED);
        return;
      }
      const rect = containerRef.current?.getBoundingClientRect();
      const screen = { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
      void insertImageFiles(files, screenToWorld(screen, getActiveViewport(useBoardStore.getState())));
    },
  };

  return { dropState, dropHandlers: handlers };
}
