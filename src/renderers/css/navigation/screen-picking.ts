import type { OrbitSegment } from '../solar-system/heliocentric-view.js';

export type ScreenPickShape =
  | { kind: 'rect'; left: number; top: number; right: number; bottom: number }
  | { kind: 'circle'; x: number; y: number; radius: number }
  | { kind: 'segments'; segments: readonly OrbitSegment[]; halfWidth: number };
export interface ScreenPickTarget {
  element: HTMLElement;
  /** Same back-to-front rank as the retained presentation. */
  rank: number;
  shape: ScreenPickShape;
}

const registries = new WeakMap<HTMLElement, ReturnType<typeof createRegistry>>();
function createRegistry() {
  const publications = new Map<object, readonly ScreenPickTarget[]>();
  const listeners = new Set<() => void>();
  return {
    publish(owner: object, targets: readonly ScreenPickTarget[]) {
      publications.set(owner, targets);
      for (const listener of listeners) listener();
    },
    remove(owner: object) {
      if (publications.delete(owner)) for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    pick(x: number, y: number) {
      let direct: ScreenPickTarget | null = null, orbit: ScreenPickTarget | null = null;
      for (const targets of publications.values()) for (const target of targets) {
        if (target.element.ariaDisabled === 'true') continue;
        const isOrbit = target.shape.kind === 'segments';
        const previous = isOrbit ? orbit : direct;
        if (previous && previous.rank > target.rank) continue;
        if (!hitsScreenShape(target.shape, x, y)) continue;
        if (isOrbit) orbit = target; else direct = target;
      }
      // Preserve the existing priority of direct labels/markers over orbit chords.
      return (direct ?? orbit)?.element ?? null;
    },
  };
}

/** Application-stage registry. Detail handoffs do not own or recreate it.
 * Coordinates are relative to the same viewport centre used to paint targets.
 * Publishers supply only visible, clipped, enabled presentation geometry. */
export function screenPicking(host: HTMLElement) {
  let registry = registries.get(host);
  if (!registry) { registry = createRegistry(); registries.set(host, registry); }
  return registry;
}

export function hitsScreenShape(shape: ScreenPickShape, x: number, y: number): boolean {
  if (shape.kind === 'rect') return x >= shape.left && x <= shape.right && y >= shape.top && y <= shape.bottom;
  if (shape.kind === 'circle') return (x - shape.x) ** 2 + (y - shape.y) ** 2 <= shape.radius ** 2;
  for (const [x0, y0, x1, y1, opacity] of shape.segments) {
    if (opacity <= .1 || x < Math.min(x0, x1) - shape.halfWidth || x > Math.max(x0, x1) + shape.halfWidth ||
        y < Math.min(y0, y1) - shape.halfWidth || y > Math.max(y0, y1) + shape.halfWidth) continue;
    const dx = x1 - x0, dy = y1 - y0, lengthSquared = dx * dx + dy * dy;
    const along = ((x - x0) * dx + (y - y0) * dy) / lengthSquared;
    // The CSS hit corridor widens the stroke, not its clipped endpoints.
    if (along < 0 || along > 1 || lengthSquared === 0) continue;
    const cross = (x - x0) * dy - (y - y0) * dx;
    if (cross * cross <= shape.halfWidth ** 2 * lengthSquared) return true;
  }
  return false;
}
