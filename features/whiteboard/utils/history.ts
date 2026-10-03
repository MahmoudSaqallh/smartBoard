import { HISTORY_COALESCE_MS, HISTORY_LIMIT } from "../constants";
import { diffElements } from "../model/operations";
import type { BoardElement, HistoryEntry, PageHistory } from "../types";

export function createHistory(): PageHistory {
  return { past: [], future: [], lastKey: null, lastAt: 0 };
}

/**
 * Undo step for one page change, or null when nothing changed. The inverse is
 * simply the diff in the other direction, so it only touches elements this
 * change touched and leaves other people's concurrent edits alone.
 */
export function createEntry(
  pageId: string,
  before: readonly BoardElement[],
  after: readonly BoardElement[],
): HistoryEntry | null {
  const ops = diffElements(pageId, before, after);
  if (ops.length === 0) return null;
  return { ops, inverse: diffElements(pageId, after, before) };
}

interface RecordOptions {
  /** Changes with the same key inside the coalesce window merge into one undo step. */
  coalesceKey?: string;
  now?: number;
  limit?: number;
}

export function recordHistory(
  history: PageHistory,
  entry: HistoryEntry,
  { coalesceKey, now = Date.now(), limit = HISTORY_LIMIT }: RecordOptions = {},
): PageHistory {
  const last = history.past[history.past.length - 1];
  const canCoalesce =
    coalesceKey !== undefined && last !== undefined && history.lastKey === coalesceKey && now - history.lastAt <= HISTORY_COALESCE_MS;

  if (canCoalesce) {
    // A then B: redo replays A's ops then B's; undo reverts B first, then A.
    const merged: HistoryEntry = { ops: [...last.ops, ...entry.ops], inverse: [...entry.inverse, ...last.inverse] };
    return { ...history, past: [...history.past.slice(0, -1), merged], future: [], lastAt: now };
  }

  const past = [...history.past, entry];
  return {
    past: past.length > limit ? past.slice(past.length - limit) : past,
    future: [],
    lastKey: coalesceKey ?? null,
    lastAt: now,
  };
}

export interface HistoryStep {
  history: PageHistory;
  /** The entry being undone or redone. Apply `inverse` for undo, `ops` for redo. */
  entry: HistoryEntry;
}

export function undoHistory(history: PageHistory): HistoryStep | null {
  const entry = history.past[history.past.length - 1];
  if (!entry) return null;
  return {
    entry,
    history: { past: history.past.slice(0, -1), future: [entry, ...history.future], lastKey: null, lastAt: 0 },
  };
}

export function redoHistory(history: PageHistory): HistoryStep | null {
  const [entry, ...rest] = history.future;
  if (!entry) return null;
  return {
    entry,
    history: { past: [...history.past, entry], future: rest, lastKey: null, lastAt: 0 },
  };
}
