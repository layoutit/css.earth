import { createPreparedUniverse, prepareObjectResources, loadPreparedCssVolume, loadPreparedCssPointField, loadPreparedCssSurfaceShell } from '../src/renderers/css/dist/universe.js';
import applicationContext from '../src/planets/sun/prepared/world-context.json' with { type: 'json' };
import { PREPARED_NAVIGATION_MARKERS } from './prepared-navigation-markers.mjs';

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
    const sprites = Object.fromEntries(Object.entries(PREPARED_NAVIGATION_MARKERS).map(([id, sprite]) => [id, {
      url: '/navigation/planet-markers@2x.webp', index: sprite.index, count: sprite.count,
      size: sprite.presentation.size,
    }]));
    return createPreparedUniverse({ context: applicationContext, volume, stars, sprites, shells,
      resolveResource: path => volumeSet.resolve(`prepared/${path}`),
      resolveStarResource: path => starSet.resolve(`prepared/${path}`) });
  })().catch(error => { universePromise = null; throw error; });
  return universePromise;
}

export function createApplicationWorldContext() {
  return {
    async mount({ stage, signal }) {
      const prepared = await loadApplicationUniverse();
      if (signal?.aborted) throw signal.reason;
      const resources = prepareObjectResources(prepared.assets, { signal });
      try {
        await resources.ready;
        if (signal?.aborted) throw signal.reason;
        const layer = prepared.mount(stage);
        const target = stage.ownerDocument.defaultView;
        const diagnostics = import.meta.env?.DEV === true ? Object.freeze({ inspect: layer.inspect }) : null;
        if (diagnostics) target.__cssEarthUniverse = diagnostics;
        return { ...layer, destroy() {
          if (diagnostics && target.__cssEarthUniverse === diagnostics) delete target.__cssEarthUniverse;
          layer.destroy(); resources.destroy();
        } };
      } catch (error) { resources.destroy(); throw error; }
    },
  };
}
