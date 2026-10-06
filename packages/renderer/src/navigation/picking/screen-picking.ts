import type { OrbitSegment } from '@cssearth/engine';

export type ScreenPickShape =
  | { kind: 'rect'; left: number; top: number; right: number; bottom: number }
  | { kind: 'circle'; x: number; y: number; radius: number }
  | { kind: 'segments'; segments: readonly OrbitSegment[]; halfWidth: number;
      bounds?: { left: number; top: number; right: number; bottom: number } | null };
export interface ScreenPickTarget {
  element: HTMLElement;
  /** Same back-to-front rank as the retained presentation. */
  rank: number;
  shape: ScreenPickShape;
  /** Nothing solid is drawn over it: the selected object is see-through (a galaxy, a cluster, a nebula), so the
   * detailed object's own hit does not cancel this pick. */
  unoccluded?: boolean;
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
    /** `reach` is a finger's slop: when nothing is under the point, the nearest label or marker within it is picked. */
    pick(x: number, y: number, reach = 0) { return this.pickTarget(x, y, reach)?.element ?? null; },
    pickTarget(x: number, y: number, reach = 0): ScreenPickTarget | null {
      let direct: ScreenPickTarget | null = null, near: ScreenPickTarget | null = null, nearest = reach;
      for (const targets of publications.values()) for (const target of targets) {
        if (target.shape.kind === 'segments') continue;
        if (target.element.ariaDisabled === 'true') continue;
        const gap = reach > 0 ? screenShapeGap(target.shape, x, y) : hitsScreenShape(target.shape, x, y) ? 0 : Infinity;
        if (gap > 0) {
          if (gap < nearest || (gap === nearest && near && near.rank <= target.rank)) { near = target; nearest = gap; }
          continue;
        }
        if (direct && direct.rank > target.rank) continue;
        direct = target;
      }
      direct ??= near;
      // Direct labels/markers always win, regardless of orbit depth. Do not
      // traverse any chord banks when that decision is already resolved.
      if (direct) return direct;
      let orbit: ScreenPickTarget | null = null;
      for (const targets of publications.values()) for (const target of targets) {
        if (target.shape.kind !== 'segments' || target.element.ariaDisabled === 'true' ||
            (orbit && orbit.rank > target.rank)) continue;
        if (hitsScreenShape(target.shape, x, y)) orbit = target;
      }
      return orbit;
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

/** Pixels from a point to a label or marker shape; zero inside it. */
function screenShapeGap(shape: Exclude<ScreenPickShape, { kind: 'segments' }>, x: number, y: number): number {
  if (shape.kind === 'circle') return Math.max(0, Math.hypot(x - shape.x, y - shape.y) - shape.radius);
  return Math.hypot(Math.max(shape.left - x, 0, x - shape.right), Math.max(shape.top - y, 0, y - shape.bottom));
}

export function hitsScreenShape(shape: ScreenPickShape, x: number, y: number): boolean {
  if (shape.kind === 'rect') return x >= shape.left && x <= shape.right && y >= shape.top && y <= shape.bottom;
  if (shape.kind === 'circle') return (x - shape.x) ** 2 + (y - shape.y) ** 2 <= shape.radius ** 2;
  const bounds = shape.bounds;
  if (bounds === null || (bounds && (x < bounds.left - shape.halfWidth || x > bounds.right + shape.halfWidth ||
      y < bounds.top - shape.halfWidth || y > bounds.bottom + shape.halfWidth))) return false;
  for (const [x0, y0, x1, y1, opacity] of shape.segments) {
    if (opacity <= .1 || x < Math.min(x0, x1) - shape.halfWidth || x > Math.max(x0, x1) + shape.halfWidth ||
        y < Math.min(y0, y1) - shape.halfWidth || y > Math.max(y0, y1) + shape.halfWidth) continue;
    const dx = x1 - x0, dy = y1 - y0, lengthSquared = dx * dx + dy * dy;
    const along = ((x - x0) * dx + (y - y0) * dy) / lengthSquared;
    // The hit corridor widens the stroke, not its clipped endpoints.
    if (along < 0 || along > 1 || lengthSquared === 0) continue;
    const cross = (x - x0) * dy - (y - y0) * dx;
    if (cross * cross <= shape.halfWidth ** 2 * lengthSquared) return true;
  }
  return false;
}
