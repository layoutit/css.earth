import type { PositionM } from '@cssearth/engine';
import type { WorldCameraPose } from '@cssearth/engine';
import type { ShellCamera } from '../browser/browser-types.mts';
import type { ObjectEntry } from '../objects.mts';
import type { createPreparedWorldNavigation } from '../prepared-world-navigation.mts';
import { withDataset } from '../dataset-url.mts';
import { namesSystem, withView } from './navigation-scope.mts';
import { systemById, type SystemObjects } from '../object-systems.mts';
import { satelliteSystemByHost } from '../satellite-systems.mts';
import { zoomStepOf } from '../inside-view.mts';
import { moonSystem, selectionKey, starSystem, subjectOf, subjectView, type SceneSubject } from '../scene/scene-subject.mts';

import type { NavigationHistory, NavigationIntent, SceneView, SelectionTarget } from './navigation-types.mts';
export type { NavigationHistory, NavigationIntent } from './navigation-types.mts';
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
export function readNavigationSelection(url: URL, objectId: string) {
  return { subject: subjectOf(objectId, namesSystem(url) ? 'system' : 'body'), savedView: url.searchParams.has('v'),
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
    const link = new URL(intent.url, current.href), selection = readNavigationSelection(link, object.id);
    const view = subjectView(selection.subject);
    if (view !== 'body' && !selection.savedView && !selection.dataset) intent = { kind: 'object', view, camera: 'frame' };
  }
  const linked = intent.kind === 'link' || intent.kind === 'history';
  let url = new URL(intent.kind === 'link' || intent.kind === 'history' ? intent.url : current.href, current.href);
  let history: NavigationHistory = intent.kind === 'history' ? intent.history
    : { history: intent.kind === 'object' && (intent.history === 'replace' || intent.camera === 'preserve' && !intent.departed) ? 'replace' : 'push' };
  const targetRequest = { objectId: object.id, fromId: current.objectId, mount: current.mount };
  const family = satelliteSystemByHost(object.id);
  const view = intent.kind === 'object' ? intent.view ?? null : null;
  // A planet's system is its host seen out to its moons; a star's is a destination the zoom out of the star reaches.
  const ofMoons = view === 'system' && family !== null;
  // A destination a zoom out reaches (a star's system, an object seen from inside) opens framed as that scope says, around its centre; the
  // zoom's own hand-over keeps the camera, and history restores its own.
  const step = intent.kind !== 'history' && !(intent.kind === 'object' && intent.camera === 'preserve') ? zoomStepOf(subjectOf(object.id, view ?? 'body')) : null;
  const overviewTarget = step ? navigation.overviewTarget({ ...targetRequest, objectId: step.centreId, scope: step.scope }) : null;
  const opensOverviewFocus = starSystem(current.subject) && object.id === current.objectId;
  const opensFamilyFocus = moonSystem(current.subject) && object.id === current.objectId;
  const plain = intent.kind === 'object' && view === null;
  const familyTarget = ofMoons && intent.kind === 'object' && intent.camera === 'frame'
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
    withView(url, view ?? (plain && (familyTarget !== null || center && systemById(objects, object.id)) ? 'system' : 'body'));
    if (intent.kind === 'feature' && intent.id !== null) url.searchParams.set('feature', intent.id);
  }
  const selection = readNavigationSelection(url, object.id);
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
  centeredObjectId: center && (view !== 'system' || ofMoons) ? object.id : null };
}
