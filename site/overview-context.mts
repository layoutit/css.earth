import type { PreparedCatalogObject } from '@cssearth/catalog';
import type { WorldCameraPose, PreparedWorldCameraFrame } from '@cssearth/renderer/navigation/world-camera.ts';
import type { ObjectWorldNavigation } from '@cssearth/renderer/runtime/world-navigation-types.ts';
/** `system` is the planetary system of the mounted star; every scope is measured from that star (overviewScopeAtCamera). */
export type OverviewScope = 'system' | 'milky-way' | 'local-group' | 'nearby-universe' | 'observable-universe';
import { SYSTEM_FRAMING_RADII, systemOverviewDistance } from './system-framing.mts';
import { GALAXY_SCALE } from '@cssearth/renderer/labels/universe-label-policy.ts';
import { APPLICATION_WORLD_CONTEXT as context } from './world-context-plan.mts';
import { systemFadeDistances } from '@cssearth/renderer/universe/world-context/context-scale.ts';

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

/** The scope the camera frames. UI scale thresholds, not physical boundaries or membership claims, each with a separate
 * return threshold to avoid flicker, and every one measured from the star the zoom is centred on (`centre`: the mounted
 * system's; the Sun's on its own scene and every overview page). Zooming backs away along the line of sight, so the
 * camera's path depends on where it looks; the distance from the centre does not, and neither does the sequence.
 * - the centre's system overview until its own bodies have faded out, over the distances the world context fades them
 *   (systemFadeDistances: the plan's, about a light-year, or its host's authored orbit range), and back below the middle
 *   of that fade;
 * - the Milky Way beyond it: the stars of the galaxy;
 * - the Local Group once the galaxy's own captions (its nebulae) have mostly faded, at the middle of the world plan's
 *   volume fade that fades them, and back below its start: the Milky Way card is the view from inside the galaxy. A
 *   centre that itself lies past that middle (the Magellanic Clouds) has no Milky Way step;
 * - the nearby universe from 5 Mpc (back below 4 Mpc);
 * - the observable universe from 1 Gpc (back below 800 Mpc), past the Cosmicflows-4 field, where DESI's galaxies and
 *   quasars and the cosmic microwave background are the view. */
export function overviewScopeAtCamera(world: WorldCameraPose, previous: OverviewScope = 'system', plan = context,
  centre: { readonly originM: readonly number[]; readonly orbitsWithinM?: number } = { originM: plan.focus.positionM }): OverviewScope {
  const range = distance(world.pose.positionM, centre.originM);
  const { fadeOutStartDistanceM, hiddenDistanceM } = systemFadeDistances(plan.system, centre.orbitsWithinM);
  if (range < (previous !== 'system' ? Math.sqrt(fadeOutStartDistanceM * hiddenDistanceM) : hiddenDistanceM)) return 'system';
  const parsec = 3.085677581491367e16;
  if (range >= (previous === 'observable-universe' ? .8 : 1) * 1e9 * parsec) return 'observable-universe';
  if (range >= (previous === 'nearby-universe' || previous === 'observable-universe' ? 4 : 5) * 1e6 * parsec) return 'nearby-universe';
  const { fadeStartDistanceM, fullDistanceM } = plan.volume, galaxyEdgeM = Math.sqrt(fadeStartDistanceM * fullDistanceM);
  if (range >= (previous === 'local-group' || previous === 'nearby-universe' ? fadeStartDistanceM : galaxyEdgeM)) return 'local-group';
  return distance(centre.originM, plan.focus.positionM) >= galaxyEdgeM ? 'local-group' : 'milky-way';
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

/** Where the Milky Way overview lands: between the end of the galaxy handoff (its dots and backing in full) and the scale
 * where its captions fade and the card becomes the Local Group, so the galaxy fills the view from inside. */
export function milkyWayOverviewDistanceM(plan = context): number {
  const enter = GALAXY_SCALE.handoffEndM, leave = Math.sqrt(plan.volume.fadeStartDistanceM * plan.volume.fullDistanceM);
  return Math.sqrt(enter * leave);
}
