import { DATASET_VISIBILITY } from './runtime-policy.mts';
import { isRecord } from '@cssearth/core';
// Generated after the prepared dataset payloads are restored: text now, validated below.
import datasetBillboardText from './prepared-dataset-billboards.json?raw';
import datasetBillboardAtlasUrl from './prepared-dataset-billboards.webp?url';
import galaxyDisplaySample from '../src/objects/local-group/prepared/display-sample.json' with { type: 'json' };
import { parseDensityVolumeFrame, parseImageLayerBankDescriptor, parseObjectDescriptor } from '@cssearth/objects';
import { createPreparedUniverse, parseDatasetBillboards, loadPreparedCssVolume, loadPreparedPointAppearance, loadPreparedCssSurfaceShell, loadPreparedCssImageLayers, loadPreparedVolumeDatasets } from '@cssearth/renderer/universe';
import { APPLICATION_WORLD_CONTEXT as applicationContext, APPLICATION_WORLD_PLANNER_SOURCE } from './world-context-plan.mts';
import { preparedBodyBillboards } from '@cssearth/renderer/navigation/prepared-body-billboards.ts';
import { CONTEXT_OBJECT_ASSET_URLS, CONTEXT_OBJECT_DESCRIPTORS } from './prepared-context-objects.mts';
import { CONTEXT_AVAILABILITY } from './context-availability.mts';
import { PREPARED_WORLD_PRESENTATION } from './prepared-world-presentation.mts';
import { createInFlightLoader } from './in-flight-loader.mts';
import { loadFocusCatalogs } from './focus-catalog.mts';
import { worldVisibilityPolicy } from './application-world-visibility.mts';
import { STELLAR_EXTENTS } from './stellar-extents.mts';
import { readPageDatasets, selectedPageDataset } from './page-datasets.mts';
import { KNOWN_OVERVIEWS } from './object-directory.mts';
import { navigationHref } from './navigation/navigation-history.mts';

/** The view the page `page` shows its image mesh in: its selected dataset's (page-datasets.mts), read from the address. The
 * shell presents the cards (object-shell-client.mts); a page without datasets shows its mesh cut open. */
let cards: ReturnType<typeof readPageDatasets> | null = null;
// The cards are retained shell markup: read once.
const pageDatasets = () => cards ??= readPageDatasets(document);
function meshView(page: string): string {
  const datasets = pageDatasets().find(candidate => candidate.page === page);
  return datasets ? datasets.views.get(selectedPageDataset(navigationHref(window), datasets))! : 'cutaway';
}
import { isOverviewPage, withOverviewScope } from './navigation/navigation-scope.mts';

// An asteroid sprite's smallest drawn size, and a plain asteroid dot's (see world-context.css for its opacity).
const ASTEROID_MINIMUM_PIXELS = 2, PLAIN_DOT_MINIMUM_PIXELS = 1.5;
const { annotationOpacities, annotationPriorities, asteroidIds, ordinaryAsteroidIds, plainDotIds, compact: phone } = worldVisibilityPolicy;
const ASTRONOMICAL_UNIT_M = 149_597_870_700, PARSEC_M = 3.085677581491367e16;
// Published catalogues placed on a galaxy's disc plane, drawn over its image layers (src/objects/m31/README.md,
// src/objects/m33/README.md).
const IMAGE_LAYER_CATALOGUE_POINTS: Readonly<Record<string, readonly string[]>> = {
  m31: ['stars', 'dots'],
  m33: ['stars', 'dots'],
  m81: ['dots'],
  m83: ['dots'],
  'ngc-253': ['dots'],
  'ngc-300': ['dots'],
};

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
    // Every galaxy point field draws its dots, and its far banks (`properties.farBanks`) once the camera is that far out.
    const backgroundCataloguePoints = parsedDescriptors.filter(descriptor => descriptor.type === 'galaxy-point-field').flatMap(descriptor => {
      const set = resourceSet(descriptor.id), far = descriptor.properties.farBanks;
      if (!descriptor.prepared) throw new TypeError(`src/objects/${descriptor.id}/object.json: a galaxy point field names its prepared dots.`);
      if (far !== undefined && !(isRecord(far) && Array.isArray(far.banks) && far.banks.every(bank => typeof bank === 'string')
        && typeof far.fromDistancePc === 'number' && far.fromDistancePc > 0)) {
        throw new TypeError(`src/objects/${descriptor.id}/object.json properties.farBanks: expected banks (prepared paths) and fromDistancePc > 0, not ${JSON.stringify(far)}.`);
      }
      return [{ url: set.resolve(descriptor.prepared.url) }, ...(far ? (far.banks as string[]).map(bank => ({ url: set.resolve(bank), fromDistanceM: (far.fromDistancePc as number) * PARSEC_M })) : [])];
    });
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
        resolveResource: (path: string) => set.resolve(`prepared/${path}`),
        cataloguePointUrls: (IMAGE_LAYER_CATALOGUE_POINTS[id] ?? []).map(bank => set.resolve(`prepared/${bank}.bin`)) };
    });
    const plainDots = new Set(plainDotIds), asteroids = new Set(asteroidIds);
    const sprites = preparedBodyBillboards([applicationContext.focus, ...applicationContext.bodies], plainDots,
      id => asteroids.has(id) ? ASTEROID_MINIMUM_PIXELS : 2.4);
    // Bank declarations do not fetch payloads. Deduplicate pending loads only; the
    // mounted layer owns residency and can release banks after they leave view.
    const volumeDatasetDescriptors = parsedDescriptors
      .filter(descriptor => descriptor.type === 'volume-dataset-bank' && CONTEXT_AVAILABILITY[descriptor.id]?.available);
    const volumeDatasetIds = new Set(volumeDatasetDescriptors.map(descriptor => descriptor.id));
    const volumeDatasetBanks = volumeDatasetDescriptors.map(descriptor => ({ id: descriptor.id, frame: parseDensityVolumeFrame(descriptor.properties.frame) }));
    // Every bank's context visibility and Sun-facing billboard, prepared from those same payloads.
    const datasetBillboards = { plan: parseDatasetBillboards(JSON.parse(datasetBillboardText)), atlasUrl: datasetBillboardAtlasUrl };
    const loadVolumeDataset = createInFlightLoader(async (id: string) => {
      if (!volumeDatasetIds.has(id)) throw new TypeError(`Unknown prepared volume dataset bank: ${id}.`);
      const set = resourceSet(id), payload = await loadPreparedVolumeDatasets(set.descriptor, set.transport);
      return { payload, resolveResource: (path: string) => set.resolve(`prepared/${path}`) };
    });
    // The worker receives the validated summary and reads orbit paths on demand.
    // The bounded spatial-star sample is already inside pointAppearance;
    // the complete binary catalogue stays out of the app.
    const plannerSource = APPLICATION_WORLD_PLANNER_SOURCE;
    const fades = PREPARED_WORLD_PRESENTATION;
    const catalogBank = { fadeStartDistanceM: fades.galaxies.fadeStartDistanceM, fullDistanceM: fades.galaxies.fullDistanceM,
      clusters: { fadeStartDistanceM: fades.clusters.fadeStartDistanceM, fullDistanceM: fades.clusters.fullDistanceM } };
    const universe = createPreparedUniverse({
      // The world's volume is an overview's package (the Milky Way): clicking it opens that overview's page.
      environmentLinks: isOverviewPage(applicationContext.volume.objectId) ? { [applicationContext.volume.objectId]: (link => link.pathname + link.search)(
        withOverviewScope(new URL(`/${applicationContext.focus.id}/`, location.origin), applicationContext.focus.id, applicationContext.volume.objectId)) } : {},
      stellarExtents: STELLAR_EXTENTS,
      // Published catalogues inside the galaxy, drawn as dust with it: the young disc and its warp (Skowron et al. 2019
      // Cepheids), star-forming regions on both sides of the centre (Anderson et al. 2014 WISE HII regions, Reid et al.
      // 2019 maser parallaxes), the local arms (Hunt & Reffert 2023 open clusters) and the halo (Baumgardt & Vasiliev 2021).
      galaxyCataloguePoints: ['globular-clusters', 'dots'].map(id => volumeSet.resolve(`prepared/${id}.bin`)),
      galaxyBacking: volumeSet.resolve('prepared/backing.json'),
      context: applicationContext, volume, pointAppearance, sprites,
      imageLayerBanks, loadImageLayer, volumeDatasetBanks, loadVolumeDataset,
      backgroundCataloguePoints,
      // Every context object prepared as an image mesh (the cosmic microwave background of the Observable Universe), cut
      // open unless its page's dataset shows it whole or hides it. Hidden, its caption names the overview it bounds.
      imageMeshes: parsedDescriptors.filter(descriptor => descriptor.prepared?.format === 'cssearth-image-mesh@1').map(descriptor => {
        const set = resourceSet(descriptor.id);
        return { url: set.resolve(descriptor.prepared!.url), resolveResource: (path: string) => set.resolve(`prepared/${path}`),
          cutaway: () => meshView(descriptor.id) === 'cutaway', hidden: () => meshView(descriptor.id) === 'hidden', hiddenCaption: KNOWN_OVERVIEWS.find(overview => overview.id === descriptor.id)?.name };
      }),
      annotationPriorities, annotationLandmarks: PREPARED_WORLD_PRESENTATION.moons.major, annotationOpacities, plannerSource, catalogBank,
      distantNavigation: { afterDistanceM: 25 * ASTRONOMICAL_UNIT_M, nonNavigableIds: ordinaryAsteroidIds },
      plainDots: { ids: plainDotIds, minimumDiameterPixels: PLAIN_DOT_MINIMUM_PIXELS },
      datasetVisibility: DATASET_VISIBILITY, datasetBillboards,
      // Phones draw no celestial sky cube: about 60 MB of layers and 27 MB of decoded faces behind the body.
      sky: !phone,
      loadCatalog: async () => {
        const { galaxies, clusters, nebulae } = await loadCatalogs();
        return { payload: galaxies, galaxySample: galaxyDisplaySample, nebulae, ...catalogBank,
          clusters: { payload: clusters, ...catalogBank.clusters } };
      },
      resolveResource: path => volumeSet.resolve(`prepared/${path}`),
      resolvePointResource: path => starSet.resolve(`prepared/${path}`) });
    return {
      ...universe, loadShells,
      catalogSources: () => catalogs ? [...catalogs.galaxies.sources, ...catalogs.clusters.sources, ...catalogs.nebulae.sources] : [],
    };
  })().catch(error => { universePromise = null; throw error; });
  return universePromise;
}
