import type { PreparedCatalogObject, SpatialCitation } from '@cssearth/catalog';
import type { PreparedFocusPresentation } from './prepared-focus.mts';
import type { WorldCameraPose } from '../src/renderers/css/navigation/world-camera.js';
import type { ObjectEntry } from './object-schema.mts';
import { overviewScopeAtCamera, type OverviewScope } from './overview-context.mts';
import { overviewScopeFromUrl, withOverviewScope, withPreparedFocus } from './navigation-scope.mts';
import { SOLAR_SYSTEM_ID, systemById } from './object-systems.mts';

export interface SceneOverview { readonly scope: OverviewScope; readonly systemId: string; }
export type SceneContext =
  | { readonly kind: 'object'; readonly objectId: string }
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

export function selectionTargetFromUrl(url: URL, objectId: string, objects: readonly ObjectEntry[]): SelectionTarget {
  if (url.searchParams.has('focus')) return { kind: 'focus', id: url.searchParams.get('focus')! };
  const scope = overviewScopeFromUrl(url);
  return scope ? { kind: 'overview', overview: { scope, systemId: systemById(objects, objectId)?.id ?? SOLAR_SYSTEM_ID } }
    : { kind: 'object', objectId };
}

/** Identity used by navigation rows, source links and per-selection reading positions. */
export function selectionKey(subject: SelectionTarget): string {
  switch (subject.kind) {
    case 'focus': return `focus:${subject.id}`;
    case 'object': return `object:${subject.objectId}`;
    case 'overview': return `overview:${subject.overview.scope === 'system' ? `system:${subject.overview.systemId}` : subject.overview.scope}`;
  }
}

/** One committed subject. Mounted scene ownership and temporary browsing/flight previews remain independent. */
export function createSceneSelection({ initial, objectId, initialFocus = null, onChange }: {
  initial: SelectionTarget; objectId: string; initialFocus?: PreparedCatalogObject | null;
  onChange(): void;
}) {
  let subject: SceneSubject = initial.kind === 'focus'
    ? { ...initial, record: initialFocus?.id === initial.id ? initialFocus : null, sources: [], presentation: null,
      context: { kind: 'object', objectId } } : initial;
  function publish(next: SceneSubject) {
    if (subject === next) return false;
    subject = next; onChange(); return true;
  }
  return {
    get current() { return subject; },
    get context() { return selectionContext(subject); },
    commit(target: SelectionTarget, mountedObjectId: string) {
      if (target.kind !== 'focus') {
        return selectionKey(target) === selectionKey(subject) ? false : publish(target);
      }
      const context = selectionContext(subject);
      const host = context.kind === 'object' ? context.objectId : context.overview.systemId;
      const retained = subject.kind === 'focus' && subject.id === target.id ? subject : null;
      if (retained && host === mountedObjectId) return false;
      return publish({ ...target, record: retained?.record ?? null, sources: retained?.sources ?? [], presentation: retained?.presentation ?? null,
        context: host === mountedObjectId ? context : { kind: 'object', objectId: mountedObjectId } });
    },
    focus(record: PreparedCatalogObject | null, sources: readonly SpatialCitation[], presentation: PreparedFocusPresentation | null) {
      return publish(record ? { kind: 'focus', id: record.id, record, sources, presentation, context: selectionContext(subject) }
        : selectionContext(subject));
    },
    followCamera(world: WorldCameraPose) {
      const context = selectionContext(subject);
      if (context.kind !== 'overview') return false;
      const scope = overviewScopeAtCamera(world, context.overview.scope);
      if (scope === context.overview.scope) return false;
      const next: SceneContext = { kind: 'overview', overview: { ...context.overview, scope } };
      return publish(subject.kind === 'focus' ? { ...subject, context: next } : next);
    },
    /** Project the committed identity while preserving camera, dataset and diagnostic URL payloads. */
    url(value: string | URL) {
      const url = new URL(value);
      if (subject.kind === 'focus') {
        const lens = subject.presentation?.selectedLens ?? (url.searchParams.get('focus') === subject.id ? url.searchParams.get('focusLens') : null);
        return withPreparedFocus(url, subject.id, lens).href;
      }
      return withOverviewScope(withPreparedFocus(url, null, null), subject.kind === 'overview' ? subject.overview.scope : null).href;
    },
  };
}
