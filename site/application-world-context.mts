import { LENS_VISIBILITY, MOBILE_VIEWPORT_QUERY } from './runtime-policy.mts';
// Generated after the prepared lens payloads are restored, so typechecks never need it: text now, validated below.
import lensBillboardText from './prepared-lens-billboards.json?raw';
import lensBillboardAtlasUrl from './prepared-lens-billboards.webp?url';
import { labelOcclusionFor } from '../src/renderers/css/dist/index.js';
import galaxyFieldDescriptor from '../src/objects/nearby-universe/object.json' with { type: 'json' };
import galaxyDisplaySample from '../src/objects/local-group/prepared/display-sample.json' with { type: 'json' };
import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from '../src/renderers/css/navigation/world-camera.js';
import type { PreparedAssets } from '../src/renderers/css/rendering/prepared-residency.js';
import { loadFocusCatalogs } from './focus-catalog.mts';
import { parseDensityVolumeFrame, parseImageLayerBankDescriptor, parseObjectDescriptor } from '@cssearth/objects';
import { createSpaceMinimapSetting } from './minimap/minimap-setting.mts';
import { DIAGNOSTICS_ENABLED } from './diagnostics-policy.mts';
import { createPreparedUniverse, parseLensBillboards, createWorldFrameQueue, prepareObjectResources, loadPreparedCssVolume, loadPreparedPointAppearance, loadPreparedCssSurfaceShell, loadPreparedCssImageLayers, loadPreparedVolumeLenses, createRetainedGeometrySnapshot } from '../src/renderers/css/dist/universe.js';
import { APPLICATION_WORLD_CONTEXT as applicationContext, APPLICATION_WORLD_PLANNER_SOURCE } from './world-context-plan.mts';
import { contextMarkerSprite, contextAnnotationOpacity } from '../src/navigation/marker-presentation.mts';
import { PREPARED_NAVIGATION_MARKERS } from './prepared-navigation-markers.mjs';
import { createCameraViewport } from '../src/renderers/css/dist/navigation.js';
import { SCENE_OBJECTS } from './objects.mts';
import { discoveryVisibility, isDefaultContextFeature, showsDefaultContextOrbit } from './object-discovery.mts';
import { labelImportance } from '../src/renderers/css/labels/universe-label-policy.ts';

import galaxyPresentation from '../src/objects/local-group/source/presentation.json' with { type: 'json' };
import clusterPresentation from '../src/objects/galaxy-clusters/source/presentation.json' with { type: 'json' };
import { createPreparedContextNavigation } from './prepared-context-navigation.mts';
import { CONTEXT_OBJECT_ASSET_URLS, CONTEXT_OBJECT_DESCRIPTORS } from './prepared-context-objects.mts';
import { CONTEXT_AVAILABILITY } from './context-availability.mts';
import { majorMoonIds, minorMoonOrbitIds, suppressMinorMoonOrbitPaint } from './moon-orbit-policy.mts';
import { mountCatalogueMoonLabels } from './catalogue-moon-labels.mts';
import { createInFlightLoader } from './in-flight-loader.mts';

const annotationOpacities = Object.fromEntries(SCENE_OBJECTS.map(object => [object.id, contextAnnotationOpacity(object.classification)]));
const asteroidIds = SCENE_OBJECTS.filter(object => object.classification === 'asteroid').map(object => object.id);
// Phones get a lighter scene: no celestial sky cube, and no ordinary asteroid markers (see discoveryVisibility).
const phone = globalThis.matchMedia?.(MOBILE_VIEWPORT_QUERY).matches === true;
const ordinaryAsteroidIds = SCENE_OBJECTS.filter(object => object.classification === 'asteroid' && !isDefaultContextFeature(object)).map(object => object.id);
const ASTRONOMICAL_UNIT_M = 149_597_870_700;
const minorMoonIds = minorMoonOrbitIds(applicationContext.bodies);
const orbitCenters = new Map(applicationContext.bodies.flatMap(body => 'orbit' in body && body.orbit ? [[body.id, body.orbit.centerBodyId] as const] : []));
const placedStarIds = new Set(SCENE_OBJECTS.filter(object => (object.classification === 'star' || object.classification === 'black-hole') && object.id !== applicationContext.focus.id).map(object => object.id));
/** The placed star an object belongs to, with every body orbiting that star; empty inside the Solar System. */
function placedSystemOf(id: string): ReadonlySet<string> {
  const rootOf = (start: string) => { let current = start; for (let steps = 0; steps <= orbitCenters.size; steps++) { const center = orbitCenters.get(current); if (!center) return current; current = center; } return current; };
  const root = rootOf(id);
  if (!placedStarIds.has(root)) return new Set();
  return new Set([root, ...[...orbitCenters.keys()].filter(member => rootOf(member) === root)]);
}
const hiddenOrbitIds = [
  ...SCENE_OBJECTS.filter(object => !showsDefaultContextOrbit(object)).map(object => object.id),
  ...minorMoonIds,
];
const annotationPriorities = Object.fromEntries([...SCENE_OBJECTS.map(object =>
  [object.id, object.discovery.illustration ? 0 : labelImportance(object.classification, isDefaultContextFeature(object) || object.classification === 'satellite' && !minorMoonIds.includes(object.id), object.discovery.orientationReference ?? 0)]),
  // A body drawn from its astronomy record is a star or planet hosted by a placed star; its tier is that role in its host's
  // system, the one a catalogued planet of that system has.
  ...applicationContext.bodies.filter(body => 'unpackaged' in body && body.unpackaged === true).map(body => [body.id, labelImportance('planet')])]);

// Inventory of prepared resources, not navigation entries or runtime generators.
type ApplicationUniverse = ReturnType<typeof createPreparedUniverse> & {
  loadShells(): Promise<{ payload: Awaited<ReturnType<typeof loadPreparedCssSurfaceShell>>; resolveResource(path: string): string }[]>;
  catalogSources(): Awaited<ReturnType<typeof loadFocusCatalogs>>['galaxies']['sources'];
};
let universePromise: Promise<ApplicationUniverse> | null = null;
function loadApplicationUniverse(): Promise<ApplicationUniverse> {
  universePromise ??= (async () => {
    let catalogs: Awaited<ReturnType<typeof loadFocusCatalogs>> | null = null;
    let catalogsLoading: Promise<Awaited<ReturnType<typeof loadFocusCatalogs>>> | null = null;
    const loadCatalogs = () => catalogs ? Promise.resolve(catalogs) : catalogsLoading ??= loadFocusCatalogs(document, location.origin)
      .then(value => catalogs = value).finally(() => { catalogsLoading = null; });
    // Only the context objects' folders are globbed; bodies share src/objects but are not world resources.
    const descriptors = CONTEXT_OBJECT_DESCRIPTORS, assets = CONTEXT_OBJECT_ASSET_URLS;
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
    const backgroundPointSet = resourceSet('nearby-universe');
    const [volume, pointAppearance] = await Promise.all([
      loadPreparedCssVolume(volumeSet.descriptor, volumeSet.transport),
      loadPreparedPointAppearance(starSet.descriptor, starSet.transport),
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
    const imageLayerDescriptors = Object.values(descriptors).map(parseObjectDescriptor).filter(descriptor => descriptor.type === 'image-layer-bank')
      .map(parseImageLayerBankDescriptor);
    const imageLayerBanks = imageLayerDescriptors.map(descriptor => ({ id: descriptor.id, frame: descriptor.frame }));
    const loadImageLayer = createInFlightLoader(async (id: string) => {
      const descriptor = imageLayerDescriptors.find(candidate => candidate.id === id);
      if (!descriptor) throw new TypeError(`Unknown prepared image-layer bank: ${id}.`);
      const set = resourceSet(id);
      return { payload: await loadPreparedCssImageLayers(set.descriptor, set.transport),
        resolveResource: (path: string) => set.resolve(`prepared/${path}`) };
    });
    const sprites = Object.fromEntries(Object.entries(PREPARED_NAVIGATION_MARKERS)
      .map(([id, sprite]) => [id, { ...contextMarkerSprite(sprite),
        minimumDiameterPixels: asteroidIds.includes(id) ? 2 : 2.4 }]));
    // Volume lens banks (nebulae, discs, shells) are identified from their descriptor alone, at no
    // fetch cost; their prepared payload — the same 27 MB raw / ~3.12 MB brotli across all ten of them
    // that used to block the first frame — is fetched per bank, memoised, only once that bank is
    // selected or comes into view. This mirrors loadShells' deferral, one bank at a time.
    const volumeLensDescriptors = Object.values(descriptors).map(parseObjectDescriptor)
      .filter(descriptor => descriptor.type === 'volume-lens-bank' && CONTEXT_AVAILABILITY[descriptor.id]?.available);
    const volumeLensBanks = volumeLensDescriptors.map(descriptor => ({ id: descriptor.id, frame: parseDensityVolumeFrame(descriptor.properties.frame) }));
    // Every bank's context visibility and Sun-facing billboard, prepared from those same payloads.
    const lensBillboards = { plan: parseLensBillboards(JSON.parse(lensBillboardText)), atlasUrl: lensBillboardAtlasUrl };
    const loadVolumeLens = createInFlightLoader(async (id: string) => {
      const descriptor = volumeLensDescriptors.find(candidate => candidate.id === id);
      if (!descriptor) throw new TypeError(`Unknown prepared volume lens bank: ${id}.`);
      const set = resourceSet(id), payload = await loadPreparedVolumeLenses(set.descriptor, set.transport);
      return { payload, resolveResource: (path: string) => set.resolve(`prepared/${path}`) };
    });
    // The worker reads its own prepared context. The bounded spatial-star sample is
    // already inside pointAppearance; the complete binary catalogue stays out of the app.
    const plannerSource = APPLICATION_WORLD_PLANNER_SOURCE;
    const catalogBank = { fadeStartDistanceM: galaxyPresentation.fadeStartDistanceM, fullDistanceM: galaxyPresentation.fullDistanceM,
      clusters: { fadeStartDistanceM: clusterPresentation.fadeStartDistanceM, fullDistanceM: clusterPresentation.fullDistanceM } };
    const universe = createPreparedUniverse({ environmentLinks: { 'milky-way': '/sun/?overview=milky-way' }, context: applicationContext, volume, pointAppearance, sprites, imageLayerBanks, loadImageLayer, volumeLensBanks, loadVolumeLens, backgroundPointManifest: backgroundPointSet.resolve('prepared/points.json'), backgroundPointCloud: backgroundPointSet.resolve('prepared/cloud.webp'), annotationPriorities, annotationLandmarks: majorMoonIds(), annotationOpacities, plannerSource, catalogBank,
      distantNavigation: { afterDistanceM: 25 * ASTRONOMICAL_UNIT_M, nonNavigableIds: ordinaryAsteroidIds },
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
    return { ...universe, loadShells,
      catalogSources: () => catalogs ? [...catalogs.galaxies.sources, ...catalogs.clusters.sources, ...catalogs.nebulae.sources] : [],
      assets: {
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
      let releaseOcclusion = () => {};
      let pendingLayer: ReturnType<typeof prepared.mount> | null = null;
      let pendingPlanner: ReturnType<typeof prepared.createFramePlanner> | null = null;
      try {
        await resources.ready;
        if (signal?.aborted) throw signal.reason;
        let contextNavigation: ReturnType<typeof createPreparedContextNavigation> | undefined;
        let refreshWorld = () => false;
        // World presentation lives beside the detail stage, outside its changing object scope.
        const presentationHost = stage.closest<HTMLElement>('.object-world-stage') ?? stage;
        const layer = prepared.mount(stage, { presentationHost, requestPublication: () => refreshWorld(), onSelectGalaxy: object => { void contextNavigation?.select(object); } });
        pendingLayer = layer;
        const occlusion = labelOcclusionFor(stage.ownerDocument);
        const updateOcclusion = () => layer.setLabelBlockers(occlusion.read());
        updateOcclusion();
        releaseOcclusion = occlusion.subscribe(updateOcclusion);
        contextNavigation = createPreparedContextNavigation({ layer, presentation: galaxyPresentation,
          unavailableObjectIds: Object.entries(CONTEXT_AVAILABILITY).filter(([, state]) => !state.available).map(([id]) => id),
          sources: prepared.catalogSources, windowTarget });
        const restoreMoonOrbitPaint = suppressMinorMoonOrbitPaint(presentationHost, minorMoonIds);
        const framePlanner = prepared.createFramePlanner();
        pendingPlanner = framePlanner;
        // On phones the header floats over the top of the scene and the readout rides on the drawer; the camera centres
        // the focus between them. Wider layouts measure these as uncovering nothing of note.
        const viewport = createCameraViewport(stage, stage.ownerDocument.querySelector<HTMLElement>('.object-sidebar'), phone ? {
          above: stage.ownerDocument.querySelector<HTMLElement>('.explorer-shell-header'),
          below: stage.ownerDocument.querySelector<HTMLElement>('.object-view-readout') } : null);
        const minimap = createSpaceMinimapSetting(stage.ownerDocument, error => target.reportError(error));
        const moonLabels = mountCatalogueMoonLabels(presentationHost, applicationContext.bodies, applicationContext.focus, layer.opacityClock);
        let heliosphereEnabled = false, shellsMounted = false, destroyed = false;
        let illustrationModelsEnabled = false;
        let highlightedClassification: string | null = null;
        // Opening a placed star's system, or any member of it, shows that whole system: its star, planets, names and orbits.
        // Discovery keeps a system without imagery off the default map, not out of its own view.
        let openSystem: ReadonlySet<string> = new Set();
        const updateDiscoveryVisibility = () => {
          const visibility = discoveryVisibility(SCENE_OBJECTS, { illustrations: illustrationModelsEnabled, highlighted: highlightedClassification, compact: phone });
          const hiddenBodies = visibility.hiddenBodies.filter(id => !openSystem.has(id)), hiddenLabels = visibility.hiddenLabels.filter(id => !openSystem.has(id));
          const { highlightedBodies } = visibility;
          layer.setHiddenBodies(hiddenBodies);
          layer.setHiddenLabels(hiddenLabels);
          layer.setHighlighted(highlightedBodies);
          minimap.setHiddenBodies(hiddenBodies);
          if (publication) minimap.publish(publication.world, publication.viewport);
        };
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
          moonLabels.publish(world, viewport, layer.labelBudget());
          // The decorative minimap follows a drag at half rate and holds still
          // through a fly-to; release and arrival publish it once.
          if (!flying && (!rotating || (minimapFrame++ & 1) === 0)) minimap.publish(world, viewport);
        };
        let rotating = false, flying = false, minimapFrame = 0;
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
        const inputSurface = stage.ownerDocument.querySelector<HTMLElement>('.object-input-surface');
        // Rotation suppresses hover/picking churn; label placement is continuous.
        const rotationChanged = (event: Event) => {
          const active = event instanceof CustomEvent && (event.detail as { active?: unknown } | null)?.active === true;
          layer.setRotationActive(active);
          rotating = active;
          if (!active && publication) minimap.publish(publication.world, publication.viewport);
        };
        inputSurface?.addEventListener('objectrotationchange', rotationChanged);
        // JPL mission-target asteroids keep circles. Other asteroid markers retain their
        // pick target, with the circle revealed on hover.
        layer.setHiddenIndicators(SCENE_OBJECTS.filter(object => object.classification === 'asteroid' && !isDefaultContextFeature(object)).map(object => object.id));
        updateDiscoveryVisibility();
        layer.setHiddenOrbits(hiddenOrbitIds);
        const diagnostics = DIAGNOSTICS_ENABLED ? createWorldContextDiagnostics(layer, frameQueue, presentationHost !== stage) : null;
        if (diagnostics) Reflect.set(target, '__cssEarthUniverse', diagnostics);
        return { ...layer, viewport, publish,
          setNavigationInFlight(active: boolean) {
            layer.setNavigationInFlight(active);
            if (flying === active) return;
            flying = active;
            if (!active && !destroyed && publication) minimap.publish(publication.world, publication.viewport);
          },
          connectNavigation: contextNavigation.connect,
          suspendFocus: contextNavigation.suspend,
          restoreFocus(url: string | URL) {
            const focus = new URL(url, windowTarget.location.href).searchParams.get('focus');
            if (!focus) return contextNavigation.restore(url);
            return layer.ensureGalaxyCatalog().then(() => contextNavigation!.restore(url)).catch(error => target.reportError(error));
          },
          async selectPreparedFocus(id: string) {
            await layer.ensureGalaxyCatalog();
            const object = layer.resolveGalaxy(id);
            if (!object) return;
            const detailedId = 'detailedObjectId' in object ? object.detailedObjectId : undefined;
            if (detailedId) void layer.ensureImageLayer(detailedId).catch(error => target.reportError(error));
            await contextNavigation.select(object);
          },
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
            const system = placedSystemOf(id);
            if (system.size !== openSystem.size || [...system].some(member => !openSystem.has(member))) { openSystem = system; updateDiscoveryVisibility(); }
            layer.selectObject(id, frame);
            minimap.selectObject(frame);
            moonLabels.selectObject(id);
          },
          setIllustrationModelsEnabled(enabled: boolean) {
            if (destroyed) return;
            illustrationModelsEnabled = enabled === true;
            updateDiscoveryVisibility();
          },
          setMinimapEnabled(enabled: boolean) {
            if (!destroyed) minimap.setEnabled(enabled);
          },
          setThreeDStarsEnabled(enabled: boolean) {
            if (!destroyed) layer.setStellarPointsEnabled(enabled);
          },
          setHighlightedClassification(classification: string | null) {
            if (destroyed) return;
            highlightedClassification = classification;
            updateDiscoveryVisibility();
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
            destroyed = true; publication = null; releaseOcclusion();
            inputSurface?.removeEventListener('objectrotationchange', rotationChanged);
            frameQueue.destroy(); framePlanner.destroy(); stagedFrame = null;
            if (diagnostics && Reflect.get(target, '__cssEarthUniverse') === diagnostics) Reflect.deleteProperty(target, '__cssEarthUniverse');
            contextNavigation?.destroy(); minimap.destroy(); moonLabels.destroy(); restoreMoonOrbitPaint();
            viewport.destroy(); layer.destroy(); resources.destroy();
          },
        };
      } catch (error) { releaseOcclusion(); pendingPlanner?.destroy(); pendingLayer?.destroy(); resources.destroy(); throw error; }
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

export type WorldContextDiagnostics = ReturnType<typeof createWorldContextDiagnostics>;
