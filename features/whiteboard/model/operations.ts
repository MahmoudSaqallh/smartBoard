/**
 * Document operations: the single contract for every board change.
 *
 * Pure TypeScript with no React, Konva or store imports, so the same code can
 * run in a sync server, an autosave worker or a version-history service.
 *
 * Operations are derived by diffing immutable states (`diffDocuments`), which
 * keeps store actions simple. They are applied idempotently (`applyOperations`),
 * so a replayed or duplicated remote operation is harmless.
 */
import type { BoardDocument, BoardElement, BoardOperation, BoardPage } from "../types";

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

function insertAfter<T extends { id: string }>(items: T[], item: T, after: string | null): T[] {
  if (after === null) return [item, ...items];
  const index = items.findIndex((candidate) => candidate.id === after);
  // Unknown anchor (e.g. deleted by someone else): place on top rather than drop.
  if (index === -1) return [...items, item];
  return [...items.slice(0, index + 1), item, ...items.slice(index + 1)];
}

/** Reorders to match `order`; unknown ids are ignored, unlisted items keep their relative order at the end. */
function reorder<T extends { id: string }>(items: T[], order: string[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const listed = order.map((id) => byId.get(id)).filter((item): item is T => item !== undefined);
  const listedIds = new Set(listed.map((item) => item.id));
  const next = [...listed, ...items.filter((item) => !listedIds.has(item.id))];
  return next.every((item, i) => item === items[i]) ? items : next;
}

function applyToElements(elements: BoardElement[], op: BoardOperation): BoardElement[] {
  switch (op.type) {
    case "element.put": {
      const index = elements.findIndex((el) => el.id === op.element.id);
      if (index === -1) return insertAfter(elements, op.element, op.after);
      if (elements[index] === op.element) return elements;
      const next = elements.slice();
      next[index] = op.element;
      return next;
    }
    case "element.delete": {
      const next = elements.filter((el) => el.id !== op.id);
      return next.length === elements.length ? elements : next;
    }
    case "element.order":
      return reorder(elements, op.order);
    default:
      return elements;
  }
}

/** Applies one operation. Returns the same reference when nothing changes. */
export function applyOperation(doc: BoardDocument, op: BoardOperation): BoardDocument {
  switch (op.type) {
    case "board.update":
      return doc.title === op.title ? doc : { ...doc, title: op.title };

    case "page.insert":
      if (doc.pages.some((page) => page.id === op.page.id)) return doc;
      return { ...doc, pages: insertAfter(doc.pages, op.page, op.after) };

    case "page.update": {
      const page = doc.pages.find((p) => p.id === op.pageId);
      if (!page || page.name === op.name) return doc;
      return { ...doc, pages: doc.pages.map((p) => (p.id === op.pageId ? { ...p, name: op.name } : p)) };
    }

    case "page.delete": {
      // A board always keeps at least one page.
      if (doc.pages.length <= 1) return doc;
      const pages = doc.pages.filter((page) => page.id !== op.pageId);
      return pages.length === doc.pages.length ? doc : { ...doc, pages };
    }

    case "page.order": {
      const pages = reorder(doc.pages, op.order);
      return pages === doc.pages ? doc : { ...doc, pages };
    }

    case "page.background": {
      const page = doc.pages.find((p) => p.id === op.pageId);
      if (!page || page.background === op.background) return doc;
      return {
        ...doc,
        pages: doc.pages.map((p) => (p.id === op.pageId ? { ...p, background: op.background } : p)),
      };
    }

    case "asset.put":
      if (doc.assets[op.asset.id] === op.asset) return doc;
      return { ...doc, assets: { ...doc.assets, [op.asset.id]: op.asset } };

    case "asset.delete": {
      if (!(op.assetId in doc.assets)) return doc;
      const assets = { ...doc.assets };
      delete assets[op.assetId];
      return { ...doc, assets };
    }

    case "element.put":
    case "element.delete":
    case "element.order": {
      const page = doc.pages.find((p) => p.id === op.pageId);
      if (!page) return doc;
      const elements = applyToElements(page.elements, op);
      if (elements === page.elements) return doc;
      return { ...doc, pages: doc.pages.map((p) => (p.id === op.pageId ? { ...p, elements } : p)) };
    }
  }
}

export function applyOperations(doc: BoardDocument, ops: readonly BoardOperation[]): BoardDocument {
  return ops.reduce(applyOperation, doc);
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/**
 * Operations that turn `prev` into `next` for one page. Unchanged elements are
 * detected by reference, so this is O(n) and emits nothing for untouched ones.
 */
export function diffElements(pageId: string, prev: readonly BoardElement[], next: readonly BoardElement[]): BoardOperation[] {
  if (prev === next) return [];
  const ops: BoardOperation[] = [];
  const nextIds = new Set(next.map((el) => el.id));
  const prevById = new Map(prev.map((el) => [el.id, el]));

  for (const el of prev) {
    if (!nextIds.has(el.id)) ops.push({ type: "element.delete", pageId, id: el.id });
  }
  next.forEach((el, i) => {
    if (prevById.get(el.id) === el) return;
    ops.push({ type: "element.put", pageId, element: el, after: i === 0 ? null : next[i - 1].id });
  });

  const keptBefore = prev.filter((el) => nextIds.has(el.id)).map((el) => el.id);
  const keptAfter = next.filter((el) => prevById.has(el.id)).map((el) => el.id);
  if (!sameOrder(keptBefore, keptAfter)) {
    ops.push({ type: "element.order", pageId, order: next.map((el) => el.id) });
  }
  return ops;
}

/** Operations that turn one document into another. */
export function diffDocuments(prev: BoardDocument, next: BoardDocument): BoardOperation[] {
  if (prev === next) return [];
  const ops: BoardOperation[] = [];
  if (prev.title !== next.title) ops.push({ type: "board.update", title: next.title });

  // Assets first, so receivers have the pixels before any element references them.
  if (prev.assets !== next.assets) {
    for (const [id, asset] of Object.entries(next.assets)) {
      if (prev.assets[id] !== asset) ops.push({ type: "asset.put", asset });
    }
  }

  const nextIds = new Set(next.pages.map((page) => page.id));
  const prevById = new Map<string, BoardPage>(prev.pages.map((page) => [page.id, page]));

  next.pages.forEach((page, i) => {
    const before = prevById.get(page.id);
    if (!before) {
      ops.push({ type: "page.insert", page, after: i === 0 ? null : next.pages[i - 1].id });
      return;
    }
    if (before === page) return;
    if (before.name !== page.name) ops.push({ type: "page.update", pageId: page.id, name: page.name });
    if (before.background !== page.background) {
      ops.push({ type: "page.background", pageId: page.id, background: page.background });
    }
    ops.push(...diffElements(page.id, before.elements, page.elements));
  });
  // Deletes after inserts: replacing the only page must not hit the
  // "at least one page" guard in applyOperation.
  for (const page of prev.pages) {
    if (!nextIds.has(page.id)) ops.push({ type: "page.delete", pageId: page.id });
  }

  const keptBefore = prev.pages.filter((p) => nextIds.has(p.id)).map((p) => p.id);
  const keptAfter = next.pages.filter((p) => prevById.has(p.id)).map((p) => p.id);
  if (!sameOrder(keptBefore, keptAfter)) ops.push({ type: "page.order", order: next.pages.map((p) => p.id) });

  // Asset removals last, after nothing references them any more.
  if (prev.assets !== next.assets) {
    for (const id of Object.keys(prev.assets)) {
      if (!(id in next.assets)) ops.push({ type: "asset.delete", assetId: id });
    }
  }
  return ops;
}

/** Element ids touched by a set of operations (used for permission checks). */
export function touchedElementIds(ops: readonly BoardOperation[]): Set<string> {
  const ids = new Set<string>();
  for (const op of ops) {
    if (op.type === "element.put") ids.add(op.element.id);
    else if (op.type === "element.delete") ids.add(op.id);
  }
  return ids;
}
