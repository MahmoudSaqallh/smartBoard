/**
 * Permission policy: one pure function deciding what an actor may do.
 *
 * The client calls it to disable controls and reject local edits early. That
 * is UX, not security: once boards are shared, the server must run the same
 * checks on every incoming operation before accepting it.
 */
import type { BoardElement, ToolId } from "@/features/whiteboard/types";

export type Role = "teacher" | "student";

/** Classroom-wide switches a teacher controls. */
export interface ClassroomPolicy {
  /** Freezes the whole board for students. */
  boardLocked: boolean;
  /** Students may create and change content. */
  studentsCanDraw: boolean;
  /** Drawing tools students may use; navigation tools are always allowed. */
  allowedStudentTools: ToolId[] | "all";
}

export interface PermissionContext {
  userId: string;
  role: Role;
  policy: ClassroomPolicy;
}

export type PermissionAction =
  | { type: "tool.use"; tool: ToolId }
  /** Any content change at all (create, edit, erase, undo). */
  | { type: "board.edit" }
  /** Move, restyle, edit text or delete one existing element. */
  | { type: "element.edit"; element: BoardElement }
  /** Lock or unlock an element. */
  | { type: "element.lock"; element: BoardElement }
  | { type: "page.manage" }
  | { type: "board.manage" };

export const OPEN_POLICY: ClassroomPolicy = {
  boardLocked: false,
  studentsCanDraw: true,
  allowedStudentTools: "all",
};

/** Single-user sessions: the local user owns the board. */
export const LOCAL_OWNER: PermissionContext = { userId: "local-user", role: "teacher", policy: OPEN_POLICY };

const NAVIGATION_TOOLS: ReadonlySet<ToolId> = new Set(["select", "hand"]);

function studentCanDraw({ policy }: PermissionContext): boolean {
  return !policy.boardLocked && policy.studentsCanDraw;
}

/**
 * Locks protect an element from everyone, the teacher included, so a locked
 * background or worksheet cannot be changed by accident. The teacher's
 * override is the right to unlock (`element.lock`); students cannot change locks.
 */
export function can(context: PermissionContext, action: PermissionAction): boolean {
  const isTeacher = context.role === "teacher";

  switch (action.type) {
    case "tool.use":
      if (isTeacher || NAVIGATION_TOOLS.has(action.tool)) return true;
      return (
        studentCanDraw(context) &&
        (context.policy.allowedStudentTools === "all" || context.policy.allowedStudentTools.includes(action.tool))
      );
    case "board.edit":
      return isTeacher || studentCanDraw(context);
    case "element.edit":
      return !action.element.locked && (isTeacher || studentCanDraw(context));
    case "element.lock":
    case "page.manage":
    case "board.manage":
      return isTeacher;
  }
}
