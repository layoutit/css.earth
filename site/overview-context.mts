import type { WorldCameraPose, PreparedWorldCameraFrame } from '../src/renderers/css/navigation/world-camera.js';
import type { ObjectWorldNavigation } from '../src/renderers/css/runtime/world-navigation-types.js';
export type OverviewScope = 'solar-system' | 'milky-way';
import context from '../src/planets/sun/prepared/world-context.json' with { type: 'json' };
import { SYSTEM_FRAMING_RADII, systemOverviewDistance } from './system-framing.mts';

const distance = (position: readonly number[], origin: readonly number[]) => Math.hypot(...position.map((value, axis) => value - origin[axis]));

/** Match the camera's detail handoff at the body's centered apparent size. */
export function bodyCardViewAtCamera(world: WorldCameraPose | null | undefined, frame: PreparedWorldCameraFrame | null | undefined, optics: ReturnType<ObjectWorldNavigation['optics']> | null | undefined, objectId: string) {
  if (!world || !frame || !optics) return 'detail';
  const range = distance(world.pose.positionM, frame.originM);
  if (range <= frame.bodyRadiusM) return 'detail';
  const systemRadius = SYSTEM_FRAMING_RADII.get(objectId);
  if (systemRadius && optics.framingRadiusPixels) {
    // Switch halfway in zoom between the system framing and the body close-up.
    return range >= systemOverviewDistance(frame.bodyRadiusM, systemRadius, optics) ? 'overview' : 'detail';
  }
  // Centered size keeps panning or looking away from changing the card's zoom mode.
  const diameter = 2 * optics.focalPixels * frame.bodyRadiusM
    / Math.sqrt(range * range - frame.bodyRadiusM * frame.bodyRadiusM);
  return diameter <= optics.detailHandoffDiameterPixels ? 'overview' : 'detail';
}

/** Follow the prepared galaxy's fade, with a separate return threshold to avoid flicker. */
export function overviewScopeAtCamera(world: WorldCameraPose, previous: OverviewScope = 'solar-system', plan = context): OverviewScope {
  const { fadeStartDistanceM, fullDistanceM } = plan.volume;
  const threshold = previous === 'milky-way' ? fadeStartDistanceM
    : Math.sqrt(fadeStartDistanceM * fullDistanceM);
  return distance(world.pose.positionM, plan.focus.positionM) >= threshold ? 'milky-way' : 'solar-system';
}

export function viewDistance(world: WorldCameraPose, frame: PreparedWorldCameraFrame, scope: OverviewScope, plan = context) {
  return scope === 'milky-way' ? {
    label: 'Distance from Sun:',
    meters: distance(world.pose.positionM, plan.focus.positionM),
    title: 'Camera distance from the center of the Sun',
  } : {
    label: 'Altitude:',
    meters: Math.max(0, distance(world.pose.positionM, frame.originM) - frame.bodyRadiusM),
    title: "Camera altitude above the selected object's reference surface",
  };
}
