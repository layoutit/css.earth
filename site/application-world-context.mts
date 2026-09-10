import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from '../src/renderers/css/navigation/world-camera.js';
import type { PreparedAssets } from '../src/renderers/css/rendering/prepared-residency.js';
import { parseObjectDescriptor } from '@cssearth/objects';
import { mountSpaceMinimap } from './minimap/minimap.mts';
import { DIAGNOSTICS_ENABLED } from './diagnostics-policy.mts';
import { createPreparedUniverse, prepareObjectResources, loadPreparedCssVolume, loadPreparedCssPointField, loadPreparedCssSurfaceShell } from '../src/renderers/css/dist/universe.js';
import applicationContext from '../src/planets/sun/prepared/world-context.json' with { type: 'json' };
import { contextMarkerSprite } from '../src/navigation/marker-presentation.mts';
import { PREPARED_NAVIGATION_MARKERS } from './prepared-navigation-markers.mjs';
import { createCameraViewport } from '../src/renderers/css/dist/navigation.js';
import { OBJECTS } from './objects.mts';
import { CONTEXT_ANNOTATION_PRIORITY } from './runtime-policy.mts';

const asteroidIds = OBJECTS.filter(object => object.classification === 'asteroid').map(object => object.id);
const cometIds = OBJECTS.filter(object => object.classification === 'comet').map(object => object.id);
const annotationPriorities = Object.fromEntries(OBJECTS.map(object =>
  [object.id, (CONTEXT_ANNOTATION_PRIORITY as Readonly<Partial<Record<typeof object.classification, number>>>)[object.classification] ?? 0]));

// Inventory of prepared resources, not navigation entries or runtime generators.
let universePromise: Promise<ReturnType<typeof createPreparedUniverse>> | null = null;
function loadApplicationUniverse(): Promise<ReturnType<typeof createPreparedUniverse>> {
  universePromise ??= (async () => {
    const descriptors = import.meta.glob('../src/objects/*/object.json', { import: 'default', eager: true });
    const assets = import.meta.glob('../src/objects/*/prepared/**/*.{json,png,webp}', {
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
    const shells = await Promise.all(Object.values(descriptors).map(parseObjectDescriptor).filter(descriptor => descriptor.type === 'surface-shell')
      .map(async descriptor => {
        const set = resourceSet(descriptor.id);
        return { payload: await loadPreparedCssSurfaceShell(set.descriptor, set.transport),
          resolveResource: (path: string) => set.resolve(`prepared/${path}`) };
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
    } satisfies PreparedAssets };
  })().catch(error => { universePromise = null; throw error; });
  return universePromise;
}

export function createApplicationWorldContext() {
  return {
    async mount({ stage, signal }: { stage: HTMLElement; signal?: AbortSignal }) {
      const target = stage.ownerDocument.defaultView;
      if (!target) throw new Error("World context requires a window.");
      const prepared = await loadApplicationUniverse();
      if (signal?.aborted) throw signal.reason;
      const resources = prepareObjectResources(prepared.assets, { signal });
      try {
        await resources.ready;
        if (signal?.aborted) throw signal.reason;
        const layer = prepared.mount(stage);
        layer.setHiddenOrbits(cometIds);
        const viewport = createCameraViewport(stage, stage.ownerDocument.querySelector<HTMLElement>('.planet-sidebar'));
        const minimap = mountSpaceMinimap(stage.ownerDocument);
        const diagnostics = DIAGNOSTICS_ENABLED ? Object.freeze({ inspect: layer.inspect }) : null;
        if (diagnostics) Reflect.set(target, '__cssEarthUniverse', diagnostics);
        let heliosphereEnabled = false, destroyed = false; let publication: { world: WorldCameraPose; viewport: WorldCameraViewport } | null = null;
        const publish = (world: WorldCameraPose, viewport: WorldCameraViewport) => {
          if (destroyed) return;
          publication = { world, viewport };
          layer.publish(world, viewport, { heliosphere: heliosphereEnabled });
          minimap.publish(world, viewport);
        };
        return { ...layer, viewport, publish,
          previewSelection(id?: string | null) {
            layer.previewSelection(id);
            if (publication) publish(publication.world, publication.viewport);
          },
          selectObject(id: string, frame: PreparedWorldCameraFrame) {
            layer.selectObject(id, frame);
            minimap.selectObject(frame);
          },
          setAsteroidOrbitsEnabled(enabled: boolean) {
            if (!destroyed) layer.setHiddenOrbits(enabled === true ? cometIds : [...cometIds, ...asteroidIds]);
          },
          setAsteroidLabelsEnabled(enabled: boolean) {
            if (!destroyed) layer.setHiddenLabels(enabled === true ? [] : asteroidIds);
          },
          setHeliosphereEnabled(enabled: boolean) {
            if (destroyed || heliosphereEnabled === (enabled === true)) return;
            heliosphereEnabled = enabled === true;
            if (publication) publish(publication.world, publication.viewport);
          },
          destroy() {
            destroyed = true; publication = null;
            if (diagnostics && Reflect.get(target, '__cssEarthUniverse') === diagnostics) Reflect.deleteProperty(target, '__cssEarthUniverse');
            minimap.destroy();
            viewport.destroy(); layer.destroy(); resources.destroy();
          },
        };
      } catch (error) { resources.destroy(); throw error; }
    },
  };
}
