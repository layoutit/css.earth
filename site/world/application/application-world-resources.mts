import { IMAGE_MESH_SCHEMA, bankCataloguePoints, parseDatasetBillboards, parseGalaxyBacking, parseCataloguePointBankDescriptor, parseDensityVolumeFrame, parseImageLayerBankDescriptor, parseObjectDescriptor } from '@cssearth/objects';
import { DATASET_VISIBILITY } from '../../browser/runtime-policy.mts';
import { isRecord } from '@cssearth/core';
// Generated after the prepared dataset payloads are restored: text now, validated below.
import datasetBillboardText from '../../prepared/prepared-dataset-billboards.json?raw';
import { createPreparedUniverse, loadPreparedCssVolume, loadPreparedPointAppearance, loadPreparedCssSurfaceShell, loadPreparedCssImageLayers, loadPreparedVolumeDatasets } from '@cssearth/renderer/universe';
import { APPLICATION_WORLD_CONTEXT as applicationContext, APPLICATION_WORLD_PLANNER_SOURCE, WORLD_DOT_BANKS, onWorldSystems } from '../../directory/world-context-plan.mts';
import { preparedBodyBillboards } from '@cssearth/renderer/navigation/prepared-body-billboards.ts';
import { CONTEXT_OBJECT_ASSET_URLS, CONTEXT_OBJECT_DESCRIPTORS } from '../../prepared/prepared-context-objects.mts';
import { CONTEXT_AVAILABILITY } from './context-availability.mts';
import { PREPARED_WORLD_PRESENTATION } from '../prepared-world-presentation.mts';
import { createInFlightLoader } from '../../browser/in-flight-loader.mts';
import { startupFetch } from '../../directory/startup-requests.mts';
import { loadCatalogueDots } from './dot-catalogues.mts';
import { annotationsForBodies, worldVisibilityPolicy } from './application-world-visibility.mts';
import { STELLAR_EXTENTS } from './stellar-extents.mts';
import { CONTEXT_DATASETS } from './context-datasets.mts';
import { navigationHref } from '../../model/navigation-href.mts';
import { onObjectEntry } from '../../directory/object-entries.mts';

/** The view an image mesh package is drawn in: the view of the dataset the mounted object shows of it (context-datasets.mts),
 * or of its default dataset; its descriptor names each dataset's view (`properties.views`). A package without views is cut open. */
function meshView(descriptor: { id: string; properties: Record<string, unknown> }): string {
  const views = descriptor.properties.views;
  if (views === undefined) return 'cutaway';
  if (!isRecord(views) || !isRecord(views.datasets) || typeof views.default !== 'string') throw new TypeError(`src/objects/${descriptor.id}/object.json properties.views: expected its datasets' views and the default dataset.`);
  const view = views.datasets[CONTEXT_DATASETS.get(descriptor.id) ?? views.default];
  if (view !== 'cutaway' && view !== 'full' && view !== 'hidden') throw new TypeError(`src/objects/${descriptor.id}/object.json properties.views: a view is cutaway, full or hidden, not ${String(view)}.`);
  return view;
}

// An asteroid sprite's smallest drawn size, and a plain asteroid dot's (see world-context.css for its opacity).
const ASTEROID_MINIMUM_PIXELS = 2, PLAIN_DOT_MINIMUM_PIXELS = 1.5;
const { annotationOpacities, annotationPriorities, ordinaryAsteroidIds, compact: phone } = worldVisibilityPolicy;
const PARSEC_M = 3.085677581491367e16;

// Inventory of prepared resources, not navigation entries or runtime generators.
type ApplicationUniverse = ReturnType<typeof createPreparedUniverse> & {
  loadShells(): Promise<{ payload: Awaited<ReturnType<typeof loadPreparedCssSurfaceShell>>; resolveResource(path: string): string }[]>;
};
let universePromise: Promise<ApplicationUniverse> | null = null;
export function loadApplicationUniverse(): Promise<ApplicationUniverse> {
  universePromise ??= (async () => {
    let catalogs: Awaited<ReturnType<typeof loadCatalogueDots>> | null = null;
    let catalogsLoading: Promise<Awaited<ReturnType<typeof loadCatalogueDots>>> | null = null;
    const loadCatalogs = () => catalogs ? Promise.resolve(catalogs) : catalogsLoading ??= loadCatalogueDots(location.origin)
      .then(value => catalogs = value).finally(() => { catalogsLoading = null; });
    // The context objects the world draws from any page are in its code; a bank drawn only for the bodies that hold it
    // comes with their object entries (`banks`, below), and joins these tables then.
    const descriptors: Record<string, unknown> = { ...CONTEXT_OBJECT_DESCRIPTORS }, assets: Record<string, unknown> = { ...CONTEXT_OBJECT_ASSET_URLS };
    const parsedDescriptors = Object.values(descriptors).map(parseObjectDescriptor);
    // The objects seen from inside (the Milky Way, the Local Group, the Nearby and the Observable Universe) are context
    // objects too, and the banks they host are the world's own context: drawn always, each answering as a bank with
    // nothing to load, its caption naming its host and linking to its host's page.
    const insideObjects = new Map(parsedDescriptors.filter(descriptor => isRecord(descriptor.properties.zoom)).map(descriptor => [descriptor.id, descriptor] as const));
    const insideHost = (id: string) => {
      const host = parsedDescriptors.find(descriptor => descriptor.id === id)?.properties.host;
      return typeof host === 'string' ? insideObjects.get(host) : undefined;
    };
    const contextBanks = parsedDescriptors.filter(descriptor => insideHost(descriptor.id)).map(descriptor => descriptor.id);
    const hostName = (id: string) => {
      const catalog = insideHost(id)?.properties.catalog;
      return isRecord(catalog) && typeof catalog.name === 'string' ? catalog.name : undefined;
    };
    const resourceSet = (objectId: string, files: Record<string, unknown> = assets) => {
      const base = `../src/objects/${objectId}/`;
      const resolve = (path: string) => {
        const url = files[`${base}${path}`];
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
    // A bank a body's dataset shows names its files when it is first loaded (prepare-catalog.mts CONTEXT_BANK_TYPES).
    const bankSet = async (objectId: string) => {
      // The page's head asked for its own default bank's list already (startup-requests.mts).
      const response = await startupFetch(`/world/context-assets/${encodeURIComponent(objectId)}.json`, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`Prepared context bank ${objectId}: its file list request failed (${response.status}).`);
      const files: unknown = await response.json();
      if (!isRecord(files)) throw new TypeError(`Prepared context bank ${objectId}: /world/context-assets/${objectId}.json is not a file list.`);
      return resourceSet(objectId, files);
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
    const imageLayerCataloguePoints = new Map(imageLayerDescriptors.map(descriptor => [descriptor.id, descriptor.cataloguePoints]));
    const imageLayerBanks = imageLayerDescriptors.map(descriptor => ({ id: descriptor.id, frame: descriptor.frame,
      ...(descriptor.surrounds ? { surrounds: true as const } : {}), ...(descriptor.host === undefined ? {} : { host: descriptor.host }) }));
    const loadImageLayer = createInFlightLoader(async (id: string) => {
      if (!imageLayerIds.has(id)) throw new TypeError(`Unknown prepared image-layer bank: ${id}.`);
      const set = await bankSet(id);
      return { payload: await loadPreparedCssImageLayers(set.descriptor, set.transport),
        resolveResource: (path: string) => set.resolve(`prepared/${path}`),
        cataloguePointUrls: imageLayerCataloguePoints.get(id)!.map(bank => set.resolve(`prepared/${bank}.bin`)) };
    });
    // Packages that are only catalogue dots: a galaxy cluster's members draw while their catalogue row is selected, and a
    // body's (a planet's moons without a page) while that body or one that orbits it is.
    const pointBank = (descriptor: ReturnType<typeof parseObjectDescriptor>) => {
      const bank = parseCataloguePointBankDescriptor(descriptor);
      return { id: bank.id, url: resourceSet(bank.id).resolve(bank.url), ...(bank.host === undefined ? {} : { host: bank.host }) };
    };
    // The plain stars inside an object are dots of that object (`/world/dots/<object id>.bin`, named by the world's summary):
    // they draw while it or a body inside it is selected, so no other page asks for them.
    const pointBanks = [...parsedDescriptors.filter(descriptor => descriptor.type === 'catalogue-point-bank').map(pointBank),
      ...WORLD_DOT_BANKS.map(id => ({ id: `${id}/plain-stars`, url: `/world/dots/${id}.bin`, host: id, stars: true as const }))];
    // A body's row says whether it is a plain dot (no billboard) and what it is (an asteroid's sprite stays smaller).
    const billboards = (bodies: readonly (Parameters<typeof preparedBodyBillboards>[0][number] & { readonly plainDot?: true; readonly classification?: string })[]) => {
      const asteroids = new Set(bodies.filter(body => body.classification === 'asteroid').map(body => body.id));
      return preparedBodyBillboards(bodies, new Set(bodies.filter(body => body.plainDot === true).map(body => body.id)),
        id => asteroids.has(id) ? ASTEROID_MINIMUM_PIXELS : 2.4);
    };

    // Bank declarations do not fetch payloads. Deduplicate pending loads only; the
    // mounted layer owns residency and can release banks after they leave view.
    const volumeDatasetDescriptors = parsedDescriptors
      .filter(descriptor => descriptor.type === 'volume-dataset-bank' && CONTEXT_AVAILABILITY[descriptor.id]?.available);
    const volumeDatasetIds = new Set(volumeDatasetDescriptors.map(descriptor => descriptor.id));
    const volumeDatasetBanks = volumeDatasetDescriptors.map(descriptor => ({ id: descriptor.id, frame: parseDensityVolumeFrame(descriptor.properties.frame) }));
    // Every bank's context visibility and Sun-facing billboard, prepared from those same payloads.
    // Each bank's billboard image is a public file named by its id, and by its dataset's when it pictures a dataset
    // other than the bank's default (prepare-dataset-billboards.ts).
    const datasetBillboards = { plan: parseDatasetBillboards(JSON.parse(datasetBillboardText)),
      imageUrl: (id: string, dataset?: string) =>
        `/navigation/dataset-billboards/${encodeURIComponent(dataset === undefined ? id : `${id}.${dataset}`)}.webp` };
    const loadVolumeDataset = createInFlightLoader(async (id: string) => {
      if (!volumeDatasetIds.has(id)) throw new TypeError(`Unknown prepared volume dataset bank: ${id}.`);
      // The bank's index and its default dataset; another dataset's files are read when it is first selected.
      const set = await bankSet(id), payload = await loadPreparedVolumeDatasets(set.descriptor, set.transport, { resolve: path => set.resolve(path) });
      return { payload, resolveResource: (path: string) => set.resolve(`prepared/${path}`),
        // Published catalogues drawn through the bank, with its opacity (its descriptor's `cataloguePoints`).
        cataloguePointUrls: bankCataloguePoints(parseObjectDescriptor(set.descriptor)).map(bank => set.resolve(`prepared/${bank}.bin`)) };
    });
    // A bank drawn from afar by its backing plane (its billboard facts say so) reads it from its own file list.
    const loadVolumeBacking = createInFlightLoader(async (id: string) => {
      if (!volumeDatasetIds.has(id)) throw new TypeError(`Unknown prepared volume dataset bank: ${id}.`);
      const set = await bankSet(id), path = 'prepared/backing.json';
      return { payload: parseGalaxyBacking(JSON.parse(new TextDecoder().decode(await set.transport.read(path))), `${id}/${path}`),
        resolveResource: (resource: string) => set.resolve(`prepared/${resource}`) };
    });
    // The worker receives the validated summary and reads orbit paths on demand.
    // The bounded spatial-star sample is already inside pointAppearance;
    // the complete binary catalogue stays out of the app.
    const plannerSource = APPLICATION_WORLD_PLANNER_SOURCE;
    const fades = PREPARED_WORLD_PRESENTATION;
    const catalogBank = { fadeStartDistanceM: fades.galaxies.fadeStartDistanceM, fullDistanceM: fades.galaxies.fullDistanceM,
      clusters: { fadeStartDistanceM: fades.clusters.fadeStartDistanceM, fullDistanceM: fades.clusters.fullDistanceM } };
    // The plan as it stands now: systems read later reach the universe through onWorldSystems below.
    const plan = applicationContext, sprites = billboards([plan.focus, ...plan.bodies]);
    const universe = createPreparedUniverse({
      // The world's volume is the Milky Way's bank: clicking it opens its host's page.
      environmentLinks: (host => host ? { [applicationContext.volume.objectId]: `/${host.id}/` } : {})(insideHost(applicationContext.volume.objectId)),
      contextBanks,
      stellarExtents: STELLAR_EXTENTS,
      // Published catalogues inside the galaxy, drawn as dust with it: the young disc and its warp (Skowron et al. 2019
      // Cepheids), star-forming regions on both sides of the centre (Anderson et al. 2014 WISE HII regions, Reid et al.
      // 2019 maser parallaxes), the local arms (Hunt & Reffert 2023 open clusters) and the halo (Baumgardt & Vasiliev 2021).
      galaxyCataloguePoints: ['globular-clusters', 'old-star-dots', 'dots'].map(id => volumeSet.resolve(`prepared/${id}.bin`)),
      galaxyBacking: volumeSet.resolve('prepared/backing.json'),
      context: plan, volume, pointAppearance, sprites,
      imageLayerBanks, loadImageLayer, pointBanks, volumeDatasetBanks, loadVolumeDataset, loadVolumeBacking,
      backgroundCataloguePoints,
      // Every context object prepared as an image mesh (the cosmic microwave background of the Observable Universe), cut
      // open unless its page's dataset shows it whole or hides it. Hidden, its caption names the object it bounds.
      imageMeshes: parsedDescriptors.filter(descriptor => descriptor.prepared?.format === IMAGE_MESH_SCHEMA).map(descriptor => {
        const set = resourceSet(descriptor.id);
        return { url: set.resolve(descriptor.prepared!.url), resolveResource: (path: string) => set.resolve(`prepared/${path}`),
          cutaway: () => meshView(descriptor) === 'cutaway', hidden: () => meshView(descriptor) === 'hidden', hiddenCaption: hostName(descriptor.id) };
      }),
      annotationPriorities, annotationLandmarks: PREPARED_WORLD_PRESENTATION.moons.major, annotationOpacities, plannerSource, catalogBank,
      nonNavigableIds: ordinaryAsteroidIds,
      plainDots: { minimumDiameterPixels: PLAIN_DOT_MINIMUM_PIXELS },
      datasetVisibility: DATASET_VISIBILITY, datasetBillboards,
      // Phones draw no celestial sky cube: about 60 MB of layers and 27 MB of decoded faces behind the body.
      sky: !phone,
      loadCatalog: async () => {
        // The catalogue's dots alone, read by the data worker: the catalogues themselves stay with the build.
        return { payload: await loadCatalogs(), ...catalogBank };
      },
      resolveResource: path => volumeSet.resolve(`prepared/${path}`),
      resolvePointResource: path => starSet.resolve(`prepared/${path}`) });
    // A bank drawn only for the bodies that hold it arrives in their object entries (`/objects/<id>/entry.json` `banks`,
    // site/world/hosted-banks.mts): a page reads the entry of each object it opens before it mounts it, so the bank is declared
    // before that object's datasets ask for it. Only volume dataset banks and packages of catalogue dots travel this way.
    onObjectEntry((objectId, entry) => {
      const carried = isRecord(entry) ? entry.banks : undefined;
      if (carried === undefined) return;
      if (!Array.isArray(carried)) throw new TypeError(`/objects/${objectId}/entry.json banks: expected a list of banks, not ${JSON.stringify(carried)}.`);
      const volumes: { id: string; frame: ReturnType<typeof parseDensityVolumeFrame> }[] = [], points: { id: string; url: string; host?: string }[] = [];
      for (const bank of carried) {
        if (!isRecord(bank) || bank.files !== undefined && !isRecord(bank.files)) throw new TypeError(`/objects/${objectId}/entry.json banks: expected a descriptor with its files, not ${JSON.stringify(bank)}.`);
        const descriptor = parseObjectDescriptor(bank.descriptor), key = `../src/objects/${descriptor.id}/object.json`;
        if (descriptors[key] !== undefined) continue;
        descriptors[key] = bank.descriptor; Object.assign(assets, bank.files);
        if (descriptor.type === 'volume-dataset-bank') {
          // As at startup, a bank whose prepared payload is not restored is not declared.
          if (!CONTEXT_AVAILABILITY[descriptor.id]?.available) continue;
          volumeDatasetIds.add(descriptor.id);
          volumes.push({ id: descriptor.id, frame: parseDensityVolumeFrame(descriptor.properties.frame) });
        } else if (descriptor.type === 'catalogue-point-bank') points.push(pointBank(descriptor));
        else throw new TypeError(`/objects/${objectId}/entry.json banks: ${descriptor.id} is a ${descriptor.type}; an entry carries volume dataset banks and catalogue dots only.`);
      }
      universe.addBanks({ volumeDatasetBanks: volumes, pointBanks: points });
    });
    // Other systems' bodies join the world as their files arrive (site/directory/world-context-plan.mts), with their billboards and
    // their annotation strengths and tiers, which the first plan's tables did not hold.
    let drawn = plan.bodies.length;
    onWorldSystems(next => {
      const added = next.bodies.slice(drawn);
      drawn = next.bodies.length;
      universe.addSystems(next, billboards(added), annotationsForBodies(added));
    });
    // The first world mount adopts a planner made now: its worker builds the planner from the summary while the first body
    // still prepares, so the world's first frame waits only for its own plan. Later mounts make their own.
    let firstPlanner: ReturnType<typeof universe.createFramePlanner> | null = universe.createFramePlanner();
    return {
      ...universe, loadShells,
      createFramePlanner() {
        const planner = firstPlanner ?? universe.createFramePlanner();
        firstPlanner = null;
        return planner;
      },
    };
  })().catch(error => { universePromise = null; throw error; });
  return universePromise;
}
