import { eyeDistanceM } from '@cssearth/engine';
import type { PositionM } from '@cssearth/engine';
import type { WorldCameraPose } from '@cssearth/engine';
import type { WorldCameraViewport } from '@cssearth/renderer/navigation/world-camera.ts';
import type { ObjectWorldNavigation } from '@cssearth/renderer/runtime/world-navigation-types.ts';
import type { ObjectEntry } from './objects.mts';
import type { SystemObjects } from './object-systems.mts';
interface SelectionPublication { world: WorldCameraPose; viewport: WorldCameraViewport; }
export interface OverviewSelection { overview: boolean; objectId: string; }
/** The object a body is inside, when that object has a scene of its own: another galaxy, a cluster of galaxies. Its scene
 * shows it from outside, so `radiusM` is its body's (`worldFrame.bodyRadiusM`). */
export interface InsideBody { readonly id: string; readonly originM: PositionM; readonly radiusM: number }
import { presentWorldCamera } from '@cssearth/renderer/navigation/world-camera.ts';
import { OVERVIEW_SELECTION_POLICY as policy } from './browser/runtime-policy.mts';
import { SOLAR_SYSTEM_ID, systemOfObject } from './object-systems.mts';
import { systemOverviewDistance } from './system-framing.mts';
import { leaveDistanceM, zoomStepOf } from './inside-view.mts';
import { satelliteSelectionAtCamera } from './satellite-selection.mts';
import { subjectOf, type SceneSubject } from './scene/scene-subject.mts';

const distance = (a: PositionM, b: PositionM) => Math.hypot(...a.map((value, axis) => value - b[axis]));
/** The Solar System's star; the root of the galactic overviews. */
export const solarSystemFocus = (objects: SystemObjects) => objects.find(object => object.id === SOLAR_SYSTEM_ID);

/** `objects` are the loaded objects, for the mounted one's frame; `systems` are the world's bodies, for its system and the Sun. */
export function selectionAtCamera({ world, viewport, objects, systems, objectId, overview, landed = false, restRangeM = 0, exitScale = 1, inside = null }: SelectionPublication & { objects: readonly Pick<ObjectEntry, 'id' | 'worldFrame'>[]; systems: SystemObjects; objectId: string; overview: boolean;
  /** The object the body is inside, when it has a scene of its own: zooming out of the body hands the view to it. */
  inside?: InsideBody | null;
  /** A flight to a framing (a header pill's category) has just landed here. */
  landed?: boolean;
  /** How far from the body its scene came to rest: where its page loaded or its flight landed. */
  restRangeM?: number;
  /** Ask for an exit distance this many times as far: whether the camera is clearly past it. */
  exitScale?: number }): OverviewSelection | null {
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
      // A flight that lands as far from the body as its star is has left the body for its system: the Moons pill from
      // Earth framed the whole Solar System at 88 au under the "Earth–Moon system" card (2026-10-01). A zoom by hand
      // keeps the body's scene out to the exit distance, so a reader can come back in.
      if (landed && outside > 0 && eyeDistanceM(world.pose, selected.originM) >= outside) return { overview: true, objectId: system.id };
      return eyeDistanceM(world.pose, system.originM) >= exit * exitScale ? { overview: true, objectId: system.id } : null;
    }
    // A body inside an object with a scene of its own (a star of another galaxy, a galaxy of a cluster) hands the view to
    // that object, the next one out in the object tree, once the camera is outside it: that scene shows its body from
    // outside and refuses a camera inside it. `leaveDistanceM` is that far from the body whichever way the camera backs out.
    // A flight that landed far out chose a framing of the whole world, which the Sun's overview shows.
    if (inside && !landed) {
      return eyeDistanceM(world.pose, selected.originM) >= Math.max(leaveDistanceM(selected.originM, inside), 2 * restRangeM) * exitScale
        ? { overview: false, objectId: inside.id } : null;
    }
    // A star or body outside every system keeps its scene until the camera is as far from it as the Sun is;
    // the Solar System overview then hands the camera to the galactic scopes.
    const sun = solarSystemFocus(systems)?.worldFrame;
    if (!sun) return null;
    // A galaxy is a body too, and a near one is framed from farther than the Sun is: the LMC, 49.6 kpc away, opened as
    // "Local Group" the moment its flight landed (2026-10-01). A body keeps its scene out to twice the range it came to rest at.
    return eyeDistanceM(world.pose, selected.originM) >= Math.max(policy.exitSunDistanceM, distance(selected.originM, sun.originM), 2 * restRangeM) * exitScale
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

/** The selection the camera frames from the scene of body `objectId` when it is not the committed one, farthest first:
 * out of the body, its star's system or the object it is inside (selectionAtCamera); short of that, its planet's
 * system or its own moons' (satelliteSelectionAtCamera); and back in, the body. Null while the camera frames
 * `selection` still. A system is named by its own object id. A zoom in past the scene's near limit is the watcher's
 * (watchCameraSelection `inward`). */
export function framedAtCamera({ selection, optics, ...facts }: Omit<Parameters<typeof selectionAtCamera>[0], 'overview'> & {
  /** The committed selection of the mounted scene: the body, or its system. */
  selection: SceneSubject;
  /** The shared camera's optics, for the body's own close-up threshold; without them only the exits are asked. */
  optics?: ReturnType<ObjectWorldNavigation['optics']> | null }): SceneSubject | null {
  const exit = selectionAtCamera({ ...facts, overview: zoomStepOf(selection) !== null });
  if (exit) return exit.overview ? subjectOf(exit.objectId, 'system') : { objectId: exit.objectId };
  return optics ? satelliteSelectionAtCamera(facts.world, optics, facts.objects, selection) : null;
}

/** Watches the camera on a body's scene and reports the selection it frames (framedAtCamera). A crossing must last
 * (policy.settleMilliseconds), even while the camera keeps moving; a camera clearly past an exit (policy.clearExitScale)
 * is reported at once. A crossing is reported once, until the camera comes back (`onReturn`) or frames another: what it
 * names (another scene, or the body's own system or the body itself, which share the mounted scene) takes the card and
 * the address only when the camera rests (scene/camera-handover.mts), and this watcher goes on with the committed
 * selection until then.
 *
 * A zoom in on an object whose walls surround a body (`inner`: a nebula and its central star) goes on into that body: once
 * the camera is as near as the object's scene lets it come, the body's scene takes the view where the camera is, draws the
 * walls around it, and has the rest of the way in. Zooming back out returns the same way (`inside`). */
export function watchCameraSelection({ navigation, objects, systems, objectId, getSelection, isAvailable,
  onChange, onReturn, windowTarget, inside, inner }: { navigation: ObjectWorldNavigation; objects: readonly Pick<ObjectEntry, 'id' | 'worldFrame'>[]; systems: SystemObjects; objectId: string;
  /** The committed selection of the mounted scene. */
  getSelection(): SceneSubject; isAvailable(): boolean;
  /** The object the body is inside, when it has a scene of its own; asked on each camera, as its entry may be read late. */
  inside?(): InsideBody | null;
  /** The body the mounted object's walls surround, once the page has read it (object-directory.mts `knownInner`). */
  inner?(): string | null;
  /** `landed`: a flight to a framing has just landed here, so the camera is at rest. */
  onChange(selection: SceneSubject, landed: boolean): void;
  /** The camera frames the committed selection again after a crossing was reported. */
  onReturn?(): void;
  windowTarget: Window }) {
  let timer: number | null = null, latest: SelectionPublication | null = null, candidate: SceneSubject | null = null; let disposed = false;
  // Where the body's scene came to rest: the first camera it answers for, and each landing after it.
  let restRangeM: number | null = null;
  // The crossing last reported, until the camera comes back: one report a crossing.
  let left: SceneSubject | null = null;
  const same = (a: SceneSubject | null, b: SceneSubject | null) => a?.objectId === b?.objectId;
  const range = (world: WorldCameraPose) => {
    const origin = objects.find(object => object.id === objectId)?.worldFrame?.originM;
    return origin ? eyeDistanceM(world.pose, origin) : 0;
  };
  // What every reading of the camera is asked with.
  const facts = (publication: SelectionPublication) => ({ ...publication, objects, systems, objectId, inside: inside?.() ?? null, restRangeM: restRangeM ?? 0 });
  // The zoom in has reached the scene's near limit, on the body's own selection. Not where the scene came to rest: a page
  // opened on its nearest view stays the object's, and a camera handed in from the body it surrounds is on its way out.
  const inward = (publication: SelectionPublication): SceneSubject | null => {
    const body = inner?.() ?? null;
    return body !== null && getSelection().objectId === objectId && navigation.nearest?.() === true
      && restRangeM !== null && range(publication.world) < restRangeM ? { objectId: body } : null;
  };
  const framed = (publication: SelectionPublication, landed = false) =>
    framedAtCamera({ ...facts(publication), selection: getSelection(), optics: navigation.optics?.() ?? null, landed })
      ?? (landed ? null : inward(publication));
  /** Whether the camera is clearly past an exit out of the body: no wait is needed to know it has left. */
  const clearlyOut = (publication: SelectionPublication) => zoomStepOf(getSelection()) === null
    && selectionAtCamera({ ...facts(publication), overview: false, exitScale: policy.clearExitScale }) !== null;
  const report = (next: SceneSubject, landed: boolean) => {
    left = next;
    onChange(next, landed);
  };
  function inspect(landed = false) {
    timer = null;
    candidate = null;
    if (disposed || !isAvailable() || !latest) return;
    if (landed || restRangeM === null) restRangeM = range(latest.world);
    const next = framed(latest, landed);
    if (next) report(next, landed);
  }
  const unsubscribe = navigation.subscribe((world, viewport) => {
    // Publications use the whole stage; selection uses the content centre
    // beside the sidebar, just like the active object's orbit controls.
    latest = { world, viewport: navigation.optics?.() ?? viewport };
    if (isAvailable() && restRangeM === null) restRangeM = range(world);
    const next = isAvailable() ? framed(latest) : null;
    if (!next) {
      // A flight that holds this watcher off (isAvailable) is not the camera coming back.
      if (left && isAvailable()) { left = null; onReturn?.(); }
    } else if (same(next, left)) return;
    else if (clearlyOut(latest)) {
      if (timer !== null) windowTarget.clearTimeout(timer);
      timer = null; candidate = null;
      report(next, false);
      return;
    }
    if (same(next, candidate)) return;
    if (timer !== null) windowTarget.clearTimeout(timer);
    timer = null; candidate = next;
    if (next) timer = windowTarget.setTimeout(() => inspect(), policy.settleMilliseconds);
  });
  // `refresh` settles at once on the last camera: a flight that held the watcher off (isAvailable) hands over where it landed.
  return Object.assign(() => { disposed = true; unsubscribe(); if (timer !== null) windowTarget.clearTimeout(timer); },
    { refresh(landed = false) { if (timer !== null) windowTarget.clearTimeout(timer); inspect(landed); } });
}
