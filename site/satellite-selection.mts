import type { WorldCameraPose } from '@cssearth/engine';
import type { ObjectWorldNavigation } from '@cssearth/renderer/runtime/world-navigation-types.ts';
import type { ObjectEntry } from './objects.mts';
import { bodyViewAtCamera } from './zoom-scope.mts';
import { OVERVIEW_SELECTION_POLICY } from './runtime-policy.mts';
import { satelliteSystemByHost, satelliteSystemOfMember } from './satellite-systems.mts';
import type { SceneContext } from './scene/scene-selection.mts';
import { moonSystem, starSystem, subjectHost, subjectOf } from './scene/scene-subject.mts';

/** The selected body's own close-up leads into its nearest prepared satellite family. */
export function satelliteSelectionAtCamera(world: WorldCameraPose, optics: ReturnType<ObjectWorldNavigation['optics']>,
  objects: readonly Pick<ObjectEntry, 'id' | 'worldFrame'>[], selection: SceneContext): SceneContext | null {
  // A star's system is a step of the zoom out of the star (scene-selection.mts `followCamera`), not this hand-over.
  if (starSystem(selection)) return null;
  const id = subjectHost(selection), overview = moonSystem(selection);
  const family = satelliteSystemByHost(id) ?? satelliteSystemOfMember(id);
  if (!family) return null;
  const frame = objects.find(object => object.id === id)?.worldFrame;
  if (!frame) return null;
  const card = bodyViewAtCamera(world, frame, optics, id, overview ? 'overview' : 'detail');
  if (overview && card === 'detail') return { objectId: id };
  if (!overview && card === 'overview') return subjectOf(family.hostId, 'system');
  return null;
}

/** Layout-changing card selection settles after motion, with no change mid-coast. A crossing out of the body's close-up
 * is reported once, until the camera comes back (`onReturn`): when it leads to another scene (a moon's planet), that
 * scene takes the view only when the camera rests (scene/camera-handover.mts), and this watcher goes on with the body's. */
export function watchSatelliteSelection({ navigation, objects, getSelection, isAvailable, onChange, onReturn,
  documentTarget, windowTarget }: { navigation: ObjectWorldNavigation;
  objects: readonly Pick<ObjectEntry, 'id' | 'worldFrame'>[]; getSelection(): SceneContext;
  isAvailable(): boolean; onChange(selection: SceneContext): void;
  /** The camera no longer frames the selection last reported. */
  onReturn?(): void;
  documentTarget: Document; windowTarget: Window }) {
  let timer: number | null = null, coasting = false, disposed = false;
  let latest: { world: WorldCameraPose; optics: ReturnType<ObjectWorldNavigation['optics']> } | null = null;
  let candidate: SceneContext | null = null, left: SceneContext | null = null;
  const cancel = () => { if (timer !== null) windowTarget.clearTimeout(timer); timer = null; candidate = null; };
  const same = (a: SceneContext | null, b: SceneContext | null) => a?.objectId === b?.objectId;
  const inspect = () => {
    timer = null; candidate = null;
    if (disposed || coasting || !isAvailable() || !latest) return;
    const next = satelliteSelectionAtCamera(latest.world, latest.optics, objects, getSelection());
    if (next) { left = next; onChange(next); }
  };
  const schedule = () => {
    if (disposed || coasting || !isAvailable() || !latest) { cancel(); return; }
    const next = satelliteSelectionAtCamera(latest.world, latest.optics, objects, getSelection());
    if (left) {
      if (same(next, left)) return;
      left = null; onReturn?.();
    }
    if (same(next, candidate)) return;
    cancel(); candidate = next;
    if (next) timer = windowTarget.setTimeout(inspect, OVERVIEW_SELECTION_POLICY.settleMilliseconds);
  };
  const unsubscribe = navigation.subscribe(world => {
    latest = { world, optics: navigation.optics() };
    schedule();
  });
  const motionChanged = (event: Event) => {
    coasting = event instanceof CustomEvent && (event.detail as { coasting?: unknown } | null)?.coasting === true;
    if (coasting) cancel(); else schedule();
  };
  documentTarget.addEventListener('objectmotionchange', motionChanged, { capture: true });
  return Object.assign(() => { disposed = true; cancel(); unsubscribe(); documentTarget.removeEventListener('objectmotionchange', motionChanged, { capture: true }); },
    // Whatever was reported no longer stands (a wider crossing was withdrawn): the camera is asked again.
    { refresh() { left = null; schedule(); } });
}
