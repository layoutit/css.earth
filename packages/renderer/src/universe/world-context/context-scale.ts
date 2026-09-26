import type { PreparedWorldContext, PreparedVolumeOpacityProfile } from '../../prepared-data/world-context.js';

export const BODY_INDICATOR_DIAMETER = 16;
export const CONTEXT_LINE_WIDTH = 1;
/** The widest dot a body circle holds: the 16px ring's 1.5px line leaves 13px inside, and 9px keeps a clear gap. */
export const INDICATOR_DOT_MAX_DIAMETER = 9;

/** Radii up to 1,000 km share the smallest dot, so the scale spends its range between small worlds and the star.
 * A presentation choice, not a physical threshold: across 31 m to a supergiant, Earth and Saturn were 0.6px apart. */
export const INDICATOR_DOT_SMALLEST_RADIUS_M = 1e6;

/** The dot inside a body's circle grows with the body's radius on a log scale from 1,000 km, at the minimum marker core,
 * to the system star's radius at the widest dot. Larger stars stop at that limit. A body without a radius has no dot. */
export function indicatorDotDiameter(radiusM: number, starRadiusM: number, minimumDiameter: number): number | null {
  if (!(radiusM > 0) || !(starRadiusM > INDICATOR_DOT_SMALLEST_RADIUS_M)) return null;
  const t = (Math.log(radiusM) - Math.log(INDICATOR_DOT_SMALLEST_RADIUS_M)) /
    (Math.log(starRadiusM) - Math.log(INDICATOR_DOT_SMALLEST_RADIUS_M));
  return minimumDiameter + (INDICATOR_DOT_MAX_DIAMETER - minimumDiameter) * Math.max(0, Math.min(1, t));
}
/** An authored system range fades out over one doubling of camera distance beyond it. */
const AUTHORED_RANGE_FADE = 2;

export function logarithmicFade(distanceM: number, startM: number, endM: number): number {
  const t = Math.max(0, Math.min(1, (Math.log(distanceM) - Math.log(startM)) / (Math.log(endM) - Math.log(startM))));
  return t * t * (3 - 2 * t);
}

/** Each planetary system fades with the camera's distance from its own star: the Sun's
 * and every placed star with orbiting bodies. The context retires once all of them have. */
export function createSystemFade(plan: Pick<PreparedWorldContext, 'focus' | 'bodies' | 'orbitCenters' | 'system'>) {
  const points = [plan.focus, ...plan.bodies];
  const byId = new Map(points.map(point => [point.id, point]));
  const parentOf = (id: string) => {
    const point = byId.get(id);
    return point && 'orbit' in point ? point.orbit?.centerBodyId : plan.orbitCenters?.[id]?.centerBodyId;
  };
  const rootOf = (id: string) => {
    for (let current = id, steps = 0; steps <= points.length + Object.keys(plan.orbitCenters ?? {}).length; steps++) {
      const parent = parentOf(current);
      if (parent === undefined) return current;
      current = parent;
    }
    throw new TypeError(`${id} has a cyclic orbit chain.`);
  };
  const rootIds = points.map(point => rootOf(point.id));
  const roots = [...new Set([plan.focus.id, ...rootIds.filter((id, index) => id !== points[index]!.id)])];
  const positions = roots.map(id => byId.get(id)!.positionM);
  const rootIndex = rootIds.map(id => roots.indexOf(id));
  const values = new Float64Array(roots.length);
  // Every system fades over the authored distances, unless its host authors its own orbit range: that system is drawn
  // whole to the range and gone one doubling of distance beyond it (a presentation choice, not a measurement).
  const ranges = roots.map(id => { const point = byId.get(id); return point && 'orbitsWithinM' in point ? point.orbitsWithinM : undefined; });
  const fadeStarts = ranges.map(range => range ?? plan.system.fadeOutStartDistanceM);
  const hiddenDistances = ranges.map(range => range === undefined ? plan.system.hiddenDistanceM : range * AUTHORED_RANGE_FADE);
  return Object.freeze({
    /** The largest system opacity, after measuring every system from this camera position. */
    update(positionM: readonly number[]) {
      let maximum = 0;
      for (let index = 0; index < roots.length; index++) {
        const star = positions[index]!;
        values[index] = 1 - logarithmicFade(Math.hypot(positionM[0]! - star[0], positionM[1]! - star[1], positionM[2]! - star[2]),
          fadeStarts[index]!, hiddenDistances[index]!);
        maximum = Math.max(maximum, values[index]!);
      }
      return maximum;
    },
    /** The opacity of the system the indexed context point belongs to; a star outside every system is never faded. */
    of(pointIndex: number) { const root = rootIndex[pointIndex]!; return root < 0 ? 1 : values[root]!; },
    /** A system's star: the focus or a placed star that bodies orbit. */
    isSystemStar(id: string) { return roots.includes(id); },
    /** The indexed point belongs to the focus star's own system. */
    inFocusSystem(pointIndex: number) { return rootIndex[pointIndex] === 0; },
    /** Inside its host's authored range a system draws every member's orbit, named or not. */
    hasAuthoredRange(pointIndex: number) { const root = rootIndex[pointIndex]!; return root >= 0 && ranges[root] !== undefined; },
  });
}
/** Applies prepared grading by common-focus distance, independently of camera angle or selected detail. */
export function preparedVolumeOpacity(distanceM: number, profile?: PreparedVolumeOpacityProfile): number {
  if (!profile) return 1;
  const fade = logarithmicFade(distanceM, profile.fadeStartDistanceM, profile.fullDistanceM);
  return profile.nearOpacity + (profile.fullOpacity - profile.nearOpacity) * fade;
}
