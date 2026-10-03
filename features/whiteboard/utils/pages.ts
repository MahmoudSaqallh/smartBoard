import { DEFAULT_BACKGROUND } from "../background/presets";
import { PAGE_NAME_MAX_LENGTH } from "../constants";
import type { BoardPage, PageBackground } from "../types";
import { createId } from "./id";

/** Lowest "Page N" not already taken, so deleting pages never produces duplicates. */
export function nextPageName(pages: readonly BoardPage[]): string {
  const taken = new Set(pages.map((page) => page.name.trim().toLowerCase()));
  let n = pages.length + 1;
  for (let i = 1; i <= pages.length + 1; i += 1) {
    if (!taken.has(`page ${i}`)) {
      n = i;
      break;
    }
  }
  return `Page ${n}`;
}

/** New page; callers pass the current page's background so a notebook stays a notebook. */
export function createPage(
  pages: readonly BoardPage[],
  background: PageBackground = DEFAULT_BACKGROUND,
  id: string = createId(),
): BoardPage {
  return { id, name: nextPageName(pages), background, elements: [] };
}

/** Trims and limits user input; returns null when the result is empty. */
export function sanitizeName(input: string, maxLength = PAGE_NAME_MAX_LENGTH): string | null {
  const name = input.replace(/\s+/g, " ").trim().slice(0, maxLength);
  return name.length > 0 ? name : null;
}

/** Page to activate after removing `removedId`: the next page, else the previous one. */
export function neighbourPageId(pages: readonly BoardPage[], removedId: string): string | null {
  const index = pages.findIndex((page) => page.id === removedId);
  if (index === -1) return null;
  return pages[index + 1]?.id ?? pages[index - 1]?.id ?? null;
}
