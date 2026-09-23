import {loadObjectTestDefinition} from '../../../tools/contract/object-test-data.mts';
import { createObjectRuntime } from '../../renderers/css/dist/index.js';
import { createSceneLifetime } from '@cssearth/engine';
import { createPreparedResidency } from '../prepared-residency.mts';
import { createObjectSelectionRuntime } from '../object-selection-runtime.mts';
import { retainedPresentationFixture } from './object-runtime-package.mts';
import { Surface, orbitFixture, type OrbitCallbacks } from './orbit-fixture.mts';
import { requireObjectRuntimeDefinition } from '../object-runtime-contract.mts';
import { parsePreparedObjectRuntime } from '../../renderers/css/dist/index.js';
import type { ObjectRuntimeDefinition, ObjectRuntimeServices } from '../../renderers/css/dist/index.js';
import type { RetainedCubicSkyOrbit, OrbitServices } from '../../renderers/css/dist/platform/object-orbit.js';
import type { PreparedImage } from '../prepared-image-store.mts';
import type { SceneLifetime } from '@cssearth/engine';

const definitions = new Map<string, ObjectRuntimeDefinition>(await Promise.all(['mercury', 'venus', 'mars'].map(async id =>
  [id, requireObjectRuntimeDefinition(parsePreparedObjectRuntime(await loadObjectTestDefinition(id))) as ObjectRuntimeDefinition] as const)));
const identity = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)';
type MaterialFixture = { callbacks: OrbitCallbacks; owners: Set<string>; stage: Surface; errors: unknown[]; writes: number; fail: boolean; lifetime?: SceneLifetime; ready?: () => void; resources?: ReturnType<typeof createPreparedResidency>; orbit?: RetainedCubicSkyOrbit; runtime?: ReturnType<ReturnType<typeof createObjectRuntime>>; create(): Promise<RetainedCubicSkyOrbit | undefined>; event(name: string, orbit: RetainedCubicSkyOrbit): (() => void) | undefined; restore(): void };

// Actual common mount, resources, selection, orbit and package presentation.
// Only native DOM, image decoding and input transports are controlled here.
export function materialOrbitFixture(id: string) {
  const prepared = definitions.get(id); if (!prepared) throw new Error(`Missing object test definition: ${id}`);
  // These failure scenarios isolate material publication; feature labels have their own lifecycle suite.
  const { features, ...definition } = prepared;
  const native = retainedPresentationFixture(definition);
  const { stage, document } = native;
  const nativeStage = stage as unknown as Surface & HTMLElement & { getAnimations(): Animation[]; getComputedStyle(element: HTMLElement): CSSStyleDeclaration };
  for (const name of ['listeners', 'frames', 'nextFrame', 'captured'] as const) (nativeStage as unknown as { -readonly [K in typeof name]: Surface[typeof name] })[name] = new Surface()[name];
  for (const name of Object.getOwnPropertyNames(Surface.prototype).filter(name => name !== 'constructor')) (nativeStage as unknown as Record<string, unknown>)[name] = (Surface.prototype as unknown as Record<string, unknown>)[name];
  stage.dataset.objectId = id;
  nativeStage.getAnimations = () => [];
  nativeStage.getComputedStyle = (element: HTMLElement) => element.style;
  document.defaultView = nativeStage as unknown as Record<string, unknown>; document.readyState = 'complete';
  document.querySelector = selector => selector === '.object-sidebar' ? null : stage;
  // A perspective camera (an object with a heliocentric view) projects through
  // the shared dolly; its native measurements are controlled here too.
  const levelOfDetail = { stage: 'geometry', silhouetteDiameter: 400, billboardOpacity: 0, markerOpacity: 0 };
  const dolly = { rotX: definition.camera.defaultControlPitchDegrees, rotY: definition.camera.defaultControlYawDegrees, zoom: definition.camera.defaultZoom };
  const sharedDependencies = { HTMLElement: globalThis.HTMLElement,
    createPerspectiveDolly: () => ({
      camera: { get state() { return { ...dolly, distance: 1 / dolly.zoom }; },
        update(partial: { distance?: number; rotX?: number; rotY?: number; zoom?: number }) { Object.assign(dolly, partial); if (partial.distance !== undefined) dolly.zoom = 1 / partial.distance; } },
      measure() {}, reclamp() {}, remeasure() {}, minimumZoom: () => 0.01, maximumZoom: () => definition.camera.maximumZoom,
      publish: () => ({ distance: 1 / dolly.zoom, focal: 1000, viewportWidth: 1000, viewportHeight: 800, principalOffset: [0, 0],
        body: null, sun: null, levelOfDetail }),
      trackball: () => ({ centerX: 500, centerY: 400, radius: 200, surfaceRadius: 200, focalLength: 1000, viewportWidth: 1000,
        viewportCenterX: 500, viewportCenterY: 400 }),
      state: () => ({ distance: 1 / dolly.zoom }), levelOfDetail: () => levelOfDetail, stats: () => ({}),
    }),
    createUnboundedMatrixDragControls(options: Parameters<NonNullable<OrbitServices['createUnboundedMatrixDragControls']>>[0]) {
      shared.callbacks.drag = options; shared.owners.add('drag');
      return { update() {}, stop() {}, invalidateTrackball() {}, stats() { return {}; }, destroy() { shared.owners.delete('drag'); } };
    },
    createCubicSkyCameraOrientation: () => ({ scene: () => identity, sceneMatrix: () => identity,
      skybox: () => ({ matrix: identity, sunViewDirection: [0, 0, 1] }),
      counterRotation: () => identity,
      reset() {}, rotate() {}, snapshot: () => ({}) }) };
  const shared = orbitFixture(null, false, sharedDependencies as unknown as Partial<import('../../renderers/css/dist/platform/object-orbit.js').OrbitServices>);
  const f = { ...shared, stage: nativeStage, errors: [], writes: 0, fail: false, create: async () => undefined, event: () => undefined, restore() {} } as unknown as MaterialFixture;
  const publish = () => { f.writes++; if (f.fail) throw new Error('material publication failed'); };
  const services = {
    createSelection(options: Parameters<typeof createObjectSelectionRuntime>[0]) {
    const presentation = options.presentation as unknown as { cameraElement: object; sceneElement: object };
    for (const node of stage.querySelectorAll('*').filter(node =>
      node !== presentation.cameraElement && node !== presentation.sceneElement)) {
      const original = node.style;
      Object.defineProperty(node, 'style', { value: new Proxy(original, { set(target, key, value) { publish(); if (typeof key === 'string') (target as unknown as Record<string, unknown>)[key] = value; return true; },
        get(target, key) {
          if (key === 'setProperty') return (name: string, value: string, priority?: string) => { publish(); return original.setProperty(name, value, priority); };
          if (f.fail) throw new Error('material publication failed');
          return typeof key === 'string' ? (target as unknown as Record<string, unknown>)[key] : undefined;
        } }) });
    }
    return createObjectSelectionRuntime(options);
    },
    createLifetime() { f.lifetime = createSceneLifetime(); return f.lifetime; },
    waitDocument: () => Promise.resolve(), waitPaint: () => Promise.resolve(),
    createControls: () => ({ publish() {}, setReady() {}, destroy() {} }),
    createResources(options: Parameters<typeof createPreparedResidency>[0]) {
      f.ready = () => options.onReady?.('fixture');
      f.resources = createPreparedResidency({ ...options, createImage: (): PreparedImage => ({ src: '', naturalWidth: 1, naturalHeight: 1, decoding: 'async',
        decode: () => Promise.resolve(), removeAttribute() { this.src = ''; } }) });
      return f.resources;
    },
    mountSky: () => { const root = document.createElement('div'); return { root, setOrientation() {}, destroy() { root.remove(); } }; },
    createOrbit(options: unknown) { f.orbit = shared.create(options as import('../../renderers/css/dist/platform/object-orbit.js').RetainedOrbitOptions); return f.orbit; },
  };
  const mount = createObjectRuntime(definition, services as unknown as Partial<ObjectRuntimeServices>);
  f.create = async () => { f.runtime = mount(nativeStage, { inputSurface: nativeStage, runtimePolicy: shared.arguments.runtimePolicy, onError: error => f.errors.push(error) }); await f.runtime.ready; return f.orbit; };
  f.event = (name: string, orbit: RetainedCubicSkyOrbit) => {
    if (name === 'wheel') return () => {
      const wheel = f.callbacks.wheel; if (!wheel) throw new Error('Wheel fixture was not created');
      try { wheel.rotate({ controlPitchDelta: 0, controlYawDelta: 0, zoom: 2 }); }
      catch (error) { if (typeof wheel.onError === 'function') wheel.onError(error); }
    };
    if (name === 'resize') { const listener = nativeStage.listeners.get('resize')?.values().next().value; return typeof listener === 'function' ? () => listener({} as PointerEvent) : undefined; }
    if (name === 'invalidate') return f.ready;
    if (name === 'refresh') return () => orbit.refresh();
    if (name === 'setState') return () => orbit.setState({ zoom: 2 });
    if (name === 'media-change') return () => { const policy = f.callbacks.policy; if (!policy) throw new Error('Policy fixture was not created'); if (typeof policy.onError === 'function') policy.onError(new Error('material publication failed')); };
    return () => {
      const drag = f.callbacks.drag; if (!drag) throw new Error('Drag fixture was not created');
      try { drag.rotate({ controlPitchDelta: 2, controlYawDelta: 3 }); }
      catch (error) { if (typeof drag.onError === 'function') drag.onError(error); }
    };
  };
  f.restore = () => { f.fail = false; f.runtime?.destroy(); native.restore(); };
  return f;
}
