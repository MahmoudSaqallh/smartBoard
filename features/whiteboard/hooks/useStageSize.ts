"use client";

import { useEffect, useState, type RefObject } from "react";
import type { Size } from "../types";

/**
 * Tracks an element's size with ResizeObserver, covering window resizes,
 * panel collapse, orientation changes and mobile browser chrome.
 */
export function useStageSize(ref: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width);
      const height = Math.floor(entry.contentRect.height);
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
