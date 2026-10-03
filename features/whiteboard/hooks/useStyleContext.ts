"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { ELEMENT_LABELS, TOOLS } from "../constants";
import { getActivePage, useBoardStore } from "../store/board-store";
import type { BoardElement, DrawingStyle, ToolId } from "../types";
import { describeElements, getStyleCapabilities } from "../utils/elements";

export type StyleCapabilities = ReturnType<typeof getStyleCapabilities>;

const NONE: StyleCapabilities = {
  color: false,
  strokeWidth: false,
  filled: false,
  fontSize: false,
  stickyColor: false,
};

const TOOL_ELEMENT: Partial<Record<ToolId, BoardElement["type"]>> = {
  pen: "freehand",
  line: "line",
  rectangle: "rectangle",
  ellipse: "ellipse",
  text: "text",
  sticky: "sticky",
};

export interface StyleContext {
  mode: "selection" | "tool" | "none";
  /** e.g. "Rectangle", "3 objects", "Pen". */
  subject: string;
  capabilities: StyleCapabilities;
  values: DrawingStyle;
  selection: BoardElement[];
  /** Locked elements ignore style changes; "all" means nothing selected is editable. */
  lockState: "none" | "some" | "all";
}

/**
 * What the style controls edit: the selection when there is one (values read
 * from it), otherwise the defaults for the active drawing tool.
 */
export function useStyleContext(): StyleContext {
  // Select stable references only; deriving arrays inside the selector would
  // produce a new snapshot on every read and loop useSyncExternalStore.
  const { elements, selectedIds, tool, style } = useBoardStore(
    useShallow((s) => ({
      elements: getActivePage(s).elements,
      selectedIds: s.selectedIds,
      tool: s.activeTool,
      style: s.style,
    })),
  );
  const selection = useMemo(() => {
    const ids = new Set(selectedIds);
    return elements.filter((el) => ids.has(el.id));
  }, [elements, selectedIds]);

  if (selection.length > 0) {
    const lockedCount = selection.filter((el) => el.locked).length;
    const lockState = lockedCount === 0 ? "none" : lockedCount === selection.length ? "all" : "some";
    // Style controls describe what a change would affect: the unlocked elements.
    const editable = lockState === "all" ? selection : selection.filter((el) => !el.locked);
    const capabilities = editable.reduce<StyleCapabilities>((acc, el) => {
      const caps = getStyleCapabilities(el.type);
      return {
        color: acc.color || caps.color,
        strokeWidth: acc.strokeWidth || caps.strokeWidth,
        filled: acc.filled || caps.filled,
        fontSize: acc.fontSize || caps.fontSize,
        stickyColor: acc.stickyColor || caps.stickyColor,
      };
    }, NONE);

    // Show the first selected element's values so controls reflect the selection.
    const values: DrawingStyle = { ...style };
    for (const el of [...editable].reverse()) {
      if (el.type === "sticky") values.stickyColor = el.color;
      else if ("color" in el) values.color = el.color;
      if ("strokeWidth" in el) values.strokeWidth = el.strokeWidth;
      if ("filled" in el) values.filled = el.filled;
      if (el.type === "text") values.fontSize = el.fontSize;
    }

    return {
      mode: "selection",
      subject: selection.length === 1 ? ELEMENT_LABELS[selection[0].type] : describeElements(selection),
      capabilities: lockState === "all" ? NONE : capabilities,
      values,
      selection,
      lockState,
    };
  }

  const elementType = TOOL_ELEMENT[tool];
  if (!elementType) {
    return { mode: "none", subject: "No selection", capabilities: NONE, values: style, selection, lockState: "none" };
  }
  return {
    mode: "tool",
    subject: TOOLS.find((t) => t.id === tool)?.label ?? "Tool",
    capabilities: getStyleCapabilities(elementType),
    values: style,
    selection,
    lockState: "none",
  };
}
