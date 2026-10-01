import type { WorldCameraPose } from '@cssearth/renderer/navigation/world-camera.ts';
import { overviewScopeAtCamera, type OverviewScope } from '../overview-context.mts';
import { overviewScopeFromUrl, satelliteSystemFromUrl, withOverviewScope, withSatelliteSystemView } from '../navigation/navigation-scope.mts';
import { SOLAR_SYSTEM_ID, systemById, type SystemObjects } from '../object-systems.mts';
import { satelliteSystemByHost } from '../satellite-systems.mts';
import { SYSTEM_RANGES } from '../system-framing.mts';
import { isLevelObject, levelCentre } from '../level-view.mts';

/** The camera has crossed into a level that is an object, or back into the centre's system: the view is handed to that scene. */
export interface LadderHandover { readonly objectId: string; readonly centreId: string; readonly to: 'level' | 'system' }

export interface SceneOverview { readonly scope: OverviewScope; readonly systemId: string; }
export type SceneContext =
  | { readonly kind: 'object'; readonly objectId: string }
  | { readonly kind: 'satellite-system'; readonly hostId: string }
  | { readonly kind: 'overview'; readonly overview: SceneOverview };
export type SelectionTarget = SceneContext;
export type SceneSubject = SceneContext;

export function selectionContext(subject: SceneSubject): SceneContext {
  return subject;
}

export function selectionTargetFromUrl(url: URL, objectId: string, objects: SystemObjects): SelectionTarget {
  if (satelliteSystemFromUrl(url) && satelliteSystemByHost(objectId)) return { kind: 'satellite-system', hostId: objectId };
  const scope = overviewScopeFromUrl(url);
  return scope ? { kind: 'overview', overview: { scope, systemId: systemById(objects, objectId)?.id ?? SOLAR_SYSTEM_ID } }
    : { kind: 'object', objectId };
}

/** Identity used by navigation rows, source links and per-selection reading positions. */
export function selectionKey(subject: SelectionTarget): string {
  switch (subject.kind) {
    case 'object': return `object:${subject.objectId}`;
    case 'satellite-system': return `satellite-system:${subject.hostId}`;
    case 'overview': return `overview:${subject.overview.scope === 'system' ? `system:${subject.overview.systemId}` : subject.overview.scope}`;
  }
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
      if (context.kind !== 'overview' && !(context.kind === 'object' && level)) return false;
      const centreId = context.kind === 'overview' ? context.overview.systemId : levelCentre();
      const previous = context.kind === 'overview' ? context.overview.scope : level!;
      const star = systemById(systems, centreId);
      const scope = overviewScopeAtCamera(world, previous, undefined,
        star ? { originM: star.originM, orbitsWithinM: SYSTEM_RANGES.get(star.id) } : undefined);
      if (scope === previous) return false;
      if (scope === scene && level) return publish({ kind: 'object', objectId: scene });
      if (isLevelObject(scope)) return { objectId: scope, centreId, to: 'level' };
      if (level && scope === 'system') return { objectId: centreId, centreId, to: 'system' };
      return publish({ kind: 'overview', overview: { systemId: centreId, scope } });
    },
    /** Project the committed identity while preserving camera, dataset and diagnostic URL payloads. */
    url(value: string | URL) {
      return withSatelliteSystemView(withOverviewScope(new URL(value), subject.kind === 'overview'), subject.kind === 'satellite-system').href;
    },
  };
}
