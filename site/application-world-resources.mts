import { LENS_VISIBILITY } from './runtime-policy.mts';
// Generated after the prepared lens payloads are restored: text now, validated below.
import lensBillboardText from './prepared-lens-billboards.json?raw';
import lensBillboardAtlasUrl from './prepared-lens-billboards.webp?url';
import galaxyDisplaySample from '../src/objects/local-group/prepared/display-sample.json' with { type: 'json' };
import type { PreparedAssets } from '@cssearth/renderer/rendering/prepared-residency.ts';
import { parseDensityVolumeFrame, parseImageLayerBankDescriptor, parseObjectDescriptor } from '@cssearth/objects';
import { createPreparedUniverse, parseLensBillboards, loadPreparedCssVolume, loadPreparedPointAppearance, loadPreparedCssSurfaceShell, loadPreparedCssImageLayers, loadPreparedVolumeLenses } from '@cssearth/renderer/universe';
import { APPLICATION_WORLD_CONTEXT as applicationContext, APPLICATION_WORLD_PLANNER_SOURCE } from './world-context-plan.mts';
import { contextMarkerSprite } from '../src/navigation/marker-presentation.mts';
import { PREPARED_NAVIGATION_MARKERS } from './prepared-navigation-markers.mjs';
import { CONTEXT_OBJECT_ASSET_URLS, CONTEXT_OBJECT_DESCRIPTORS } from './prepared-context-objects.mts';
import { CONTEXT_AVAILABILITY } from './context-availability.mts';
import { PREPARED_WORLD_PRESENTATION } from './prepared-world-presentation.mts';
import { createInFlightLoader } from './in-flight-loader.mts';
import { loadFocusCatalogs } from './focus-catalog.mts';
import { worldVisibilityPolicy } from './application-world-visibility.mts';

// An asteroid sprite's smallest drawn size, and a plain asteroid dot's (see world-context.css for its opacity).
const ASTEROID_MINIMUM_PIXELS = 2, PLAIN_DOT_MINIMUM_PIXELS = 1.5;
const { annotationOpacities, annotationPriorities, asteroidIds, ordinaryAsteroidIds, plainDotIds, compact: phone } = worldVisibilityPolicy;
const ASTRONOMICAL_UNIT_M = 149_597_870_700;

// Inventory of prepared resources, not navigation entries or runtime generators.
type ApplicationUniverse = ReturnType<typeof createPreparedUniverse> & {
  loadShells(): Promise<{ payload: Awaited<ReturnType<typeof loadPreparedCssSurfaceShell>>; resolveResource(path: string): string }[]>;
  catalogSources(): Awaited<ReturnType<typeof loadFocusCatalogs>>['galaxies']['sources'];
};
let universePromise: Promise<ApplicationUniverse> | null = null;
export function loadApplicationUniverse(): Promise<ApplicationUniverse> {
  universePromise ??= (async () => {
    let catalogs: Awaited<ReturnType<typeof loadFocusCatalogs>> | null = null;
    let catalogsLoading: Promise<Awaited<ReturnType<typeof loadFocusCatalogs>>> | null = null;
    const loadCatalogs = () => catalogs ? Promise.resolve(catalogs) : catalogsLoading ??= loadFocusCatalogs(location.origin)
      .then(value => catalogs = value).finally(() => { catalogsLoading = null; });
    // Only the context objects' folders are globbed; bodies share src/objects but are not world resources.
    const descriptors = CONTEXT_OBJECT_DESCRIPTORS, assets = CONTEXT_OBJECT_ASSET_URLS;
    const parsedDescriptors = Object.values(descriptors).map(parseObjectDescriptor);
    const resourceSet = (objectId: string) => {
      const base = `../src/objects/${objectId}/`;
      const resolve = (path: string) => {
        const url = assets[`${base}${path}`];
        if (typeof url !== 'string') throw new Error(`Prepared context resource unavailable: ${path}.`);
        return url;
      };
      return { descriptor: descriptors[`${base}object.json`], resolve,
        transport: { async read(path: string) {
          const response = await fetch(resolve(path), { signal: AbortSignal.timeout(15_000) });
          if (!response.ok) throw new Error(`Prepared context request failed: ${response.status}.`);
          return response.arrayBuffer();
        } } };
    };
    const volumeSet = resourceSet(applicationContext.volume.objectId), starSet = resourceSet(applicationContext.stars.objectId);
    const backgroundPointSet = resourceSet('nearby-universe');
    const [volume, pointAppearance] = await Promise.all([
      loadPreparedCssVolume(volumeSet.descriptor, volumeSet.transport),
      loadPreparedPointAppearance(starSet.descriptor, starSet.transport),
    ]);
    // Surface shells (the heliosphere) are optional and off by default. Their
    // payload, validation and atlas load the first time one is enabled.
    const shellLoaders = parsedDescriptors.filter(descriptor => descriptor.type === 'surface-shell')
      .map(descriptor => async () => {
        const set = resourceSet(descriptor.id);
        return { payload: await loadPreparedCssSurfaceShell(set.descriptor, set.transport),
          resolveResource: (path: string) => set.resolve(`prepared/${path}`) };
      });
    let shellsLoaded: Promise<Awaited<ReturnType<(typeof shellLoaders)[number]>>[]> | null = null;
    const loadShells = () => shellsLoaded ??= Promise.all(shellLoaders.map(load => load()));
    const imageLayerDescriptors = parsedDescriptors.filter(descriptor => descriptor.type === 'image-layer-bank')
      .map(parseImageLayerBankDescriptor);
    const imageLayerIds = new Set(imageLayerDescriptors.map(descriptor => descriptor.id));
    const imageLayerBanks = imageLayerDescriptors.map(descriptor => ({ id: descriptor.id, frame: descriptor.frame }));
    const loadImageLayer = createInFlightLoader(async (id: string) => {
      if (!imageLayerIds.has(id)) throw new TypeError(`Unknown prepared image-layer bank: ${id}.`);
      const set = resourceSet(id);
      return { payload: await loadPreparedCssImageLayers(set.descriptor, set.transport),
        resolveResource: (path: string) => set.resolve(`prepared/${path}`) };
    });
    const plainDots = new Set(plainDotIds);
    const sprites = Object.fromEntries(Object.entries(PREPARED_NAVIGATION_MARKERS).filter(([id]) => !plainDots.has(id))
      .map(([id, sprite]) => [id, { ...contextMarkerSprite(sprite),
        minimumDiameterPixels: asteroidIds.includes(id) ? ASTEROID_MINIMUM_PIXELS : 2.4 }]));
    // Bank declarations do not fetch payloads. Deduplicate pending loads only; the
    // mounted layer owns residency and can release banks after they leave view.
    const volumeLensDescriptors = parsedDescriptors
      .filter(descriptor => descriptor.type === 'volume-lens-bank' && CONTEXT_AVAILABILITY[descriptor.id]?.available);
    const volumeLensIds = new Set(volumeLensDescriptors.map(descriptor => descriptor.id));
    const volumeLensBanks = volumeLensDescriptors.map(descriptor => ({ id: descriptor.id, frame: parseDensityVolumeFrame(descriptor.properties.frame) }));
    // Every bank's context visibility and Sun-facing billboard, prepared from those same payloads.
    const lensBillboards = { plan: parseLensBillboards(JSON.parse(lensBillboardText)), atlasUrl: lensBillboardAtlasUrl };
    const loadVolumeLens = createInFlightLoader(async (id: string) => {
      if (!volumeLensIds.has(id)) throw new TypeError(`Unknown prepared volume lens bank: ${id}.`);
      const set = resourceSet(id), payload = await loadPreparedVolumeLenses(set.descriptor, set.transport);
      return { payload, resolveResource: (path: string) => set.resolve(`prepared/${path}`) };
    });
    // The worker reads its own prepared context. The bounded spatial-star sample is
    // already inside pointAppearance; the complete binary catalogue stays out of the app.
    const plannerSource = APPLICATION_WORLD_PLANNER_SOURCE;
    const fades = PREPARED_WORLD_PRESENTATION;
    const catalogBank = { fadeStartDistanceM: fades.galaxies.fadeStartDistanceM, fullDistanceM: fades.galaxies.fullDistanceM,
      clusters: { fadeStartDistanceM: fades.clusters.fadeStartDistanceM, fullDistanceM: fades.clusters.fullDistanceM } };
    const universe = createPreparedUniverse({
      environmentLinks: { 'milky-way': '/sun/?overview=milky-way' },
      context: applicationContext, volume, pointAppearance, sprites,
      imageLayerBanks, loadImageLayer, volumeLensBanks, loadVolumeLens,
      backgroundPointManifest: backgroundPointSet.resolve('prepared/points.json'),
      backgroundPointCloud: backgroundPointSet.resolve('prepared/cloud.webp'),
      annotationPriorities, annotationLandmarks: PREPARED_WORLD_PRESENTATION.moons.major, annotationOpacities, plannerSource, catalogBank,
      distantNavigation: { afterDistanceM: 25 * ASTRONOMICAL_UNIT_M, nonNavigableIds: ordinaryAsteroidIds },
      plainDots: { ids: plainDotIds, minimumDiameterPixels: PLAIN_DOT_MINIMUM_PIXELS },
      lensVisibility: LENS_VISIBILITY, lensBillboards,
      // Phones draw no celestial sky cube: about 60 MB of layers and 27 MB of decoded faces behind the body.
      sky: !phone,
      loadCatalog: async () => {
        const { galaxies, clusters, nebulae } = await loadCatalogs();
        return { payload: galaxies, galaxySample: galaxyDisplaySample, nebulae, ...catalogBank,
          clusters: { payload: clusters, ...catalogBank.clusters } };
      },
      resolveResource: path => volumeSet.resolve(`prepared/${path}`),
      resolvePointResource: path => starSet.resolve(`prepared/${path}`) });
    const markerPool = 'context-markers';
    const markerEntries = [...new Set(Object.values(sprites).map(sprite => sprite.url))]
      .map((url, index) => ({ key: `${markerPool}:${index}`, url, pool: markerPool }));
    return {
      ...universe, loadShells,
      catalogSources: () => catalogs ? [...catalogs.galaxies.sources, ...catalogs.clusters.sources, ...catalogs.nebulae.sources] : [],
      assets: {
        entries: [...universe.assets.entries, ...markerEntries],
        pools: [...universe.assets.pools, { id: markerPool, retention: 'mount', capacity: markerEntries.length,
          concurrency: 4, reuse: false, decoding: 'async' }],
        // Markers decode through retained leaves, avoiding eager decoding of the entire pool.
        startup: universe.assets.startup,
      } satisfies PreparedAssets,
    };
  })().catch(error => { universePromise = null; throw error; });
  return universePromise;
}
