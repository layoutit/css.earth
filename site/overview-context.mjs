import context from '../src/planets/sun/prepared/world-context.json' with { type: 'json' };
import { SYSTEM_FRAMING_RADII, systemOverviewDistance } from './system-framing.mjs';

const distance = (position, origin) => Math.hypot(...position.map((value, axis) => value - origin[axis]));

/** Match the camera's detail handoff at the body's centered apparent size. */
export function bodyCardViewAtCamera(world, frame, optics, objectId) {
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
export function overviewScopeAtCamera(world, previous = 'solar-system', plan = context) {
  const { fadeStartDistanceM, fullDistanceM } = plan.volume;
  const threshold = previous === 'milky-way' ? fadeStartDistanceM
    : Math.sqrt(fadeStartDistanceM * fullDistanceM);
  return distance(world.pose.positionM, plan.focus.positionM) >= threshold ? 'milky-way' : 'solar-system';
}

export function viewDistance(world, frame, scope, plan = context, focus = null) {
  if (focus) return { label: `Distance to ${focus.name}:`, meters: distance(world.pose.positionM, focus.positionM),
    title: `Camera distance from the prepared center of ${focus.name}` };
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
