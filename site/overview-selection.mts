import type { PositionM } from '@cssearth/engine';
import type { WorldCameraPose, WorldCameraViewport } from '@cssearth/renderer/navigation/world-camera.ts';
import type { ObjectWorldNavigation } from '@cssearth/renderer/runtime/world-navigation-types.ts';
import type { ObjectEntry } from './object-schema.mts';
import type { SystemObjects } from './object-systems.mts';
interface SelectionPublication { world: WorldCameraPose; viewport: WorldCameraViewport; }
export interface OverviewSelection { overview: boolean; objectId: string; }
import { presentWorldCamera } from '@cssearth/renderer/navigation';
import { OVERVIEW_SELECTION_POLICY as policy } from './runtime-policy.mts';
import { SOLAR_SYSTEM_ID, systemOfObject } from './object-systems.mts';
import { systemOverviewDistance } from './system-framing.mts';

const distance = (a: PositionM, b: PositionM) => Math.hypot(...a.map((value, axis) => value - b[axis]));
/** The Solar System's star; the root of the galactic overviews. */
export const solarSystemFocus = (objects: SystemObjects) => objects.find(object => object.id === SOLAR_SYSTEM_ID);

/** `objects` are the loaded objects, for the mounted one's frame; `systems` are the world's bodies, for its system and the Sun. */
export function selectionAtCamera({ world, viewport, objects, systems, objectId, overview }: SelectionPublication & { objects: readonly Pick<ObjectEntry, 'id' | 'worldFrame'>[]; systems: SystemObjects; objectId: string; overview: boolean }): OverviewSelection | null {
  const selected = objects.find(object => object.id === objectId)?.worldFrame;
  if (!selected) return null;
  const system = systemOfObject(systems, objectId);
  if (!overview) {
    // Leaving an object's planetary system opens that system's overview, whose star the router mounts. A member that already
    // lies outside that framing, such as a wide binary companion hundreds of au out, keeps its own scene until the camera has
    // left it too; otherwise its page would open in the overview.
    if (system) {
      const outside = distance(selected.originM, system.originM);
      const exit = outside >= system.exitDistanceM ? outside + system.exitDistanceM : system.exitDistanceM;
      return distance(world.pose.positionM, system.originM) >= exit ? { overview: true, objectId: system.id } : null;
    }
    // A star or body outside every system keeps its scene until the camera is as far from it as the Sun is;
    // the Solar System overview then hands the camera to the galactic scopes.
    const sun = solarSystemFocus(systems)?.worldFrame;
    if (!sun) return null;
    return distance(world.pose.positionM, selected.originM) >= Math.max(policy.exitSunDistanceM, distance(selected.originM, sun.originM))
      ? { overview: true, objectId: SOLAR_SYSTEM_ID } : null;
  }
  // An overview mounts its system's star; only approaching that star opens its card.
  if (system?.id !== objectId) return null;
  const view = presentWorldCamera(world, selected, viewport);
  if (!view.silhouette || !view.centerPixels) return null;
  const radius = view.silhouette.tangentialSemiAxis;
  // A compact system frames its star large: a hot Jupiter orbits a few stellar radii out. The card also waits for
  // the zoom to pass halfway from the system framing to the close-up, the boundary moon systems use.
  const framing = 'framingRadiusPixels' in viewport && typeof viewport.framingRadiusPixels === 'number' ? viewport.framingRadiusPixels : 0;
  const withinSystem = !framing || view.distanceM <= systemOverviewDistance(selected.bodyRadiusM, system.radiusM, { focalPixels: viewport.focalPixels, framingRadiusPixels: framing });
  return withinSystem && 2 * radius >= policy.enterSunDiameterPixels &&
    Math.hypot(...view.centerPixels) <= Math.max(policy.centerRadiusPixels, radius)
    ? { overview: false, objectId } : null;
}

/** Require a sustained threshold crossing, even while the camera keeps moving. */
export function watchOverviewSelection({ navigation, objects, systems, objectId, getOverview, isAvailable,
  onChange, windowTarget }: { navigation: ObjectWorldNavigation; objects: readonly Pick<ObjectEntry, 'id' | 'worldFrame'>[]; systems: SystemObjects; objectId: string; getOverview(): boolean; isAvailable(): boolean; onChange(selection: OverviewSelection): void; windowTarget: Window }) {
  let timer: number | null = null, latest: SelectionPublication | null = null, candidate: OverviewSelection | null = null; let disposed = false;
  function inspect() {
    timer = null;
    candidate = null;
    if (disposed || !isAvailable() || !latest) return;
    const next = selectionAtCamera({ ...latest, objects, systems, objectId, overview: getOverview() });
    if (next) onChange(next);
  }
  const unsubscribe = navigation.subscribe((world, viewport) => {
    // Publications use the whole stage; selection uses the content centre
    // beside the sidebar, just like the active object's orbit controls.
    latest = { world, viewport: navigation.optics?.() ?? viewport };
    const next = isAvailable() ? selectionAtCamera({ ...latest, objects, systems, objectId, overview: getOverview() }) : null;
    if (next?.objectId === candidate?.objectId && next?.overview === candidate?.overview) return;
    if (timer !== null) windowTarget.clearTimeout(timer);
    timer = null; candidate = next;
    if (next) timer = windowTarget.setTimeout(inspect, policy.settleMilliseconds);
  });
  return () => { disposed = true; unsubscribe(); if (timer !== null) windowTarget.clearTimeout(timer); };
}
