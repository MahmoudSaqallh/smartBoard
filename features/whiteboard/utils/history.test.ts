import { describe, expect, it } from "vitest";
import { DEFAULT_BACKGROUND } from "../background/presets";
import { createDocument } from "../model/document";
import { applyOperations } from "../model/operations";
import type { BoardDocument, BoardElement, HistoryEntry } from "../types";
import { createEntry, createHistory, recordHistory, redoHistory, undoHistory } from "./history";

const rect = (id: string, x = 0): BoardElement => ({
  id,
  type: "rectangle",
  x,
  y: 0,
  rotation: 0,
  width: 10,
  height: 10,
  color: "#000000",
  strokeWidth: 2,
  filled: false,
});

const docWith = (elements: BoardElement[]): BoardDocument =>
  createDocument({ id: "b", title: "T", pages: [{ id: "p", name: "Page 1", background: DEFAULT_BACKGROUND, elements }] });

const elementsOf = (doc: BoardDocument) => doc.pages[0].elements;

/** Records a change from `before` to `after` and returns the entry. */
const entry = (before: BoardElement[], after: BoardElement[]): HistoryEntry => createEntry("p", before, after)!;

describe("history entries", () => {
  it("returns null for a no-op change", () => {
    const elements = [rect("a")];
    expect(createEntry("p", elements, elements)).toBeNull();
  });

  it("inverse operations restore the previous state", () => {
    const before = [rect("a"), rect("b")];
    const after = [rect("b", 50), rect("c")]; // a deleted, b moved and reordered, c added
    const e = entry(before, after);
    expect(elementsOf(applyOperations(docWith(before), e.ops))).toEqual(after);
    expect(elementsOf(applyOperations(docWith(after), e.inverse))).toEqual(before);
  });
});

describe("history stacks", () => {
  it("undoes and redoes in order", () => {
    const s0: BoardElement[] = [];
    const s1 = [rect("a")];
    const s2 = [rect("a"), rect("b")];

    let history = recordHistory(createHistory(), entry(s0, s1), { now: 0 });
    history = recordHistory(history, entry(s1, s2), { now: 5000 });

    let doc = docWith(s2);
    const undo1 = undoHistory(history)!;
    doc = applyOperations(doc, undo1.entry.inverse);
    expect(elementsOf(doc).map((el) => el.id)).toEqual(["a"]);

    const undo2 = undoHistory(undo1.history)!;
    doc = applyOperations(doc, undo2.entry.inverse);
    expect(elementsOf(doc)).toEqual([]);

    const redo1 = redoHistory(undo2.history)!;
    doc = applyOperations(doc, redo1.entry.ops);
    const redo2 = redoHistory(redo1.history)!;
    doc = applyOperations(doc, redo2.entry.ops);
    expect(elementsOf(doc).map((el) => el.id)).toEqual(["a", "b"]);
  });

  it("returns null when there is nothing to undo or redo, however often it is called", () => {
    const empty = createHistory();
    for (let i = 0; i < 5; i += 1) {
      expect(undoHistory(empty)).toBeNull();
      expect(redoHistory(empty)).toBeNull();
    }
  });

  it("clears the redo stack when a new change is recorded", () => {
    const history = recordHistory(createHistory(), entry([], [rect("a")]), { now: 0 });
    const undone = undoHistory(history)!;
    expect(undone.history.future).toHaveLength(1);

    const branched = recordHistory(undone.history, entry([], [rect("b")]), { now: 10_000 });
    expect(branched.future).toHaveLength(0);
    expect(redoHistory(branched)).toBeNull();
  });

  it("caps the number of undo steps", () => {
    let history = createHistory();
    for (let i = 0; i < 10; i += 1) {
      history = recordHistory(history, entry([], [rect(String(i))]), { now: i * 5000, limit: 3 });
    }
    expect(history.past).toHaveLength(3);
  });

  it("merges rapid changes sharing a coalesce key into one reversible step", () => {
    const original = [rect("a", 0)];
    const moved1 = [rect("a", 10)];
    const moved2 = [rect("a", 20)];
    let history = recordHistory(createHistory(), entry(original, moved1), { coalesceKey: "nudge", now: 0 });
    history = recordHistory(history, entry(moved1, moved2), { coalesceKey: "nudge", now: 200 });

    expect(history.past).toHaveLength(1);
    const reverted = applyOperations(docWith(moved2), history.past[0].inverse);
    expect(elementsOf(reverted)).toEqual(original);
  });

  it("does not merge changes with different keys or after the window", () => {
    let history = recordHistory(createHistory(), entry([], [rect("a")]), { coalesceKey: "a", now: 0 });
    history = recordHistory(history, entry([], [rect("b")]), { coalesceKey: "b", now: 100 });
    history = recordHistory(history, entry([], [rect("c")]), { coalesceKey: "b", now: 5000 });
    expect(history.past).toHaveLength(3);
  });

  it("never merges into a step that was undone", () => {
    const history = recordHistory(createHistory(), entry([], [rect("a")]), { coalesceKey: "k", now: 0 });
    const undone = undoHistory(history)!;
    const next = recordHistory(undone.history, entry([], [rect("b")]), { coalesceKey: "k", now: 100 });
    expect(next.past).toHaveLength(1);
  });
});

describe("undo with concurrent edits", () => {
  it("only reverts this user's change, keeping another user's edit", () => {
    const mine = entry([], [rect("mine")]);
    // Someone else adds an element after my change.
    const withRemote = [rect("mine"), rect("theirs")];
    const afterUndo = applyOperations(docWith(withRemote), mine.inverse);
    expect(elementsOf(afterUndo).map((el) => el.id)).toEqual(["theirs"]);
  });
});
