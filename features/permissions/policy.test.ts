import { describe, expect, it } from "vitest";
import type { BoardElement } from "@/features/whiteboard/types";
import { can, OPEN_POLICY, type PermissionContext } from "./policy";

const element: BoardElement = { id: "s", type: "sticky", x: 0, y: 0, rotation: 0, text: "", width: 200, height: 200, color: "#fff0a6" };
const locked: BoardElement = { ...element, locked: true };

const student = (policy: Partial<PermissionContext["policy"]> = {}): PermissionContext => ({
  userId: "s1",
  role: "student",
  policy: { ...OPEN_POLICY, ...policy },
});
const teacher: PermissionContext = { userId: "t1", role: "teacher", policy: { ...OPEN_POLICY, boardLocked: true, studentsCanDraw: false } };

describe("permission policy", () => {
  it("does not restrict teachers by classroom policy", () => {
    expect(can(teacher, { type: "tool.use", tool: "pen" })).toBe(true);
    expect(can(teacher, { type: "board.edit" })).toBe(true);
    expect(can(teacher, { type: "page.manage" })).toBe(true);
  });

  it("makes locks bind everyone, with unlocking as the teacher's override", () => {
    expect(can(teacher, { type: "element.edit", element: locked })).toBe(false);
    expect(can(teacher, { type: "element.lock", element: locked })).toBe(true);
    expect(can(student(), { type: "element.lock", element })).toBe(false);
    expect(can(student(), { type: "element.lock", element: locked })).toBe(false);
  });

  it("lets students draw on an open board but not manage pages or the board", () => {
    const ctx = student();
    expect(can(ctx, { type: "board.edit" })).toBe(true);
    expect(can(ctx, { type: "tool.use", tool: "pen" })).toBe(true);
    expect(can(ctx, { type: "page.manage" })).toBe(false);
    expect(can(ctx, { type: "board.manage" })).toBe(false);
  });

  it("blocks student edits when the board is locked or drawing is disabled", () => {
    for (const ctx of [student({ boardLocked: true }), student({ studentsCanDraw: false })]) {
      expect(can(ctx, { type: "board.edit" })).toBe(false);
      expect(can(ctx, { type: "tool.use", tool: "pen" })).toBe(false);
      expect(can(ctx, { type: "element.edit", element })).toBe(false);
    }
  });

  it("always allows navigation tools so students can follow along", () => {
    const ctx = student({ boardLocked: true });
    expect(can(ctx, { type: "tool.use", tool: "select" })).toBe(true);
    expect(can(ctx, { type: "tool.use", tool: "hand" })).toBe(true);
  });

  it("restricts students to the allowed tool list", () => {
    const ctx = student({ allowedStudentTools: ["pen", "sticky"] });
    expect(can(ctx, { type: "tool.use", tool: "pen" })).toBe(true);
    expect(can(ctx, { type: "tool.use", tool: "eraser" })).toBe(false);
  });

  it("protects locked elements from students", () => {
    expect(can(student(), { type: "element.edit", element })).toBe(true);
    expect(can(student(), { type: "element.edit", element: locked })).toBe(false);
  });
});
