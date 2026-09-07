import { presentWorldCamera } from '../src/renderers/css/dist/navigation.js';
import { OVERVIEW_SELECTION_POLICY as policy } from './runtime-policy.mjs';

const distance = (a, b) => Math.hypot(...a.map((value, axis) => value - b[axis]));
export const solarSystemFocus = objects => objects.find(object => object.classification === 'star' && object.distanceAu === 0);

export function overviewExitDistance(frame, sunFrame) {
  return Math.max(frame.bodyRadiusM * policy.minimumDistanceRadii,
    distance(frame.originM, sunFrame.originM) * policy.orbitDistanceFactor);
}

export function selectionAtCamera({ world, viewport, objects, objectId, overview }) {
  const focus = solarSystemFocus(objects);
  const sun = focus?.worldFrame;
  const selected = objects.find(object => object.id === objectId)?.worldFrame;
  if (!sun || !selected) return null;
  if (!overview) {
    return distance(world.pose.positionM, selected.originM) > overviewExitDistance(selected, sun)
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
  onChange, windowTarget }) {
  let timer = null, latest = null, candidate = null, disposed = false;
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
