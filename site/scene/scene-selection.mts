import type { WorldCameraPose } from '@cssearth/objects';
import { dollyPoseAboutFocus } from '@cssearth/engine';
import { zoomScopeAtCamera } from '../zoom-scope.mts';
import { namesSystem, type PageView } from '../navigation/navigation-scope.mts';
import { systemById, type SystemObjects } from '../object-systems.mts';
import { SYSTEM_RANGES } from '../system-framing.mts';
import { subjectOfScope, zoomChain, zoomStepOf } from '../inside-view.mts';
import { selectionKey, subjectOf, type SceneSubject } from './scene-subject.mts';
import { systemObjectId } from '../navigation/system-address.mts';
export { moonSystem, selectionKey, starSystem, subjectHost, subjectOf, subjectView, type SceneSubject } from './scene-subject.mts';

/** The camera has crossed into a scope of the zoom another scene shows (an object seen from inside, or back to the centre's own system): the
 * view is handed to that scene. */
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
    return zoomScopeAtCamera(world, step.scope, undefined, star ? { originM: star.originM, orbitsWithinM: SYSTEM_RANGES.get(star.id) } : undefined,
      zoomChain(step.centreId).map(object => ({ id: object.id, zoom: object.zoom! })));
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
    /** Follows the camera as it backs out: true when the selection changed in place, a hand-over when the camera has crossed
     * into an object the centre is inside (the router replaces the scene once the crossing has held), false otherwise. */
    followCamera(world: WorldCameraPose): boolean | ZoomHandover {
      const step = zoomStepOf(subject);
      if (!step) return false;
      const scope = scopeAt(world, step);
      if (scope === step.scope) return false;
      // The scope the camera crossed into is a selection of the mounted scene (a star's own system), or of another scene.
      const next = subjectOfScope(scope, step.centreId);
      return ownScene(next) ? publish(next) : { ...next, centreId: step.centreId };
    },
    /** The scene a camera `ratio` times as far from its focus would be handed to, without changing the selection: what a
     * zoom toward a crossing has fetched before it gets there. Null on a body, and when that camera is in this scope still. */
    handoverAhead(world: WorldCameraPose, ratio: number): ZoomHandover | null {
      const step = zoomStepOf(subject);
      if (!step) return null;
      const scope = scopeAt({ ...world, pose: dollyPoseAboutFocus(world.pose, ratio) }, step);
      if (scope === step.scope) return null;
      const next = subjectOfScope(scope, step.centreId);
      return ownScene(next) ? null : { ...next, centreId: step.centreId };
    },
    /** Whether a wider scene takes the camera as it zooms out: a body's system does, and so does the next object the centre
     * is inside, out to the last the page has read. Such a scene's own far limit does not stop the zoom. */
    zoomOutOpen(): boolean {
      const step = zoomStepOf(subject);
      if (!step) return true;
      const chain = zoomChain(step.centreId);
      return step.scope === 'system' ? chain.length > 0 : chain.at(-1)?.id !== step.scope;
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
