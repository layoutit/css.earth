import type { PositionM } from '@cssearth/engine';
import type { WorldCameraPose } from '@cssearth/renderer/navigation/world-camera.ts';
import type { ShellCamera } from '../browser-types.mts';
import type { ObjectEntry } from '../object-schema.mts';
import type { OverviewScope } from '../overview-context.mts';
import type { createPreparedWorldNavigation } from '../prepared-world-navigation.mts';
import { isFocusDatasetUrl, withDataset } from '../dataset-url.mts';
import { withOverviewScope, withPreparedFocus, withSatelliteSystemView } from './navigation-scope.mts';
import { systemById, type SystemObjects } from '../object-systems.mts';
import { satelliteSystemByHost } from '../satellite-systems.mts';
import { selectionContext, selectionKey, selectionTargetFromUrl, type SelectionTarget, type SceneSubject } from '../scene/scene-selection.mts';

export type NavigationHistory = { history: 'push' | 'replace' } | { history: 'pop'; entry: string };
export type NavigationIntent =
  | { kind: 'object' }
  | { kind: 'satellite-system'; camera: 'frame' | 'preserve' }
  | { kind: 'focus'; id: string }
  | { kind: 'feature'; id: string | null }
  | { kind: 'link'; url: string }
  | { kind: 'history'; url: string; history: NavigationHistory }
  | { kind: 'overview'; scope: OverviewScope; camera: 'frame' | 'preserve' };
export type NavigationCamera =
  | { kind: 'focus' }
  | { kind: 'surface' }
  | { kind: 'restore'; animate: boolean }
  | { kind: 'preserve' }
  | { kind: 'frame'; framing: 'center' | 'detail'; world: WorldCameraPose | null; focusPositionM: PositionM | null };
export interface ResolvedNavigation {
  readonly id: string;
  readonly subject: SelectionTarget;
  readonly camera: NavigationCamera;
  readonly history: NavigationHistory;
  readonly scene: 'reuse' | 'replace';
  readonly origin: 'selection' | 'link';
  readonly feature: string | null;
  url: string;
}

/** Interpret destination intent here; dataset and camera owners still validate their payloads when applying them. */
export function readNavigationSelection(url: URL, objectId: string, objects: SystemObjects) {
  return { subject: selectionTargetFromUrl(url, objectId, objects), savedView: url.searchParams.has('v'),
    dataset: url.searchParams.has('dataset') || isFocusDatasetUrl(url), feature: url.searchParams.get('feature') };
}

/** Resolve once, before cancellation: loading, preview, flight and arrival consume the same destination. */
export function resolveNavigation(intent: NavigationIntent, { object, objects, navigation, current }: {
  object: ObjectEntry;
  /** The world's bodies, for system framing and selections. */
  objects: SystemObjects;
  navigation: ReturnType<typeof createPreparedWorldNavigation>;
  current: { objectId: string; href: string; subject: SceneSubject; centeredObjectId: string | null;
    hasPresented: boolean; reuseScene: boolean; mount: ShellCamera | null; pending: ResolvedNavigation | null };
}): { destination: ResolvedNavigation; centeredObjectId: string | null } {
  if (intent.kind === 'link') {
    const link = new URL(intent.url, current.href), selection = readNavigationSelection(link, object.id, objects);
    if (selection.subject.kind === 'overview' && !selection.savedView && !selection.dataset) {
      intent = { kind: 'overview', scope: selection.subject.overview.scope, camera: 'frame' };
    } else if (selection.subject.kind === 'satellite-system' && !selection.savedView && !selection.dataset) {
      intent = { kind: 'satellite-system', camera: 'frame' };
    }
  }
  const linked = intent.kind === 'link' || intent.kind === 'history';
  let url = new URL(intent.kind === 'link' || intent.kind === 'history' ? intent.url : current.href, current.href);
  let history: NavigationHistory = intent.kind === 'history' ? intent.history
    : { history: (intent.kind === 'overview' || intent.kind === 'satellite-system') && intent.camera === 'preserve' ? 'replace' : 'push' };
  const targetRequest = { objectId: object.id, fromId: current.objectId, mount: current.mount };
  const family = satelliteSystemByHost(object.id);
  if (intent.kind === 'satellite-system' && !family) throw new TypeError(`${object.id} has no satellite system.`);
  const overviewTarget = intent.kind === 'overview' && intent.camera === 'frame'
    ? navigation.overviewTarget({ ...targetRequest, scope: intent.scope }) : null;
  const opensOverviewFocus = current.subject.kind === 'overview' && object.id === current.objectId && current.subject.overview.scope === 'system';
  const opensFamilyFocus = current.subject.kind === 'satellite-system' && object.id === current.objectId;
  const familyTarget = intent.kind === 'satellite-system' && intent.camera === 'frame'
    ? navigation.systemTarget({ ...targetRequest, force: true })
    : intent.kind === 'object' && family && !opensFamilyFocus && object.id !== current.centeredObjectId && current.hasPresented
      ? navigation.systemTarget(targetRequest) : null;
  const center = overviewTarget?.world ?? familyTarget
    ?? (intent.kind === 'object' && !opensOverviewFocus && object.id !== current.centeredObjectId && current.hasPresented
      ? navigation.centerTarget(targetRequest) : null);
  if (intent.kind === 'focus') {
    url.pathname = object.route;
    url = withPreparedFocus(url, intent.id, null);
    url.searchParams.delete('v');
    history = { history: 'replace' };
  } else if (!linked) {
    url.pathname = object.route; url.searchParams.delete('v'); url.searchParams.delete('feature');
    url = withDataset(withPreparedFocus(url, null, null), null);
    withOverviewScope(url, intent.kind === 'overview' ? intent.scope
      : center && intent.kind === 'object' && systemById(objects, object.id) ? 'system' : null);
    withSatelliteSystemView(url, intent.kind === 'satellite-system' || intent.kind === 'object' && familyTarget !== null);
    if (intent.kind === 'feature' && intent.id !== null) url.searchParams.set('feature', intent.id);
  }
  const selection = readNavigationSelection(url, object.id, objects);
  const interruptedFlight = current.pending !== null
    && !(current.pending.camera.kind === 'frame' && current.pending.camera.framing === 'center') && !center;
  const restore = history.history === 'pop' || linked && selection.savedView;
  const keepCamera = intent.kind === 'overview' && intent.camera === 'preserve'
    || intent.kind === 'satellite-system' && intent.camera === 'preserve'
    || current.reuseScene && (linked && selection.dataset || interruptedFlight);
  const camera: NavigationCamera = current.reuseScene && (intent.kind === 'feature' || selection.feature !== null)
    ? { kind: 'surface' } : intent.kind === 'focus' ? { kind: 'focus' } : restore ? { kind: 'restore', animate: history.history === 'pop' }
    : keepCamera ? { kind: 'preserve' }
    : { kind: 'frame', framing: center ? 'center' : 'detail', world: center, focusPositionM: overviewTarget?.focusPositionM ?? null };
  if (current.reuseScene && !restore) {
    const changesSelection = selectionKey(selectionContext(current.subject)) !== selectionKey(selection.subject);
    if (!changesSelection && !(linked && selection.dataset)) history = { history: 'replace' };
  }
  return { destination: { id: object.id, url: url.href, subject: selection.subject, camera, history,
    scene: current.reuseScene ? 'reuse' : 'replace', origin: linked ? 'link' : 'selection', feature: selection.feature },
  centeredObjectId: center && intent.kind !== 'overview' ? object.id : null };
}
