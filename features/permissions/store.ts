import { create } from "zustand";
import { can, LOCAL_OWNER, type PermissionAction, type PermissionContext } from "./policy";

interface PermissionState {
  context: PermissionContext;
  /** Set by the classroom/session layer (e.g. from the server) once roles exist. */
  setContext: (context: PermissionContext) => void;
}

export const usePermissionStore = create<PermissionState>()((set) => ({
  context: LOCAL_OWNER,
  setContext: (context) => set({ context }),
}));

export function getPermissionContext(): PermissionContext {
  return usePermissionStore.getState().context;
}

/** Reactive permission check for UI (disable controls the user cannot use). */
export function useCan(action: PermissionAction): boolean {
  return usePermissionStore((s) => can(s.context, action));
}
