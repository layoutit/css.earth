import type { WorldCameraPose } from '@cssearth/renderer/navigation/world-camera.ts';
import { overviewScopeAtCamera } from '../overview-context.mts';
import { PAGE_VIEWS, namesSystem, withView, type PageView } from '../navigation/navigation-scope.mts';
import { systemById, type SystemObjects } from '../object-systems.mts';
import { satelliteSystemByHost } from '../satellite-systems.mts';
import { SYSTEM_RANGES } from '../system-framing.mts';
import { ladderOf, subjectOfScope } from '../level-view.mts';

/** The camera has crossed into a rung of the zoom ladder another scene shows (a level, or back to the centre's own system): the
 * view is handed to that scene. */
export interface LadderHandover { readonly objectId: string; readonly view: 'body' | 'system'; readonly centreId: string }

/** How far out an object is seen: on the body, out to its moons, or (a star) out to its planetary system. */
export type SceneView = PageView;
/** The one selection: an object, and how far out it is seen. A planet's moons and a star's planetary system are views of
 * that planet and that star, not other kinds of subject. */
export interface SceneSubject { readonly objectId: string; readonly view: SceneView }
export type SceneContext = SceneSubject;
export type SelectionTarget = SceneSubject;

export function selectionTargetFromUrl(url: URL, objectId: string, objects: SystemObjects): SelectionTarget {
  // A system's address shows its host out to its members: a planet's moons, or a star's planetary system. An address that
  // names the system of a host without one is the body.
  if (!namesSystem(url)) return { objectId, view: 'body' };
  return { objectId, view: satelliteSystemByHost(objectId) ? 'moons' : systemById(objects, objectId) ? 'system' : 'body' };
}

/** Identity used by navigation rows, source links and per-selection reading positions. */
export function selectionKey(subject: SelectionTarget): string {
  return `${PAGE_VIEWS[subject.view].identity}:${subject.objectId}`;
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
    /** Follows the zoom ladder: true when the selection changed in place, a hand-over when the camera has crossed into
     * another scene's level (the router replaces the scene once the crossing has held), false otherwise. */
    followCamera(world: WorldCameraPose): boolean | LadderHandover {
      const ladder = ladderOf(subject);
      if (!ladder) return false;
      const { centreId } = ladder, star = systemById(systems, centreId);
      const scope = overviewScopeAtCamera(world, ladder.scope, undefined,
        star ? { originM: star.originM, orbitsWithinM: SYSTEM_RANGES.get(star.id) } : undefined);
      if (scope === ladder.scope) return false;
      // The rung the camera crossed into is a selection of the mounted scene (a star's own system), or of another scene.
      const next = subjectOfScope(scope, centreId);
      return next.objectId === scene ? publish(next) : { ...next, centreId };
    },
    /** Project the committed identity while preserving camera, dataset and diagnostic URL payloads. */
    url(value: string | URL) {
      return withView(new URL(value), subject.view).href;
    },
  };
}
