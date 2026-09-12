import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from '../src/renderers/css/navigation/world-camera.js';
import type { PreparedAssets } from '../src/renderers/css/rendering/prepared-residency.js';
import { parseObjectDescriptor } from '@cssearth/objects';
import { mountSpaceMinimap } from './minimap/minimap.mts';
import { DIAGNOSTICS_ENABLED } from './diagnostics-policy.mts';
import { createPreparedUniverse, createWorldFrameQueue, prepareObjectResources, loadPreparedCssVolume, loadPreparedCssPointField, loadPreparedCssSurfaceShell, loadPreparedCssImageLayers, loadPreparedVolumeLenses, createRetainedGeometrySnapshot } from '../src/renderers/css/dist/universe.js';
import { APPLICATION_WORLD_CONTEXT as applicationContext, APPLICATION_WORLD_CONTEXT_URL } from './world-context-plan.mts';
import { contextMarkerSprite, contextAnnotationOpacity } from '../src/navigation/marker-presentation.mts';
import { PREPARED_NAVIGATION_MARKERS } from './prepared-navigation-markers.mjs';
import { createCameraViewport } from '../src/renderers/css/dist/navigation.js';
import { OBJECTS } from './objects.mts';
import { CONTEXT_ANNOTATION_PRIORITY } from './runtime-policy.mts';

import galaxyCatalog from '../src/objects/local-group/prepared/catalogue.json' with { type: 'json' };
import galaxyPresentation from '../src/objects/local-group/source/presentation.json' with { type: 'json' };
import clusterCatalog from '../src/objects/galaxy-clusters/prepared/catalogue.json' with { type: 'json' };
import clusterPresentation from '../src/objects/galaxy-clusters/source/presentation.json' with { type: 'json' };
import { createPreparedContextNavigation } from './prepared-context-navigation.mts';

const annotationOpacities = Object.fromEntries(OBJECTS.map(object => [object.id, contextAnnotationOpacity(object.classification)]));
const asteroidIds = OBJECTS.filter(object => object.classification === 'asteroid').map(object => object.id);
const hiddenOrbitIds = OBJECTS.filter(object => ['comet', 'trans-neptunian', 'interstellar'].includes(object.classification)).map(object => object.id);
const annotationPriorities = Object.fromEntries(OBJECTS.map(object =>
  [object.id, (CONTEXT_ANNOTATION_PRIORITY as Readonly<Partial<Record<typeof object.classification, number>>>)[object.classification] ?? 0]));

// Inventory of prepared resources, not navigation entries or runtime generators.
type ApplicationUniverse = ReturnType<typeof createPreparedUniverse> & {
  loadShells(): Promise<{ payload: Awaited<ReturnType<typeof loadPreparedCssSurfaceShell>>; resolveResource(path: string): string }[]>;
};
let universePromise: Promise<ApplicationUniverse> | null = null;
function loadApplicationUniverse(): Promise<ApplicationUniverse> {
  universePromise ??= (async () => {
    const descriptors = import.meta.glob('../src/objects/*/object.json', { import: 'default', eager: true });
    const assets = import.meta.glob('../src/objects/*/prepared/**/*.{json,png,webp,bin}', {
      query: '?url', import: 'default', eager: true,
    });
    const resourceSet = (objectId: string) => {
      const base = `../src/objects/${objectId}/`;
      const resolve = (path: string) => {
        const url = assets[`${base}${path}`];
        if (typeof url !== 'string') throw new Error(`Prepared context resource unavailable: ${path}.`);
        return url;
      };
      return { descriptor: descriptors[`${base}object.json`], resolve,
        transport: { async read(path: string) {
          const response = await fetch(resolve(path));
          if (!response.ok) throw new Error(`Prepared context request failed: ${response.status}.`);
          return response.arrayBuffer();
        } } };
    };
    const volumeSet = resourceSet(applicationContext.volume.objectId), starSet = resourceSet(applicationContext.stars.objectId);
    const [volume, stars] = await Promise.all([
      loadPreparedCssVolume(volumeSet.descriptor, volumeSet.transport),
      loadPreparedCssPointField(starSet.descriptor, starSet.transport),
    ]);
    // Surface shells (the heliosphere) are optional and off by default. Their
    // payload, validation and atlas load the first time one is enabled.
    const shellLoaders = Object.values(descriptors).map(parseObjectDescriptor).filter(descriptor => descriptor.type === 'surface-shell')
      .map(descriptor => async () => {
        const set = resourceSet(descriptor.id);
        return { payload: await loadPreparedCssSurfaceShell(set.descriptor, set.transport),
          resolveResource: (path: string) => set.resolve(`prepared/${path}`) };
      });
    let shellsLoaded: Promise<Awaited<ReturnType<(typeof shellLoaders)[number]>>[]> | null = null;
    const loadShells = () => shellsLoaded ??= Promise.all(shellLoaders.map(load => load()));
    const imageLayers = await Promise.all(Object.values(descriptors).map(parseObjectDescriptor).filter(descriptor => descriptor.type === 'image-layer-bank')
      .map(async descriptor => {
        const set = resourceSet(descriptor.id);
        return { payload: await loadPreparedCssImageLayers(set.descriptor, set.transport),
          resolveResource: (path: string) => set.resolve(`prepared/${path}`) };
      }));
    const sprites = Object.fromEntries(Object.entries(PREPARED_NAVIGATION_MARKERS)
      .map(([id, sprite]) => [id, { ...contextMarkerSprite(sprite),
        minimumDiameterPixels: asteroidIds.includes(id) ? 2 : 2.4 }]));
    const volumeLenses = await Promise.all(Object.values(descriptors).map(parseObjectDescriptor).filter(descriptor => descriptor.type === 'volume-lens-bank')
      .map(async descriptor => {
        const set = resourceSet(descriptor.id);
        return { payload: await loadPreparedVolumeLenses(set.descriptor, set.transport),
          resolveResource: (path: string) => set.resolve(`prepared/${path}`) };
      }));
    // The planner worker reads its own copies of the context and stars: a
    // structured clone of both cost the main thread ~150 ms at startup.
    const starBase = `../src/objects/${applicationContext.stars.objectId}/`;
    const plannerSource = { contextUrl: APPLICATION_WORLD_CONTEXT_URL, stars: { descriptor: starSet.descriptor,
      files: Object.fromEntries(Object.entries(assets).filter(([key]) => key.startsWith(starBase))
        .map(([key, url]) => [key.slice(starBase.length), String(url)])) } };
    const universe = createPreparedUniverse({ context: applicationContext, volume, stars, sprites, imageLayers, volumeLenses, annotationPriorities, annotationOpacities, plannerSource,
      catalog: { payload: galaxyCatalog, fadeStartDistanceM: galaxyPresentation.fadeStartDistanceM,
        fullDistanceM: galaxyPresentation.fullDistanceM,
        clusters: { payload: clusterCatalog, fadeStartDistanceM: clusterPresentation.fadeStartDistanceM, fullDistanceM: clusterPresentation.fullDistanceM } },
      resolveResource: path => volumeSet.resolve(`prepared/${path}`),
      resolveStarResource: path => starSet.resolve(`prepared/${path}`) });
    const markerPool = 'context-markers';
    const markerEntries = [...new Set(Object.values(sprites).map(sprite => sprite.url))]
      .map((url, index) => ({ key: `${markerPool}:${index}`, url, pool: markerPool }));
    return { ...universe, loadShells, assets: {
      entries: [...universe.assets.entries, ...markerEntries],
      pools: [...universe.assets.pools, { id: markerPool, retention: 'mount', capacity: markerEntries.length,
        concurrency: 4, reuse: false, decoding: 'async' }],
      // Markers load through their retained leaves and decode for raster when drawn.
      // Decoding all ~400 sprites up front cost ~450 MB and was not reused.
      startup: universe.assets.startup,
    } satisfies PreparedAssets };
  })().catch(error => { universePromise = null; throw error; });
  return universePromise;
}

export function createApplicationWorldContext() {
  return {
    async mount({ stage, signal, windowTarget = stage.ownerDocument.defaultView }: { stage: HTMLElement; signal?: AbortSignal; windowTarget?: Window | null }) {
      const target = stage.ownerDocument.defaultView;
      if (!target || !windowTarget) throw new Error("World context requires a window.");
      const prepared = await loadApplicationUniverse();
      if (signal?.aborted) throw signal.reason;
      const resources = prepareObjectResources(prepared.assets, { signal });
      let pendingLayer: ReturnType<typeof prepared.mount> | null = null;
      let pendingPlanner: ReturnType<typeof prepared.createFramePlanner> | null = null;
      try {
        await resources.ready;
        if (signal?.aborted) throw signal.reason;
        let contextNavigation: ReturnType<typeof createPreparedContextNavigation> | undefined;
        let refreshWorld = () => false;
        // World presentation lives beside the detail stage, outside its changing object scope.
        const presentationHost = stage.closest<HTMLElement>('.planet-world-stage') ?? stage;
        const layer = prepared.mount(stage, { presentationHost, requestPublication: () => refreshWorld(), onSelectGalaxy: object => { void contextNavigation?.select(object); } });
        pendingLayer = layer;
        contextNavigation = createPreparedContextNavigation({ layer, presentation: galaxyPresentation,
          sources: [...galaxyCatalog.sources, ...clusterCatalog.sources], windowTarget });
        layer.setHiddenOrbits(hiddenOrbitIds);
        const framePlanner = prepared.createFramePlanner();
        pendingPlanner = framePlanner;
        const viewport = createCameraViewport(stage, stage.ownerDocument.querySelector<HTMLElement>('.planet-sidebar'));
        const minimap = mountSpaceMinimap(stage.ownerDocument);
        let heliosphereEnabled = false, shellsMounted = false, destroyed = false;
        let publication: { world: WorldCameraPose; viewport: WorldCameraViewport } | null = null;
        let stagedFrame: {world: WorldCameraPose; viewport: WorldCameraViewport; frame: Awaited<ReturnType<typeof framePlanner.plan>>; snapshot: ReturnType<typeof layer.captureFrame>; consumed: boolean} | null = null;
        const publish = (world: WorldCameraPose, viewport: WorldCameraViewport) => {
          if (destroyed) return;
          publication = { world, viewport };
          const staged = stagedFrame?.world === world && stagedFrame.viewport === viewport ? stagedFrame : null;
          const frame = staged && !staged.consumed && staged.snapshot.current() ? staged.frame : undefined;
          if (!frame) {
            // Subscription replay and initial camera connection use the same
            // worker as motion. Never synchronously project the catalogue just
            // because a different detailed body connected to this retained world.
            frameQueue.present({ world, viewport, commit() {},
              current: () => !destroyed && publication?.world === world && publication.viewport === viewport,
              fail(error) { target.reportError(error); } });
            return;
          }
          if (staged) staged.consumed = true;
          layer.publish(world, viewport, { heliosphere: heliosphereEnabled }, frame);
          // The decorative minimap follows a drag at half rate; release publishes it.
          if (!rotating || (minimapFrame++ & 1) === 0) minimap.publish(world, viewport);
        };
        let rotating = false, minimapFrame = 0;
        const frameQueue = createWorldFrameQueue(async request => {
          const snapshot = layer.captureFrame(request.world, request.viewport);
          const frame = await framePlanner.plan(snapshot.view);
          return { current: snapshot.current, commit(camera) {
            const staged = { world: request.world, viewport: request.viewport, frame, snapshot, consumed: false };
            stagedFrame = staged;
            try {
              camera();
              // Connected cameras publish through the navigation hub. Initial
              // owners can commit before that subscription has been attached.
              if (request.current() && !staged.consumed) publish(request.world, request.viewport);
            } finally { stagedFrame = null; }
          } };
        }, layer.opacityClock);
        refreshWorld = () => frameQueue.refresh();
        const inputSurface = stage.ownerDocument.querySelector<HTMLElement>('.planet-input-surface');
        // Rotation holds every label and indicator still: they follow their bodies
        // and are re-resolved once on release, never hidden and restored.
        const rotationChanged = (event: Event) => {
          const active = event instanceof CustomEvent && (event.detail as { active?: unknown } | null)?.active === true;
          layer.setRotationActive(active);
          rotating = active;
          if (!active && publication) minimap.publish(publication.world, publication.viewport);
        };
        inputSurface?.addEventListener('objectrotationchange', rotationChanged);
        // Asteroid rings are hidden by default. Each marker keeps a pick circle
        // the ring's size, so asteroids stay clickable; hover still shows the ring.
        layer.setHiddenIndicators(asteroidIds);
        const diagnostics = DIAGNOSTICS_ENABLED ? createWorldContextDiagnostics(layer, frameQueue, presentationHost !== stage) : null;
        if (diagnostics) Reflect.set(target, '__cssEarthUniverse', diagnostics);
        // Temporary diagnostic controls belong to the retained application owner.
        const diagnosticControls = DIAGNOSTICS_ENABLED ? bindDiagnosticToggles(stage.ownerDocument, target, {
          starfield(enabled) { layer.setStarfieldEnabled(enabled); },
          minimap(enabled) {
            minimap.setEnabled(enabled);
            if (enabled && publication) minimap.publish(publication.world, publication.viewport);
          },
          asteroids(enabled) {
            const hidden = enabled ? [] : asteroidIds;
            layer.setHiddenBodies(hidden); minimap.setHiddenBodies(hidden);
            if (publication) minimap.publish(publication.world, publication.viewport);
          },
        }) : null;
        return { ...layer, viewport, publish,
          connectNavigation: contextNavigation.connect,
          suspendFocus: contextNavigation.suspend, restoreFocus: contextNavigation.restore,
          present(world: WorldCameraPose, viewport: WorldCameraViewport, { signal, commit = () => {} }: { signal: AbortSignal; commit?: () => void }) {
            return frameQueue.presentAndWait({ world, viewport, commit,
              current: () => !destroyed, fail() {} }, signal);
          },
          createFramePresenter() {
            let enabled = false, disposed = false;
            return { enable() { enabled = true; }, destroy() { disposed = true; },
              present(request: Parameters<typeof frameQueue.present>[0], signal?: AbortSignal) {
                if (disposed || destroyed || signal?.aborted || !request.current()) return signal ? Promise.resolve(false) : undefined;
                const owned = { ...request, current: () => !disposed && !destroyed && request.current() };
                if (!enabled) { frameQueue.remember(owned); request.commit(); return signal ? Promise.resolve(true) : undefined; }
                if (signal) return frameQueue.presentAndWait(owned, signal);
                frameQueue.present(owned);
              } };
          },
          previewSelection(id?: string | null) {
            layer.previewSelection(id);
          },
          selectObject(id: string, frame: PreparedWorldCameraFrame) {
            layer.selectObject(id, frame);
            minimap.selectObject(frame);
          },
          setAsteroidOrbitsEnabled(enabled: boolean) {
            if (!destroyed) layer.setHiddenOrbits(enabled === true ? hiddenOrbitIds : [...hiddenOrbitIds, ...asteroidIds]);
          },
          setAsteroidLabelsEnabled(enabled: boolean) {
            if (!destroyed) layer.setHiddenLabels(enabled === true ? [] : asteroidIds);
          },
          setHeliosphereEnabled(enabled: boolean) {
            if (destroyed || heliosphereEnabled === (enabled === true)) return;
            heliosphereEnabled = enabled === true;
            if (heliosphereEnabled && !shellsMounted) {
              shellsMounted = true;
              void prepared.loadShells().then(shells => {
                if (destroyed) return;
                for (const shell of shells) layer.addShell(shell);
                if (publication && !refreshWorld()) publish(publication.world, publication.viewport);
              }).catch(error => target.reportError(error));
            }
            if (publication && !refreshWorld()) publish(publication.world, publication.viewport);
          },
          destroy() {
            destroyed = true; publication = null;
            inputSurface?.removeEventListener('objectrotationchange', rotationChanged);
            frameQueue.destroy(); framePlanner.destroy(); stagedFrame = null;
            if (diagnostics && Reflect.get(target, '__cssEarthUniverse') === diagnostics) Reflect.deleteProperty(target, '__cssEarthUniverse');
            diagnosticControls?.destroy(); contextNavigation?.destroy(); minimap.destroy();
            viewport.destroy(); layer.destroy(); resources.destroy();
          },
        };
      } catch (error) { pendingPlanner?.destroy(); pendingLayer?.destroy(); resources.destroy(); throw error; }
    },
  };
}

function createWorldContextDiagnostics(layer: ReturnType<ReturnType<typeof createPreparedUniverse>['mount']>,
  frameQueue: ReturnType<typeof createWorldFrameQueue>, separateGeometry: boolean) {
  // Membership is captured once for this owner's lifetime. World presentation
  // lives outside the detail stage, so the detail recorder no longer counts it.
  const geometry = separateGeometry
    ? createRetainedGeometrySnapshot(layer.roots.flatMap(root => [root, ...root.querySelectorAll('*')])) : null;
  return Object.freeze({ inspect: layer.inspect, frames: frameQueue.stats, ...(geometry ? { geometry } : {}) });
}

const DIAGNOSTIC_TOGGLES = [
  ['starfield', '[data-disable-starfield]'], ['minimap', '[data-hide-minimap]'], ['asteroids', '[data-hide-asteroids]'],
] as const;

/** A checked control turns its subsystem off until it is unchecked. */
function bindDiagnosticToggles(documentTarget: Document, target: Window,
  apply: Readonly<Record<(typeof DIAGNOSTIC_TOGGLES)[number][0], (enabled: boolean) => void>>) {
  const bindings = DIAGNOSTIC_TOGGLES.flatMap(([name, selector]) => {
    const input = documentTarget.querySelector<HTMLInputElement>(selector);
    if (!input) return [];
    const change = () => {
      const enabled = !input.checked;
      apply[name](enabled);
      target.performance.mark(`cssEarth:${name}:enabled`, { detail: { enabled } });
    };
    input.disabled = false;
    input.addEventListener('change', change);
    if (input.checked) change();
    return [{ input, change }];
  });
  return { destroy() { for (const { input, change } of bindings) { input.removeEventListener('change', change); input.disabled = true; } } };
}
export type WorldContextDiagnostics = ReturnType<typeof createWorldContextDiagnostics>;
