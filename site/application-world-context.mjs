import { mountSpaceMinimap } from './minimap/minimap.mjs';
import { DIAGNOSTICS_ENABLED } from './diagnostics-policy.mjs';
import { createPreparedUniverse, createWorldFrameQueue, prepareObjectResources, loadPreparedCssVolume, loadPreparedCssPointField, loadPreparedCssSurfaceShell } from '../src/renderers/css/dist/universe.js';
import applicationContext from '../src/planets/sun/prepared/world-context.json' with { type: 'json' };
import { contextMarkerSprite } from '../src/navigation/marker-presentation.mjs';
import { PREPARED_NAVIGATION_MARKERS } from './prepared-navigation-markers.mjs';
import { createCameraViewport } from '../src/renderers/css/dist/navigation.js';
import { OBJECTS } from './objects.mjs';
import { CONTEXT_ANNOTATION_PRIORITY } from './runtime-policy.mjs';

const asteroidIds = OBJECTS.filter(object => object.classification === 'asteroid').map(object => object.id);
const hiddenOrbitIds = OBJECTS.filter(object => ['comet', 'trans-neptunian'].includes(object.classification)).map(object => object.id);
const annotationPriorities = Object.fromEntries(OBJECTS.map(object =>
  [object.id, CONTEXT_ANNOTATION_PRIORITY[object.classification] ?? 0]));

// Inventory of prepared resources, not navigation entries or runtime generators.
let universePromise = null;
function loadApplicationUniverse() {
  universePromise ??= (async () => {
    const descriptors = import.meta.glob('../src/objects/*/object.json', { import: 'default', eager: true });
    const assets = import.meta.glob('../src/objects/*/prepared/**/*.{json,png,webp}', {
      query: '?url', import: 'default', eager: true,
    });
    const resourceSet = objectId => {
      const base = `../src/objects/${objectId}/`;
      const resolve = path => {
        const url = assets[`${base}${path}`];
        if (typeof url !== 'string') throw new Error(`Prepared context resource unavailable: ${path}.`);
        return url;
      };
      return { descriptor: descriptors[`${base}object.json`], resolve,
        transport: { async read(path) {
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
    const shells = await Promise.all(Object.values(descriptors).filter(descriptor => descriptor.type === 'surface-shell')
      .map(async descriptor => {
        const set = resourceSet(descriptor.id);
        return { payload: await loadPreparedCssSurfaceShell(set.descriptor, set.transport),
          resolveResource: path => set.resolve(`prepared/${path}`) };
      }));
    const sprites = Object.fromEntries(Object.entries(PREPARED_NAVIGATION_MARKERS)
      .map(([id, sprite]) => [id, contextMarkerSprite(sprite)]));
    const universe = createPreparedUniverse({ context: applicationContext, volume, stars, sprites, shells, annotationPriorities,
      resolveResource: path => volumeSet.resolve(`prepared/${path}`),
      resolveStarResource: path => starSet.resolve(`prepared/${path}`) });
    const markerPool = 'context-markers';
    const markerEntries = [...new Set(Object.values(sprites).map(sprite => sprite.url))]
      .map((url, index) => ({ key: `${markerPool}:${index}`, url, pool: markerPool }));
    return { ...universe, assets: {
      entries: [...universe.assets.entries, ...markerEntries],
      pools: [...universe.assets.pools, { id: markerPool, retention: 'mount', capacity: markerEntries.length,
        concurrency: 4, reuse: false, decoding: 'async' }],
      startup: [...universe.assets.startup, ...markerEntries.map(entry => entry.key)],
    } };
  })().catch(error => { universePromise = null; throw error; });
  return universePromise;
}

export function createApplicationWorldContext() {
  return {
    async mount({ stage, signal }) {
      const target = stage.ownerDocument.defaultView;
      const prepared = await loadApplicationUniverse();
      if (signal?.aborted) throw signal.reason;
      const resources = prepareObjectResources(prepared.assets, { signal });
      let layer = null, framePlanner = null;
      try {
        await resources.ready;
        if (signal?.aborted) throw signal.reason;
        let refreshWorld = () => false;
        layer = prepared.mount(stage, () => refreshWorld());
        layer.setHiddenOrbits(hiddenOrbitIds);
        framePlanner = prepared.createFramePlanner();
        const viewport = createCameraViewport(stage, stage.ownerDocument.querySelector('.planet-sidebar'));
        const minimap = mountSpaceMinimap(stage.ownerDocument);
        let heliosphereEnabled = false, publication = null, destroyed = false;
        let stagedFrame = null;
        const publish = (world, viewport) => {
          if (destroyed) return;
          publication = { world, viewport };
          const staged = stagedFrame?.world === world && stagedFrame.viewport === viewport ? stagedFrame : null;
          const frame = staged && !staged.consumed && staged.snapshot.current() ? staged.frame : undefined;
          if (staged) staged.consumed = true;
          layer.publish(world, viewport, { heliosphere: heliosphereEnabled }, frame);
          minimap.publish(world, viewport);
        };
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
        });
        refreshWorld = () => frameQueue.refresh();
        const diagnostics = DIAGNOSTICS_ENABLED ? Object.freeze({ inspect: layer.inspect, frames: frameQueue.stats }) : null;
        if (diagnostics) target.__cssEarthUniverse = diagnostics;
        return { ...layer, viewport, publish,
          createFramePresenter() {
            let enabled = false, disposed = false;
            return { enable() { enabled = true; }, destroy() { disposed = true; },
              present(request) {
                if (disposed || destroyed || !request.current()) return;
                const owned = { ...request, current: () => !disposed && !destroyed && request.current() };
                if (!enabled) { frameQueue.remember(owned); request.commit(); return; }
                frameQueue.present(owned);
              } };
          },
          previewSelection(id) {
            layer.previewSelection(id);
          },
          selectObject(id, frame) {
            layer.selectObject(id, frame);
            minimap.selectObject(frame);
          },
          setAsteroidOrbitsEnabled(enabled) {
            if (!destroyed) layer.setHiddenOrbits(enabled === true ? hiddenOrbitIds : [...hiddenOrbitIds, ...asteroidIds]);
          },
          setAsteroidLabelsEnabled(enabled) {
            if (!destroyed) layer.setHiddenLabels(enabled === true ? [] : asteroidIds);
          },
          setHeliosphereEnabled(enabled) {
            if (destroyed || heliosphereEnabled === (enabled === true)) return;
            heliosphereEnabled = enabled === true;
            if (publication && !refreshWorld()) publish(publication.world, publication.viewport);
          },
          destroy() {
            destroyed = true; publication = null;
            frameQueue.destroy(); framePlanner.destroy(); stagedFrame = null;
            if (diagnostics && target.__cssEarthUniverse === diagnostics) delete target.__cssEarthUniverse;
            minimap.destroy();
            viewport.destroy(); layer.destroy(); resources.destroy();
          },
        };
      } catch (error) { framePlanner?.destroy(); layer?.destroy(); resources.destroy(); throw error; }
    },
  };
}
