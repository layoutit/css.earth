import type { LabelScreenRect } from '../labels/screen-label-layout.js';
import { mountBackgroundPoints } from './background-points.js';
import { createOpacityClock } from '../stars/opacity-clock.js';
import { mountPreparedCssVolume } from '../volume/prepared-volume-runtime.js';
import { validatePreparedCssVolume } from '../volume/validation.js';
import type { PreparedCssVolume } from '../volume/types.js';
import type { SpriteWithUrl } from '../solar-system/heliocentric-sprites.js';
import { logarithmicFade, mountPreparedWorldContext, parsePreparedWorldContext, preparedVolumeOpacity } from './prepared-world-context.js';
import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import type { PreparedPointAppearance } from '../stars/types.js';
import { mountWorldContextPointSource } from './world-context-point-source.js';
import type { PreparedAssets } from '../rendering/prepared-residency.js';
import type { PreparedCssSurfaceShell } from '../shell/types.js';
import { mountPreparedCssSurfaceShell } from '../shell/prepared-shell-runtime.js';
import { mountPreparedCssSky } from '../sky/prepared-sky-runtime.js';
import type { OrbitRenderer } from '../solar-system/prepared-orbit-lines.js';
import { mountEnvironmentLabels } from './environment-labels.js';
import { mountPreparedGalaxyCatalog } from './prepared-galaxy-catalog.js';
import { mountPreparedCssImageLayers } from '../image-layers/prepared-image-layer-runtime.js';
import { isPreparedCluster, type PreparedCatalogObject } from '@cssearth/catalog';
import type { PreparedNavigationFocus } from '../navigation/prepared-focus.js';
import { detailedFocusContextOpacity } from './detailed-focus-context.js';
import type { PreparedCssImageLayers } from '../image-layers/loader.js';
import { createPreparedVolumeLenses } from '../volume/prepared-volume-lenses.js';
import type { PreparedVolumeLenses } from '../volume/prepared-volume-lenses.js';
import { DEFAULT_POINT_VISIBILITY, projectedVolumeOpacity, volumeFramingRadiusUnits } from '../volume/projected-volume-visibility.js';
import type { PreparedPointVisibility } from '../volume/projected-volume-visibility.js';
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { WorldPlannerSource } from './world-context-planner-client.js';
import type { WorldContextPublication } from './world-context-frame.js';
import { createWorldContextPlannerClient } from './world-context-planner-client.js';
import { prefetchPreparedResources } from '../rendering/prepared-prefetch.js';
import { createLabelBudget } from '../labels/universe-label-policy.js';

/** Prepared, route-independent surroundings. One application owner holds the decoded bank and DOM. */
// Galaxy files download from this fraction of the volume's fade-start distance:
// about five doubling wheel steps before the first slice is drawn.
const GALAXY_PREFETCH_RATIO = 1 / 32;
/** Hidden, unsubscribed lens banks are retained only within this measured DOM budget. */
export const WARM_VOLUME_LENS_DOM_NODE_BUDGET = 5_000;

type PreparedImageLayerBank = { payload: PreparedCssImageLayers; resolveResource(path: string): string };
type PreparedCatalogBank = { payload: unknown; galaxySample?: unknown; nebulae?: unknown; fadeStartDistanceM: number; fullDistanceM: number;
  clusters?: { payload: unknown; fadeStartDistanceM: number; fullDistanceM: number } };

export function createPreparedUniverse({ context, volume, pointAppearance, resolvePointResource, resolveResource, sprites, shells = [], imageLayers = [], imageLayerBanks = [], loadImageLayer, volumeLensBanks = [], loadVolumeLens, warmVolumeLensDomNodeBudget = WARM_VOLUME_LENS_DOM_NODE_BUDGET, backgroundPointManifest, backgroundPointCloud, backgroundPointSha256, environmentLinks, catalog, catalogBank, loadCatalog, annotationPriorities, annotationOpacities, plannerSource }: {
  backgroundPointManifest?: string; backgroundPointCloud?: string; backgroundPointSha256?: string;
  context: unknown; volume: PreparedCssVolume; pointAppearance: PreparedPointAppearance;
  /** The same prepared context as files the planner worker reads itself. */
  plannerSource?: WorldPlannerSource;
  resolvePointResource(path: string): string; resolveResource(path: string): string;
  sprites: Readonly<Record<string, SpriteWithUrl>>;
  annotationPriorities?: Readonly<Record<string, number>>;
  annotationOpacities?: Readonly<Record<string, { line: number; label: number }>>;
  shells?: readonly { payload: PreparedCssSurfaceShell; resolveResource(path: string): string }[];
  environmentLinks?: Readonly<Record<string, string>>;
  imageLayers?: readonly PreparedImageLayerBank[];
  /** Descriptor-only image banks. Their JSON and DOM are admitted only on projected visibility or explicit focus. */
  imageLayerBanks?: readonly { id: string; frame: DensityVolumeFrame }[];
  loadImageLayer?(id: string): Promise<PreparedImageLayerBank>;
  /** Volume lens banks are identified and framed from their descriptor alone; their heavy prepared
   * payload (all lenses, plus catalogue points) is fetched only through {@link loadVolumeLens}, the
   * first time a bank is selected or comes into view. Nothing here downloads at construction time. */
  volumeLensBanks?: readonly { id: string; frame: DensityVolumeFrame }[];
  loadVolumeLens?(id: string): Promise<Parameters<typeof createPreparedVolumeLenses>[0]>;
  /** Testable cap for hidden banks with no active navigation subscriber. */
  warmVolumeLensDomNodeBudget?: number;
  catalog?: PreparedCatalogBank;
  /** Fade metadata is sufficient to gate the catalogue without fetching or parsing its records. */
  catalogBank?: Omit<PreparedCatalogBank, 'payload' | 'galaxySample' | 'nebulae' | 'clusters'> & {
    clusters?: Omit<NonNullable<PreparedCatalogBank['clusters']>, 'payload'> };
  loadCatalog?(): Promise<PreparedCatalogBank>;
}) {
  const plan = parsePreparedWorldContext(context), payload = validatePreparedCssVolume(volume);
  if (!Number.isSafeInteger(warmVolumeLensDomNodeBudget) || warmVolumeLensDomNodeBudget < 0) {
    throw new TypeError('Warm volume lens DOM node budget must be a non-negative integer.');
  }
  if (payload.id !== plan.volume.objectId || pointAppearance.id !== plan.stars.objectId ||
      [payload, pointAppearance].some(data => data.frame.referenceFrame !== plan.frame.referenceFrame || data.frame.epochJdTt !== plan.frame.epochJdTt)) {
    throw new TypeError('Context, volume and point appearance must share their prepared identities and epoch.');
  }
  const pool = `volume:${payload.id}`, pointPool = `focus-point:${pointAppearance.id}`;
  // The baked-star cube is the sole sky background until the volume takes over.
  const skyPaths = new Set([...payload.sky?.faces ?? [], ...payload.sky?.nearFaces ?? []].map(face => face.texturePath));
  const startupSkyPaths = new Set((payload.sky?.nearFaces ?? payload.sky?.faces)?.map(face => face.texturePath) ?? []);
  const entries = payload.resources.map(resource => ({ key: `${pool}:${resource.path}`, url: resolveResource(resource.path), pool }));
  const pointEntries = pointAppearance.resources.filter(resource => resource.path === pointAppearance.atlas.path).map(resource => ({
    key: `${pointPool}:${resource.path}`, url: resolvePointResource(resource.path), pool: pointPool }));
  const shellEntries = shells.flatMap(({ payload, resolveResource }) => {
    if (payload.frame.referenceFrame !== plan.frame.referenceFrame || payload.frame.epochJdTt !== plan.frame.epochJdTt) {
      throw new TypeError('Prepared shells must share the universe reference frame and epoch.');
    }
    return payload.resources.map(resource => ({ key: `shell:${payload.id}:${resource.path}`,
      url: resolveResource(resource.path), pool: `shell:${payload.id}` }));
  });
  const declaredImageLayers = imageLayerBanks.length ? imageLayerBanks : imageLayers.map(({ payload }) => ({ id: payload.id, frame: payload.frame }));
  const initialImageLayers = new Map(imageLayers.map(bank => [bank.payload.id, bank]));
  if (new Set(declaredImageLayers.map(bank => bank.id)).size !== declaredImageLayers.length) throw new TypeError('Prepared image-layer identities must be unique.');
  const imageEntries = imageLayers.flatMap(({ payload, resolveResource }) => {
    if (payload.frame.referenceFrame !== plan.frame.referenceFrame || payload.frame.epochJdTt !== plan.frame.epochJdTt) {
      throw new TypeError('Prepared image models must share the universe reference frame and epoch.');
    }
    return payload.resources.map(resource => ({ key: `image-layers:${payload.id}:${resource.path}`,
      url: resolveResource(resource.path), pool: `image-layers:${payload.id}` }));
  });
  // A bank's frame is validated against its authored descriptor at load time (loadPreparedVolumeLenses);
  // this only catches a descriptor wired to the wrong universe before any network request is made.
  for (const bank of [...declaredImageLayers, ...volumeLensBanks]) {
    if (bank.frame.referenceFrame !== plan.frame.referenceFrame || bank.frame.epochJdTt !== plan.frame.epochJdTt) {
      throw new TypeError('Prepared volume lens banks must share the universe reference frame and epoch.');
    }
  }
  // Each galaxy's slices stand for it only while it spans pixels; below that its label does.
  const volumeFramingUnits = volumeFramingRadiusUnits(payload.frame);
  const imageFramingUnits = declaredImageLayers.map(({ frame }) => volumeFramingRadiusUnits(frame));
  const assets: PreparedAssets = {
    entries: [...entries, ...pointEntries, ...shellEntries, ...imageEntries],
    pools: [{ id: pool, retention: 'mount', capacity: entries.length, concurrency: 8, reuse: false, decoding: 'async' },
      { id: pointPool, retention: 'mount', capacity: pointEntries.length, concurrency: 8, reuse: false, decoding: 'async' },
      ...shells.map(({ payload }) => ({ id: `shell:${payload.id}`, retention: 'mount' as const,
        capacity: payload.resources.length, concurrency: 2, reuse: false, decoding: 'async' as const })),
      ...imageLayers.map(({ payload }) => ({ id: `image-layers:${payload.id}`, retention: 'mount' as const,
        capacity: payload.resources.length, concurrency: 4, reuse: false, decoding: 'async' as const }))],
    // Only the baked backdrop decodes at startup; the Sun atlas loads through its one marker.
    // Galaxy slices, image layers, lens banks and shells appear far away; the
    // browser decodes them again for raster when first drawn, so decoding them
    // here spent seconds and hundreds of megabytes that were never reused.
    startup: entries.filter(entry => startupSkyPaths.has(entry.key.slice(pool.length + 1))).map(entry => entry.key),
  };
  // Warm the galaxy backdrop before its handoff. Nebula lenses own their image
  // demand: crossing this distance must not fetch every distant/inactive lens.
  const galaxyUrls = entries.filter(entry => !skyPaths.has(entry.key.slice(pool.length + 1)))
    .map(entry => entry.url);
  const galaxyPrefetchDistanceM = (plan.volume.opacityProfile?.fadeStartDistanceM ?? plan.volume.fadeStartDistanceM) * GALAXY_PREFETCH_RATIO;
  return Object.freeze({ assets,
    createFramePlanner: () => createWorldContextPlannerClient(plan, undefined, annotationPriorities, plannerSource),
    mount(stage: HTMLElement, { onSelectGalaxy, requestPublication, presentationHost = stage }: {
      onSelectGalaxy?: (object: PreparedCatalogObject) => void; requestPublication?: () => boolean;
      /** Stationary world presentation, outside the selected detail's CSS scope. */
      presentationHost?: HTMLElement;
    } = {}) {
      const document = stage.ownerDocument;
      const opacityClock = createOpacityClock(document.defaultView!);
      const root = document.createElement('div');
      root.className = 'prepared-universe';
      // Keep the background below every depth-sorted body in the isolated stage.
      root.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:${-plan.bodies.length - 2}`;
      presentationHost.insertBefore(root, presentationHost.firstChild);
      // A bank whose every voxel lies between the observer and the body it surrounds composites over the
      // detail scene instead of behind it. Two flattened roots cannot interleave, so the payload declares
      // which side its data is on and the universe mounts it there; nothing is reordered at runtime.
      const frontRoot = document.createElement('div');
      frontRoot.className = 'prepared-universe-front';
      frontRoot.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1';
      presentationHost.appendChild(frontRoot);
      const frontEnd = document.createElement('span'); frontEnd.hidden = true; frontRoot.appendChild(frontEnd);
      const end = document.createElement('span'); end.hidden = true; root.appendChild(end);
      const volumeHost = document.createElement('div');
      volumeHost.className = 'prepared-volume-context';
      // A transparent volume still lays out and composites every 3D slice; an
      // invisible context leaves layout entirely until its opacity is positive.
      volumeHost.style.cssText = 'position:absolute;inset:0;pointer-events:none;display:none';
      volumeHost.style.background = '#000';
      volumeHost.style.transformStyle = 'flat';
      root.insertBefore(volumeHost, end);
      const volumeImage = document.createElement('div');
      volumeImage.className = 'prepared-volume-image';
      volumeImage.style.cssText = 'position:absolute;inset:0;pointer-events:none';
      volumeImage.style.transformStyle = 'flat';
      volumeHost.appendChild(volumeImage);
      const volumeEnd = document.createElement('span'); volumeEnd.hidden = true; volumeImage.appendChild(volumeEnd);
      const additionalPoints = mountBackgroundPoints(root, end, backgroundPointManifest, backgroundPointCloud, backgroundPointSha256);
      let volumeLayer: ReturnType<typeof mountPreparedCssVolume> | null = null;
      let skyLayer: ReturnType<typeof mountPreparedCssSky> | null = null;
      let spatial: ReturnType<typeof mountPreparedWorldContext> | null = null;
      let labelBudget = createLabelBudget(0, 0);
      let labelBlockers: readonly LabelScreenRect[] = [];
      let overview = false;
      let selectionPreview: string | null | undefined;
      let focusPoint: ReturnType<typeof mountWorldContextPointSource> = null;
      let environmentLabels: ReturnType<typeof mountEnvironmentLabels> | null = null;
      let galaxyCatalog: ReturnType<typeof mountPreparedGalaxyCatalog> | null = null;
      const imageBanks: (ReturnType<typeof mountPreparedCssImageLayers> | null)[] = declaredImageLayers.map(() => null);
      const imageLoading: (Promise<void> | null)[] = declaredImageLayers.map(() => null);
      let catalogPayload = catalog;
      let catalogLoading: Promise<void> | null = null;
      let prefetchGalaxy = (_distanceM: number) => {};
      const prefetchAbort = new AbortController();
      // One slot per declared bank. A slot starts empty (no payload fetched yet) and is filled in
      // place the first time the bank is selected or its proxy framing (from the descriptor alone)
      // comes into view; nothing here re-sizes these arrays afterwards, only their contents change.
      const lensBanks: (ReturnType<ReturnType<typeof createPreparedVolumeLenses>['mount']> | null)[] = volumeLensBanks.map(() => null);
      const lensPayload: (PreparedVolumeLenses | undefined)[] = volumeLensBanks.map(() => undefined);
      const lensLoading: (Promise<void> | null)[] = volumeLensBanks.map(() => null);
      const lensGeneration = volumeLensBanks.map(() => 0);
      const lensExplicitEnabled: (boolean | undefined)[] = volumeLensBanks.map(() => undefined);
      const lensPendingSelection: (string | undefined)[] = volumeLensBanks.map(() => undefined);
      const lensPendingStarsVisible: (boolean | undefined)[] = volumeLensBanks.map(() => undefined);
      const lensFraming: { frame: DensityVolumeFrame; radiusUnits: number; visibility: PreparedPointVisibility }[] =
        volumeLensBanks.map(bank => ({ frame: bank.frame, radiusUnits: volumeFramingRadiusUnits(bank.frame), visibility: DEFAULT_POINT_VISIBILITY }));
      const publishedBankOpacity = declaredImageLayers.map(() => NaN), publishedLensOpacity = volumeLensBanks.map(() => NaN);
      const lensResidentNodes = volumeLensBanks.map(() => 0), lensVisible = volumeLensBanks.map(() => false);
      const lensLastUsed = volumeLensBanks.map(() => 0), lensSubscribers = volumeLensBanks.map(() => 0);
      let lensUseClock = 0;
      // A cloud that accompanies a body waits for one of that body's datasets to ask for it; every other bank is
      // drawn whenever it is in view, as it always was. Unloaded banks default to "drawn when in view";
      // an accompanying cloud corrects this to disabled the moment its payload identifies it as one.
      const lensEnabled = volumeLensBanks.map(() => true);
      const publishBootstrapResidency = () => {
        root.dataset.imageLayerDeclaredBankCount = String(declaredImageLayers.length);
        root.dataset.imageLayerResidentBankCount = String(imageBanks.filter(Boolean).length);
        root.dataset.imageLayerLoadingBankCount = String(imageLoading.filter(Boolean).length);
        root.dataset.catalogResident = String(Boolean(galaxyCatalog));
        root.dataset.catalogLoading = String(Boolean(catalogLoading));
      };
      const mountCatalog = (bank: PreparedCatalogBank) => {
        if (galaxyCatalog || destroyed) return;
        galaxyCatalog = mountPreparedGalaxyCatalog({ host: root, before: end, payload: bank.payload, galaxySample: bank.galaxySample,
          clusters: bank.clusters?.payload, nebulae: bank.nebulae,
          renderedObjectIds: new Set([...declaredImageLayers.map(image => image.id), ...volumeLensBanks.map(lens => lens.id)]),
          nebulaFrames: new Map(volumeLensBanks.map(lens => [lens.id, lens.frame])), onSelect: onSelectGalaxy, pickingHost: stage });
        publishBootstrapResidency();
      };
      const ensureCatalogLoaded = (): Promise<void> => {
        if (galaxyCatalog) return Promise.resolve();
        if (catalogPayload) { mountCatalog(catalogPayload); return Promise.resolve(); }
        if (!loadCatalog) return Promise.resolve();
        if (catalogLoading) return catalogLoading;
        catalogLoading = loadCatalog().then(bank => {
          catalogPayload = bank;
          mountCatalog(bank);
          requestPublication?.();
        }).finally(() => { catalogLoading = null; publishBootstrapResidency(); });
        publishBootstrapResidency();
        return catalogLoading;
      };
      const ensureImageLayerLoaded = (index: number): Promise<void> => {
        if (imageBanks[index]) return Promise.resolve();
        if (imageLoading[index]) return imageLoading[index]!;
        const declared = declaredImageLayers[index]!;
        const eager = initialImageLayers.get(declared.id);
        const loading = eager ? Promise.resolve(eager) : loadImageLayer?.(declared.id);
        if (!loading) return Promise.resolve();
        imageLoading[index] = loading.then(bank => {
          if (destroyed || imageBanks[index]) return;
          if (bank.payload.id !== declared.id || JSON.stringify(bank.payload.frame) !== JSON.stringify(declared.frame)) {
            throw new TypeError('Prepared image-layer identity/frame mismatch.');
          }
          const mounted = mountPreparedCssImageLayers({ host: root, before: end, ...bank });
          mounted.root.style.display = 'none';
          imageBanks[index] = mounted;
          requestPublication?.();
        }).finally(() => { imageLoading[index] = null; publishBootstrapResidency(); });
        publishBootstrapResidency();
        return imageLoading[index]!;
      };
      const publishLensResidencyMetadata = () => {
        const resident = lensBanks.flatMap((bank, index) => bank ? [index] : []);
        const visible = resident.filter(index => lensVisible[index]);
        const pinned = resident.filter(index => !lensVisible[index] && lensSubscribers[index]! > 0);
        const warm = resident.filter(index => !lensVisible[index] && lensSubscribers[index] === 0);
        root.dataset.volumeLensDeclaredBankCount = String(volumeLensBanks.length);
        root.dataset.volumeLensResidentBankCount = String(resident.length);
        root.dataset.volumeLensVisibleBankCount = String(visible.length);
        root.dataset.volumeLensPinnedBankCount = String(pinned.length);
        root.dataset.volumeLensWarmBankCount = String(warm.length);
        root.dataset.volumeLensPinnedDomNodes = String(pinned.reduce((nodes, index) => nodes + lensResidentNodes[index]!, 0));
        root.dataset.volumeLensWarmDomNodes = String(warm.reduce((nodes, index) => nodes + lensResidentNodes[index]!, 0));
        root.dataset.volumeLensWarmDomNodeBudget = String(warmVolumeLensDomNodeBudget);
      };
      const updateLensWeight = (index: number) => {
        const bank = lensBanks[index];
        if (!bank) { lensResidentNodes[index] = 0; return; }
        lensResidentNodes[index] = Number(bank.root.dataset.volumeResidentDomNodes) || 1;
      };
      const evictLens = (index: number) => {
        const bank = lensBanks[index];
        if (!bank || lensVisible[index] || lensSubscribers[index]! > 0) return false;
        bank.destroy();
        lensBanks[index] = null; lensPayload[index] = undefined; lensResidentNodes[index] = 0;
        publishedLensOpacity[index] = NaN; lensGeneration[index]++;
        return true;
      };
      const trimWarmLensResidency = () => {
        const warm = lensBanks.flatMap((bank, index) => bank && !lensVisible[index] && lensSubscribers[index] === 0 ? [index] : []);
        let nodes = warm.reduce((total, index) => total + lensResidentNodes[index]!, 0);
        for (const index of warm.sort((left, right) => lensLastUsed[left]! - lensLastUsed[right]!)) {
          if (nodes <= warmVolumeLensDomNodeBudget) break;
          const weight = lensResidentNodes[index]!;
          if (evictLens(index)) nodes -= weight;
        }
        publishLensResidencyMetadata();
      };
      /** Fetch and mount one bank while resident. Concurrent callers share only this in-flight work;
       * once an evicted bank is requested again, the application loader provides a fresh decoded payload. */
      const ensureLensLoaded = (index: number): Promise<void> => {
        if (lensBanks[index] || lensLoading[index]) return lensLoading[index] ?? Promise.resolve();
        const descriptor = volumeLensBanks[index]!;
        if (!loadVolumeLens) return Promise.resolve();
        const generation = lensGeneration[index];
        const loading = loadVolumeLens(descriptor.id).then(options => {
          if (destroyed || generation !== lensGeneration[index] || lensBanks[index]) return;
          const frame = options.payload.lenses[0]!.volume.frame;
          if (frame.referenceFrame !== plan.frame.referenceFrame || frame.epochJdTt !== plan.frame.epochJdTt) {
            throw new TypeError('Prepared volume lenses must share the universe reference frame and epoch.');
          }
          const pendingLens = lensPendingSelection[index];
          if (pendingLens !== undefined && !options.payload.lenses.some(lens => lens.id === pendingLens)) {
            throw new TypeError(`Unknown prepared volume lens: ${pendingLens}.`);
          }
          const bank = createPreparedVolumeLenses(options);
          const mounted = bank.mount({ host: root, before: end, frontHost: frontRoot, frontBefore: frontEnd });
          try {
            mounted.root.style.display = 'none';
            if (pendingLens !== undefined) mounted.selectLens(pendingLens);
            if (lensPendingStarsVisible[index] !== undefined) mounted.setStarsVisible(lensPendingStarsVisible[index]!);
          } catch (error) { mounted.destroy(); throw error; }
          if (destroyed || generation !== lensGeneration[index]) { mounted.destroy(); return; }
          lensBanks[index] = mounted; lensPayload[index] = bank.payload;
          lensFraming[index] = { frame, radiusUnits: bank.payload.framingRadiusUnits, visibility: bank.payload.pointVisibility! };
          lensEnabled[index] = lensExplicitEnabled[index] ?? bank.payload.attachedTo === undefined;
          lensLastUsed[index] = ++lensUseClock; publishedLensOpacity[index] = NaN;
          updateLensWeight(index); trimWarmLensResidency();
          requestPublication?.();
        }).finally(() => {
          if (lensLoading[index] === loading) lensLoading[index] = null;
        });
        lensLoading[index] = loading;
        return loading;
      };
      const shellLayers: ReturnType<typeof mountPreparedCssSurfaceShell>[] = [];
      const mountedShells = [...shells];
      let selected = plan.focus;
      let detailedFocus: { objectId: string; focus: PreparedNavigationFocus } | null = null;
      let detailContextOpacity = 1;
      let destroyed = false;
      let highContrastSky = false, volumeOpacity = 0, volumeBrightness = 1, volumeSize = 1;
      let publishedVolumeAlpha = NaN, publishedImageAlpha = NaN, publishedSkyAlpha = NaN;
      let publishedVolumeOpacity = NaN, publishedVolumeBrightness = NaN;
      let publishedVolumeVisible: boolean | undefined, publishedScale = '';
      // The baked star cube holds the Sun's near stars. As the camera leaves the Sun's neighbourhood the 3D star field takes
      // over those stars at their catalogue positions; the star cube, which would show them from the wrong place, hands the
      // background to the plain Milky Way cube, which still holds from another star.
      let starsHandoff = 0;
      const publishBackground = () => {
        const brightness = highContrastSky ? 1 : volumeBrightness;
        // The completed images contribute (1-t)*sky + t*b*volume. Factoring
        // t*b onto the volume avoids nesting its exposure inside its handoff.
        // Compensate the opaque sky underlay so its contribution stays 1-t,
        // including when close-up presentation suppresses the surrounding volume.
        const alpha = (skyLayer ? volumeOpacity * brightness : volumeOpacity) * detailContextOpacity;
        if (alpha !== publishedVolumeAlpha) { volumeHost.style.opacity = String(alpha); publishedVolumeAlpha = alpha; }
        // The galaxy's own slices fade with its projected size; the matte and sky handoff do not.
        const imageAlpha = (skyLayer ? 1 : brightness) * volumeSize;
        if (imageAlpha !== publishedImageAlpha) {
          volumeImage.style.opacity = skyLayer && imageAlpha === 1 ? '' : String(imageAlpha);
          volumeImage.style.display = imageAlpha > 0 ? '' : 'none';
          publishedImageAlpha = imageAlpha;
        }
        const skyAlpha = alpha < 1 ? (1 - volumeOpacity) / (1 - alpha) : 0;
        if (skyLayer && skyAlpha !== publishedSkyAlpha) { skyLayer.root.style.opacity = String(skyAlpha); publishedSkyAlpha = skyAlpha; }
      };
      const destroy = () => {
        if (destroyed) return;
        destroyed = true;
        for (let index = 0; index < lensGeneration.length; index++) lensGeneration[index]++;
        prefetchAbort.abort();
        volumeLayer?.destroy(); skyLayer?.destroy(); spatial?.destroy(); focusPoint?.destroy(); environmentLabels?.destroy();
        for (const shell of shellLayers) shell.destroy();
        for (const bank of imageBanks) bank?.destroy(); galaxyCatalog?.destroy();
        for (const bank of lensBanks) bank?.destroy();
        additionalPoints.destroy();
        opacityClock.destroy();
        root.remove(); frontRoot.remove();
        delete stage.dataset.contextScale;
      };
      try {
        if (payload.sky) skyLayer = mountPreparedCssSky({ host: root, before: volumeHost, payload: payload.sky, resources: payload.resources, resolveResource });
        volumeLayer = mountPreparedCssVolume({ host: volumeImage, before: volumeEnd, payload, resolveResource });
        for (const [index, bank] of declaredImageLayers.entries()) if (initialImageLayers.has(bank.id)) void ensureImageLayerLoaded(index);
        // Image and volume lens banks mount lazily; far layers have no payload or DOM until admitted.
        let galaxyPrefetched = false;
        prefetchGalaxy = (distanceM: number) => {
          if (galaxyPrefetched || distanceM < galaxyPrefetchDistanceM) return;
          galaxyPrefetched = true;
          const target = document.defaultView;
          if (typeof target?.fetch !== 'function') return;
          void prefetchPreparedResources(galaxyUrls, target.fetch.bind(target), prefetchAbort.signal);
        };
        for (const shell of shells) shellLayers.push(mountPreparedCssSurfaceShell({ host: root, before: end, ...shell }));
        // Picking and navigation stay on the detail stage's input owner. Billboards
        // share its viewport and depth band from outside its changing CSS scope.
        spatial = mountPreparedWorldContext({ host: stage, presentationHost, before: root, plan, sprites, requestPublication, annotationPriorities, annotationOpacities, opacityClock });
        const bodyAnnotations = spatial.inspect();
        focusPoint = mountWorldContextPointSource({ host: root, before: end, plan, field: pointAppearance, resolveResource: resolvePointResource, pickingHost: stage });
        environmentLabels = mountEnvironmentLabels({ host: root, before: end, volume: payload, shells: shells.map(shell => shell.payload), links: environmentLinks, pickingHost: stage, opacityClock });
        if (catalogPayload) mountCatalog(catalogPayload);
        publishBootstrapResidency();
        publishLensResidencyMetadata();
        return Object.freeze({ root, roots: Object.freeze([root, spatial.root]), destroy, opacityClock,
          /** Mount an optional prepared shell after startup, the first time it is enabled. */
          addShell(shell: { payload: PreparedCssSurfaceShell; resolveResource(path: string): string }) {
            if (destroyed) return;
            if (shell.payload.frame.referenceFrame !== plan.frame.referenceFrame || shell.payload.frame.epochJdTt !== plan.frame.epochJdTt) {
              throw new TypeError('Prepared shells must share the universe reference frame and epoch.');
            }
            shellLayers.push(mountPreparedCssSurfaceShell({ host: root, before: end, ...shell }));
            mountedShells.push(shell);
            environmentLabels!.addShell(shell.payload);
            requestPublication?.();
          },
          selectGalaxy(id: string | null, focus: PreparedNavigationFocus | null = null) {
            if (focus && (focus.id !== id || !Number.isFinite(focus.framingRadiusM) || focus.framingRadiusM <= 0 ||
                focus.positionM.length !== 3 || !focus.positionM.every(Number.isFinite))) {
              throw new TypeError('Prepared context focus must match its selection and have finite authored framing.');
            }
            const record = id ? galaxyCatalog?.resolve(id) : null;
            const objectId = record && !isPreparedCluster(record) ? record.detailedObjectId : undefined;
            const next = focus && objectId && [...declaredImageLayers, ...volumeLensBanks].some(bank => bank.id === objectId)
              ? { objectId, focus } : null;
            const changed = next?.objectId !== detailedFocus?.objectId || next?.focus.framingRadiusM !== detailedFocus?.focus.framingRadiusM ||
              next?.focus.positionM.some((value, axis) => value !== detailedFocus?.focus.positionM[axis]);
            detailedFocus = next;
            galaxyCatalog?.select(id);
            if (changed) requestPublication?.();
          },
          resolveGalaxy(id: string) { return galaxyCatalog?.resolve(id) ?? null; },
          ensureGalaxyCatalog: ensureCatalogLoaded,
          ensureImageLayer(id: string) {
            const index = declaredImageLayers.findIndex(bank => bank.id === id);
            return index < 0 ? Promise.resolve() : ensureImageLayerLoaded(index);
          },
          /** Await the shared loader so focus consumers can use the payload's authored framing and report failures. */
          ensureVolumeLens(id: string) {
            const index = volumeLensBanks.findIndex(bank => bank.id === id);
            if (index < 0) return Promise.reject(new TypeError('Unknown prepared volume lens bank.'));
            return ensureLensLoaded(index);
          },
          imageLayerFrames: Object.freeze(Object.fromEntries(declaredImageLayers.map(bank => [bank.id, bank.frame]))),
          // Framing is exact once a bank's payload has loaded; until then it falls back to the radius that
          // holds the descriptor's own prepared bounds, the same estimate image-layer banks always use.
          // A getter, not a snapshot: framing starts as the descriptor's own bounds and is replaced by
          // the bank's declared framing radius the moment its payload loads (see ensureLensLoaded).
          get volumeLensFrames() {
            return Object.fromEntries(volumeLensBanks.map((bank, index) =>
              [bank.id, { frame: lensFraming[index]!.frame, framingRadiusUnits: lensFraming[index]!.radiusUnits }]));
          },
          volumeLensState(id: string) {
            const index = volumeLensBanks.findIndex(bank => bank.id === id);
            return index < 0 ? null : lensBanks[index]?.state() ?? null;
          },
          /** Draw or hide a cloud that accompanies a body. A free-standing cloud ignores this; it is always drawn. */
          setVolumeLensEnabled(id: string, enabled: boolean) {
            if (destroyed || typeof enabled !== 'boolean') return;
            const index = volumeLensBanks.findIndex(bank => bank.id === id);
            if (index < 0) return;
            const payload = lensPayload[index];
            if (!payload) {
              // Unknown until loaded whether this bank even accepts the toggle; remember the request and
              // apply it only if the fetched bank turns out to be an accompanying cloud.
              lensExplicitEnabled[index] = enabled;
              void ensureLensLoaded(index).catch(() => {});
              return;
            }
            if (payload.attachedTo === undefined || lensEnabled[index] === enabled) return;
            lensEnabled[index] = enabled;
            requestPublication?.();
          },
          selectVolumeLens(id: string, lens: string) {
            const index = volumeLensBanks.findIndex(bank => bank.id === id);
            if (index < 0) throw new TypeError('Unknown prepared volume lens bank.');
            lensPendingSelection[index] = lens;
            lensLastUsed[index] = ++lensUseClock;
            const bank = lensBanks[index];
            if (bank) {
              bank.selectLens(lens); updateLensWeight(index); trimWarmLensResidency(); return;
            }
            void ensureLensLoaded(index).catch(() => {});
          },
          setVolumeStarsVisible(id: string, enabled: boolean) {
            const index = volumeLensBanks.findIndex(bank => bank.id === id);
            if (index < 0) throw new TypeError('Unknown prepared volume lens bank.');
            if (typeof enabled !== 'boolean') throw new TypeError('Catalogue point visibility must be a boolean.');
            lensPendingStarsVisible[index] = enabled;
            const bank = lensBanks[index];
            if (bank) { bank.setStarsVisible(enabled); return; }
            void ensureLensLoaded(index).catch(() => {});
          },
          subscribeVolumeLens(id: string, listener: (state: ReturnType<NonNullable<(typeof lensBanks)[number]>['state']>) => void) {
            const index = volumeLensBanks.findIndex(bank => bank.id === id);
            if (index < 0) return () => {};
            lensSubscribers[index]++;
            lensLastUsed[index] = ++lensUseClock;
            publishLensResidencyMetadata();
            let released = false;
            const release = () => {
              if (released) return;
              released = true; lensSubscribers[index]--;
              trimWarmLensResidency();
            };
            const existing = lensBanks[index];
            if (existing) {
              const liveUnsubscribe = existing.subscribe(listener);
              return () => { liveUnsubscribe(); release(); };
            }
            // Not loaded yet: fetch it, then hand the caller a real subscription and one immediate
            // notification so a listener that only reacts to change events still learns the bank is ready.
            let cancelled = false, liveUnsubscribe: (() => void) | null = null;
            void ensureLensLoaded(index).then(() => {
              if (cancelled || destroyed) return;
              const mounted = lensBanks[index];
              if (!mounted) return;
              liveUnsubscribe = mounted.subscribe(listener);
              listener(mounted.state());
            }).catch(() => {});
            return () => { cancelled = true; liveUnsubscribe?.(); release(); };
          },
          captureFrame(world: WorldCameraPose, viewport: WorldCameraViewport) {
            return spatial!.captureFrame(world, viewport);
          },
          previewSelection(id?: string | null) { selectionPreview = id; spatial!.previewSelection(id); },
          setOverview(enabled: boolean) { overview = enabled; spatial!.setOverview(enabled); },
          setHighContrastSky(enabled: boolean) {
            if (destroyed || highContrastSky === enabled) return;
            highContrastSky = enabled;
            publishBackground();
          },
          setNavigationInFlight(active: boolean) { spatial!.setNavigationInFlight(active); focusPoint?.setNavigationEnabled(!active); },
          setHiddenOrbits(ids: readonly string[]) { spatial!.setHiddenOrbits(ids); },
          setOrbitRenderer(renderer: OrbitRenderer) { spatial!.setOrbitRenderer(renderer); },
          setHiddenBodies(ids: readonly string[]) { spatial!.setHiddenBodies(ids); },
          setHiddenLabels(ids: readonly string[]) { spatial!.setHiddenLabels(ids); },
          setSuppressedLabels(ids: readonly string[]) { spatial!.setSuppressedLabels(ids); },
          setRotationActive(active: boolean) { spatial!.setRotationActive(active); },
          setHiddenIndicators(ids: readonly string[]) { spatial!.setHiddenIndicators(ids); },
          setHighlighted(ids: readonly string[]) { spatial!.setHighlighted(ids); },
          setLabelBlockers(rects: readonly LabelScreenRect[]) { labelBlockers = rects; spatial!.setLabelBlockers(rects); },
          labelBudget() { return labelBudget; },
          inspect() {
            return Object.freeze({ opacity: spatial!.opacityStats(), publication: spatial!.publicationStats(), bodies: spatial!.inspect(), environmentLabels: environmentLabels!.inspect(), galaxies: galaxyCatalog?.inspect(),
              foregroundLabelExclusions: [...spatial!.backgroundExclusionRects(), ...environmentLabels!.labelExclusionRects()] });
          },
          selectObject(id: string, frame: PreparedWorldCameraFrame) {
            const body = [plan.focus, ...plan.bodies].find(body => body.id === id);
            if (!body || frame.referenceFrame !== plan.frame.referenceFrame || frame.epochJdTt !== plan.frame.epochJdTt ||
                frame.bodyRadiusM !== body.radiusM || !body.positionM.every((value, axis) => Math.abs(value - frame.originM[axis]) < .001)) {
              throw new TypeError('Selected detail does not match its prepared world context.');
            }
            selected = body;
            spatial!.selectObject(id);
            root.dataset.selectedObject = id;
          },
          publish(world: WorldCameraPose, viewport: WorldCameraViewport, shellVisibility: Readonly<Record<string, boolean>> = {}, frame?: WorldContextPublication) {
            if (destroyed) return;
            opacityClock.batch(() => {
            const distanceM = Math.hypot(...world.pose.positionM.map((value, axis) => value - plan.focus.positionM[axis]));
            detailContextOpacity = detailedFocusContextOpacity(world, detailedFocus?.focus ?? null);
            if (detailContextOpacity > 0) prefetchGalaxy(distanceM);
            additionalPoints.publish({world, viewport}, distanceM);
            const fade = logarithmicFade(distanceM, plan.volume.fadeStartDistanceM, plan.volume.fullDistanceM);
            starsHandoff = logarithmicFade(distanceM, plan.stars.fadeStartDistanceM, plan.stars.fullDistanceM);
            volumeOpacity = preparedVolumeOpacity(distanceM, plan.volume.opacityProfile);
            volumeBrightness = preparedVolumeOpacity(distanceM, plan.volume.brightnessProfile);
            volumeSize = projectedVolumeOpacity(world, viewport, payload.frame, volumeFramingUnits);
            const volumeVisible = volumeOpacity * detailContextOpacity > 0;
            if (volumeVisible !== publishedVolumeVisible) { volumeHost.style.display = volumeVisible ? '' : 'none'; publishedVolumeVisible = volumeVisible; }
            if (volumeOpacity !== publishedVolumeOpacity) {
              volumeHost.dataset.volumeOpacity = String(volumeOpacity);
              if (skyLayer) skyLayer.root.dataset.skyContribution = String(1 - volumeOpacity);
              publishedVolumeOpacity = volumeOpacity;
            }
            if (volumeBrightness !== publishedVolumeBrightness) {
              volumeImage.dataset.volumeBrightness = String(volumeBrightness); publishedVolumeBrightness = volumeBrightness;
            }
            publishBackground();
            skyLayer?.publish(world, viewport, volumeOpacity < 1, 1 - starsHandoff);
            if (volumeVisible && volumeSize > 0) volumeLayer!.publish({ world, viewport });
            // A galaxy under a few projected pixels is its label: its bank fades, then
            // leaves layout and compositing. Like lens banks, a faded image bank does too.
            for (const [index, bank] of imageBanks.entries()) {
              const presentationOpacity = declaredImageLayers[index]!.id === detailedFocus?.objectId ? 1 : detailContextOpacity;
              const opacity = presentationOpacity * volumeOpacity * projectedVolumeOpacity(world, viewport, declaredImageLayers[index]!.frame, imageFramingUnits[index]!);
              if (!bank) {
                if (opacity > 0) void ensureImageLayerLoaded(index).catch(() => {});
                continue;
              }
              if (opacity !== publishedBankOpacity[index]) {
                bank.root.style.opacity = String(opacity);
                bank.root.style.display = opacity > 0 ? '' : 'none';
                publishedBankOpacity[index] = opacity;
              }
              if (opacity > 0) bank.publish({ world, viewport });
            }
            let lensResidencyChanged = false;
            for (const [index, bank] of lensBanks.entries()) {
              const { frame, radiusUnits, visibility } = lensFraming[index]!;
              const presentationOpacity = volumeLensBanks[index]!.id === detailedFocus?.objectId ? 1 : detailContextOpacity;
              if (!bank) {
                // The fetch gate and the render gate are deliberately different. Rendering multiplies by
                // contextOpacity (the general galactic fade, 'galactic' by default) below, once the payload
                // is known to declare it; fetching never does. A bank close enough on screen to matter is
                // reason enough to go get it, even while the galaxy itself is still fully faded out — a
                // future bank baked with contextVisibility 'independent' otherwise would never be fetched by
                // proximity at all, only by explicit selection. Fetching a 'galactic' bank a little earlier
                // than its fade would have shown it is cheap; never fetching an 'independent' one is a blank
                // nebula.
                const visible = lensEnabled[index] && presentationOpacity > 0 && projectedVolumeOpacity(world, viewport, frame, radiusUnits, visibility) > 0;
                if (visible !== lensVisible[index]) {
                  lensVisible[index] = visible; lensLastUsed[index] = ++lensUseClock; lensResidencyChanged = true;
                }
                if (visible) {
                  void ensureLensLoaded(index).catch(() => {});
                }
                continue;
              }
              const contextOpacity = lensPayload[index]!.contextVisibility === 'independent' ? 1 : volumeOpacity;
              const opacity = lensEnabled[index] ? presentationOpacity * contextOpacity * projectedVolumeOpacity(world, viewport, frame, radiusUnits, visibility) : 0;
              const visible = opacity > 0;
              if (visible !== lensVisible[index]) {
                lensVisible[index] = visible; lensLastUsed[index] = ++lensUseClock; lensResidencyChanged = true;
              }
              if (opacity !== publishedLensOpacity[index]) {
                // A lens that composites in front of the body sits in the bank's second root, so both carry the
                // bank's visibility; gating only the first leaves a disabled cloud drawing over the star.
                for (const target of [bank.root, bank.frontRoot]) {
                  if (!target) continue;
                  target.style.opacity = String(opacity);
                  target.style.display = opacity > 0 ? 'block' : 'none';
                }
                publishedLensOpacity[index] = opacity;
              }
              bank.publish({ world, viewport }, visible);
            }
            if (lensResidencyChanged) trimWarmLensResidency();
            for (const [index, shell] of shellLayers.entries()) {
              shell.publish(world, viewport, shellVisibility[mountedShells[index]!.payload.id] !== false);
            }
            spatial!.publish(world, viewport, frame);
            const foregroundRects = [...spatial!.backgroundExclusionRects(), ...labelBlockers];
            labelBudget = createLabelBudget(viewport.widthPixels!, viewport.heightPixels!,
              bodyAnnotations.flatMap(body => body.labelRect ? [body.labelRect] : []), foregroundRects);
            const localAnnotations = 1 - logarithmicFade(distanceM, 12e6 * 3.085677581491367e16, 40e6 * 3.085677581491367e16);
            const environmentRects = environmentLabels!.publish({ world, viewport, volumeLabelOpacity: localAnnotations,
              shellStats: shellLayers.map(shell => shell.stats()), blockerRects: foregroundRects, labelBudget });
            const catalogPresentation = catalogPayload ?? catalogBank;
            if (catalogPresentation) {
              const galaxyOpacity = localAnnotations * logarithmicFade(distanceM, catalogPresentation.fadeStartDistanceM, catalogPresentation.fullDistanceM);
              const clusterOpacity = catalogPresentation.clusters ? logarithmicFade(distanceM, catalogPresentation.clusters.fadeStartDistanceM, catalogPresentation.clusters.fullDistanceM) : 0;
              const dotOpacity = (1 - logarithmicFade(distanceM, 30e6 * 3.085677581491367e16, 120e6 * 3.085677581491367e16)) * logarithmicFade(distanceM, catalogPresentation.fadeStartDistanceM, catalogPresentation.fullDistanceM);
              const nebulaOpacity = (1 - fade) * logarithmicFade(distanceM, plan.stars.fadeStartDistanceM, plan.stars.fullDistanceM);
              if (!galaxyCatalog && Math.max(galaxyOpacity, clusterOpacity, dotOpacity, nebulaOpacity) > 0) void ensureCatalogLoaded().catch(() => {});
              galaxyCatalog?.publish(world, viewport, galaxyOpacity, [...foregroundRects, ...environmentRects], clusterOpacity, dotOpacity, labelBudget, nebulaOpacity);
            }
            const emphasizedId = selectionPreview === undefined ? (overview ? null : selected.id) : selectionPreview;
            focusPoint?.publish(world, viewport, { opacity: (1 - fade) * (emphasizedId !== null && emphasizedId !== plan.focus.id ? .75 : 1), selectedDetail: selected.id === plan.focus.id,
              ...(selected.id === plan.focus.id ? {} : { occluder: selected }) });
            // Near the selected body its own scale wins, wherever that body sits: a placed star is an object at stellar distances.
            const selectedDistanceM = Math.hypot(...world.pose.positionM.map((value, axis) => value - selected.positionM[axis]));
            const scale = fade > 0 ? 'galactic' : selectedDistanceM <= selected.radiusM * 100 ? 'object' : distanceM > plan.stars.fadeStartDistanceM ? 'stellar' : 'system';
            if (scale !== publishedScale) { stage.dataset.contextScale = scale; publishedScale = scale; }
            });
          },
        });
      } catch (error) { destroy(); throw error; }
    },
  });
}
