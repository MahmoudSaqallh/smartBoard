"use client";

import { useSyncExternalStore } from "react";
import type { BoardAsset } from "../types";

/**
 * Decoded images by asset id. Asset sources are immutable (replacing an
 * image creates a new asset), so entries never go stale. Shared by image
 * elements, backgrounds and export.
 */
type Status = "loading" | "ready" | "error";
interface Entry {
  status: Status;
  image: HTMLImageElement;
}

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

function ensure(asset: BoardAsset): Entry {
  let entry = entries.get(asset.id);
  if (!entry) {
    const image = new Image();
    entry = { status: "loading", image };
    entries.set(asset.id, entry);
    const current = entry;
    image.onload = () => {
      current.status = "ready";
      notify();
    };
    image.onerror = () => {
      current.status = "error";
      notify();
    };
    image.src = asset.src;
  }
  return entry;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Decoded image (or null while loading / on error) plus its status. */
export function useAssetImage(asset: BoardAsset | undefined): { image: HTMLImageElement | null; status: Status | "missing" } {
  const status = useSyncExternalStore(
    subscribe,
    () => (asset ? ensure(asset).status : "missing"),
    () => "loading" as const,
  );
  return { image: asset && status === "ready" ? entries.get(asset.id)!.image : null, status };
}

/** Synchronous lookup for export; null unless the image has finished loading. */
export function getLoadedImage(asset: BoardAsset | undefined): HTMLImageElement | null {
  if (!asset) return null;
  const entry = ensure(asset);
  return entry.status === "ready" ? entry.image : null;
}
