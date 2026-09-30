import { SYSTEM_FRAMING_RADII, systemOverviewDistance } from './system-framing.mts';
import type { ObjectWorldNavigation } from '@cssearth/renderer/runtime/world-navigation-types.ts';
import type { PreparedCatalogObject } from '@cssearth/catalog';
import type { WorldCameraPose, PreparedWorldCameraFrame } from '@cssearth/renderer/navigation/world-camera.ts';
/** `system` is the planetary system of the mounted star, and every other scope is an overview's id (its registry entry,
 * KNOWN_OVERVIEWS); every scope is measured from that star (overviewScopeAtCamera). */
export type OverviewScope = 'system' | OverviewObject['id'];
import { GALAXY_SCALE } from '@cssearth/renderer/labels/universe-label-policy.ts';
import { APPLICATION_WORLD_CONTEXT as context } from './world-context-plan.mts';
import { systemFadeDistances } from '@cssearth/renderer/universe/world-context/context-scale.ts';
import { overviewHolding, type OverviewDistance, type OverviewObject } from '@cssearth/objects';
import { KNOWN_OVERVIEWS } from './object-directory.mts';

const PARSEC_M = 3.085677581491367e16;

const distance = (position: readonly number[], origin: readonly number[]) => Math.hypot(...position.map((value, axis) => value - origin[axis]));

/** Navigation switches between a body and its system at the shared camera detail threshold. */
export function bodyViewAtCamera(world: WorldCameraPose | null | undefined, frame: PreparedWorldCameraFrame | null | undefined, optics: ReturnType<ObjectWorldNavigation['optics']> | null | undefined, objectId: string, previous?: 'detail' | 'overview') {
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

/** A distance an overview names (overview-object.ts), for a zoom centred on a star whose own orbits reach `orbitsWithinM`:
 * a fixed distance; a point of the fade of that star's system (systemFadeDistances: the plan's, about a light-year, or
 * its host's authored orbit range) or of the galaxy (the world plan's volume fade), its start, geometric middle or end;
 * or the end of the galaxy captions' handoff. */
export function overviewDistanceM(value: OverviewDistance, plan = context, orbitsWithinM?: number): number {
  if ('distancePc' in value) return value.distancePc * PARSEC_M;
  if ('labels' in value) return GALAXY_SCALE.handoffEndM;
  const [start, end] = value.fade === 'system'
    ? (({ fadeOutStartDistanceM, hiddenDistanceM }) => [fadeOutStartDistanceM, hiddenDistanceM])(systemFadeDistances(plan.system, orbitsWithinM))
    : [plan.volume.fadeStartDistanceM, plan.volume.fullDistanceM];
  return value.at === 'start' ? start! : value.at === 'end' ? end! : Math.sqrt(start! * end!);
}

/** The overviews a zoom centred at `centreM` reaches, from the nearest level out: a level with `centreWithin` is skipped
 * from a centre farther from the world's centre than that (M87* has no Local Group step, the Magellanic Clouds no Milky
 * Way step). An object's breadcrumbs lead through the same levels. */
export function overviewsReachableFrom(centreM: readonly number[], plan = context, orbitsWithinM?: number,
  overviews: readonly OverviewObject[] = KNOWN_OVERVIEWS): readonly OverviewObject[] {
  const centreDistance = distance(centreM, plan.focus.positionM);
  return overviews.filter(overview => !overview.zoom.centreWithin || centreDistance < overviewDistanceM(overview.zoom.centreWithin, plan, orbitsWithinM));
}

/** The level that holds a subject of `classification` at `positionM`: its overview's `holds`, when a zoom centred there
 * reaches that level; otherwise the nearest level out that it reaches (M87, a Virgo galaxy, is not the Local Group's). */
export function overviewHoldingAt(classification: string, positionM: readonly number[], plan = context,
  overviews: readonly OverviewObject[] = KNOWN_OVERVIEWS): OverviewObject | undefined {
  const holder = overviewHolding(overviews, classification);
  const reachable = new Set(overviewsReachableFrom(positionM, plan, undefined, overviews).map(overview => overview.id));
  return !holder || reachable.has(holder.id) ? holder : overviews.find(overview => overview.order > holder.order && reachable.has(overview.id));
}

/** The scope the camera frames. UI scale thresholds, not physical boundaries or membership claims, each measured from the
 * star the zoom is centred on (`centre`: the mounted system's; the Sun's on its own scene and every overview page).
 * Zooming backs away along the line of sight, so the camera's path depends on where it looks; the distance from the
 * centre does not, and neither does the sequence.
 * - The centre's system overview until the first reachable overview's authored handoff, capped by the system fade.
 *   Other systems keep their existing fade boundary; authored orbit ranges remain fully covered.
 * - Past it, the farthest overview whose threshold the camera has passed: its `enter` distance, or its lower
 *   `returnBelow` distance while the view is already that level or a farther one, so the view does not flicker at an edge
 *   (the overviews' `zoom`, in their object.json). A level with `centreWithin` is skipped from a centre farther from the
 *   world's centre than that (the Magellanic Clouds have no Milky Way step); short of every threshold the view is the
 *   nearest level the centre reaches. */
export function overviewScopeAtCamera(world: WorldCameraPose, previous: OverviewScope = 'system', plan = context,
  centre: { readonly originM: readonly number[]; readonly orbitsWithinM?: number } = { originM: plan.focus.positionM },
  overviews: readonly OverviewObject[] = KNOWN_OVERVIEWS): OverviewScope {
  const range = distance(world.pose.positionM, centre.originM);
  const { fadeOutStartDistanceM, hiddenDistanceM } = systemFadeDistances(plan.system, centre.orbitsWithinM);
  const at = (value: OverviewDistance) => overviewDistanceM(value, plan, centre.orbitsWithinM);
  const centreDistance = distance(centre.originM, plan.focus.positionM);
  const reachable = overviewsReachableFrom(centre.originM, plan, centre.orbitsWithinM, overviews);
  const previousOrder = overviews.find(overview => overview.id === previous)?.order ?? 0;
  const systemLimit = previous !== 'system' ? Math.sqrt(fadeOutStartDistanceM * hiddenDistanceM) : hiddenDistanceM;
  const first = reachable[0];
  const handoff = first && centreDistance === 0 && centre.orbitsWithinM === undefined
    ? Math.min(systemLimit, at(previousOrder >= first.order ? first.zoom.returnBelow : first.zoom.enter))
    : systemLimit;
  if (range < handoff) return 'system';
  for (const overview of [...reachable].reverse()) {
    if (range >= at(previousOrder >= overview.order ? overview.zoom.returnBelow : overview.zoom.enter)) return overview.id;
  }
  return reachable[0]?.id ?? 'system';
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

/** Where an overview's page puts the camera, from the centre, for an overview framed at a distance or between two (its
 * `zoom.frame`); null for one framed by fitting what it draws (prepared-world-navigation.mts). The Milky Way lands between
 * the end of the galaxy handoff and the middle of the galaxy's fade, so the galaxy fills the view from inside. */
export function overviewFrameDistanceM(overview: Pick<OverviewObject, 'zoom'>, plan = context): number | null {
  const frame = overview.zoom.frame;
  if ('fit' in frame) return null;
  if ('distance' in frame) return overviewDistanceM(frame.distance, plan);
  return Math.sqrt(overviewDistanceM(frame.between[0], plan) * overviewDistanceM(frame.between[1], plan));
}
