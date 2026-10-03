import { eyeDistanceM } from '@cssearth/engine';
import { SYSTEM_FRAMING_RADII, systemOverviewDistance } from './system-framing.mts';
import type { ObjectWorldNavigation } from '@cssearth/renderer/runtime/world-navigation-types.ts';
import type { WorldCameraPose, PreparedWorldCameraFrame, ZoomDistance, ObjectZoom } from '@cssearth/objects';
/** What the camera's zoom out of a star frames, by object id: the star's own system, or an object it is inside
 * (inside-view.mts `zoomChain`); every scope is measured from that star (zoomScopeAtCamera). */
export type ZoomScope = string;
/** An object the camera's zoom hands over to: its id and its zoom facts. */
export interface ZoomStep { readonly id: string; readonly zoom: Pick<ObjectZoom, 'enter' | 'returnBelow'>;
  /** The object has a scene of its own, which shows it from outside: the centre's system lasts until its `enter`. */
  readonly body?: true }
import { GALAXY_SCALE } from '@cssearth/renderer/labels/universe-label-policy.ts';
import { APPLICATION_WORLD_CONTEXT as context } from './world-context-plan.mts';
import { systemFadeDistances } from '@cssearth/renderer/universe/world-context/context-scale.ts';
import { systemHostId, systemObjectId } from './navigation/system-address.mts';

const PARSEC_M = 3.085677581491367e16;

const distance = (position: readonly number[], origin: readonly number[]) => Math.hypot(...position.map((value, axis) => value - origin[axis]));

/** Navigation switches between a body and its system at the shared camera detail threshold. */
export function bodyViewAtCamera(world: WorldCameraPose | null | undefined, frame: PreparedWorldCameraFrame | null | undefined, optics: ReturnType<ObjectWorldNavigation['optics']> | null | undefined, objectId: string, previous?: 'detail' | 'overview') {
  if (!world || !frame || !optics) return 'detail';
  const range = eyeDistanceM(world.pose, frame.originM);
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

/** A distance an object's zoom facts name (object-zoom.ts), for a zoom centred on a star whose own orbits reach `orbitsWithinM`:
 * a fixed distance; a point of the fade of that star's system (systemFadeDistances: the plan's, about a light-year, or
 * its host's authored orbit range) or of the galaxy (the world plan's volume fade), its start, geometric middle or end;
 * or the end of the galaxy captions' handoff. */
export function zoomDistanceM(value: ZoomDistance, plan = context, orbitsWithinM?: number): number {
  if ('distancePc' in value) return value.distancePc * PARSEC_M;
  if ('labels' in value) return GALAXY_SCALE.handoffEndM;
  const [start, end] = value.fade === 'system'
    ? (({ fadeOutStartDistanceM, hiddenDistanceM }) => [fadeOutStartDistanceM, hiddenDistanceM])(systemFadeDistances(plan.system, orbitsWithinM))
    : [plan.volume.fadeStartDistanceM, plan.volume.fullDistanceM];
  return value.at === 'start' ? start! : value.at === 'end' ? end! : Math.sqrt(start! * end!);
}

/** The scope the camera frames. UI scale thresholds, not physical boundaries or membership claims, each measured from the
 * star the zoom is centred on (`centre`: the mounted system's; the Sun's on its own scene and on the page of every object
 * seen from inside). Zooming backs away along the line of sight, so the camera's path depends on where it looks; the
 * distance from the centre does not, and neither does the sequence.
 * - The centre's system until the first step's authored handoff, capped by the system fade. Other systems keep their
 *   existing fade boundary; authored orbit ranges remain fully covered.
 * - Past it, the farthest step whose threshold the camera has passed: its `enter` distance, or its lower `returnBelow`
 *   distance while the view is already that step or a farther one, so the view does not flicker at an edge (each object's
 *   `zoom`, in its object.json). The steps are the objects the centre is inside that are seen from inside, nearest first
 *   (`chain`, inside-view.mts `zoomChain`). Short of every threshold the view is the nearest step.
 * - A first step with a scene of its own (`body`: another galaxy, around one of its stars) is reached only past its own
 *   threshold, where the camera is outside it; the centre's system lasts until then. */
export function zoomScopeAtCamera(world: WorldCameraPose, previous?: ZoomScope, plan = context,
  centre: { readonly originM?: readonly number[]; readonly orbitsWithinM?: number;
    /** The centre's own system, the zoom's first scope; the system of the plan's focus when not given. */
    readonly systemId?: string } = {},
  chain: readonly ZoomStep[] = []): ZoomScope {
  const originM = centre.originM ?? plan.focus.positionM, system = centre.systemId ?? systemObjectId(plan.focus.id);
  const range = eyeDistanceM(world.pose, originM);
  const { fadeOutStartDistanceM, hiddenDistanceM } = systemFadeDistances(plan.system, centre.orbitsWithinM);
  const at = (value: ZoomDistance) => zoomDistanceM(value, plan, centre.orbitsWithinM);
  const centreDistance = distance(originM, plan.focus.positionM);
  const previousStep = chain.findIndex(step => step.id === previous);
  const systemLimit = previous !== undefined && previous !== system ? Math.sqrt(fadeOutStartDistanceM * hiddenDistanceM) : hiddenDistanceM;
  const first = chain[0];
  const firstAt = first ? at(previousStep >= 0 ? first.zoom.returnBelow : first.zoom.enter) : 0;
  const handoff = first?.body ? firstAt
    : first && centreDistance === 0 && centre.orbitsWithinM === undefined ? Math.min(systemLimit, firstAt) : systemLimit;
  if (range < handoff) return system;
  for (let index = chain.length - 1; index >= 0; index--) {
    const step = chain[index]!;
    if (range >= at(previousStep >= index ? step.zoom.returnBelow : step.zoom.enter)) return step.id;
  }
  return chain[0]?.id ?? system;
}

export function viewDistance(world: WorldCameraPose, frame: PreparedWorldCameraFrame, scope: ZoomScope | null, plan = context, focus: { readonly name: string; readonly positionM: readonly number[] } | null = null) {
  if (focus) return { label: `Distance to ${focus.name}:`, meters: eyeDistanceM(world.pose, focus.positionM),
    title: `Camera distance from the prepared center of ${focus.name}` };
  // Out to an object the star is inside the readout is the distance from the Sun; on a body or its own system, the altitude.
  return scope !== null && systemHostId(scope) === null ? {
    label: 'Distance from Sun:',
    meters: eyeDistanceM(world.pose, plan.focus.positionM),
    title: 'Camera distance from the center of the Sun',
  } : {
    label: 'Altitude:',
    meters: Math.max(0, eyeDistanceM(world.pose, frame.originM) - frame.bodyRadiusM),
    title: "Camera altitude above the selected object's reference surface",
  };
}

/** Where the page of an object seen from inside puts the camera, from the centre, for one framed at a distance or between two
 * (its `zoom.frame`); null for one framed by fitting what it draws (prepared-world-navigation.mts). The Milky Way lands
 * between the end of the galaxy handoff and the middle of the galaxy's fade, so the galaxy fills the view from inside. */
export function zoomFrameDistanceM(object: { readonly zoom: ObjectZoom }, plan = context): number | null {
  const frame = object.zoom.frame;
  if ('fit' in frame) return null;
  if ('distance' in frame) return zoomDistanceM(frame.distance, plan);
  return Math.sqrt(zoomDistanceM(frame.between[0], plan) * zoomDistanceM(frame.between[1], plan));
}
