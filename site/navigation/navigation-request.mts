import type { PositionM } from '@cssearth/engine';
import type { WorldCameraPose } from '@cssearth/objects';
import type { ShellCamera } from '../browser/browser-types.mts';
import type { ObjectEntry } from '../objects.mts';
import type { createPreparedWorldNavigation } from '../prepared-world-navigation.mts';
import { withDataset } from '../dataset-url.mts';
import { withView } from './navigation-scope.mts';
import { systemById, type SystemObjects } from '../object-systems.mts';
import { satelliteSystemByHost } from '../satellite-systems.mts';
import { ladderOf } from '../level-view.mts';
import { selectionKey, selectionTargetFromUrl, type SelectionTarget, type SceneSubject, type SceneView } from '../scene/scene-selection.mts';

export type NavigationHistory = { history: 'push' | 'replace' } | { history: 'pop'; entry: string };
export type NavigationIntent =
  /** Go to an object. `view` asks for its moons or its planetary system instead of the body itself; `camera: 'frame'` flies
   * to that view's framing, and `preserve` keeps the camera where it is (the zoom hands the view over to the object's scene).
   * `departed`: the view a header pill's flight left: the hand-over it lands on is a new entry, and Back returns to it.
   * `history: 'replace'` lands on the entry it left (a Showcase hop after the tour's first). */
  | { kind: 'object'; view?: SceneView; camera?: 'frame' | 'preserve'; departed?: string; history?: 'replace' }
  | { kind: 'feature'; id: string | null }
  | { kind: 'link'; url: string }
  | { kind: 'history'; url: string; history: NavigationHistory };
export type NavigationCamera =
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
    dataset: url.searchParams.has('dataset'), feature: url.searchParams.get('feature') };
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
    if (selection.subject.view !== 'body' && !selection.savedView && !selection.dataset) intent = { kind: 'object', view: selection.subject.view, camera: 'frame' };
  }
  const linked = intent.kind === 'link' || intent.kind === 'history';
  let url = new URL(intent.kind === 'link' || intent.kind === 'history' ? intent.url : current.href, current.href);
  let history: NavigationHistory = intent.kind === 'history' ? intent.history
    : { history: intent.kind === 'object' && (intent.history === 'replace' || intent.camera === 'preserve' && !intent.departed) ? 'replace' : 'push' };
  const targetRequest = { objectId: object.id, fromId: current.objectId, mount: current.mount };
  const family = satelliteSystemByHost(object.id);
  const view = intent.kind === 'object' ? intent.view ?? null : null;
  if (view === 'moons' && !family) throw new TypeError(`${object.id} has no satellite system.`);
  // A destination on the zoom ladder (a star's system, a level) opens framed as that rung says, around its centre; the
  // ladder's own hand-over keeps the camera, and history restores its own.
  const ladder = intent.kind !== 'history' && !(intent.kind === 'object' && intent.camera === 'preserve') ? ladderOf({ objectId: object.id, view: view ?? 'body' }) : null;
  const overviewTarget = ladder ? navigation.overviewTarget({ ...targetRequest, objectId: ladder.centreId, scope: ladder.scope }) : null;
  const opensOverviewFocus = current.subject.view === 'system' && object.id === current.objectId;
  const opensFamilyFocus = current.subject.view === 'moons' && object.id === current.objectId;
  const plain = intent.kind === 'object' && view === null;
  const familyTarget = view === 'moons' && intent.kind === 'object' && intent.camera === 'frame'
    ? navigation.systemTarget({ ...targetRequest, force: true })
    : plain && family && !opensFamilyFocus && object.id !== current.centeredObjectId && current.hasPresented
      ? navigation.systemTarget(targetRequest) : null;
  // A host's first selection flies to frame its system, as a planet's does its moons; the next one opens the body. Only
  // turning toward it kept the camera where it was, so a star picked from across the galaxy never came closer.
  const firstHostSelection = plain && (family !== null || systemById(objects, object.id) !== null)
    && !opensOverviewFocus && object.id !== current.centeredObjectId && current.hasPresented;
  const center = overviewTarget?.world ?? familyTarget
    ?? (firstHostSelection && !family ? navigation.systemTarget(targetRequest) : null)
    ?? (firstHostSelection ? navigation.centerTarget(targetRequest) : null);
  if (!linked) {
    url.pathname = object.route; url.searchParams.delete('v'); url.searchParams.delete('feature');
    url = withDataset(url, null);
    // A plain selection that flies to a host's moons, or to a star's system, lands on that view.
    withView(url, view ?? (plain && familyTarget !== null ? 'moons' : center && plain && systemById(objects, object.id) ? 'system' : 'body'));
    if (intent.kind === 'feature' && intent.id !== null) url.searchParams.set('feature', intent.id);
  }
  const selection = readNavigationSelection(url, object.id, objects);
  const interruptedFlight = current.pending !== null
    && !(current.pending.camera.kind === 'frame' && current.pending.camera.framing === 'center') && !center;
  const restore = history.history === 'pop' || linked && selection.savedView;
  const keepCamera = intent.kind === 'object' && intent.camera === 'preserve'
    || current.reuseScene && (linked && selection.dataset || interruptedFlight);
  const camera: NavigationCamera = current.reuseScene && (intent.kind === 'feature' || selection.feature !== null)
    ? { kind: 'surface' } : restore ? { kind: 'restore', animate: history.history === 'pop' }
    : keepCamera ? { kind: 'preserve' }
    : { kind: 'frame', framing: center ? 'center' : 'detail', world: center, focusPositionM: overviewTarget?.focusPositionM ?? null };
  if (current.reuseScene && !restore) {
    const changesSelection = selectionKey(current.subject) !== selectionKey(selection.subject);
    if (!changesSelection && !(linked && selection.dataset)) history = { history: 'replace' };
  }
  return { destination: { id: object.id, url: url.href, subject: selection.subject, camera, history,
    scene: current.reuseScene ? 'reuse' : 'replace', origin: linked ? 'link' : 'selection', feature: selection.feature },
  centeredObjectId: center && view !== 'system' ? object.id : null };
}
