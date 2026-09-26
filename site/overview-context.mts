import type { PreparedCatalogObject } from '@cssearth/catalog';
import type { WorldCameraPose, PreparedWorldCameraFrame } from '@cssearth/renderer/navigation/world-camera.ts';
import type { ObjectWorldNavigation } from '@cssearth/renderer/runtime/world-navigation-types.ts';
/** `system` is the planetary system of the mounted star; the larger scopes are measured from the Sun. */
export type OverviewScope = 'system' | 'milky-way' | 'local-group' | 'nearby-universe';
import { SYSTEM_FRAMING_RADII, systemOverviewDistance } from './system-framing.mts';
import { APPLICATION_WORLD_CONTEXT as context } from './world-context-plan.mts';

const distance = (position: readonly number[], origin: readonly number[]) => Math.hypot(...position.map((value, axis) => value - origin[axis]));

/** Match the camera's detail handoff at the body's centered apparent size. */
export function bodyCardViewAtCamera(world: WorldCameraPose | null | undefined, frame: PreparedWorldCameraFrame | null | undefined, optics: ReturnType<ObjectWorldNavigation['optics']> | null | undefined, objectId: string, previous?: 'detail' | 'overview') {
  if (!world || !frame || !optics) return 'detail';
  const range = distance(world.pose.positionM, frame.originM);
  if (range <= frame.bodyRadiusM) return 'detail';
  const systemRadius = SYSTEM_FRAMING_RADII.get(objectId);
  if (systemRadius && optics.framingRadiusPixels) {
    // Switch halfway in zoom between the system framing and the body close-up.
    const threshold = systemOverviewDistance(frame.bodyRadiusM, systemRadius, optics);
    return range >= threshold * (previous === 'overview' ? .9 : 1) ? 'overview' : 'detail';
  }
  // Centered size keeps panning or looking away from changing the card's zoom mode.
  const diameter = 2 * optics.focalPixels * frame.bodyRadiusM
    / Math.sqrt(range * range - frame.bodyRadiusM * frame.bodyRadiusM);
  return diameter <= optics.detailHandoffDiameterPixels * (previous === 'overview' ? 1 / .9 : 1) ? 'overview' : 'detail';
}

/** Follow the prepared galaxy's fade, with a separate return threshold to avoid flicker. */
export function overviewScopeAtCamera(world: WorldCameraPose, previous: OverviewScope = 'system', plan = context): OverviewScope {
  // UI scale thresholds, not physical boundaries or membership claims.
  const range = distance(world.pose.positionM, plan.focus.positionM);
  const parsec = 3.085677581491367e16;
  if (range >= (previous === 'nearby-universe' ? 4 : 5) * 1e6 * parsec) return 'nearby-universe';
  if (range >= (previous === 'local-group' || previous === 'nearby-universe' ? 240000 : 300000) * parsec) return 'local-group';
  const { fadeStartDistanceM, fullDistanceM } = plan.volume;
  const threshold = previous !== 'system' ? fadeStartDistanceM
    : Math.sqrt(fadeStartDistanceM * fullDistanceM);
  return distance(world.pose.positionM, plan.focus.positionM) >= threshold ? 'milky-way' : 'system';
}

export function viewDistance(world: WorldCameraPose, frame: PreparedWorldCameraFrame, scope: OverviewScope, plan = context, focus: Pick<PreparedCatalogObject, 'name' | 'positionM'> | null = null) {
  if (focus) return { label: `Distance to ${focus.name}:`, meters: distance(world.pose.positionM, focus.positionM),
    title: `Camera distance from the prepared center of ${focus.name}` };
  return scope !== 'system' ? {
    label: 'Distance from Sun:',
    meters: distance(world.pose.positionM, plan.focus.positionM),
    title: 'Camera distance from the center of the Sun',
  } : {
    label: 'Altitude:',
    meters: Math.max(0, distance(world.pose.positionM, frame.originM) - frame.bodyRadiusM),
    title: "Camera altitude above the selected object's reference surface",
  };
}
