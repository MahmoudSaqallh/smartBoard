/**
 * One shared interval for every live widget. Widgets subscribe and update
 * their own Konva nodes imperatively, so ticking never re-renders React or
 * redraws board content. The interval only runs while something listens.
 */
type TickListener = (now: number) => void;

const TICK_MS = 100;
const listeners = new Set<TickListener>();
let handle: ReturnType<typeof setInterval> | null = null;

export function subscribeTick(listener: TickListener): () => void {
  listeners.add(listener);
  if (handle === null) {
    handle = setInterval(() => {
      const now = Date.now();
      listeners.forEach((fn) => fn(now));
    }, TICK_MS);
  }
  listener(Date.now());
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && handle !== null) {
      clearInterval(handle);
      handle = null;
    }
  };
}
