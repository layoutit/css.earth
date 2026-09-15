import type { PositionM } from '@cssearth/engine';
import type { WorldCameraPose, WorldCameraViewport } from '../src/renderers/css/navigation/world-camera.js';
import type { ObjectWorldNavigation } from '../src/renderers/css/runtime/world-navigation-types.js';
import type { ObjectEntry } from './object-schema.mts';
interface SelectionPublication { world: WorldCameraPose; viewport: WorldCameraViewport; }
export interface OverviewSelection { overview: boolean; objectId: string; }
import { presentWorldCamera } from '../src/renderers/css/dist/navigation.js';
import { OVERVIEW_SELECTION_POLICY as policy } from './runtime-policy.mts';

const distance = (a: PositionM, b: PositionM) => Math.hypot(...a.map((value, axis) => value - b[axis]));
export const solarSystemFocus = (objects: readonly ObjectEntry[]) => objects.find(object => object.classification === 'star' && object.distance.meters === 0);

export function selectionAtCamera({ world, viewport, objects, objectId, overview }: SelectionPublication & { objects: readonly ObjectEntry[]; objectId: string; overview: boolean }): OverviewSelection | null {
  const focus = solarSystemFocus(objects);
  const sun = focus?.worldFrame;
  const selected = objects.find(object => object.id === objectId)?.worldFrame;
  if (!sun || !selected) return null;
  if (!overview) {
    return distance(world.pose.positionM, sun.originM) >= policy.exitSunDistanceM
      ? { overview: true, objectId: focus.id } : null;
  }
  const view = presentWorldCamera(world, sun, viewport);
  if (!view.silhouette || !view.centerPixels) return null;
  const radius = view.silhouette.tangentialSemiAxis;
  return 2 * radius >= policy.enterSunDiameterPixels &&
    Math.hypot(...view.centerPixels) <= Math.max(policy.centerRadiusPixels, radius)
    ? { overview: false, objectId: focus.id } : null;
}

/** Require a sustained threshold crossing, even while the camera keeps moving. */
export function watchOverviewSelection({ navigation, objects, objectId, getOverview, isAvailable,
  onChange, windowTarget }: { navigation: ObjectWorldNavigation; objects: readonly ObjectEntry[]; objectId: string; getOverview(): boolean; isAvailable(): boolean; onChange(selection: OverviewSelection): void; windowTarget: Window }) {
  let timer: number | null = null, latest: SelectionPublication | null = null, candidate: OverviewSelection | null = null; let disposed = false;
  function inspect() {
    timer = null;
    candidate = null;
    if (disposed || !isAvailable() || !latest) return;
    const next = selectionAtCamera({ ...latest, objects, objectId, overview: getOverview() });
    if (next) onChange(next);
  }
  const unsubscribe = navigation.subscribe((world, viewport) => {
    // Publications use the whole stage; selection uses the content centre
    // beside the sidebar, just like the active object's orbit controls.
    latest = { world, viewport: navigation.optics?.() ?? viewport };
    const next = isAvailable() ? selectionAtCamera({ ...latest, objects, objectId, overview: getOverview() }) : null;
    if (next?.objectId === candidate?.objectId && next?.overview === candidate?.overview) return;
    if (timer !== null) windowTarget.clearTimeout(timer);
    timer = null; candidate = next;
    if (next) timer = windowTarget.setTimeout(inspect, policy.settleMilliseconds);
  });
  return () => { disposed = true; unsubscribe(); if (timer !== null) windowTarget.clearTimeout(timer); };
}
