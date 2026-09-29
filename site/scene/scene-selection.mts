import type { PreparedCatalogObject, SpatialCitation } from '@cssearth/catalog';
import type { PreparedFocusPresentation } from '../prepared-focus.mts';
import type { WorldCameraPose } from '@cssearth/renderer/navigation/world-camera.ts';
import { overviewScopeAtCamera, type OverviewScope } from '../overview-context.mts';
import { overviewScopeFromUrl, preparedFocusFromUrl, satelliteSystemFromUrl, withOverviewScope, withPreparedFocus, withSatelliteSystemView } from '../navigation/navigation-scope.mts';
import { SOLAR_SYSTEM_ID, systemById, type SystemObjects } from '../object-systems.mts';
import { satelliteSystemByHost } from '../satellite-systems.mts';

export interface SceneOverview { readonly scope: OverviewScope; readonly systemId: string; }
export type SceneContext =
  | { readonly kind: 'object'; readonly objectId: string }
  | { readonly kind: 'satellite-system'; readonly hostId: string }
  | { readonly kind: 'overview'; readonly overview: SceneOverview };
export type SelectionTarget = SceneContext | { readonly kind: 'focus'; readonly id: string };
export type SceneSubject = SceneContext | {
  readonly kind: 'focus'; readonly id: string;
  readonly record: PreparedCatalogObject | null;
  readonly sources: readonly SpatialCitation[];
  readonly presentation: PreparedFocusPresentation | null;
  /** The underlying camera context is restored when the native focus clears. */
  readonly context: SceneContext;
};

export function selectionContext(subject: SceneSubject): SceneContext {
  return subject.kind === 'focus' ? subject.context : subject;
}

export function selectionTargetFromUrl(url: URL, objectId: string, objects: SystemObjects): SelectionTarget {
  const focus = preparedFocusFromUrl(url, objectId);
  if (focus !== null) return { kind: 'focus', id: focus };
  if (satelliteSystemFromUrl(url) && satelliteSystemByHost(objectId)) return { kind: 'satellite-system', hostId: objectId };
  const scope = overviewScopeFromUrl(url, objectId);
  return scope ? { kind: 'overview', overview: { scope, systemId: systemById(objects, objectId)?.id ?? SOLAR_SYSTEM_ID } }
    : { kind: 'object', objectId };
}

/** Identity used by navigation rows, source links and per-selection reading positions. */
export function selectionKey(subject: SelectionTarget): string {
  switch (subject.kind) {
    case 'focus': return `focus:${subject.id}`;
    case 'object': return `object:${subject.objectId}`;
    case 'satellite-system': return `satellite-system:${subject.hostId}`;
    case 'overview': return `overview:${subject.overview.scope === 'system' ? `system:${subject.overview.systemId}` : subject.overview.scope}`;
  }
}

/** One committed subject. Mounted scene ownership and temporary browsing/flight previews remain independent. */
export function createSceneSelection({ initial, objectId, initialFocus = null, systems = [], onChange }: {
  initial: SelectionTarget; objectId: string; initialFocus?: PreparedCatalogObject | null;
  /** The world's bodies, for a system overview's star: its overview is left by the distance from that star. */
  systems?: SystemObjects;
  onChange(): void;
}) {
  // The mounted scene: a URL that selects no focus is on its page.
  let scene = objectId;
  let subject: SceneSubject = initial.kind === 'focus'
    ? { ...initial, record: initialFocus?.id === initial.id ? initialFocus : null, sources: [], presentation: null,
      context: { kind: 'object', objectId } } : initial;
  function publish(next: SceneSubject, notify = true) {
    if (subject === next) return false;
    subject = next; if (notify) onChange(); return true;
  }
  return {
    get current() { return subject; },
    get context() { return selectionContext(subject); },
    /** Navigation binds incoming content before its single explicit publication. */
    commit(target: SelectionTarget, mountedObjectId: string, notify = true) {
      scene = mountedObjectId;
      if (target.kind !== 'focus') {
        return selectionKey(target) === selectionKey(subject) ? false : publish(target, notify);
      }
      const context = selectionContext(subject);
      const host = context.kind === 'object' ? context.objectId
        : context.kind === 'satellite-system' ? context.hostId : context.overview.systemId;
      const retained = subject.kind === 'focus' && subject.id === target.id ? subject : null;
      if (retained && host === mountedObjectId) return false;
      return publish({ ...target, record: retained?.record ?? null, sources: retained?.sources ?? [], presentation: retained?.presentation ?? null,
        context: host === mountedObjectId ? context : { kind: 'object', objectId: mountedObjectId } }, notify);
    },
    focus(record: PreparedCatalogObject | null, sources: readonly SpatialCitation[], presentation: PreparedFocusPresentation | null) {
      return publish(record ? { kind: 'focus', id: record.id, record, sources, presentation, context: selectionContext(subject) }
        : selectionContext(subject));
    },
    followCamera(world: WorldCameraPose) {
      const context = selectionContext(subject);
      if (context.kind !== 'overview') return false;
      const scope = overviewScopeAtCamera(world, context.overview.scope, undefined, systemById(systems, context.overview.systemId)?.originM);
      if (scope === context.overview.scope) return false;
      const next: SceneContext = { kind: 'overview', overview: { ...context.overview, scope } };
      return publish(subject.kind === 'focus' ? { ...subject, context: next } : next);
    },
    /** Project the committed identity while preserving camera, dataset and diagnostic URL payloads. */
    url(value: string | URL) {
      const url = new URL(value);
      if (subject.kind === 'focus') {
        const lens = subject.presentation?.selectedLens ?? (preparedFocusFromUrl(url, scene) === subject.id ? url.searchParams.get('dataset') : null);
        return withPreparedFocus(url, scene, subject.id, lens).href;
      }
      return withSatelliteSystemView(withOverviewScope(withPreparedFocus(url, scene, null, null), scene,
        subject.kind === 'overview' ? subject.overview.scope : null), subject.kind === 'satellite-system').href;
    },
  };
}
