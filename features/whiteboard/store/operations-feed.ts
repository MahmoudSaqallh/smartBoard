/**
 * Operations feed: the one integration point for anything that reacts to
 * document changes (realtime sync, autosave, version history, replay,
 * notifications, analytics).
 *
 * Operations are derived at the store boundary by diffing the previous and
 * next document, so store actions stay simple and no change can bypass the feed.
 *
 * Sync providers send `origin: "local"` batches and apply incoming ones with
 * `applyRemoteOperations`, which comes back here as `origin: "remote"`.
 */
import { diffDocuments } from "../model/operations";
import type { BoardDocument, BoardOperation } from "../types";
import { currentActorId, isApplyingRemoteOperations, useBoardStore } from "./board-store";

export type OperationOrigin = "local" | "remote";

export interface OperationBatch {
  ops: BoardOperation[];
  origin: OperationOrigin;
  /** Who made the change: needed for replay, notifications and contribution analytics. */
  actorId: string;
  /** Epoch milliseconds when the change was applied locally. */
  at: number;
  /** The document after the change, e.g. for snapshot-based autosave. */
  document: BoardDocument;
}

export function subscribeToOperations(listener: (batch: OperationBatch) => void): () => void {
  return useBoardStore.subscribe((state, previous) => {
    if (state.doc === previous.doc) return;
    const ops = diffDocuments(previous.doc, state.doc);
    if (ops.length === 0) return;
    listener({
      ops,
      origin: isApplyingRemoteOperations() ? "remote" : "local",
      actorId: currentActorId(),
      at: Date.now(),
      document: state.doc,
    });
  });
}
