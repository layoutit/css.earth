import type { WorldCameraPose } from '@cssearth/objects';
import { zoomScopeAtCamera } from '../zoom-scope.mts';
import { namesSystem, type PageView } from '../navigation/navigation-scope.mts';
import { systemById, type SystemObjects } from '../object-systems.mts';
import { satelliteSystemByHost } from '../satellite-systems.mts';
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

export function selectionTargetFromUrl(url: URL, objectId: string, objects: SystemObjects): SelectionTarget {
  // A system's address shows its host out to its members: a planet's moons, or a star's planetary system. An address that
  // names the system of a host without one is the body.
  if (!namesSystem(url)) return { objectId };
  return subjectOf(objectId, satelliteSystemByHost(objectId) || systemById(objects, objectId) ? 'system' : 'body');
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
      const { centreId } = step, star = systemById(systems, centreId);
      const scope = zoomScopeAtCamera(world, step.scope, undefined,
        star ? { originM: star.originM, orbitsWithinM: SYSTEM_RANGES.get(star.id) } : undefined, zoomChain(centreId).map(object => ({ id: object.id, zoom: object.zoom! })));
      if (scope === step.scope) return false;
      // The scope the camera crossed into is a selection of the mounted scene (a star's own system), or of another scene.
      const next = subjectOfScope(scope, centreId);
      return (next.objectId === scene || next.objectId === systemObjectId(scene)) ? publish(next) : { ...next, centreId };
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
