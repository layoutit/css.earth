import { eyeDistanceM, type WorldCameraPose } from '@cssearth/engine';
import type { PreparedGalaxyStations } from '@cssearth/objects';

const smooth = (t: number) => t * t * (3 - 2 * t);
/** A capsule around the prepared inside places. Both the approach and the interpolation
 * between places use one C1 log gain, independent of direction, time and texture readiness. */
export function galaxyAutoExposure(plan: NonNullable<PreparedGalaxyStations['autoExposure']>, world: WorldCameraPose): number {
  const a = plan.places[0]!, b = plan.places[1] ?? a;
  const length = Math.hypot(...a.positionM.map((v, i) => v - b.positionM[i]!));
  const da = eyeDistanceM(world.pose, a.positionM), db = eyeDistanceM(world.pose, b.positionM);
  const t = length ? Math.max(0, Math.min(1, (da * da + length * length - db * db) / (2 * length * length))) : 0;
  const center = a.positionM.map((v, i) => v * (1 - t) + b.positionM[i]! * t);
  const distance = eyeDistanceM(world.pose, center), s = smooth(t);
  const inner = a.innerDistanceM * (1 - s) + b.innerDistanceM * s;
  const outer = a.outerDistanceM * (1 - s) + b.outerDistanceM * s;
  const approach = smooth(Math.max(0, Math.min(1, Math.log(Math.max(distance, inner) / inner) / Math.log(outer / inner))));
  const insideLog = Math.log(a.insideOpacity) * (1 - s) + Math.log(b.insideOpacity) * s;
  return Math.exp(insideLog * (1 - approach));
}
