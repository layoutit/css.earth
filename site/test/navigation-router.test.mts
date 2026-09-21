import { testDistance } from './navigation-test-values.mts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createSceneRouter, type RouterOptions } from '../scene-router.mts';
import { formatSharedView } from '../../src/renderers/css/dist/index.js';
import { createPreparedContextNavigation } from '../prepared-context-navigation.mts';
import { worldCameraFromCenteredPresentation } from '../../src/renderers/css/dist/navigation.js';
import type { ObjectSceneLifecycle } from '../../src/renderers/css/runtime/deferred-object-mount.ts';
import type { LensVolume } from '../../src/renderers/css/runtime/object-contract.ts';
import type { SharedView } from '../../src/renderers/css/navigation/view-url.js';
import type { BrowserWindow, SceneFactory, MountOptions } from '../browser-types.mts';
import type { ObjectEntry } from '../object-schema.mts';
import type { NavigationOptions } from '../navigation-history.mts';
import type { PreparedWorldCameraFrame, WorldCameraPose } from '../../src/renderers/css/navigation/world-camera.js';
import type { ObjectWorldNavigation, ObjectWorldNavigationListener } from '../../src/renderers/css/runtime/world-navigation-types.js';
import type { PreparedNavigationFocus } from '../../src/renderers/css/navigation/prepared-focus.js';
import type { PreparedGalaxyRecord, SpatialCitation, SpatialCatalogSource } from '@cssearth/catalog';
import type { PreparedFocusPresentation } from '../prepared-context-navigation.mts';
import type { ShellOptions } from '../planet-shell-client.mts';
import type { PreparedVolumeLensState } from '../../src/renderers/css/volume/prepared-volume-lenses.ts';
import { isFocusDatasetUrl } from '../dataset-url.mts';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
function required<T>(value: T | null | undefined): T { assert.ok(value !== null && value !== undefined); return value; }


type Deferred = { promise: Promise<unknown>; resolve(value?: unknown): void; reject(reason?: unknown): void };
type MockRequest = { readonly signal: AbortSignal; readonly objectId: string; readonly fromId: string; readonly toId: string; readonly fromMount: MockMount | null; readonly targetWorldCamera?: unknown; readonly targetFocusPositionM?: unknown; readonly preserveView?: boolean; readonly reducedMotion?: boolean; readonly mount?: MockMount; readonly url: string; readonly toFactory: Promise<SceneFactory> };
type MockFocus = (options: MockRequest) => void | Promise<unknown>;
type MockTarget = (options: MockRequest & { readonly scope?: string }) => unknown;
type MockPrepare = (options: MockRequest) => unknown | Promise<unknown>;
type FocusController = ReturnType<typeof createPreparedContextNavigation>;
type FocusCallbacks = NonNullable<Parameters<FocusController['connect']>[1]>;
type MockWorldContext = { mount(options: { stage: HTMLElement; signal: AbortSignal; windowTarget: Window }): Promise<MockWorldMount> };
type MockWorldMount = { destroy(): void; publish?(world: WorldCameraPose & {pose: {id?: string}}, viewport: {principalOffsetPixels: readonly [number, number]}): void; selectObject?(id: string, frame: PreparedWorldCameraFrame & {id?: string}): void; previewSelection?(id?: string | null): void; setMinimapEnabled?(value: boolean): void; setThreeDStarsEnabled?(value: boolean): void; setNavigationInFlight?(value: boolean): void; connectNavigation?: FocusController['connect']; suspendFocus?: FocusController['suspend']; restoreFocus?: FocusController['restore'] };
type MockDataset = { ids: readonly string[]; defaultId: string; volumes: readonly LensVolume[]; volumeOf(id: string): LensVolume | null; current(): string; select(id: string, options?: { signal?: AbortSignal }): Promise<boolean>; subscribe(listener: (id: string) => void): () => void };
type MockMount = Mutable<Omit<ObjectSceneLifecycle, 'navigation' | 'datasets'>> & { id: string; options: MountOptions & {proof?: string}; value: SharedView; calls: string[]; restores: number; publishCamera?(camera: WorldCameraPose): void; manualDataset?(id: string): void; datasets?: MockDataset; navigation?: ObjectWorldNavigation };
type MockShell = { input: Record<string, never>; options: ShellOptions; destroyed: number; selected: string; playback?: unknown; datasetShown?: boolean; datasetNotice?: string | null; preparedFocus?: PreparedGalaxyRecord | null; focusSources?: readonly SpatialCitation[]; focusPresentation?: PreparedFocusPresentation | null; beginCardNavigation?: (object: ObjectEntry, world: unknown) => () => void; beginOverviewSelection?: (scope?: string) => (() => void) | void; setPlaybackState(value: unknown): void; showDataset(): void; setDatasetNotice(message: string | null): void; setMotionEnabled(value: boolean): void; setPreparedFocus(record: PreparedGalaxyRecord | null, sources: readonly SpatialCitation[], presentation: PreparedFocusPresentation | null): void; setObject(content: { id: string; apply(): void }): void; destroy(): void };
type MockDocument = EventTarget & {hidden: boolean; querySelector(selector: string): null; documentElement: {dataset: Record<string, string>}; body: {classList: {add(): void; remove(): void}}};
type MockMedia = EventTarget & {matches: boolean};
type MockHistory = {readonly state: Record<string, unknown>; replaceState(state: Record<string, unknown>, unused: string, url: string | URL | null): void; pushState(state: Record<string, unknown>, unused: string, url: string | URL | null): void; back(): void; forward(): void};
type MockWindow = EventTarget & {readonly location: URL; history: MockHistory; matchMedia(): MockMedia; performance: Pick<Performance, 'now'>; setTimeout(callback: () => void, delay?: number): ReturnType<typeof setTimeout> | number; clearTimeout(id: ReturnType<typeof setTimeout> | number | undefined): void; requestAnimationFrame(callback: FrameRequestCallback): number; cancelAnimationFrame(handle: number): void};
type Harness = { router: ReturnType<typeof createSceneRouter>; windowTarget: MockWindow; documentTarget: MockDocument; media: MockMedia; mounts: MockMount[]; shells: MockShell[]; renders: Set<MockMount>; errors: unknown[]; writes: string[]; entries: { state: Record<string, unknown>; url: string }[]; preparations: MockRequest[]; disposedContent: string[]; maxRendered(): number };
type HarnessOptions = { prepare?: MockPrepare; focus?: MockFocus; centerTarget?: MockTarget; systemTarget?: MockTarget; overviewTarget?: MockTarget; savedTarget?: MockTarget; initialUrl?: string | null; factoryGate?: Deferred | null; contentGate?: Deferred | null; persistentWorldContext?: MockWorldContext | null; withSun?: boolean; worldFrames?: Record<string, PreparedWorldCameraFrame> | null; datasets?: boolean; datasetGate?: Deferred | null };

// A navigation lets the sidebar swap render in its own frame (a timer, then a
// zero-delay timer in the harness), so one flush spans three timer turns.
const flush = async (): Promise<void> => { for (let turn = 0; turn < 3; turn++) await new Promise(resolve => setTimeout(resolve, 0)); };
function deferred(): Deferred {
  let resolve!: (value: unknown) => void, reject!: (reason?: unknown) => void;
  const promise = new Promise<unknown>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve: (value?: unknown) => resolve(value), reject };
}
const saved = (distance: number): SharedView => ({ camera: { distanceKilometers: distance,
  pose: { schema: 'cssearth-camera-pose@2', scene: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)' } },
  preparedEpochJdTt: null,
  playback: { times: [1234], speed: 1, motionRequested: false } });
function harness({ prepare = async () => ({}), focus, centerTarget, systemTarget, overviewTarget, savedTarget, initialUrl = null, factoryGate = null, contentGate = null, persistentWorldContext = null, withSun = false, worldFrames = null, datasets = false, datasetGate = null }: HarnessOptions = {}): Harness {
  const documentTarget: MockDocument = Object.assign(new EventTarget(), { hidden: false, querySelector: (_selector: string) => null, documentElement: { dataset: {} }, body: { classList: { add() {}, remove() {} } } });
  const media: MockMedia = Object.assign(new EventTarget(), {matches: false});
  const windowTarget = new EventTarget() as MockWindow;
  documentTarget.hidden = false; documentTarget.documentElement = { dataset: {} };
  documentTarget.body = { classList: { add() {}, remove() {} } };
  media.matches = false; windowTarget.matchMedia = () => media;
  windowTarget.setTimeout = setTimeout; windowTarget.clearTimeout = clearTimeout; windowTarget.performance = performance;
  // The router lets the sidebar swap render in its own frame before mounting; a timer stands in for the frame.
  windowTarget.requestAnimationFrame = callback => windowTarget.setTimeout(() => callback(windowTarget.performance.now()), 0) as number;
  windowTarget.cancelAnimationFrame = handle => windowTarget.clearTimeout(handle);
  let location = new URL(initialUrl ?? 'https://example.test/mercury/?campaign=test#vault'), index = 0;
  const entries: { state: Record<string, unknown>; url: string }[] = [{ state: { campaign: 'preserved' }, url: location.href }], writes: string[] = [];
  Object.defineProperty(windowTarget, 'location', { get: () => location });
  windowTarget.history = {
    get state() { return entries[index].state; },
    replaceState(state: Record<string, unknown>, _unused: string, url: string | URL | null) { location = new URL(url ?? location.href, location); entries[index] = { state, url: location.href }; writes.push('replace'); },
    pushState(state: Record<string, unknown>, _unused: string, url: string | URL | null) { location = new URL(url ?? location.href, location); entries.splice(++index); entries.push({ state, url: location.href }); writes.push('push'); },
    back() { if (index) { const entry = entries[--index]; location = new URL(entry.url); windowTarget.dispatchEvent(Object.assign(new Event('popstate'), { state: entry.state })); } },
    forward() { if (index + 1 < entries.length) { const entry = entries[++index]; location = new URL(entry.url); windowTarget.dispatchEvent(Object.assign(new Event('popstate'), { state: entry.state })); } },
  };
  const object = (id: string, name = id): ObjectEntry => ({ kind: 'scene', id, name, systemName: 'Solar System', classification: id === 'sun' ? 'star' : 'planet', color: '#000000', distance: testDistance(0), route: `/${id}/`, discovery: { featured: false, imagery: false, illustration: false }, description: name, loadScene: async () => factory(id), worldFrame: null });
  const objects = ['mercury', 'venus', 'earth'].map(id => object(id));
  if (withSun) objects.push(object('sun', 'Sun'));
  if (worldFrames) for (const object of objects) Object.assign(object, { worldFrame: worldFrames[object.id] });
  const stage = { dataset: { objectId: 'mercury' } } as unknown as HTMLElement, input: Record<string, never> = {}, renders = new Set<MockMount>(), mounts: MockMount[] = [], errors: unknown[] = [], shells: MockShell[] = [], preparations: MockRequest[] = [], disposedContent: string[] = [];
  let maxRendered = 0;
  const factory = (id: string): SceneFactory => (nativeStage, options) => {
    assert.equal(nativeStage, stage);
    const listeners = new Set<(value: SharedView) => void>();
    const mount: MockMount = { id, options, value: saved(id === 'mercury' ? 10000 : 20000), calls: [], restores: 0,
      ready: Promise.resolve(),
      pause() { this.calls.push('pause'); }, resume() { this.calls.push('resume'); },
      destroy() { this.calls.push('destroy'); renders.delete(this); },
      sharedView: {
        capture: () => mount.value,
        async restore(value) { mount.restores++; mount.value = value; required(mount).navigation?.setPreparedFocus(null); return true; },
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
      },
    };
    const typedMount = mount;
    if (persistentWorldContext) {
      let focus: PreparedNavigationFocus | null = null;
      const cameraListeners = new Set<ObjectWorldNavigationListener>();
      const world = { referenceFrame: 'test', epochJdTt: 1, pose: { id, positionM: [0,0,0] as const, orientationXyzw: [0,0,0,1] as const } };
      const viewport = { focalPixels: 10, principalOffsetPixels: [id === 'mercury' ? 1 : 2, 0] as const };
      typedMount.navigation = {
        frame: Object.assign(cameraFrame([0,0,0], 1), {id}),
        preparedFocus() { return focus; },
        setPreparedFocus(next) {
          focus = next;
          for (const listener of listeners) listener(mount.value);
          for (const listener of cameraListeners) listener(world, viewport);
        },
        async flyToPreparedFocus(next) { this.setPreparedFocus(next); return {completed: true}; },
        capture: () => world,
        apply() {},
        optics: () => ({ focalPixels: 1, principalOffsetPixels: [0, 0], framingRadiusPixels: 1, detailHandoffDiameterPixels: 1, visibleRect: null }),
        subscribe(listener) {
          cameraListeners.add(listener); listener(world, viewport);
          return () => cameraListeners.delete(listener);
        },
      };
    }
    if (worldFrames?.[id]) {
      const frame = worldFrames[id], cameraListeners = new Set<ObjectWorldNavigationListener>();
      const optics = { focalPixels: 1000, principalOffsetPixels: [0, 0] as const, framingRadiusPixels: 1, detailHandoffDiameterPixels: 1, visibleRect: null };
      // The camera's own rotation is a proper rotation; the frame's presentationToReference is
      // a reflection (CSS 3D space is left-handed) and must not be reused as the camera basis.
      let world = options.initialWorldCamera ?? worldCameraFromCenteredPresentation({
        rotation: identityRotation, distanceUnits: frame.bodyRadiusM * 10,
      }, frame, optics);
      typedMount.navigation = {
        frame, capture: () => world, optics: () => optics, apply(next) { world = next; },
        preparedFocus: () => null, setPreparedFocus() {}, async flyToPreparedFocus() { return {completed: false}; },
        subscribe(listener) {
          cameraListeners.add(listener); listener(world, optics);
          return () => cameraListeners.delete(listener);
        },
      };
      typedMount.publishCamera = next => {
        world = next;
        for (const listener of cameraListeners) listener(world, optics);
      };
    }
    if (datasets) {
      let selected = 'normal', live = true;
      const changes = new Set<(id: string) => void>();
      const publish = (id: string) => { selected = id; for (const listener of changes) listener(id); };
      typedMount.datasets = { ids: ['normal', 'mapped', 'failed'], defaultId: 'normal', volumes: [], volumeOf: () => null, current: () => selected,
        async select(id: string, { signal }: { signal?: AbortSignal } = {}) {
          if (!this.ids.includes(id)) throw new RangeError('Unknown dataset');
          if (id === 'failed') throw new Error('Dataset decode failed');
          if (signal?.aborted || !live) return false;
          if (datasetGate && id === 'mapped') await Promise.race([datasetGate.promise, new Promise(resolve => signal?.addEventListener('abort', resolve, { once: true }))]);
          if (signal?.aborted || !live) return false;
          publish(id); return true;
        },
        subscribe(listener: (id: string) => void) { changes.add(listener); return () => changes.delete(listener); },
      };
      typedMount.manualDataset = publish;
      const destroy = typedMount.destroy.bind(typedMount);
      typedMount.destroy = () => { live = false; changes.clear(); destroy(); };
    }
    mounts.push(typedMount); renders.add(typedMount); maxRendered = Math.max(maxRendered, renders.size);
    assert.equal(renders.size, 1, 'At most one detailed scene may render');
    return typedMount;
  };
  // Partial browser and service doubles exercise the router's optional capability paths.
  // Assertions stay at those individual injection boundaries; the router options remain checked.
  const router = createSceneRouter({ stage, objectId: 'mercury', objects,
    documentTarget: documentTarget as unknown as Document, windowTarget: windowTarget as unknown as BrowserWindow,
    reportError: (error: unknown) => errors.push(error),
    mountShell: ((options: ShellOptions) => {
      const shell: MockShell = { input, options, destroyed: 0, selected: 'mercury',
        setPlaybackState(value) { this.playback = value; },
        showDataset() { this.datasetShown = true; },
        setDatasetNotice(message) { this.datasetNotice = message; },
        setMotionEnabled(value) { required(options.onMotionChange)(value); },
        setPreparedFocus(record, sources, presentation) { this.preparedFocus = record; this.focusSources = sources; this.focusPresentation = presentation; },
        setObject(content) { assert.equal(renders.size, 0); content.apply(); this.selected = content.id; },
        destroy() { this.destroyed++; },
      };
      shells.push(shell); return shell;
    }) as unknown as RouterOptions['mountShell'],
    async loadObject(id: string) { if (id === 'venus' && factoryGate) await factoryGate.promise; return factory(id); },
    async loadContent(object: ObjectEntry, { signal }: {signal: AbortSignal}) {
      if (object.id === 'venus' && contentGate) await contentGate.promise;
      return { id: object.id, name: object.name, apply() { assert.equal(signal.aborted, false); }, dispose() { disposedContent.push(object.id); } };
    },
    navigation: {
      focus, centerTarget, systemTarget, overviewTarget, savedTarget,
      supports: (from: string, to: string) => from !== 'earth' && to !== 'earth',
      prepare(options: MockRequest) { preparations.push(options); return Promise.resolve(prepare(options)).then(handoff => Object.assign({ transferTo() {} }, handoff)); },
    } as unknown as RouterOptions['navigation'],
    persistentWorldContext: persistentWorldContext as unknown as RouterOptions['persistentWorldContext'],
  });
  return { router, windowTarget, documentTarget, media, mounts, shells, renders, errors, writes, entries, preparations, disposedContent,
    maxRendered: () => maxRendered };
}

const identityRotation = [1,0,0,0,1,0,0,0,1] as const;
const cameraFrame = (originM: readonly [number, number, number], bodyRadiusM: number): PreparedWorldCameraFrame => ({
  originM, bodyRadiusM, referenceFrame: 'test', epochJdTt: 1, presentationToReference: identityRotation, metersPerUnit: 1,
});
const catalogueSources: SpatialCatalogSource[] = ['catalogue', 'paper'].map(id => ({ id, citation: id, url: `https://example.test/${id}`, bytes: 1, sha256: '0'.repeat(64) }));
const galaxyRecord = (id: string): PreparedGalaxyRecord => ({id, name: id, aliases: [], status: 'confirmed', positionM: [1e20,0,0],
  skyPosition: {raDeg: 0, decDeg: 0, sourceRef: 'catalogue:coordinates'}, distance: {valuePc: 1, method: 'fixture', sourceRef: 'paper'},
  membership: {group: 'local-group', subgroup: 'field', basis: 'fixture', sourceRef: 'catalogue:membership'}});

function catalogueContext() {
  const selected: (string | null)[] = [], errors: unknown[] = [];
  return { selected, errors, async mount({ windowTarget }: Parameters<MockWorldContext['mount']>[0]) {
    const layer = { imageLayerFrames: {},
      resolveGalaxy: (id: string) => ['catalogue:a', 'catalogue:b'].includes(id) ? galaxyRecord(id) : null,
      selectGalaxy: (id: string | null) => selected.push(id) };
    const controller = createPreparedContextNavigation({ sources: catalogueSources, layer: layer as unknown as Parameters<typeof createPreparedContextNavigation>[0]['layer'], windowTarget, onError: error => errors.push(error),
      presentation: { metersPerParsec: 3e16, defaultFocusRadiusM: 1e18, minimumDistanceRadii: .01, maximumDistanceM: 1e23 } });
    return { publish() {}, connectNavigation: controller.connect, suspendFocus: controller.suspend,
      restoreFocus: controller.restore, destroy: controller.destroy };
  } };
}

test('same-owner Back and Forward restore the exact saved camera before its prepared focus without rewriting the incoming ID', async () => {
  const context = catalogueContext(), h = harness({ persistentWorldContext: context });
  await h.router.settled;
  const link = (id: string, distance: number) => `https://example.test/mercury/?focus=${id}&${formatSharedView(saved(distance))}`;
  await h.router.navigate('mercury', { url: link('catalogue:a', 3e12) });
  assert.equal(required(h.mounts[0].navigation).preparedFocus()?.id, 'catalogue:a');
  assert.equal(h.shells[0].preparedFocus?.id, 'catalogue:a');
  h.mounts[0].value = saved(4e12);
  await h.router.navigate('mercury', { url: link('catalogue:b', 7e12) });
  const pushes = h.writes.filter(value => value === 'push').length;
  h.windowTarget.history.back(); await h.router.settled;
  assert.equal(h.mounts[0].value.camera.distanceKilometers, 4e12);
  assert.equal(required(h.mounts[0].navigation).preparedFocus()?.id, 'catalogue:a');
  assert.equal(h.windowTarget.location.searchParams.get('focus'), 'catalogue:a');
  h.windowTarget.history.forward(); await h.router.settled;
  assert.equal(h.mounts[0].value.camera.distanceKilometers, 7e12);
  assert.equal(required(h.mounts[0].navigation).preparedFocus()?.id, 'catalogue:b');
  assert.equal(h.shells[0].preparedFocus?.id, 'catalogue:b');
  assert.equal(h.windowTarget.location.searchParams.get('focus'), 'catalogue:b');
  assert.equal(h.writes.filter(value => value === 'push').length, pushes);
  assert.equal(h.mounts.length, 1);
  assert.deepEqual([...h.errors, ...context.errors], []);
  h.router.destroy();
});

test('history within one object flies to the saved view, then restores it exactly', async () => {
  const flights: unknown[] = [];
  const h = harness({ savedTarget: ({ url }) => ({ view: new URL(url).searchParams.get('v') }),
    focus: async ({ targetWorldCamera }) => { flights.push(targetWorldCamera); } });
  await h.router.settled;
  const link = (distance: number) => `https://example.test/mercury/?${formatSharedView(saved(distance))}`;
  await h.router.navigate('mercury', { url: link(30000) });
  await h.router.navigate('mercury', { url: link(70000) });
  flights.length = 0;
  h.windowTarget.history.back(); await h.router.settled;
  assert.deepEqual(flights, [{ view: new URLSearchParams(formatSharedView(saved(30000))).get('v') }], 'Back flies to the saved view once');
  assert.equal(h.mounts[0].value.camera.distanceKilometers, 30000, 'and then restores it exactly');
  h.windowTarget.history.forward(); await h.router.settled;
  assert.equal(flights.length, 2);
  assert.equal(h.mounts[0].value.camera.distanceKilometers, 70000);
  assert.equal(h.mounts.length, 1);
  assert.deepEqual(h.errors, []); h.router.destroy();
});

test('ordinary planet selection clears the departed catalogue focus in both the requested URL and mounted camera', async () => {
  for (const target of ['mercury', 'venus']) {
    const context = catalogueContext(), h = harness({ persistentWorldContext: context,
      focus: async ({ mount }) => required(required(mount).navigation).setPreparedFocus(null),
      prepare: async ({ fromMount }) => { required(required(fromMount).navigation).setPreparedFocus(null); return {}; } });
    await h.router.settled;
    await h.router.navigate('mercury', { url: `https://example.test/mercury/?focus=catalogue:a&${formatSharedView(saved(3e12))}` });
    h.windowTarget.location.searchParams.set('focusLens', 'departed-lens');
    await h.router.navigate(target);
    assert.equal(h.windowTarget.location.searchParams.has('focus'), false);
    assert.equal(h.windowTarget.location.searchParams.has('focusLens'), false);
    assert.equal(required(required(h.mounts.at(-1)).navigation).preparedFocus(), null);
    assert.equal(h.shells[0].preparedFocus, null);
    if (target === 'venus') {
      assert.equal(new URL(required(h.preparations.at(-1)).url).searchParams.has('focus'), false);
      assert.equal(new URL(required(h.preparations.at(-1)).url).searchParams.has('focusLens'), false);
    }
    assert.equal(h.maxRendered(), 1);
    assert.deepEqual([...h.errors, ...context.errors], []);
    h.router.destroy();
  }
});

test('focused lens state reaches the retained shell without replacing its detailed scene', async () => {
  let contentChanged: FocusCallbacks['onFocusContentChange'];
  const context: MockWorldContext = { async mount() { return { publish() {}, destroy() {},
    connectNavigation(owner, { onFocusContentChange } = {}) { contentChanged = onFocusContentChange; return () => {}; },
  }; } };
  const h = harness({ persistentWorldContext: context });
  await h.router.settled;
  const record = galaxyRecord('catalogue:galaxy'), sources: SpatialCatalogSource[] = [{ id: 'source', citation: 'fixture', url: 'https://example.test', bytes: 1, sha256: '0'.repeat(64) }];
  const first: PreparedFocusPresentation = { objectId: 'prepared-galaxy', id: 'first', defaultLens: 'first', selectedLens: 'first', lenses: [], starsVisible: true, selectLens() {} };
  required(contentChanged)(record, sources, first);
  assert.equal(h.shells[0].focusPresentation, first);
  const second = { ...first, selectedLens: 'second' };
  required(contentChanged)(record, sources, second);
  assert.equal(h.shells[0].focusPresentation, second);
  assert.equal(h.shells[0].preparedFocus, record);
  assert.equal(h.shells[0].focusSources, sources);
  assert.equal(h.shells.length, 1); assert.equal(h.mounts.length, 1);
  assert.equal(h.maxRendered(), 1);
  h.router.destroy();
});

test('persistent world context is mounted once and follows the active physical navigation', async () => {
  const events: unknown[][] = [];
  const owner: MockWorldContext = {
    async mount() {
      events.push(['mount']);
      return {
        selectObject(id, frame) { events.push(['select', id, frame.id]); },
        publish(world, viewport) { events.push(['publish', world.pose.id, viewport.principalOffsetPixels[0]]); },
        destroy() { events.push(['destroy']); },
      };
    },
  };
  const h = harness({ persistentWorldContext: owner });
  await h.router.settled;
  assert.deepEqual(events, [['mount'], ['select', 'mercury', 'mercury'], ['publish', 'mercury', 1]]);
  await h.router.navigate('venus');
  assert.deepEqual(events, [
    ['mount'], ['select', 'mercury', 'mercury'], ['publish', 'mercury', 1],
    ['select', 'venus', 'venus'], ['publish', 'venus', 2],
  ]);
  h.router.destroy();
  assert.deepEqual(events.at(-1), ['destroy']);
});

test('flight state covers system framing and resets after success, failure, cancellation and preserved-view navigation', async () => {
  let visible = true, flight = deferred();
  const h = harness({ prepare: () => flight.promise, systemTarget: () => ({ id: 'system-camera' }), persistentWorldContext: { async mount() {
    return { selectObject() {}, publish() {}, destroy() {},
      setNavigationInFlight(value) { visible = !value; } };
  } } });
  await h.router.settled;
  const selected = h.router.navigate('venus', { sceneSelection: true }); await flush();
  assert.equal(visible, false);
  flight.resolve({}); assert.equal(await selected, true);
  assert.equal(visible, true);
  flight = deferred();
  const failed = h.router.navigate('mercury'); await flush();
  assert.equal(visible, false);
  flight.reject(new Error('Prepared asset unavailable'));
  assert.equal(await failed, false); assert.equal(visible, true);
  flight = deferred();
  const cancelled = h.router.navigate('mercury'); await flush();
  assert.equal(visible, false);
  flight.reject(Object.assign(new Error('Input interrupted the flight'), { name: 'AbortError', preserveView: true }));
  assert.equal(await cancelled, false); assert.equal(visible, true);
  await h.router.navigate('venus', { overview: true, preserveView: true });
  assert.equal(visible, true);
  h.router.destroy();
});

test('the destination card stays held until arrival, including the new camera mount', async () => {
  const arrival = deferred(), target = { system: 'venus' };
  const h = harness({ prepare: async () => ({ afterMount: () => arrival.promise }), systemTarget: () => target });
  await h.router.settled;
  let held = false;
  h.shells[0].beginCardNavigation = (object, world) => {
    assert.equal(object.id, 'venus'); assert.equal(world, target);
    held = true; return () => { held = false; };
  };
  const selection = h.router.navigate('venus', { sceneSelection: true });
  await flush();
  assert.equal(required(h.mounts.at(-1)).id, 'venus');
  assert.equal(held, true, 'The camera handoff does not release the card');
  arrival.resolve(); assert.equal(await selection, true);
  assert.equal(held, false);
  h.router.destroy();
});

test('surface labels default off and remain a shell preference, independent of the retained context', async () => {
  const illustrations: boolean[] = [];
  const h = harness({ persistentWorldContext: { async mount() {
    return { selectObject() {}, publish() {}, destroy() {},
      setIllustrationModelsEnabled: (value: boolean) => illustrations.push(value) };
  } } });
  await h.router.settled;
  const settings = h.shells[0].options;
  assert.equal(settings.illustrationModelsEnabled, false);
  assert.equal(settings.surfaceLabelsEnabled, false);
  assert.deepEqual(illustrations, [false]);
  required(settings.onIllustrationModelsChange)(true);
  required(settings.onSurfaceLabelsChange)(true);
  await h.router.navigate('venus');
  assert.equal(h.shells.length, 1);
  assert.deepEqual(illustrations, [false, true]);
  required(settings.onSurfaceLabelsChange)(false);
  h.router.destroy();
  required(settings.onSurfaceLabelsChange)(true);
  required(settings.onIllustrationModelsChange)(false);
  assert.deepEqual(illustrations, [false, true]);
});

test('the minimap setting defaults off, reaches the retained context and survives a body change', async () => {
  const minimap: boolean[] = [];
  const h = harness({ persistentWorldContext: { async mount() {
    return { selectObject() {}, publish() {}, destroy() {},
      setMinimapEnabled: (value: boolean) => minimap.push(value) };
  } } });
  await h.router.settled;
  const settings = h.shells[0].options;
  assert.equal(settings.minimapEnabled, false);
  // The mount carries the default, so the context never builds a minimap the shell reports as off.
  assert.deepEqual(minimap, [false]);
  required(settings.onMinimapChange)(true);
  await h.router.navigate('venus');
  assert.equal(h.shells.length, 1);
  assert.deepEqual(minimap, [false, true]);
  required(settings.onMinimapChange)(false);
  assert.deepEqual(minimap, [false, true, false]);
  h.router.destroy();
  required(settings.onMinimapChange)(true);
  assert.deepEqual(minimap, [false, true, false]);
});

test('the 3D stars setting defaults off, reaches the retained context and survives a body change', async () => {
  const stars: boolean[] = [];
  const h = harness({ persistentWorldContext: { async mount() {
    return { selectObject() {}, publish() {}, destroy() {},
      setThreeDStarsEnabled: (value: boolean) => stars.push(value) };
  } } });
  await h.router.settled;
  const settings = h.shells[0].options;
  assert.equal(settings.threeDStarsEnabled, false);
  assert.deepEqual(stars, [false]);
  required(settings.onThreeDStarsChange)(true);
  await h.router.navigate('venus');
  assert.equal(h.shells.length, 1);
  assert.deepEqual(stars, [false, true]);
  required(settings.onThreeDStarsChange)(false);
  assert.deepEqual(stars, [false, true, false]);
  h.router.destroy();
  required(settings.onThreeDStarsChange)(true);
  assert.deepEqual(stars, [false, true, false]);
});

test('entering overview on the current object changes selection without invoking focus or restoring the camera', async () => {
  let focuses = 0;
  const h = harness({ focus: async () => { focuses++; } });
  await h.router.settled;
  const source = h.mounts[0], initial = source.value, restores = source.restores;
  await h.router.navigate('mercury', { overview: true, preserveView: true, history: 'replace' });
  assert.equal(focuses, 0);
  assert.equal(source.restores, restores);
  assert.equal(source.value, initial);
  assert.equal(h.mounts.length, 1);
  assert.equal(h.router.state().selectedObjectId, null);
  assert.equal(new URL(h.windowTarget.location.href).searchParams.get('overview'), 'system');
  h.router.destroy();
});

test('flight retains the source and one shell; target readiness and handoff precede history commit', async () => {
  const flight = deferred(), attached = deferred();
  const h = harness({ prepare: () => flight.promise });
  await h.router.settled;
  required(h.shells[0].options.onMotionChange)(true);
  const selected = h.router.navigate('venus'); await flush();
  assert.equal(h.router.state().selectedObjectId, 'venus', 'Selection changes before the destination is mounted');
  assert.equal(h.router.state().activeObjectId, 'mercury', 'The source still owns the departing camera');
  assert.equal(h.router.state().ready, false, 'A pending selection is not a completed navigation');
  assert.equal(h.renders.size, 1); assert.equal(h.mounts[0].id, 'mercury');
  assert.equal(h.shells.length, 1); assert.equal(h.writes.includes('push'), false);
  assert.equal(h.preparations[0].fromMount, h.mounts[0]);
  assert.equal(typeof await h.preparations[0].toFactory, 'function');
  flight.resolve({ mountOptions: { proof: 'handoff' }, afterMount: () => attached.promise }); await flush();
  assert.deepEqual(h.mounts.map(m => m.id), ['mercury', 'venus']);
  assert.equal(h.mounts[1].options.proof, 'handoff');
  assert.equal(h.mounts[0].calls.at(-1), 'destroy');
  assert.equal(h.router.state().ready, false); assert.equal(h.writes.includes('push'), false);
  assert.equal(h.documentTarget.documentElement.dataset.scenePresented, 'true', 'Incoming readiness cannot hide an already presented world');
  attached.resolve(); assert.equal(await selected, true);
  assert.equal(h.preparations[0].signal.aborted, false, 'Successful handoff is not cancellation');
  assert.equal(h.router.state().activeObjectId, 'venus');
  assert.equal(h.windowTarget.location.pathname, '/venus/');
  assert.equal(h.windowTarget.location.searchParams.get('campaign'), 'test');
  assert.equal(h.windowTarget.location.hash, '#vault');
  assert.equal(h.maxRendered(), 1); assert.equal(h.shells.length, 1);
  assert.equal(h.shells[0].destroyed, 0);
  h.router.destroy(); assert.equal(h.shells[0].destroyed, 1);
});

test('rapid Mercury → Venus → Mercury cancels the stale factory without replacing shell or source', async () => {
  const gate = deferred(), h = harness({ factoryGate: gate });
  await h.router.settled;
  const first = h.router.navigate('venus'); await flush();
  assert.equal(await h.router.navigate('mercury'), true);
  assert.equal(await first, false);
  assert.deepEqual(h.disposedContent, ['venus'], 'Cancelled loading releases content without waiting for the factory');
  gate.resolve(); await flush();
  assert.deepEqual(h.disposedContent, ['venus'], 'Late factory completion cannot dispose content twice');
  assert.deepEqual(h.mounts.map(m => m.id), ['mercury']);
  assert.equal(h.shells.length, 1); assert.equal(h.renders.size, 1);
  assert.equal(h.writes.includes('push'), false); assert.deepEqual(h.errors, []);
  h.router.destroy();
});

test('rapid Mercury → Venus → Sun commits only the final destination after a late Venus factory', async t => {
  const gate = deferred(), h = harness({ factoryGate: gate, withSun: true });
  t.after(() => { gate.resolve(); h.router.destroy(); });
  await h.router.settled;
  const venus = h.router.navigate('venus'); await flush();
  assert.equal(await h.router.navigate('sun'), true);
  assert.equal(await venus, false);
  gate.resolve(); await flush();
  assert.deepEqual(h.mounts.map(mount => mount.id), ['mercury', 'sun']);
  assert.equal(h.router.state().ready, true);
  assert.deepEqual(h.entries.map(entry => new URL(entry.url).pathname), ['/mercury/', '/sun/']);
  assert.deepEqual(h.disposedContent.sort(), ['sun', 'venus']);
  assert.equal(h.maxRendered(), 1); assert.equal(h.shells.length, 1); assert.deepEqual(h.errors, []);
});

test('destroying during transport settles navigation and disposes late content exactly once', async t => {
  const factory = deferred(), content = deferred(), h = harness({ factoryGate: factory, contentGate: content });
  t.after(() => { factory.resolve(); content.resolve(); h.router.destroy(); });
  await h.router.settled;
  const selected = h.router.navigate('venus'); await flush();
  h.router.destroy();
  assert.equal(await selected, false);
  const writes = h.writes.length;
  content.resolve(); factory.reject(new Error('late transport failure')); await flush();
  assert.deepEqual(h.disposedContent, ['venus']);
  assert.equal(h.writes.length, writes); assert.equal(h.renders.size, 0);
  assert.equal(h.router.state().ready, false); assert.equal(h.shells[0].destroyed, 1);
  assert.deepEqual(h.errors, []);
});

test('superseding a saved view on the retained scene settles its request before restoration completes', async t => {
  const gate = deferred(), h = harness();
  t.after(() => { gate.resolve(); h.router.destroy(); });
  await h.router.settled;
  h.mounts[0].sharedView.restore = async () => { await gate.promise; return true; };
  let settled = false;
  const old = h.router.navigate('mercury', { url: `/mercury/?${formatSharedView(saved(54321))}` });
  void old.then(() => { settled = true; });
  await flush(); assert.equal(settled, false);
  assert.equal(await h.router.navigate('mercury', { preserveView: true }), true);
  await flush();
  assert.equal(settled, true, 'Cancelling a request must not wait for a retained scene to retire');
  assert.equal(await old, false);
  gate.resolve(); await flush();
  assert.equal(h.router.state().ready, true); assert.equal(h.mounts.length, 1);
  assert.deepEqual(h.errors, []);
});

test('history back restores the departed exact view after target handoff without another push', async () => {
  const h = harness(); await h.router.settled;
  h.mounts[0].value = saved(54321);
  assert.equal(await h.router.navigate('venus'), true);
  required(h.mounts.at(-1)).value = saved(87654);
  h.windowTarget.history.back(); await h.router.settled;
  assert.equal(h.router.state().activeObjectId, 'mercury');
  assert.equal(required(h.mounts.at(-1)).value.camera.distanceKilometers, 54321);
  assert.equal(h.windowTarget.location.pathname, '/mercury/');
  assert.equal(h.writes.filter(write => write === 'push').length, 1);
  assert.equal(h.maxRendered(), 1); assert.equal(h.shells.length, 1);
  assert.deepEqual(h.errors, []); h.router.destroy();
});

test('history back during a flight returns to the view it left instead of skipping that entry', async () => {
  const arrivals: Deferred[] = [];
  const h = harness({ prepare: async () => ({ afterMount: () => { const arrival = deferred(); arrivals.push(arrival); return arrival.promise; } }) });
  await h.router.settled;
  const venus = h.router.navigate('venus'); await flush();
  required(arrivals.at(-1)).resolve(); assert.equal(await venus, true);
  required(h.mounts.at(-1)).value = saved(87654);
  const returning = h.router.navigate('mercury'); await flush();
  assert.equal(h.router.state().ready, false, 'The flight to Mercury is still arriving');
  h.windowTarget.history.back(); await flush();
  // The mock arrivals ignore cancellation; release them so both flights can settle.
  for (const arrival of arrivals) arrival.resolve();
  assert.equal(await returning, false, 'Back cancels the unfinished flight');
  for (let turn = 0; turn < 20 && !h.router.state().ready; turn++) { await flush(); for (const arrival of arrivals) arrival.resolve(); }
  assert.equal(h.router.state().activeObjectId, 'venus', 'Back returns to the body the flight left, not the one before it');
  assert.equal(h.windowTarget.location.pathname, '/venus/');
  assert.equal(required(h.mounts.at(-1)).value.camera.distanceKilometers, 87654, 'The departed view is restored');
  assert.deepEqual(h.entries.map(entry => new URL(entry.url).pathname), ['/mercury/', '/venus/'], 'History reads Mercury, Venus with no duplicate');
  const settle = async () => { for (let turn = 0; turn < 20 && !h.router.state().ready; turn++) { await flush(); for (const arrival of arrivals) arrival.resolve(); } };
  h.windowTarget.history.back(); await flush(); await settle();
  assert.equal(h.router.state().activeObjectId, 'mercury', 'A settled Back still goes one entry back');
  assert.deepEqual(h.errors, []); h.router.destroy();
});

test('history forward during an unfinished back returns to the departed body and its view', async () => {
  const arrivals: Deferred[] = [];
  const h = harness({ prepare: async () => ({ afterMount: () => { const arrival = deferred(); arrivals.push(arrival); return arrival.promise; } }) });
  await h.router.settled;
  const selected = h.router.navigate('venus'); await flush();
  required(arrivals.at(-1)).resolve(); assert.equal(await selected, true);
  required(h.mounts.at(-1)).value = saved(87654);
  h.windowTarget.history.back(); await flush();
  assert.equal(required(h.mounts.at(-1)).id, 'mercury');
  assert.equal(h.router.state().ready, false, 'The back flight is still arriving');
  h.windowTarget.history.forward(); await flush();
  assert.equal(required(h.mounts.at(-1)).id, 'venus', 'Forward leaves the unfinished restoration');
  required(arrivals.at(-1)).resolve(); await h.router.settled;
  assert.equal(h.router.state().activeObjectId, 'venus');
  assert.equal(h.windowTarget.location.pathname, '/venus/');
  assert.equal(required(h.mounts.at(-1)).value.camera.distanceKilometers, 87654);
  assert.deepEqual(h.errors, []); h.router.destroy();
});

test('saved-view anchors preserve query and hash across objects and on the already selected object', async () => {
  const h = harness(); await h.router.settled;
  const click = (distance: number) => {
    const href = `https://example.test/venus/?campaign=linked&${formatSharedView(saved(distance))}#saved-vault`;
    const event = Object.assign(new Event('click', { cancelable: true }), {button: 0});
    Object.defineProperty(event, 'target', { value: { closest: () => ({ href, target: '', hasAttribute: () => false }) } });
    h.documentTarget.dispatchEvent(event); assert.equal(event.defaultPrevented, true); return href;
  };
  const first = click(23456); await h.router.settled;
  assert.equal(h.preparations[0].url, first);
  assert.equal(required(h.mounts.at(-1)).value.camera.distanceKilometers, 23456);
  click(65432); await h.router.settled;
  assert.equal(required(h.mounts.at(-1)).value.camera.distanceKilometers, 65432);
  assert.equal(h.mounts.length, 2); assert.equal(h.preparations.length, 1);
  assert.equal(h.windowTarget.location.searchParams.get('campaign'), 'linked');
  assert.equal(h.windowTarget.location.hash, '#saved-vault');
  assert.equal(h.writes.filter(write => write === 'push').length, 2);
  h.windowTarget.history.back(); await h.router.settled;
  assert.equal(required(h.mounts.at(-1)).value.camera.distanceKilometers, 23456);
  assert.equal(h.mounts.length, 2); h.router.destroy();
});

test('reselecting the source cancels a running flight at its painted view without another restore or mount', async () => {
  const gate = deferred();
  const h = harness({ prepare: ({ fromMount }) => { required(fromMount).value = saved(43210); return gate.promise; } });
  await h.router.settled;
  const first = h.router.navigate('venus'); await flush();
  assert.equal(await h.router.navigate('mercury'), true);
  assert.equal(await first, false); gate.resolve({}); await flush();
  assert.equal(h.mounts.length, 1); assert.equal(h.mounts[0].restores, 0);
  assert.equal(h.mounts[0].value.camera.distanceKilometers, 43210);
  assert.equal(h.preparations[0].signal.aborted, true);
  assert.equal(h.writes.filter(write => write === 'push').length, 0);
  assert.deepEqual(h.errors, []); h.router.destroy();
});

test('late rejected handoff is observed after replacement and cannot publish stale readiness', async () => {
  const handoff = deferred();
  const h = harness({ prepare: async ({ toId }) => toId === 'venus' ? { afterMount: () => handoff.promise } : {} });
  await h.router.settled;
  const first = h.router.navigate('venus'); await flush();
  assert.equal(required(h.mounts.at(-1)).id, 'venus');
  assert.equal(await h.router.navigate('mercury'), true);
  assert.equal(await first, false);
  handoff.reject(new Error('retired handoff')); await flush();
  assert.equal(h.router.state().activeObjectId, 'mercury'); assert.equal(h.router.state().ready, true);
  assert.equal(h.renders.size, 1); assert.equal(h.maxRendered(), 1); assert.deepEqual(h.errors, []);
  h.router.destroy();
});

test('navigation preserves requested playback and reduced-motion policy', async () => {
  const h = harness(); await h.router.settled;
  required(h.shells[0].options.onMotionChange)(true); h.media.matches = true; h.media.dispatchEvent(new Event('change'));
  await h.router.navigate('venus');
  assert.deepEqual(h.router.playback(), { motionRequested: true, allowed: false, reason: 'reduced-motion' });
  assert.equal(required(h.mounts.at(-1)).calls.includes('resume'), false);
  h.media.matches = false; h.media.dispatchEvent(new Event('change'));
  assert.equal(required(h.mounts.at(-1)).calls.at(-1), 'resume');
  assert.equal(await h.router.navigate('earth'), false); h.router.destroy();
});

test('real input interruption preserves the last painted source view and flushes it without restoring the old URL', async () => {
  const h = harness({ prepare: async ({ fromMount }) => {
    required(fromMount).value = saved(123456);
    const error = new Error('User interrupted the flight');
    Object.assign(error, {name: 'AbortError', preserveView: true}); throw error;
  } });
  await h.router.settled;
  assert.equal(await h.router.navigate('venus'), false);
  assert.equal(h.mounts[0].value.camera.distanceKilometers, 123456);
  assert.equal(h.preparations[0].signal.aborted, true, 'Interruption before handoff cancels destination loading');
  assert.equal(h.router.state().activeObjectId, 'mercury');
  assert.equal(h.windowTarget.location.pathname, '/mercury/');
  assert.equal(h.writes.includes('push'), false);
  assert.ok(h.windowTarget.location.searchParams.has('v'));
  assert.deepEqual(h.errors, []); h.router.destroy();
});

test('input interrupting a same-owner selection keeps the new selection and drawn camera, not the departed prepared focus', async () => {
  const context = catalogueContext();
  const h = harness({
    initialUrl: `https://example.test/mercury/?focus=catalogue:a&${formatSharedView(saved(10000))}`,
    persistentWorldContext: context,
    focus: async ({ mount }) => {
      required(mount).value = saved(123456);
      throw Object.assign(new Error('User took over the selection flight'), { name: 'AbortError', preserveView: true });
    },
  });
  await h.router.settled;
  assert.equal(required(h.mounts[0].navigation).preparedFocus()?.id, 'catalogue:a');
  assert.equal(await h.router.navigate('mercury', { sceneSelection: true }), false);
  assert.equal(h.windowTarget.location.pathname, '/mercury/');
  assert.equal(h.windowTarget.location.searchParams.has('focus'), false);
  assert.equal(h.windowTarget.location.searchParams.has('focusLens'), false);
  assert.equal(h.windowTarget.location.searchParams.get('v'), new URLSearchParams(formatSharedView(saved(123456))).get('v'));
  assert.equal(required(h.mounts[0].navigation).preparedFocus(), null);
  assert.equal(h.shells[0].preparedFocus, null);
  assert.equal(h.writes.filter(write => write === 'push').length, 1);
  h.windowTarget.history.back(); await h.router.settled;
  assert.equal(required(h.mounts[0].navigation).preparedFocus()?.id, 'catalogue:a', 'Back retains the departed focus as its own entry');
  assert.deepEqual([...h.errors, ...context.errors], []);
  h.router.destroy();
});

test('a missing destination asset preserves the painted view and permits a fresh selection retry', async () => {
  const failure = new Error('Prepared image did not decode: /scenes/venus/surface.webp.');
  let attempt = 0;
  const targets: (string)[] = [];
  const h = harness({ systemTarget: ({ objectId }) => { targets.push(objectId); return { system: objectId }; },
    prepare: async ({ fromMount }) => {
      if (++attempt === 1) { required(fromMount).value = saved(123456); throw failure; }
      return {};
    },
  });
  await h.router.settled;
  const restores = h.mounts[0].restores;
  assert.equal(await h.router.navigate('venus', { sceneSelection: true }), false);
  assert.equal(h.mounts[0].value.camera.distanceKilometers, 123456, 'Failure cannot restore the departure camera');
  assert.equal(h.mounts[0].restores, restores);
  assert.equal(h.windowTarget.location.searchParams.get('v'), new URLSearchParams(formatSharedView(saved(123456))).get('v'));
  assert.equal(h.router.state().activeObjectId, 'mercury');
  assert.equal(h.router.state().ready, true);
  assert.equal(h.writes.includes('push'), false);
  assert.deepEqual(h.errors, [failure], 'Keep the underlying loading error visible');
  assert.equal(await h.router.navigate('venus', { sceneSelection: true }), true);
  assert.deepEqual(targets, ['venus', 'venus'], 'Retry must not count the failed flight as a completed first click');
  assert.equal(h.maxRendered(), 1);
  h.router.destroy();
});

test('input after the detailed handoff keeps the incoming scene and its painted pose, including saved-view links', async () => {
  const h = harness({ prepare: async ({ toId }) => toId === 'venus' ? {
    afterMount(mount: MockMount) {
      mount.value = saved(34567);
      const error = new Error('User interrupted the incoming flight');
      Object.assign(error, {name: 'AbortError', preserveView: true}); throw error;
    },
  } : {} });
  await h.router.settled;
  h.mounts[0].value = saved(54321);
  const url = `https://example.test/venus/?${formatSharedView(saved(98765))}#linked`;
  assert.equal(await h.router.navigate('venus', { url }), false);
  const incoming = required(h.mounts.at(-1));
  assert.equal(incoming.value.camera.distanceKilometers, 34567);
  assert.equal(incoming.restores, 0, 'Interruption cannot restore the originally requested arrival camera');
  assert.equal(incoming.calls.includes('destroy'), false);
  assert.equal(h.router.state().activeObjectId, 'venus');
  assert.equal(h.router.state().ready, true);
  assert.equal(h.documentTarget.documentElement.dataset.scenePresented, 'true');
  assert.equal(h.windowTarget.location.pathname, '/venus/');
  assert.equal(h.windowTarget.location.hash, '#linked');
  assert.equal(h.windowTarget.location.searchParams.get('v'), new URLSearchParams(formatSharedView(saved(34567))).get('v'));
  assert.equal(h.writes.filter(write => write === 'push').length, 1);
  assert.equal(h.renders.size, 1); assert.equal(h.maxRendered(), 1);
  h.windowTarget.history.back(); await h.router.settled;
  assert.equal(required(h.mounts.at(-1)).value.camera.distanceKilometers, 54321);
  assert.deepEqual(h.errors, []); h.router.destroy();
});

test('navbar/search anchors and vault events share one route; modifier and unsupported links stay native', async () => {
  const systemTarget = { pose: 'system-framing' };
  const h = harness({ systemTarget: () => systemTarget }); await h.router.settled;
  const supportsLabel = (objectId: string) => {
    const event = Object.assign(new Event('objectnavigationquery', { cancelable: true }), {detail: {objectId}});
    h.documentTarget.dispatchEvent(event); return event.defaultPrevented;
  };
  assert.equal(supportsLabel('venus'), true);
  assert.equal(supportsLabel('earth'), false, 'A registered object also needs a supported navigation path');
  assert.equal(supportsLabel('star:123'), false, 'A catalogue name is not a registered destination');
  function click(id: string, extra: {ctrlKey?: boolean; target?: string} = {}) {
    const anchor = { href: `https://example.test/${id}/`, target: '', hasAttribute: () => false, ...extra };
    const event = new Event('click', { cancelable: true });
    Object.assign(event, { button: 0, ctrlKey: extra.ctrlKey === true });
    Object.defineProperty(event, 'target', { value: { closest: () => anchor } });
    h.documentTarget.dispatchEvent(event); return event;
  }
  assert.equal(click('earth').defaultPrevented, false);
  assert.equal(click('venus', { ctrlKey: true }).defaultPrevented, false);
  assert.equal(click('venus', { target: '_blank' }).defaultPrevented, false);
  assert.equal(click('venus').defaultPrevented, true); await h.router.settled;
  assert.equal(h.preparations[0].targetWorldCamera, systemTarget, 'Plain body links use the same framing as scene selections');
  const event = Object.assign(new Event('objectnavigate', { cancelable: true }), {detail: {objectId: 'mercury'}});
  h.documentTarget.dispatchEvent(event); await h.router.settled;
  assert.equal(event.defaultPrevented, true);
  assert.equal(h.router.state().activeObjectId, 'mercury'); assert.equal(h.preparations.length, 2);
  h.router.destroy();
  assert.equal(supportsLabel('venus'), false, 'Teardown removes availability handling');
});

test('a failed persistent context mount can retry when the document restores', async () => {
  let attempts = 0, disposed = 0;
  const h = harness({ persistentWorldContext: { async mount() {
    if (++attempts === 1) throw new Error('Temporary context transport failure');
    return { publish() {}, destroy() { disposed++; } };
  } } });
  await h.router.settled;
  assert.equal(h.router.state().ready, false);
  assert.equal(h.errors.length, 1);
  h.windowTarget.dispatchEvent(new Event('pagehide'));
  const restored = Object.assign(new Event('pageshow'), {persisted: true});
  h.windowTarget.dispatchEvent(restored);
  await h.router.settled;
  assert.equal(attempts, 2);
  assert.equal(h.router.state().ready, true);
  h.router.destroy(); assert.equal(disposed, 1);
});

test('leaving the document releases its universe and a cached-page restore mounts one fresh owner', async () => {
  let mounted = 0, disposed = 0;
  const h = harness({ persistentWorldContext: { async mount() {
    mounted++; return { publish() {}, destroy() { disposed++; } };
  } } });
  await h.router.settled;
  h.windowTarget.dispatchEvent(new Event('pagehide'));
  assert.equal(disposed, 1);
  const restored = Object.assign(new Event('pageshow'), {persisted: true});
  h.windowTarget.dispatchEvent(restored); await h.router.settled;
  assert.equal(mounted, 2); assert.equal(h.router.state().ready, true);
  h.router.destroy(); assert.equal(disposed, 2);
});


test('selecting the current object flies the retained camera without preparing or replacing detail', async () => {
  const gate = deferred(), focuses: (MockRequest)[] = [];
  const h = harness({ focus(options) { focuses.push(options); return gate.promise; } });
  await h.router.settled;
  const source = h.mounts[0];
  source.value = saved(1e10);
  const selecting = h.router.navigate('mercury'); await flush();
  assert.equal(focuses.length, 1);
  assert.equal(focuses[0].mount, source);
  assert.equal(h.preparations.length, 0);
  assert.equal(h.router.playback().reason, 'unavailable');
  source.value = saved(10000); gate.resolve();
  assert.equal(await selecting, true);
  assert.equal(h.mounts.length, 1);
  assert.equal(source.restores, 0);
  assert.equal(h.shells.length, 1);
  assert.equal(h.writes.filter(write => write === 'push').length, 0);
  assert.equal(h.windowTarget.location.searchParams.get('v'), new URLSearchParams(formatSharedView(source.value)).get('v'));
  h.router.destroy();
});

test('plain current-object anchors focus but saved-view links restore their specified view', async () => {
  const focuses: (MockRequest)[] = [];
  const h = harness({ focus(options) { focuses.push(options); } });
  await h.router.settled;
  await h.router.navigate('mercury', { url: 'https://example.test/mercury/' });
  assert.equal(focuses.length, 1);
  assert.equal(h.mounts[0].restores, 0);
  await h.router.navigate('mercury', { url: `https://example.test/mercury/?${formatSharedView(saved(77777))}` });
  assert.equal(focuses.length, 1);
  assert.equal(h.mounts[0].value.camera.distanceKilometers, 77777);
  assert.equal(h.mounts.length, 1);
  h.router.destroy();
});


test('a first selection frames the object system and changes its card, then the next click focuses', async () => {
  const centered = { pose: 'system-framing' }, focuses: (MockRequest)[] = [];
  const h = harness({ systemTarget: () => centered, focus: async options => { focuses.push(options); } });
  await h.router.settled;
  assert.equal(await h.router.navigate('venus', { sceneSelection: true }), true);
  assert.equal(h.preparations[0].targetWorldCamera, centered);
  assert.equal(h.router.state().activeObjectId, 'venus');
  assert.equal(h.shells[0].selected, 'venus');
  assert.equal(h.mounts.length, 2);
  assert.equal(focuses.length, 0);
  assert.equal(await h.router.navigate('venus', { sceneSelection: true }), true);
  assert.equal(focuses.length, 1);
  assert.equal(focuses[0].targetWorldCamera, undefined);
  assert.equal(h.mounts.length, 2);
  h.router.destroy();
});

test('zooming out after first-click system framing restores the overview at the same camera pose', async () => {
  const au = 149597870700;
  const rotation = identityRotation;
  // The map between CSS presentation directions and reference directions is a reflection
  // (fix/world-handedness, #284): a determinant-1 rotation is refused here.
  const reflection = [1, 0, 0, 0, -1, 0, 0, 0, 1] as const;
  const frame = (originM: readonly [number, number, number], bodyRadiusM: number) => ({ originM, bodyRadiusM, referenceFrame: 'test', epochJdTt: 1,
    presentationToReference: reflection, metersPerUnit: 1 });
  const worldFrames = { mercury: frame([500, 0, 0], 1), venus: frame([1000, 0, 0], 1), sun: frame([0, 0, 0], 10) };
  const camera = (distanceUnits: number) => worldCameraFromCenteredPresentation({ rotation, distanceUnits },
    worldFrames.venus, { focalPixels: 1000, principalOffsetPixels: [0, 0] });
  const h = harness({ withSun: true, worldFrames, systemTarget: () => camera(20),
    prepare: async ({ fromMount, targetWorldCamera, preserveView }) => ({
      mountOptions: { initialWorldCamera: preserveView ? required(required(fromMount).navigation).capture() : targetWorldCamera },
    }),
  });
  const timers = new Map<number, () => void>(); let serial = 0;
  h.windowTarget.setTimeout = callback => { timers.set(++serial, callback); return serial; };
  h.windowTarget.clearTimeout = id => { if (typeof id === 'number') timers.delete(id); };
  try {
    await h.router.settled;
    // The frame gate and its follow-up run through this test's manual timers.
    const drain = async (pending: Promise<unknown> | null) => {
      let finished = pending === null; pending?.then(() => { finished = true; }, () => { finished = true; });
      while (!finished) { await flush(); for (const [id, callback] of timers) { timers.delete(id); callback(); } }
      return pending;
    };
    assert.equal(await drain(h.router.navigate('venus', { sceneSelection: true })), true);
    const selected = required(h.mounts.at(-1));
    required(selected.publishCamera)(camera(99 * au));
    assert.equal(timers.size, 0, 'The selected system remains below 100 AU from the Sun');
    required(selected.publishCamera)(camera(101 * au));
    assert.equal(timers.size, 1, 'First-click selection must not disable the zoom-out cutoff');
    required(selected.publishCamera)(camera(99 * au));
    assert.equal(timers.size, 0, 'A transient crossing is cancelled');
    const zoomedOut = camera(102 * au);
    required(selected.publishCamera)(zoomedOut);
    for (const [id, callback] of timers) { timers.delete(id); callback(); }
    await drain(h.router.settled);
    assert.equal(h.router.state().activeObjectId, 'sun');
    assert.equal(h.router.state().selectedObjectId, null);
    assert.equal(h.windowTarget.location.searchParams.get('overview'), 'system');
    assert.equal(required(h.preparations.at(-1)).preserveView, true);
    assert.deepEqual(required(required(h.mounts.at(-1)).navigation).capture(), zoomedOut);
    assert.equal(h.writes.filter(write => write === 'push').length, 1, 'Automatic deselection replaces history');
    assert.deepEqual(h.errors, []);
  } finally { h.router.destroy(); }
});

test('a first Sun click frames the Solar System card, and a repeat opens the Sun close-up', async () => {
  const target = { pose: 'solar-system-framing' }, focuses: (MockRequest)[] = [], previews: (string | null | undefined)[] = [];
  const h = harness({ withSun: true, systemTarget: () => target,
    focus: async options => { focuses.push(options); },
    persistentWorldContext: { async mount() {
      return { selectObject() {}, publish() {}, destroy() {}, previewSelection: id => previews.push(id) };
    } } });
  await h.router.settled;
  let overviewPreview = false;
  h.shells[0].beginOverviewSelection = () => { overviewPreview = true; };
  await h.router.navigate('sun', { sceneSelection: true });
  assert.equal(h.preparations[0].targetWorldCamera, target);
  assert.equal(h.windowTarget.location.searchParams.get('overview'), 'system');
  assert.ok(overviewPreview);
  assert.ok(previews.includes(null), 'the system card does not emphasize the Sun marker');
  assert.equal(focuses.length, 0);
  await h.router.navigate('sun', { sceneSelection: true });
  assert.equal(focuses.length, 1);
  assert.equal(focuses[0].targetWorldCamera, undefined);
  assert.equal(h.windowTarget.location.searchParams.has('overview'), false);
  h.router.destroy();
});

test('clicking the Sun from the Solar System overview opens its body instead of refitting the outer planets', async () => {
  const focuses: (MockRequest)[] = [], systems: (MockRequest)[] = [];
  const h = harness({ withSun: true,
    systemTarget: options => { systems.push(options); return { pose: 'outer-planets' }; },
    focus: async options => { focuses.push(options); },
  });
  await h.router.settled;
  await h.router.navigate('sun', { overview: true, preserveView: true });
  assert.equal(h.router.state().overview, true);
  await h.router.navigate('sun', { sceneSelection: true });
  assert.equal(systems.length, 0, 'The visible system is not fitted a second time');
  assert.equal(focuses.length, 1);
  assert.equal(focuses[0].targetWorldCamera, undefined, 'Use the normal Sun close-up');
  assert.equal(h.router.state().selectedObjectId, 'sun');
  assert.equal(h.windowTarget.location.searchParams.has('overview'), false);
  assert.equal(h.mounts.length, 2, 'The mounted Sun scene is retained');
  h.router.destroy();
});

test('clicking the Sun from a galactic overview still frames its Solar System first', async () => {
  const target = { pose: 'solar-system-framing' }, focuses: (MockRequest)[] = [];
  const h = harness({ withSun: true, systemTarget: () => target,
    focus: async options => { focuses.push(options); },
  });
  await h.router.settled;
  await h.router.navigate('sun', { overview: true, overviewScope: 'milky-way', preserveView: true });
  await h.router.navigate('sun', { sceneSelection: true });
  assert.equal(focuses[0].targetWorldCamera, target);
  assert.equal(h.router.state().overview, true);
  assert.equal(h.windowTarget.location.searchParams.get('overview'), 'system');
  h.router.destroy();
});

test('a second scene click can zoom while centering the current object is still in progress', async () => {
  const gate = deferred(), focuses: (MockRequest)[] = [];
  const h = harness({ centerTarget: () => ({ pose: 'centered' }), focus: options => {
    focuses.push(options); return focuses.length === 1 ? gate.promise : Promise.resolve();
  } });
  await h.router.settled;
  const centering = h.router.navigate('mercury', { sceneSelection: true });
  assert.equal(await h.router.navigate('mercury', { sceneSelection: true }), true);
  assert.equal(focuses[0].signal.aborted, true);
  assert.equal(focuses[1].targetWorldCamera, undefined);
  gate.resolve();
  assert.equal(await centering, false);
  h.router.destroy();
});

test('selection emphasis previews immediately before the next detailed owner is ready', async () => {
  const gate = deferred(), previews: (string | null | undefined)[] = [];
  const h = harness({ factoryGate: gate, persistentWorldContext: { async mount() {
    return { selectObject() {}, publish() {}, destroy() {}, previewSelection: id => previews.push(id) };
  } } });
  await h.router.settled;
  const selecting = h.router.navigate('venus', { sceneSelection: true });
  assert.equal(previews.at(-1), 'venus');
  assert.equal(h.router.state().activeObjectId, 'mercury');
  gate.resolve(); await selecting;
  assert.equal(h.router.state().activeObjectId, 'venus');
  assert.equal(previews.at(-1), undefined);
  h.router.destroy();
});

for (const wide of [false, true]) test(`empty-space clicks leave selection, camera and card unchanged (wide=${wide})`, async () => {
  const centers: (MockRequest)[] = [], previews: (string | null | undefined)[] = [];
  const h = harness({ withSun: true, centerTarget(options) { centers.push(options); return wide ? { pose: 'wide-view' } : null; },
    persistentWorldContext: { async mount() {
      return { selectObject() {}, publish() {}, destroy() {}, previewSelection: id => previews.push(id) };
    } } });
  await h.router.settled;
  const mount = h.mounts[0], savedView = mount.value, url = h.windowTarget.location.href;
  const writes = h.writes.length, previewCount = previews.length;
  let cardChanged = false;
  h.shells[0].beginOverviewSelection = () => { cardChanged = true; };
  h.documentTarget.dispatchEvent(new Event('objectdeselect', { cancelable: true }));
  await flush();
  assert.equal(h.router.state().selectedObjectId, 'mercury');
  assert.equal(cardChanged, false);
  assert.equal(previews.length, previewCount);
  assert.equal(h.preparations.length, 0);
  assert.equal(h.mounts.length, 1);
  assert.equal(mount.value, savedView);
  assert.equal(h.windowTarget.location.href, url);
  assert.equal(h.writes.length, writes);
  assert.equal(centers.length, 0);
  assert.deepEqual(h.errors, []);
  h.router.destroy();
});

function clickRoute(h: Harness, href: string, modifiers: {ctrlKey?: boolean} = {}) {
  const anchor = { href, target: '', hasAttribute: () => false };
  const event = new Event('click', { cancelable: true });
  Object.assign(event, { button: 0, ...modifiers });
  Object.defineProperty(event, 'target', { value: { closest: () => anchor } });
  h.documentTarget.dispatchEvent(event);
  return event;
}

test('overview breadcrumbs reframe, select the card, and retain separate history entries', async () => {
  const scopes: (unknown)[] = [], focused: (MockRequest)[] = [], previews: (string | null | undefined)[] = [];
  const h = harness({ withSun: true, overviewTarget({ scope }) {
    scopes.push(scope);
    return { world: { scope }, focusPositionM: [1, 2, 3] };
  }, focus: async options => focused.push(options) });
  await h.router.settled;
  h.shells[0].beginOverviewSelection = scope => { previews.push(scope); return () => {}; };
  assert.equal(clickRoute(h, 'https://example.test/sun/?overview=system').defaultPrevented, true);
  assert.deepEqual(previews, ['system'], 'The card changes before the flight finishes');
  await h.router.settled;
  assert.equal(h.router.state().overview, true);
  assert.deepEqual(h.preparations[0].targetWorldCamera, { scope: 'system' });
  assert.deepEqual(h.preparations[0].targetFocusPositionM, [1, 2, 3]);
  clickRoute(h, 'https://example.test/sun/?overview=milky-way');
  await h.router.settled;
  assert.deepEqual(scopes, ['system', 'milky-way']);
  assert.deepEqual(focused[0].targetWorldCamera, {scope: 'milky-way'});
  assert.equal(h.router.state().selectedObjectId, null);
  assert.equal(h.entries.length, 3, 'Each ancestor is a distinct history destination');
  h.windowTarget.history.back(); await h.router.settled;
  assert.equal(h.windowTarget.location.searchParams.get('overview'), 'system');
  assert.equal(scopes.length, 2, 'Back restores its saved view without reframing');
  assert.equal(h.maxRendered(), 1);
  assert.deepEqual(h.errors, []);
  h.router.destroy();
});

test('overview links preserve native modifier clicks and exact saved views', async () => {
  const scopes: (unknown)[] = [];
  const h = harness({ withSun: true, overviewTarget: options => scopes.push(options) });
  await h.router.settled;
  assert.equal(clickRoute(h, 'https://example.test/sun/?overview=milky-way', { ctrlKey: true }).defaultPrevented, false);
  const query = formatSharedView(saved(77777));
  clickRoute(h, `https://example.test/sun/?overview=milky-way&${query}`);
  await h.router.settled;
  assert.deepEqual(scopes, []);
  assert.ok(h.preparations[0].url.includes(query));
  assert.equal(h.router.state().overview, true);
  h.router.destroy();
});

test('a direct overview URL frames once, but a saved overview URL retains its camera', async () => {
  for (const savedQuery of ['', `&${formatSharedView(saved(77777))}`]) {
    const focused: (MockRequest)[] = [];
    const h = harness({ initialUrl: `https://example.test/mercury/?overview=milky-way${savedQuery}`,
      overviewTarget: () => ({ world: { fitted: true }, focusPositionM: [1, 2, 3] }),
      focus: async options => focused.push(options) });
    await h.router.settled;
    assert.equal(focused.length, savedQuery ? 0 : 1);
    if (!savedQuery) assert.equal(focused[0].reducedMotion, true);
    assert.equal(h.router.state().overview, true);
    h.router.destroy();
  }
});

test('selecting another list body during a flight still uses its system framing', async () => {
  const gate = deferred(), targets: (string)[] = [];
  const h = harness({ withSun: true, prepare: ({ toId }) => toId === 'venus' ? gate.promise : {},
    systemTarget: ({ objectId }) => { targets.push(objectId); return { system: objectId }; } });
  await h.router.settled;
  clickRoute(h, 'https://example.test/venus/');
  const first = h.router.settled;
  clickRoute(h, 'https://example.test/sun/');
  assert.equal(await first, false);
  await h.router.settled;
  assert.deepEqual(targets, ['venus', 'sun']);
  assert.deepEqual(required(h.preparations.at(-1)).targetWorldCamera, { system: 'sun' });
  assert.equal(h.router.state().overview, true);
  gate.resolve({}); h.router.destroy();
});

test('dataset links commit one same-body history entry, preserve the camera and restore the default on back', async () => {
  let focuses = 0;
  const h = harness({ datasets: true, focus: async () => { focuses++; } }); await h.router.settled;
  const mount = h.mounts[0]; mount.value = saved(54321);
  assert.equal(await h.router.navigate('mercury', { url: '/mercury/?dataset=mapped' }), true);
  assert.equal(required(mount.datasets).current(), 'mapped'); assert.equal(focuses, 0);
  assert.equal(mount.value.camera.distanceKilometers, 54321);
  assert.equal(h.windowTarget.location.searchParams.get('dataset'), 'mapped');
  assert.equal(h.writes.filter(write => write === 'push').length, 1);
  assert.equal(h.shells[0].datasetShown, true);
  h.windowTarget.history.back(); await h.router.settled;
  assert.equal(required(mount.datasets).current(), 'normal');
  assert.equal(mount.value.camera.distanceKilometers, 54321);
  assert.equal(h.windowTarget.location.hash, '#vault');
  assert.equal(h.mounts.length, 1); h.router.destroy();
});

test('source focus links preserve the requested lens and create history without refocusing the Sun', async () => {
  const errors: unknown[] = [], bodyFocuses: string[] = [];
  let bank: PreparedVolumeLensState = { objectId: 'm42', id: 'optical', defaultLens: 'optical', selectedLens: 'optical', starsVisible: true,
    lenses: ['optical', 'infrared'].map(id => ({ id, label: id, title: id, description: 'Prepared observation', sourceUrl: 'https://example.test/source' })) };
  const context: MockWorldContext = { async mount({ windowTarget }) {
    const layer = { imageLayerFrames: {}, selectGalaxy() {},
      resolveGalaxy: (id: string) => id === 'm42' ? { ...galaxyRecord(id), detailedObjectId: id } : null,
      volumeLensState: (id: string) => id === bank.objectId ? bank : null,
      selectVolumeLens(id: string, lensId: string) { assert.equal(id, bank.objectId); bank = { ...bank, id: lensId, selectedLens: lensId }; },
    };
    const controller = createPreparedContextNavigation({ sources: catalogueSources, layer: layer as unknown as Parameters<typeof createPreparedContextNavigation>[0]['layer'], windowTarget,
      onError: error => errors.push(error), presentation: { metersPerParsec: 3e16, defaultFocusRadiusM: 1e18, minimumDistanceRadii: .01, maximumDistanceM: 1e23 } });
    return { publish() {}, connectNavigation: controller.connect, suspendFocus: controller.suspend, restoreFocus: controller.restore, destroy: controller.destroy };
  } };
  const h = harness({ withSun: true, persistentWorldContext: context, focus: async ({ objectId }) => { bodyFocuses.push(objectId); } });
  await h.router.settled;
  assert.equal(clickRoute(h, 'https://example.test/sun/?focus=m42&focusLens=optical').defaultPrevented, true);
  await h.router.settled;
  assert.equal(h.preparations.at(-1)?.url, 'https://example.test/sun/?focus=m42&focusLens=optical', 'Cross-body transport keeps the complete destination.');
  const pushes = h.writes.filter(write => write === 'push').length;
  assert.equal(clickRoute(h, 'https://example.test/sun/?focus=m42&focusLens=infrared').defaultPrevented, true);
  await h.router.settled;
  assert.deepEqual(bodyFocuses, []);
  assert.equal(bank.selectedLens, 'infrared');
  assert.equal(h.shells[0].focusPresentation?.selectedLens, 'infrared');
  assert.equal(h.windowTarget.location.searchParams.get('focus'), 'm42');
  assert.equal(h.windowTarget.location.searchParams.get('focusLens'), 'infrared');
  assert.equal(h.writes.filter(write => write === 'push').length, pushes + 1);
  h.windowTarget.history.back(); await h.router.settled;
  assert.equal(bank.selectedLens, 'optical');
  assert.equal(h.windowTarget.location.searchParams.get('focusLens'), 'optical');
  assert.equal(h.mounts.length, 2, 'The same Sun owner remains mounted while focus datasets change.');
  assert.deepEqual([...errors, ...h.errors], []);
  h.router.destroy();
});

test('only canonical focus dataset URLs bypass ordinary same-body framing', () => {
  assert.equal(isFocusDatasetUrl(new URL('https://example.test/sun/?focus=m42&focusLens=optical')), true);
  for (const path of ['/mercury/?focus=m42&focusLens=optical', '/sun/?focus=m42', '/sun/?focusLens=optical',
    '/sun/?focus=m42&focusLens=optical&focusLens=infrared', '/sun/?focus=m42&focus=helix&focusLens=optical',
    '/sun/?focus=m42&focusLens=optical#dataset=normal', '/sun/?focus=m42&focusLens=optical&unrelated=value']) {
    assert.equal(isFocusDatasetUrl(new URL(path, 'https://example.test')), false, path);
  }
});

test('manual dataset queries survive Back and preserve unrelated anchors', async () => {
  const h = harness({ datasets: true }); await h.router.settled;
  required(h.mounts[0].manualDataset)('mapped');
  assert.equal(h.windowTarget.location.hash, '#vault');
  assert.equal(h.windowTarget.location.searchParams.get('dataset'), 'mapped');
  assert.equal(h.writes.includes('push'), false);
  await h.router.navigate('venus');
  assert.equal(h.windowTarget.location.hash, '#vault');
  assert.equal(h.windowTarget.location.searchParams.has('dataset'), false);
  assert.equal(required(h.mounts[1].datasets).current(), 'normal');
  h.windowTarget.history.back(); await h.router.settled;
  assert.equal(required(required(h.mounts.at(-1)).datasets).current(), 'mapped');
  assert.equal(h.windowTarget.location.hash, '#vault');
  assert.equal(h.windowTarget.location.searchParams.get('dataset'), 'mapped');
  required(required(h.mounts.at(-1)).manualDataset)('normal'); assert.equal(h.windowTarget.location.hash, '#vault');
  assert.equal(h.windowTarget.location.searchParams.has('dataset'), false);
  h.router.destroy();
});

test('direct dataset links wait for readiness without pushing, and invalid direct links remain diagnostic', async () => {
  for (const id of ['mapped', 'missing']) {
    const h = harness({ datasets: true, initialUrl: `https://example.test/mercury/?dataset=${id}` });
    await h.router.settled;
    assert.equal(required(h.mounts[0].datasets).current(), id === 'mapped' ? 'mapped' : 'normal');
    assert.equal(h.router.state().ready, true); assert.equal(h.writes.includes('push'), false);
    assert.equal(h.windowTarget.location.searchParams.get('dataset'), id);
    if (id === 'missing') assert.match(required(h.shells[0].datasetNotice), /unavailable/);
    h.router.destroy();
  }
});

test('a failed same-body dataset leaves the committed selection and URL together', async () => {
  const h = harness({ datasets: true }); await h.router.settled;
  await h.router.navigate('mercury', { url: '/mercury/?dataset=mapped' });
  for (const id of ['failed', 'missing']) {
    assert.equal(await h.router.navigate('mercury', { url: `/mercury/?dataset=${id}` }), false);
    assert.equal(required(h.mounts[0].datasets).current(), 'mapped');
    assert.equal(h.windowTarget.location.searchParams.get('dataset'), 'mapped');
    assert.ok(h.shells[0].datasetNotice);
  }
  assert.equal(h.writes.filter(write => write === 'push').length, 1); h.router.destroy();
});

test('a cancelled dataset cannot publish after a replacement navigation', async () => {
  const gate = deferred(), h = harness({ datasets: true, datasetGate: gate }); await h.router.settled;
  const pending = h.router.navigate('mercury', { url: '/mercury/?dataset=mapped' }); await flush();
  assert.equal(required(h.mounts[0].datasets).current(), 'normal'); assert.equal(h.writes.includes('push'), false);
  await h.router.navigate('venus'); assert.equal(await pending, false);
  gate.resolve(); await flush();
  assert.equal(h.windowTarget.location.pathname, '/venus/'); assert.equal(h.windowTarget.location.hash, '#vault');
  assert.equal(required(h.mounts[1].datasets).current(), 'normal'); assert.equal(h.maxRendered(), 1); h.router.destroy();
});

test('cross-body dataset failure finishes on the destination default without claiming the failed dataset', async () => {
  const h = harness({ datasets: true }); await h.router.settled;
  assert.equal(await h.router.navigate('venus', { url: '/venus/?dataset=failed' }), true);
  assert.equal(h.windowTarget.location.pathname, '/venus/'); assert.equal(h.windowTarget.location.searchParams.has('dataset'), false);
  assert.equal(required(required(h.mounts.at(-1)).datasets).current(), 'normal');
  assert.match(required(h.shells[0].datasetNotice), /default dataset/);
  assert.equal(h.writes.filter(write => write === 'push').length, 1); h.router.destroy();
});

test('input that interrupts the arrival flight after mount also ends the flight state', async () => {
  let visible = true, mounted = false;
  const arrival = deferred();
  const h = harness({ prepare: async () => ({ afterMount: () => { mounted = true; return arrival.promise; } }), systemTarget: () => ({ id: 'system-camera' }),
    persistentWorldContext: { async mount() {
      return { selectObject() {}, publish() {}, destroy() {},
        setNavigationInFlight(value) { visible = !value; } };
    } } });
  await h.router.settled;
  const selection = h.router.navigate('venus', { sceneSelection: true });
  for (let step = 0; step < 20 && !mounted; step++) await flush();
  assert.equal(mounted, true, 'The destination mounted and its arrival flight began');
  assert.equal(visible, false, 'The arrival flight holds the flight state');
  arrival.reject(Object.assign(new Error('Input interrupted the flight'), { name: 'AbortError', preserveView: true }));
  await selection;
  await flush();
  assert.equal(visible, true, 'Annotations, picking and the minimap resume once input takes the camera');
  h.router.destroy();
});
