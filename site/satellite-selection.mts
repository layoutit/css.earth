import type { WorldCameraPose } from '@cssearth/renderer/navigation/world-camera.ts';
import type { ObjectWorldNavigation } from '@cssearth/renderer/runtime/world-navigation-types.ts';
import type { ObjectEntry } from './object-schema.mts';
import { bodyCardViewAtCamera } from './overview-context.mts';
import { OVERVIEW_SELECTION_POLICY } from './runtime-policy.mts';
import { satelliteSystemByHost, satelliteSystemOfMember } from './satellite-systems.mts';
import type { SceneContext } from './scene/scene-selection.mts';

/** The selected body's own close-up leads into its nearest prepared satellite family. */
export function satelliteSelectionAtCamera(world: WorldCameraPose, optics: ReturnType<ObjectWorldNavigation['optics']>,
  objects: readonly Pick<ObjectEntry, 'id' | 'worldFrame'>[], selection: SceneContext): SceneContext | null {
  if (selection.kind === 'overview') return null;
  const id = selection.kind === 'satellite-system' ? selection.hostId : selection.objectId;
  const family = satelliteSystemByHost(id) ?? satelliteSystemOfMember(id);
  if (!family) return null;
  const frame = objects.find(object => object.id === id)?.worldFrame;
  if (!frame) return null;
  const card = bodyCardViewAtCamera(world, frame, optics, id,
    selection.kind === 'satellite-system' ? 'overview' : 'detail');
  if (selection.kind === 'satellite-system' && card === 'detail') return { kind: 'object', objectId: id };
  if (selection.kind === 'object' && card === 'overview') return { kind: 'satellite-system', hostId: family.hostId };
  return null;
}

/** Layout-changing card selection settles after motion, with no change mid-coast. */
export function watchSatelliteSelection({ navigation, objects, getSelection, isAvailable, onChange,
  documentTarget, windowTarget }: { navigation: ObjectWorldNavigation;
  objects: readonly Pick<ObjectEntry, 'id' | 'worldFrame'>[]; getSelection(): SceneContext;
  isAvailable(): boolean; onChange(selection: SceneContext): void;
  documentTarget: Document; windowTarget: Window }) {
  let timer: number | null = null, coasting = false, disposed = false;
  let latest: { world: WorldCameraPose; optics: ReturnType<ObjectWorldNavigation['optics']> } | null = null;
  let candidate: SceneContext | null = null;
  const cancel = () => { if (timer !== null) windowTarget.clearTimeout(timer); timer = null; candidate = null; };
  const same = (a: SceneContext | null, b: SceneContext | null) => a?.kind === b?.kind
    && (a?.kind === 'object' && b?.kind === 'object' ? a.objectId === b.objectId
      : a?.kind === 'satellite-system' && b?.kind === 'satellite-system' ? a.hostId === b.hostId : a === b);
  const inspect = () => {
    timer = null; candidate = null;
    if (disposed || coasting || !isAvailable() || !latest) return;
    const next = satelliteSelectionAtCamera(latest.world, latest.optics, objects, getSelection());
    if (next) onChange(next);
  };
  const schedule = () => {
    if (disposed || coasting || !isAvailable() || !latest) { cancel(); return; }
    const next = satelliteSelectionAtCamera(latest.world, latest.optics, objects, getSelection());
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
  return () => { disposed = true; cancel(); unsubscribe(); documentTarget.removeEventListener('objectmotionchange', motionChanged, { capture: true }); };
}
