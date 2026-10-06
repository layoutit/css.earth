import type { WorldCameraPose } from '@cssearth/engine';
import { zoomScopeAtCamera } from '../world/zoom-scope.mts';
import { namesSystem, type PageView } from '../world/navigation-scope.mts';
import { systemById, type SystemObjects } from '../world/object-systems.mts';
import { SYSTEM_RANGES } from '../world/system-framing.mts';
import { zoomChain, zoomStepOf } from '../world/inside-view.mts';
import { selectionKey, subjectOf, type SceneSubject } from '../world/scene-subject.mts';
import { systemHostId, systemObjectId } from '../model/system-address.mts';
export { moonSystem, selectionKey, starSystem, subjectHost, subjectOf, subjectView, type SceneSubject } from '../world/scene-subject.mts';

/** The camera has crossed into a scope of the zoom (an object seen from inside, or back to the centre's own system): the
 * view is handed to the scene that shows it. */
export interface ZoomHandover { readonly objectId: string; readonly centreId: string }

/** How far out an object's scene is seen: on the body, or out to its system. */
export type SceneView = PageView;
export type SceneContext = SceneSubject;
export type SelectionTarget = SceneSubject;

/** The selection an address names on the scene of `objectId`: its system when the address is a system's (the registry's
 * rule, navigation/system-address.mts), which shows the host out to what is inside it; else the body. The build serves a
 * system's address only for a system object, so no table of systems is asked. */
export function selectionTargetFromUrl(url: URL, objectId: string): SelectionTarget {
  return subjectOf(objectId, namesSystem(url) ? 'system' : 'body');
}

/** One committed subject. Mounted scene ownership and temporary browsing/flight previews remain independent. */
export function createSceneSelection({ initial, objectId, systems = [], onChange }: {
  initial: SelectionTarget; objectId: string;
  /** The world's bodies, for a system overview's star: its overview is left by the distance from that star. */
  systems?: SystemObjects;
  onChange(): void;
}) {
  // The mounted scene.
  let scene = objectId;
  let subject: SceneSubject = initial;
  /** The scope a camera frames, on the zoom out of a step's centre (zoom-scope.mts). */
  const scopeAt = (world: WorldCameraPose, step: { readonly scope: string; readonly centreId: string }) => {
    const star = systemById(systems, step.centreId);
    const systemId = systemObjectId(step.centreId);
    return zoomScopeAtCamera(world, step.scope, undefined, star ? { originM: star.originM, orbitsWithinM: SYSTEM_RANGES.get(star.id), systemId } : { systemId },
      zoomChain(step.centreId));
  };
  /** Whether the mounted scene shows `next`: its own object, or its system. */
  const ownScene = (next: SceneSubject) => next.objectId === scene || next.objectId === systemObjectId(scene);
  function publish(next: SceneSubject, notify = true) {
    if (subject === next) return false;
    subject = next; if (notify) onChange(); return true;
  }
  return {
    get current() { return subject; },
    get context() { return subject; },
    /** Navigation binds incoming content before its single explicit publication. */
    commit(target: SelectionTarget, mountedObjectId: string, notify = true) {
      scene = mountedObjectId;
      return selectionKey(target) === selectionKey(subject) ? false : publish(target, notify);
    },
    /** Whether the mounted scene shows `next`: its own object, or its system. */
    ownScene,
    /** The scope the camera frames as it backs out or comes in, from `from`: the committed selection, or one the camera
     * has already crossed into (camera-handover.mts). Null while it frames `from` still; else the scope it has crossed
     * into, a selection of the mounted scene (a star's own system) or of another. Nothing is committed here: every
     * crossing goes to the camera hand-over, which commits it when the camera rests. */
    followCamera(world: WorldCameraPose, from: SceneSubject = subject): ZoomHandover | null {
      const step = zoomStepOf(from);
      if (!step) return null;
      const scope = scopeAt(world, step);
      return scope === step.scope ? null : { objectId: scope, centreId: step.centreId };
    },
    /** Whether a wider scene takes the camera as it zooms out of `from`: a body's system does, and so does the next object
     * the centre is inside, out to the last the page has read. Such a zoom does not stop at the mounted scene's far limit. */
    zoomOutOpen(from: SceneSubject = subject): boolean {
      const step = zoomStepOf(from);
      if (!step) return true;
      const chain = zoomChain(step.centreId);
      return systemHostId(step.scope) !== null ? chain.length > 0 : chain.at(-1)?.id !== step.scope;
    },
    /** Project the committed identity while preserving camera, dataset and diagnostic URL payloads. */
    url(value: string | URL) {
      const url = new URL(value);
      // The front page (`/`) shows its object's body under its own address.
      if (!(url.pathname === '/' && subject.objectId === scene)) url.pathname = `/${subject.objectId}/`;
      return url.href;
    },
  };
}
