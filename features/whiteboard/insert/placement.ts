/**
 * Smart placement for inserted objects: repeated inserts at the same spot
 * cascade diagonally instead of stacking exactly on top of each other.
 */
import type { BoardElement, Point } from "../types";
import { getElementBounds } from "../utils/geometry";

const STEP = 32;
const MAX_STEPS = 12;
/** Centres closer than this count as "the same spot". */
const SAME_SPOT = STEP * 0.75;

function centerOf(element: BoardElement): Point {
  const b = getElementBounds(element);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Offset that moves `element` to the first unoccupied cascade slot. */
export function cascadeOffset(element: BoardElement, existing: readonly BoardElement[]): Point {
  const taken = existing.map(centerOf);
  const origin = centerOf(element);
  for (let step = 0; step <= MAX_STEPS; step += 1) {
    const candidate = { x: origin.x + step * STEP, y: origin.y + step * STEP };
    const occupied = taken.some((c) => Math.hypot(c.x - candidate.x, c.y - candidate.y) < SAME_SPOT);
    if (!occupied) return { x: step * STEP, y: step * STEP };
  }
  return { x: 0, y: 0 };
}
