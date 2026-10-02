import type { WorldCameraPose } from '@cssearth/renderer/navigation/world-camera.ts';
import { overviewScopeAtCamera } from '../overview-context.mts';
import { overviewScopeFromUrl, satelliteSystemFromUrl, withOverviewScope, withSatelliteSystemView } from '../navigation/navigation-scope.mts';
import { systemById, type SystemObjects } from '../object-systems.mts';
import { satelliteSystemByHost } from '../satellite-systems.mts';
import { SYSTEM_RANGES } from '../system-framing.mts';
import { isLevelObject, levelCentre } from '../level-view.mts';

/** The camera has crossed into a level that is an object, or back into the centre's system: the view is handed to that scene. */
export interface LadderHandover { readonly objectId: string; readonly centreId: string; readonly to: 'level' | 'system' }

/** How far out an object is seen: on the body, out to its moons, or (a star) out to its planetary system. */
export type SceneView = 'body' | 'moons' | 'system';
/** The one selection: an object, and how far out it is seen. A planet's moons and a star's planetary system are views of
 * that planet and that star, not other kinds of subject. */
export interface SceneSubject { readonly objectId: string; readonly view: SceneView }
export type SceneContext = SceneSubject;
export type SelectionTarget = SceneSubject;

export function selectionTargetFromUrl(url: URL, objectId: string, objects: SystemObjects): SelectionTarget {
  if (satelliteSystemFromUrl(url) && satelliteSystemByHost(objectId)) return { objectId, view: 'moons' };
  // A system overview is a view of its star's page: on any other page the address names the body.
  const system = overviewScopeFromUrl(url) ? systemById(objects, objectId) : null;
  return { objectId, view: system ? 'system' : 'body' };
}

/** Identity used by navigation rows, source links and per-selection reading positions. */
export function selectionKey(subject: SelectionTarget): string {
  return subject.view === 'body' ? `object:${subject.objectId}` : subject.view === 'moons' ? `satellite-system:${subject.objectId}` : `overview:system:${subject.objectId}`;
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
      const context = subject, level = isLevelObject(scene) ? scene : null;
      // A mounted level is seen around its centre; an overview, around its system's star.
      if (context.view !== 'system' && !(context.view === 'body' && level)) return false;
      const centreId = context.view === 'system' ? context.objectId : levelCentre();
      const previous = context.view === 'system' ? 'system' : level!;
      const star = systemById(systems, centreId);
      const scope = overviewScopeAtCamera(world, previous, undefined,
        star ? { originM: star.originM, orbitsWithinM: SYSTEM_RANGES.get(star.id) } : undefined);
      if (scope === previous) return false;
      if (scope === scene && level) return publish({ objectId: scene, view: 'body' });
      if (isLevelObject(scope)) return { objectId: scope, centreId, to: 'level' };
      if (level && scope === 'system') return { objectId: centreId, centreId, to: 'system' };
      // The star's own system is the only overview left to select in place; a level is another scene.
      return scope === 'system' ? publish({ objectId: centreId, view: 'system' }) : false;
    },
    /** Project the committed identity while preserving camera, dataset and diagnostic URL payloads. */
    url(value: string | URL) {
      return withSatelliteSystemView(withOverviewScope(new URL(value), subject.view === 'system'), subject.view === 'moons').href;
    },
  };
}
