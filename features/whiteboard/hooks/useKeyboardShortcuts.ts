"use client";

import { useEffect } from "react";
import { TOOL_BY_SHORTCUT, TOOLS } from "../constants";
import { useBoardStore } from "../store/board-store";

const NON_TEXT_INPUTS = new Set(["radio", "checkbox", "range", "button", "submit", "reset", "color"]);

/** Text entry swallows every shortcut. Radios, sliders and checkboxes do not. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return true;
  return target instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(target.type);
}

function isBoardFocus(target: EventTarget | null): boolean {
  return (
    target === document.body ||
    (target instanceof HTMLElement && target.getAttribute("aria-roledescription") === "whiteboard")
  );
}

/** Form controls that use arrow keys / Space natively (radio groups, sliders). */
function isFormControl(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement;
}

function isActivatable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && ["BUTTON", "A", "SUMMARY"].includes(target.tagName);
}

/**
 * Board-wide shortcuts. Ignored while typing or when a modal is open, so
 * text input and dialogs keep their native keyboard behaviour.
 */
export function useKeyboardShortcuts(onShowShortcuts: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || isTypingTarget(event.target)) return;
      if (document.querySelector("dialog[open]")) return;

      const store = useBoardStore.getState();
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (mod) {
        let action: (() => void) | undefined;
        // Physical key codes: Shift turns "]" into "}" and "l" into "L".
        if (event.shiftKey && event.code === "KeyL") action = store.toggleSelectionLock;
        else if (event.shiftKey && event.code === "BracketRight") action = store.bringSelectedToFront;
        else if (event.shiftKey && event.code === "BracketLeft") action = store.sendSelectedToBack;
        else if (event.code === "BracketRight") action = store.bringSelectedForward;
        else if (event.code === "BracketLeft") action = store.sendSelectedBackward;
        else if (key === "z") action = event.shiftKey ? store.redo : store.undo;
        else if (key === "y") action = store.redo;
        else if (key === "a") action = store.selectAll;
        else if (key === "d") action = store.duplicateSelected;
        else if (key === "=" || key === "+") action = store.zoomIn;
        else if (key === "-") action = store.zoomOut;
        else if (key === "0") action = store.resetZoom;
        if (action) {
          event.preventDefault();
          action();
        }
        return;
      }
      if (event.altKey) return;

      if (event.code === "Space") {
        if (isActivatable(event.target) || isFormControl(event.target)) return;
        event.preventDefault();
        if (!event.repeat) store.setSpacePanning(true);
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (store.selectedIds.length) {
          event.preventDefault();
          store.deleteSelected();
        }
        return;
      }

      if (event.key === "Escape") {
        store.clearSelection();
        return;
      }

      // Page navigation, only when focus is on the board itself; scrollable
      // panels keep their native PageUp/PageDown behaviour.
      if ((event.key === "PageDown" || event.key === "PageUp") && isBoardFocus(event.target)) {
        const { pages } = store.doc;
        const index = pages.findIndex((page) => page.id === store.activePageId);
        const next = pages[index + (event.key === "PageDown" ? 1 : -1)];
        event.preventDefault();
        if (next) store.switchPage(next.id);
        return;
      }

      if (
        event.key.startsWith("Arrow") &&
        !isFormControl(event.target) &&
        store.selectedIds.length &&
        store.activeTool === "select"
      ) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        store.nudgeSelected(dx, dy);
        return;
      }

      if (event.key === "?") {
        event.preventDefault();
        onShowShortcuts();
        return;
      }

      if (event.shiftKey && event.code === "Digit1") {
        event.preventDefault();
        store.zoomToFit();
        return;
      }

      const tool = TOOL_BY_SHORTCUT[key];
      if (tool && !event.shiftKey) {
        event.preventDefault();
        store.setTool(tool);
        store.announce(`${TOOLS.find((t) => t.id === tool)?.label ?? tool} tool`);
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") useBoardStore.getState().setSpacePanning(false);
    };
    // Releasing Space in another window must not leave the board stuck in pan mode.
    const onBlur = () => useBoardStore.getState().setSpacePanning(false);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [onShowShortcuts]);
}
