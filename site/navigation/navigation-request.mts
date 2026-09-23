import type { PositionM } from '@cssearth/engine';
import type { WorldCameraPose } from '../../src/renderers/css/navigation/world-camera.js';
import type { ShellCamera } from '../browser-types.mts';
import type { ObjectEntry } from '../object-schema.mts';
import type { OverviewScope } from '../overview-context.mts';
import type { createPreparedWorldNavigation } from '../prepared-world-navigation.mts';
import { isFocusDatasetUrl, withDataset } from '../dataset-url.mts';
import { withOverviewScope, withPreparedFocus } from './navigation-scope.mts';
import { systemById } from '../object-systems.mts';
import { selectionContext, selectionTargetFromUrl, type SelectionTarget, type SceneSubject } from '../scene/scene-selection.mts';

export type NavigationHistory = { history: 'push' | 'replace' } | { history: 'pop'; entry: string };
export type NavigationIntent =
  | { kind: 'object' }
  | { kind: 'focus'; id: string }
  | { kind: 'feature'; id: string }
  | { kind: 'link'; url: string }
  | { kind: 'history'; url: string; history: NavigationHistory }
  | { kind: 'overview'; scope: OverviewScope; camera: 'frame' | 'preserve' };
export type NavigationCamera =
  | { kind: 'focus' }
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
export function readNavigationSelection(url: URL, objectId: string, objects: readonly ObjectEntry[]) {
  return { subject: selectionTargetFromUrl(url, objectId, objects), savedView: url.searchParams.has('v'),
    dataset: url.searchParams.has('dataset') || isFocusDatasetUrl(url), feature: url.searchParams.get('feature') };
}

/** Resolve once, before cancellation: loading, preview, flight and arrival consume the same destination. */
export function resolveNavigation(intent: NavigationIntent, { object, objects, navigation, current }: {
  object: ObjectEntry;
  objects: readonly ObjectEntry[];
  navigation: ReturnType<typeof createPreparedWorldNavigation>;
  current: { objectId: string; href: string; subject: SceneSubject; centeredObjectId: string | null;
    hasPresented: boolean; reuseScene: boolean; mount: ShellCamera | null; pending: ResolvedNavigation | null };
}): { destination: ResolvedNavigation; centeredObjectId: string | null } {
  if (intent.kind === 'link') {
    const link = new URL(intent.url, current.href), selection = readNavigationSelection(link, object.id, objects);
    if (selection.subject.kind === 'overview' && !selection.savedView) {
      intent = { kind: 'overview', scope: selection.subject.overview.scope, camera: 'frame' };
    } else if (!link.search && !link.hash) intent = { kind: 'object' };
  }
  const linked = intent.kind === 'link' || intent.kind === 'history';
  let url = new URL(intent.kind === 'link' || intent.kind === 'history' ? intent.url : current.href, current.href);
  let history: NavigationHistory = intent.kind === 'history' ? intent.history
    : { history: intent.kind === 'overview' && intent.camera === 'preserve' ? 'replace' : 'push' };
  const targetRequest = { objectId: object.id, fromId: current.objectId, mount: current.mount };
  const overviewTarget = intent.kind === 'overview' && intent.camera === 'frame'
    ? navigation.overviewTarget({ ...targetRequest, scope: intent.scope }) : null;
  const opensOverviewFocus = current.subject.kind === 'overview' && object.id === current.objectId && current.subject.overview.scope === 'system';
  const center = overviewTarget?.world ?? (intent.kind === 'object' && !opensOverviewFocus
    && object.id !== current.centeredObjectId && current.hasPresented
    ? navigation.systemTarget(targetRequest) ?? navigation.centerTarget(targetRequest) : null);
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
    if (intent.kind === 'feature') url.searchParams.set('feature', intent.id);
  }
  const selection = readNavigationSelection(url, object.id, objects);
  const interruptedFlight = current.pending !== null
    && !(current.pending.camera.kind === 'frame' && current.pending.camera.framing === 'center') && !center;
  const restore = history.history === 'pop' || linked && selection.savedView;
  const keepCamera = intent.kind === 'overview' && intent.camera === 'preserve'
    || current.reuseScene && (linked && selection.dataset || interruptedFlight);
  const camera: NavigationCamera = intent.kind === 'focus' ? { kind: 'focus' } : restore ? { kind: 'restore', animate: history.history === 'pop' }
    : keepCamera ? { kind: 'preserve' }
    : { kind: 'frame', framing: center ? 'center' : 'detail', world: center, focusPositionM: overviewTarget?.focusPositionM ?? null };
  if (current.reuseScene && !restore) {
    const scope = selection.subject.kind === 'overview' ? selection.subject.overview.scope : null;
    const changesSelection = (selectionContext(current.subject).kind === 'overview') !== Boolean(scope)
      || (current.subject.kind === 'overview' ? current.subject.overview.scope : null) !== scope;
    if (!changesSelection && !(linked && selection.dataset)) history = { history: 'replace' };
  }
  return { destination: { id: object.id, url: url.href, subject: selection.subject, camera, history,
    scene: current.reuseScene ? 'reuse' : 'replace', origin: linked ? 'link' : 'selection', feature: selection.feature },
  centeredObjectId: center && intent.kind !== 'overview' ? object.id : null };
}
