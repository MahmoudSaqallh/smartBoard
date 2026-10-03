"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribes to a media query. `serverValue` is used during SSR and
 * hydration, so markup matches and the real value applies right after.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

export const DESKTOP_QUERY = "(min-width: 1024px)";

export function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)", false);
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
