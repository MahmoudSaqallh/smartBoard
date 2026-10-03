import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_STYLE, MAX_PAGES, MAX_ZOOM, MIN_ZOOM } from "../constants";
import type { BoardElement } from "../types";
import { BACKGROUND_PRESETS, DEFAULT_BACKGROUND } from "../background/presets";
import {
  createImageElement,
  createQrElement,
  createShapeFromDrag,
  createSticky,
  createText,
  createTimerElement,
} from "../utils/elements";
import { useTimerRuntime } from "../widgets/runtime-store";
import { LOCAL_OWNER, OPEN_POLICY } from "@/features/permissions/policy";
import { usePermissionStore } from "@/features/permissions/store";
import { getActivePage, getActiveViewport, resetBoardStore, useBoardStore } from "./board-store";
import { subscribeToOperations, type OperationBatch } from "./operations-feed";

const store = () => useBoardStore.getState();
const activeElements = () => getActivePage(store()).elements;

function rect(id: string): BoardElement {
  return createShapeFromDrag("rectangle", { x: 0, y: 0 }, { x: 80, y: 40 }, DEFAULT_STYLE, false, id)!;
}

beforeEach(() => {
  resetBoardStore();
  usePermissionStore.getState().setContext(LOCAL_OWNER);
  store().setStageSize({ width: 1000, height: 800 });
});

describe("tool state", () => {
  it("starts with the pen and switches tools", () => {
    expect(store().activeTool).toBe("pen");
    store().setTool("rectangle");
    expect(store().activeTool).toBe("rectangle");
  });

  it("clears the selection when leaving the select tool", () => {
    store().addElement(rect("a"));
    store().setTool("select");
    store().select(["a"]);
    store().setTool("pen");
    expect(store().selectedIds).toEqual([]);
  });

  it("applies style changes to the selection as one undo step", () => {
    store().addElement(rect("a"));
    store().setTool("select");
    store().select(["a"]);
    store().setStyle({ strokeWidth: 6 });
    store().setStyle({ strokeWidth: 9 });
    store().setStyle({ strokeWidth: 12 });

    expect(activeElements()[0]).toMatchObject({ strokeWidth: 12 });
    expect(store().style.strokeWidth).toBe(12);

    store().undo();
    expect(activeElements()[0]).toMatchObject({ strokeWidth: DEFAULT_STYLE.strokeWidth });
  });
});

describe("undo / redo", () => {
  it("undoes and redoes element creation", () => {
    store().addElement(rect("a"));
    store().addElement(rect("b"));
    store().undo();
    expect(activeElements().map((el) => el.id)).toEqual(["a"]);
    store().redo();
    expect(activeElements().map((el) => el.id)).toEqual(["a", "b"]);
  });

  it("is safe to call repeatedly with an empty history", () => {
    for (let i = 0; i < 10; i += 1) {
      store().undo();
      store().redo();
    }
    expect(activeElements()).toEqual([]);
  });

  it("restores a cleared page", () => {
    store().addElement(rect("a"));
    store().clearPage();
    expect(activeElements()).toEqual([]);
    expect(store().toast?.action).toBe("undo");
    store().undo();
    expect(activeElements().map((el) => el.id)).toEqual(["a"]);
  });

  it("does not record history for no-op actions", () => {
    store().clearPage();
    store().deleteSelected();
    store().eraseElements([]);
    store().eraseElements(["missing"]);
    store().undo();
    expect(store().histories[store().activePageId].past).toHaveLength(0);
  });

  it("drops selected ids that no longer exist after undo", () => {
    store().addElement(rect("a"));
    store().setTool("select");
    store().select(["a"]);
    store().undo();
    expect(store().selectedIds).toEqual([]);
  });
});

describe("deleting", () => {
  it("does nothing when nothing is selected", () => {
    store().addElement(rect("a"));
    store().deleteSelected();
    expect(activeElements()).toHaveLength(1);
  });

  it("deletes the selection", () => {
    store().addElement(rect("a"));
    store().addElement(rect("b"));
    store().setTool("select");
    store().select(["a"]);
    store().deleteSelected();
    expect(activeElements().map((el) => el.id)).toEqual(["b"]);
    expect(store().selectedIds).toEqual([]);
  });
});

describe("pages", () => {
  it("keeps each page's elements and history separate", () => {
    const firstPage = store().activePageId;
    store().addElement(rect("on-first"));

    store().addPage();
    const secondPage = store().activePageId;
    expect(secondPage).not.toBe(firstPage);
    expect(activeElements()).toEqual([]);
    store().addElement(rect("on-second"));

    store().switchPage(firstPage);
    expect(activeElements().map((el) => el.id)).toEqual(["on-first"]);

    // Undo only affects the active page.
    store().undo();
    expect(activeElements()).toEqual([]);
    store().switchPage(secondPage);
    expect(activeElements().map((el) => el.id)).toEqual(["on-second"]);
  });

  it("keeps a separate viewport per page", () => {
    const firstPage = store().activePageId;
    store().zoomIn();
    const zoomed = getActiveViewport(store()).scale;
    store().addPage();
    expect(getActiveViewport(store()).scale).toBe(1);
    store().switchPage(firstPage);
    expect(getActiveViewport(store()).scale).toBe(zoomed);
  });

  it("ignores switching to an unknown page", () => {
    const before = store().activePageId;
    store().switchPage("does-not-exist");
    expect(store().activePageId).toBe(before);
  });

  it("names new pages without duplicates after deletions", () => {
    store().addPage(); // Page 2
    store().addPage(); // Page 3
    const page2 = store().doc.pages[1].id;
    store().deletePage(page2);
    store().addPage();
    expect(store().doc.pages.map((p) => p.name).sort()).toEqual(["Page 1", "Page 2", "Page 3"]);
  });

  it("refuses to delete the last page", () => {
    store().deletePage(store().activePageId);
    expect(store().doc.pages).toHaveLength(1);
    expect(store().toast?.message).toMatch(/at least one page/);
  });

  it("activates a neighbouring page when the active page is deleted", () => {
    store().addPage();
    const second = store().activePageId;
    store().deletePage(second);
    expect(store().doc.pages).toHaveLength(1);
    expect(store().activePageId).toBe(store().doc.pages[0].id);
    expect(store().histories[second]).toBeUndefined();
  });

  it("ignores empty page names and trims long ones", () => {
    const id = store().activePageId;
    store().renamePage(id, "   ");
    expect(store().doc.pages[0].name).toBe("Page 1");
    store().renamePage(id, `  ${"x".repeat(100)}  `);
    expect(store().doc.pages[0].name).toHaveLength(40);
  });

  it("enforces the page limit", () => {
    for (let i = 0; i < MAX_PAGES + 5; i += 1) store().addPage();
    expect(store().doc.pages).toHaveLength(MAX_PAGES);
  });

  it("duplicates a page with fresh element ids", () => {
    store().addElement(rect("a"));
    store().duplicatePage(store().activePageId);
    expect(store().doc.pages).toHaveLength(2);
    expect(activeElements()).toHaveLength(1);
    expect(activeElements()[0].id).not.toBe("a");
  });
});

describe("text editing", () => {
  it("removes a new text element left empty without an undo step", () => {
    store().createAndEdit(createText({ x: 0, y: 0 }, DEFAULT_STYLE, "t"));
    store().finishEditing();
    expect(activeElements()).toEqual([]);
    expect(store().histories[store().activePageId].past).toHaveLength(0);
  });

  it("keeps typed text when the page changes mid-edit", () => {
    const firstPage = store().activePageId;
    store().createAndEdit(createText({ x: 0, y: 0 }, DEFAULT_STYLE, "t"));
    store().updateEditingText("Photosynthesis");
    store().addPage();
    store().switchPage(firstPage);

    expect(store().editingId).toBeNull();
    expect(activeElements()[0]).toMatchObject({ id: "t", text: "Photosynthesis" });
    store().undo();
    expect(activeElements()).toEqual([]);
  });

  it("keeps empty sticky notes", () => {
    store().createAndEdit(createSticky({ x: 0, y: 0 }, DEFAULT_STYLE, "s"));
    store().finishEditing();
    expect(activeElements()).toHaveLength(1);
  });
});

describe("zoom", () => {
  it("stays within limits under repeated zooming", () => {
    for (let i = 0; i < 30; i += 1) store().zoomIn();
    expect(getActiveViewport(store()).scale).toBe(MAX_ZOOM);
    for (let i = 0; i < 30; i += 1) store().zoomOut();
    expect(getActiveViewport(store()).scale).toBe(MIN_ZOOM);
    store().resetZoom();
    expect(getActiveViewport(store()).scale).toBe(1);
  });

  it("clamps viewports set directly and rejects invalid coordinates", () => {
    store().setViewport({ x: Number.NaN, y: 10, scale: 999 });
    expect(getActiveViewport(store())).toEqual({ x: 0, y: 10, scale: MAX_ZOOM });
  });

  it("zoom to fit resets the view on an empty page", () => {
    store().zoomIn();
    store().zoomToFit();
    expect(getActiveViewport(store())).toEqual({ x: 0, y: 0, scale: 1 });
  });
});

describe("object locking", () => {
  const ids = () => activeElements().map((el) => el.id);
  const lock = (...lockIds: string[]) => {
    store().setTool("select");
    store().select(lockIds);
    store().setSelectionLocked(true);
  };

  it("locks and unlocks the selection as undoable steps", () => {
    store().addElement(rect("a"));
    lock("a");
    expect(activeElements()[0].locked).toBe(true);
    store().toggleSelectionLock();
    expect(activeElements()[0].locked).toBeFalsy();
    store().undo();
    expect(activeElements()[0].locked).toBe(true);
  });

  it("protects locked objects from moving, restyling, text edits and deletion, even for the teacher", () => {
    store().addElement(rect("a"));
    store().addElement(createSticky({ x: 0, y: 0 }, DEFAULT_STYLE, "s"));
    lock("a", "s");

    store().nudgeSelected(10, 0);
    store().setStyle({ color: "#d92d20" });
    store().deleteSelected();
    store().transformElements({ a: { x: 99, y: 99, rotation: 0, scaleX: 1, scaleY: 1 } });
    store().startEditing("s");

    expect(ids()).toEqual(["a", "s"]);
    expect(activeElements()[0]).toMatchObject({ x: 0, color: DEFAULT_STYLE.color });
    expect(store().editingId).toBeNull();
    expect(store().toast?.message).toMatch(/locked/i);
  });

  it("skips locked objects in bulk actions instead of failing them", () => {
    store().addElement(rect("background"));
    store().addElement(rect("stroke"));
    lock("background");

    store().eraseElements(["background", "stroke"]);
    expect(ids()).toEqual(["background"]);

    store().addElement(rect("note"));
    store().clearPage();
    expect(ids()).toEqual(["background"]);
    expect(store().toast?.message).toMatch(/locked, kept/);
  });

  it("deletes the unlocked part of a mixed selection and keeps locked ones selected", () => {
    store().addElement(rect("a"));
    store().addElement(rect("b"));
    lock("a");
    store().select(["a", "b"]);
    store().deleteSelected();
    expect(ids()).toEqual(["a"]);
    expect(store().selectedIds).toEqual(["a"]);
  });

  it("leaves locked objects out of select-all but still allows reordering them", () => {
    store().addElement(rect("a"));
    store().addElement(rect("b"));
    lock("b");
    store().selectAll();
    expect(store().selectedIds).toEqual(["a"]);
    store().select(["b"]);
    store().sendSelectedToBack();
    expect(ids()).toEqual(["b", "a"]);
  });

  it("duplicates a locked object as an editable copy", () => {
    store().addElement(rect("a"));
    lock("a");
    store().duplicateSelected();
    expect(activeElements()).toHaveLength(2);
    expect(activeElements()[1].locked).toBeFalsy();
  });

  it("does not let students change locks", () => {
    store().addElement(rect("a"));
    lock("a");
    usePermissionStore.getState().setContext({ userId: "s1", role: "student", policy: OPEN_POLICY });
    store().setSelectionLocked(false);
    expect(activeElements()[0].locked).toBe(true);
    expect(store().toast?.message).toMatch(/permission/);
  });

  it("refuses an undo that would move an object someone else has since locked", () => {
    const pageId = store().activePageId;
    store().addElement(rect("a"));
    store().setTool("select");
    store().select(["a"]);
    store().nudgeSelected(10, 0);
    // The teacher locks it from another device.
    const moved = activeElements()[0];
    store().applyRemoteOperations([{ type: "element.put", pageId, element: { ...moved, locked: true }, after: null }]);

    store().undo();
    expect(activeElements()[0]).toMatchObject({ x: 10, locked: true });
    expect(store().toast?.message).toMatch(/locked/i);
  });
});

describe("inserted objects", () => {
  const asset = { id: "a1", kind: "image" as const, src: "data:image/png;base64,AA==", mimeType: "image/png" as const, width: 800, height: 400 };

  it("inserts an image as one undoable step, selected and ready to move", () => {
    expect(store().addAsset(asset)).toBe(true);
    store().insertObject(createImageElement(asset, { x: 0, y: 0 }, 640, "img"));
    expect(activeElements().map((el) => el.id)).toEqual(["img"]);
    expect(store().selectedIds).toEqual(["img"]);
    expect(store().activeTool).toBe("select");

    store().undo();
    expect(activeElements()).toEqual([]);
    // Assets are append-only, so redo (and undoing a deletion) still has the pixels.
    expect(store().doc.assets.a1).toBeDefined();
    store().redo();
    expect(activeElements().map((el) => el.id)).toEqual(["img"]);
  });

  it("undoes image deletion with the asset intact", () => {
    store().addAsset(asset);
    store().insertObject(createImageElement(asset, { x: 0, y: 0 }, 640, "img"));
    store().deleteSelected();
    expect(activeElements()).toEqual([]);
    store().undo();
    expect(activeElements()[0]).toMatchObject({ id: "img", assetId: "a1" });
  });

  it("records QR edits as undoable changes", () => {
    store().insertObject(createQrElement("https://a.example", "", { x: 0, y: 0 }, "qr"));
    store().updateElement("qr", (el) => (el.type === "qr" ? { ...el, content: "Homework", label: "Scan me" } : el));
    expect(activeElements()[0]).toMatchObject({ content: "Homework", label: "Scan me" });
    store().undo();
    expect(activeElements()[0]).toMatchObject({ content: "https://a.example", label: "" });
  });

  it("refuses assets for users who cannot edit", () => {
    usePermissionStore.getState().setContext({ userId: "s1", role: "student", policy: { ...OPEN_POLICY, boardLocked: true } });
    expect(store().addAsset(asset)).toBe(false);
    expect(store().doc.assets).toEqual({});
  });
});

describe("page backgrounds", () => {
  const dark = BACKGROUND_PRESETS.find((p) => p.id === "dark")!.background;
  const graph = BACKGROUND_PRESETS.find((p) => p.id === "graph")!.background;

  it("changes only the active page", () => {
    store().addPage();
    store().setPageBackground(dark);
    expect(store().doc.pages[1].background).toBe(dark);
    expect(store().doc.pages[0].background).toEqual(DEFAULT_BACKGROUND);
  });

  it("starts new pages with the current page's background", () => {
    store().setPageBackground(graph);
    store().addPage();
    expect(getActivePage(store()).background).toBe(graph);
    store().setPageBackground(dark);
    expect(store().doc.pages[0].background).toBe(graph);
  });

  it("undoes and redoes background changes, merging slider drags", () => {
    store().setPageBackground(graph);
    for (const opacity of [0.3, 0.2, 0.1]) {
      store().setPageBackground({ ...getActivePage(store()).background, pattern: { ...graph.pattern, opacity } as typeof graph.pattern }, "bg:opacity");
    }
    store().undo(); // all opacity changes at once
    expect(getActivePage(store()).background).toBe(graph);
    store().undo();
    expect(getActivePage(store()).background).toEqual(DEFAULT_BACKGROUND);
    store().redo();
    expect(getActivePage(store()).background).toBe(graph);
  });

  it("keeps background changes with the teacher", () => {
    usePermissionStore.getState().setContext({ userId: "s1", role: "student", policy: OPEN_POLICY });
    store().setPageBackground(dark);
    expect(getActivePage(store()).background).toEqual(DEFAULT_BACKGROUND);
  });
});

describe("timer configuration vs runtime", () => {
  it("never writes running state into the document", () => {
    store().insertObject(createTimerElement("countdown", { x: 0, y: 0 }, "#1f2328", "t"));
    const before = store().doc;
    useTimerRuntime.getState().start("t");
    useTimerRuntime.getState().pause("t");
    expect(store().doc).toBe(before);
    expect(useTimerRuntime.getState().runtimes.t.status).toBe("paused");
    useTimerRuntime.getState().reset("t");
  });

  it("completes a running countdown only once", () => {
    useTimerRuntime.getState().start("t2");
    expect(useTimerRuntime.getState().complete("t2", 1000)).toBe(true);
    expect(useTimerRuntime.getState().complete("t2", 1000)).toBe(false);
    useTimerRuntime.getState().reset("t2");
  });
});

describe("remote operations", () => {
  it("applies remote changes without adding them to local undo", () => {
    const pageId = store().activePageId;
    store().addElement(rect("mine"));
    store().applyRemoteOperations([{ type: "element.put", pageId, element: rect("theirs"), after: "mine" }]);
    expect(activeElements().map((el) => el.id)).toEqual(["mine", "theirs"]);

    // Undo reverts only my change; the collaborator's element stays.
    store().undo();
    expect(activeElements().map((el) => el.id)).toEqual(["theirs"]);
    store().undo();
    expect(activeElements().map((el) => el.id)).toEqual(["theirs"]);
  });

  it("drops selection and editing state for elements deleted remotely", () => {
    const pageId = store().activePageId;
    store().createAndEdit(createSticky({ x: 0, y: 0 }, DEFAULT_STYLE, "s"));
    store().applyRemoteOperations([{ type: "element.delete", pageId, id: "s" }]);
    expect(store().editingId).toBeNull();
    expect(activeElements()).toEqual([]);
  });

  it("falls back to another page when the active page is deleted remotely", () => {
    const first = store().activePageId;
    store().addPage();
    const second = store().activePageId;
    store().applyRemoteOperations([{ type: "page.delete", pageId: second }]);
    expect(store().activePageId).toBe(first);
  });
});

describe("operations feed", () => {
  it("reports local and remote changes with their origin", () => {
    const batches: OperationBatch[] = [];
    const unsubscribe = subscribeToOperations((batch) => batches.push(batch));
    const pageId = store().activePageId;

    store().addElement(rect("a"));
    store().setViewport({ x: 10, y: 10, scale: 2 }); // local-only state: no operations
    store().applyRemoteOperations([{ type: "element.delete", pageId, id: "a" }]);
    unsubscribe();
    store().addElement(rect("b"));

    expect(batches.map((b) => [b.origin, b.ops.map((op) => op.type)])).toEqual([
      ["local", ["element.put"]],
      ["remote", ["element.delete"]],
    ]);
  });

  it("attributes each batch to an actor with a timestamp", () => {
    const batches: OperationBatch[] = [];
    const unsubscribe = subscribeToOperations((batch) => batches.push(batch));
    const pageId = store().activePageId;
    store().addElement(rect("a"));
    store().applyRemoteOperations([{ type: "element.delete", pageId, id: "a" }], { actorId: "student-7" });
    unsubscribe();

    expect(batches.map((b) => b.actorId)).toEqual([LOCAL_OWNER.userId, "student-7"]);
    expect(batches.every((b) => typeof b.at === "number" && b.at > 0)).toBe(true);
  });
});

describe("permission enforcement", () => {
  const asStudent = (policy: Partial<typeof OPEN_POLICY> = {}) =>
    usePermissionStore.getState().setContext({ userId: "s1", role: "student", policy: { ...OPEN_POLICY, ...policy } });

  it("rejects every kind of content change on a locked board", () => {
    store().addElement(rect("a"));
    store().setTool("select");
    store().select(["a"]);
    asStudent({ boardLocked: true });

    store().addElement(rect("b"));
    store().deleteSelected();
    store().eraseElements(["a"]);
    store().nudgeSelected(5, 0);
    store().clearPage();
    store().undo();
    store().createAndEdit(createText({ x: 0, y: 0 }, DEFAULT_STYLE, "t"));

    expect(activeElements().map((el) => el.id)).toEqual(["a"]);
    expect(activeElements()[0].x).toBe(0);
    expect(store().editingId).toBeNull();
    expect(store().toast?.message).toMatch(/permission/);
  });

  it("protects locked elements while allowing other edits", () => {
    store().addElement({ ...rect("locked"), locked: true });
    asStudent();
    store().eraseElements(["locked"]);
    expect(activeElements()).toHaveLength(1);
    store().addElement(rect("free"));
    expect(activeElements()).toHaveLength(2);
  });

  it("refuses disallowed tools but keeps navigation", () => {
    asStudent({ allowedStudentTools: ["pen"] });
    store().setTool("eraser");
    expect(store().activeTool).toBe("pen");
    store().setTool("hand");
    expect(store().activeTool).toBe("hand");
  });

  it("keeps page management with the teacher", () => {
    asStudent();
    store().addPage();
    store().renamePage(store().activePageId, "Hacked");
    expect(store().doc.pages.map((p) => p.name)).toEqual(["Page 1"]);
  });
});
