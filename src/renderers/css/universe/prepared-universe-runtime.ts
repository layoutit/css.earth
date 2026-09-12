import { createOpacityClock } from '../stars/opacity-clock.js';
import { mountPreparedCssVolume } from '../volume/prepared-volume-runtime.js';
import { validatePreparedCssVolume } from '../volume/validation.js';
import type { PreparedCssVolume } from '../volume/types.js';
import type { SpriteWithUrl } from '../solar-system/heliocentric-sprites.js';
import { logarithmicFade, mountPreparedWorldContext, parsePreparedWorldContext, preparedVolumeOpacity } from './prepared-world-context.js';
import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import type { PreparedCssPointField } from '../stars/types.js';
import { mountPreparedCssPointField } from '../stars/prepared-point-field-runtime.js';
import { mountWorldContextPointSource } from './world-context-point-source.js';
import type { PreparedAssets } from '../rendering/prepared-residency.js';
import type { PreparedCssSurfaceShell } from '../shell/types.js';
import { mountPreparedCssSurfaceShell } from '../shell/prepared-shell-runtime.js';
import { mountPreparedCssSky } from '../sky/prepared-sky-runtime.js';
import { mountEnvironmentLabels } from './environment-labels.js';
import { mountPreparedGalaxyCatalog } from './prepared-galaxy-catalog.js';
import { mountPreparedCssImageLayers } from '../image-layers/prepared-image-layer-runtime.js';
import type { PreparedCatalogObject } from '@cssearth/catalog';
import type { PreparedCssImageLayers } from '../image-layers/loader.js';
import { createPreparedVolumeLenses } from '../volume/prepared-volume-lenses.js';
import type { WorldPlannerSource } from './world-context-planner-client.js';
import type { WorldContextPublication } from './world-context-frame.js';
import { createWorldContextPlannerClient } from './world-context-planner-client.js';

/** Prepared, route-independent surroundings. One application owner holds the decoded bank and DOM. */
// Galaxy files download from this fraction of the volume's fade-start distance:
// about five doubling wheel steps before the first slice is drawn.
const GALAXY_PREFETCH_RATIO = 1 / 32;

export function createPreparedUniverse({ context, volume, stars, resolveStarResource, resolveResource, sprites, shells = [], imageLayers = [], volumeLenses = [], catalog, annotationPriorities, annotationOpacities, plannerSource }: {
  context: unknown; volume: PreparedCssVolume; stars: PreparedCssPointField;
  /** The same prepared context and stars as files the planner worker reads itself. */
  plannerSource?: WorldPlannerSource;
  resolveStarResource(path: string): string; resolveResource(path: string): string;
  sprites: Readonly<Record<string, SpriteWithUrl>>;
  annotationPriorities?: Readonly<Record<string, number>>;
  annotationOpacities?: Readonly<Record<string, { line: number; label: number }>>;
  shells?: readonly { payload: PreparedCssSurfaceShell; resolveResource(path: string): string }[];
  imageLayers?: readonly { payload: PreparedCssImageLayers; resolveResource(path: string): string }[];
  volumeLenses?: readonly Parameters<typeof createPreparedVolumeLenses>[0][];
  catalog?: { payload: unknown; fadeStartDistanceM: number; fullDistanceM: number;
    clusters?: { payload: unknown; fadeStartDistanceM: number; fullDistanceM: number } };
}) {
  const plan = parsePreparedWorldContext(context), payload = validatePreparedCssVolume(volume);
  if (payload.id !== plan.volume.objectId || stars.id !== plan.stars.objectId ||
      [payload, stars].some(data => data.frame.referenceFrame !== plan.frame.referenceFrame || data.frame.epochJdTt !== plan.frame.epochJdTt)) {
    throw new TypeError('Context, volume and stars must share their prepared identities and epoch.');
  }
  const pool = `volume:${payload.id}`, starPool = `stars:${stars.id}`;
  const skyPaths = new Set(payload.sky?.faces.map(face => face.texturePath) ?? []);
  const entries = payload.resources.map(resource => ({ key: `${pool}:${resource.path}`, url: resolveResource(resource.path), pool }));
  const starEntries = stars.resources.filter(resource => resource.path === stars.atlas.path).map(resource => ({
    key: `${starPool}:${resource.path}`, url: resolveStarResource(resource.path), pool: starPool }));
  const shellEntries = shells.flatMap(({ payload, resolveResource }) => {
    if (payload.frame.referenceFrame !== plan.frame.referenceFrame || payload.frame.epochJdTt !== plan.frame.epochJdTt) {
      throw new TypeError('Prepared shells must share the universe reference frame and epoch.');
    }
    return payload.resources.map(resource => ({ key: `shell:${payload.id}:${resource.path}`,
      url: resolveResource(resource.path), pool: `shell:${payload.id}` }));
  });
  const imageEntries = imageLayers.flatMap(({ payload, resolveResource }) => {
    if (payload.frame.referenceFrame !== plan.frame.referenceFrame || payload.frame.epochJdTt !== plan.frame.epochJdTt) {
      throw new TypeError('Prepared image models must share the universe reference frame and epoch.');
    }
    return payload.resources.map(resource => ({ key: `image-layers:${payload.id}:${resource.path}`,
      url: resolveResource(resource.path), pool: `image-layers:${payload.id}` }));
  });
  const lensPlans = volumeLenses.map(options => {
    const frame = options.payload.lenses[0]!.volume.frame;
    if (frame.referenceFrame !== plan.frame.referenceFrame || frame.epochJdTt !== plan.frame.epochJdTt)
      throw new TypeError('Prepared volume lenses must share the universe reference frame and epoch.');
    return createPreparedVolumeLenses(options);
  });
  const assets: PreparedAssets = {
    entries: [...entries, ...starEntries, ...shellEntries, ...imageEntries, ...lensPlans.flatMap(bank => bank.assets.entries)],
    pools: [{ id: pool, retention: 'mount', capacity: entries.length, concurrency: 8, reuse: false, decoding: 'async' },
      { id: starPool, retention: 'mount', capacity: starEntries.length, concurrency: 8, reuse: false, decoding: 'async' },
      ...shells.map(({ payload }) => ({ id: `shell:${payload.id}`, retention: 'mount' as const,
        capacity: payload.resources.length, concurrency: 2, reuse: false, decoding: 'async' as const })),
      ...imageLayers.map(({ payload }) => ({ id: `image-layers:${payload.id}`, retention: 'mount' as const,
        capacity: payload.resources.length, concurrency: 4, reuse: false, decoding: 'async' as const })),
      ...lensPlans.flatMap(bank => bank.assets.pools)],
    // Only the backdrop and stars drawn from the first view decode at startup.
    // Galaxy slices, image layers, lens banks and shells appear far away; the
    // browser decodes them again for raster when first drawn, so decoding them
    // here spent seconds and hundreds of megabytes that were never reused.
    startup: [...entries.filter(entry => skyPaths.has(entry.key.slice(pool.length + 1))), ...starEntries].map(entry => entry.key),
  };
  // Their bytes are fetched once, a few wheel steps before the volume fades in.
  const galaxyUrls = [...entries.filter(entry => !skyPaths.has(entry.key.slice(pool.length + 1))), ...imageEntries,
    ...lensPlans.flatMap(bank => bank.assets.entries)].map(entry => entry.url);
  const galaxyPrefetchDistanceM = (plan.volume.opacityProfile?.fadeStartDistanceM ?? plan.volume.fadeStartDistanceM) * GALAXY_PREFETCH_RATIO;
  return Object.freeze({ assets,
    createFramePlanner: () => createWorldContextPlannerClient(plan, undefined, annotationPriorities, stars, plannerSource),
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
      let volumeLayer: ReturnType<typeof mountPreparedCssVolume> | null = null;
      let skyLayer: ReturnType<typeof mountPreparedCssSky> | null = null;
      let spatial: ReturnType<typeof mountPreparedWorldContext> | null = null;
      let pointField: ReturnType<typeof mountPreparedCssPointField> | null = null;
      let overview = false;
      let selectionPreview: string | null | undefined;
      let focusPoint: ReturnType<typeof mountWorldContextPointSource> = null;
      let environmentLabels: ReturnType<typeof mountEnvironmentLabels> | null = null;
      let galaxyCatalog: ReturnType<typeof mountPreparedGalaxyCatalog> | null = null;
      const imageBanks: ReturnType<typeof mountPreparedCssImageLayers>[] = [];
      let prefetchGalaxy = (_distanceM: number) => {};
      const lensBanks: ReturnType<ReturnType<typeof createPreparedVolumeLenses>['mount']>[] = [];
      const shellLayers: ReturnType<typeof mountPreparedCssSurfaceShell>[] = [];
      const mountedShells = [...shells];
      let selected = plan.focus;
      let destroyed = false;
      let highContrastSky = false, volumeOpacity = 0, volumeBrightness = 1;
      let publishedVolumeAlpha = NaN, publishedImageAlpha = NaN, publishedSkyAlpha = NaN;
      let publishedVolumeOpacity = NaN, publishedVolumeBrightness = NaN;
      let publishedVolumeVisible: boolean | undefined, publishedScale = '';
      const publishBackground = () => {
        const brightness = highContrastSky ? 1 : volumeBrightness;
        // The completed images contribute (1-t)*sky + t*b*volume. Factoring
        // t*b onto the volume avoids nesting its exposure inside its handoff.
        // Compensate the opaque sky underlay so its contribution stays 1-t.
        const alpha = skyLayer ? volumeOpacity * brightness : volumeOpacity;
        if (alpha !== publishedVolumeAlpha) { volumeHost.style.opacity = String(alpha); publishedVolumeAlpha = alpha; }
        const imageAlpha = skyLayer ? 1 : brightness;
        if (imageAlpha !== publishedImageAlpha) { volumeImage.style.opacity = skyLayer ? '' : String(imageAlpha); publishedImageAlpha = imageAlpha; }
        const skyAlpha = alpha < 1 ? (1 - volumeOpacity) / (1 - alpha) : 0;
        if (skyLayer && skyAlpha !== publishedSkyAlpha) { skyLayer.root.style.opacity = String(skyAlpha); publishedSkyAlpha = skyAlpha; }
      };
      const destroy = () => {
        if (destroyed) return;
        destroyed = true;
        volumeLayer?.destroy(); skyLayer?.destroy(); spatial?.destroy(); pointField?.destroy(); focusPoint?.destroy(); environmentLabels?.destroy();
        for (const shell of shellLayers) shell.destroy();
        for (const bank of imageBanks) bank.destroy(); galaxyCatalog?.destroy();
        for (const bank of lensBanks) bank.destroy();
        opacityClock.destroy();
        root.remove();
        delete stage.dataset.contextScale;
      };
      try {
        if (payload.sky) skyLayer = mountPreparedCssSky({ host: root, before: volumeHost, payload: payload.sky, resources: payload.resources, resolveResource });
        volumeLayer = mountPreparedCssVolume({ host: volumeImage, before: volumeEnd, payload, resolveResource });
        for (const bank of imageLayers) imageBanks.push(mountPreparedCssImageLayers({ host: root, before: end, ...bank }));
        for (const bank of lensPlans) lensBanks.push(bank.mount({ host: root, before: end }));
        // Far layers leave layout, and so image loading, until a publication shows them.
        for (const bank of [...imageBanks, ...lensBanks]) bank.root.style.display = 'none';
        let galaxyPrefetched = false;
        prefetchGalaxy = (distanceM: number) => {
          if (galaxyPrefetched || distanceM < galaxyPrefetchDistanceM) return;
          galaxyPrefetched = true;
          const target = document.defaultView;
          if (typeof target?.fetch !== 'function') return;
          for (const url of galaxyUrls) target.fetch(url, { priority: 'low' }).then(response => response.arrayBuffer()).catch(() => {});
        };
        pointField = mountPreparedCssPointField({ host: root, before: end, payload: stars, resolveResource: resolveStarResource, occluder: plan.focus, showLabels: false,
          framePlanned: true, requestPublication, opacityClock });
        for (const shell of shells) shellLayers.push(mountPreparedCssSurfaceShell({ host: root, before: end, ...shell }));
        // Picking and navigation stay on the detail stage's input owner. Billboards
        // share its viewport and depth band from outside its changing CSS scope.
        spatial = mountPreparedWorldContext({ host: stage, presentationHost, before: root, plan, sprites, requestPublication, annotationPriorities, annotationOpacities, opacityClock });
        focusPoint = mountWorldContextPointSource({ host: root, before: end, plan, field: stars, resolveResource: resolveStarResource, pickingHost: stage });
        environmentLabels = mountEnvironmentLabels({ host: root, before: end, volume: payload, shells: shells.map(shell => shell.payload), opacityClock });
        if (catalog) galaxyCatalog = mountPreparedGalaxyCatalog({ host: root, before: end, payload: catalog.payload, clusters: catalog.clusters?.payload, onSelect: onSelectGalaxy, pickingHost: stage });
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
          selectGalaxy(id: string | null) { galaxyCatalog?.select(id); },
          resolveGalaxy(id: string) { return galaxyCatalog?.resolve(id) ?? null; },
          imageLayerFrames: Object.freeze(Object.fromEntries(imageLayers.map(({ payload }) => [payload.id, payload.frame]))),
          volumeLensFrames: Object.freeze(Object.fromEntries(volumeLenses.map(({ payload }) => [payload.id,
            { frame: payload.lenses[0]!.volume.frame, framingRadiusUnits: payload.framingRadiusUnits }]))),
          volumeLensState(id: string) { return lensBanks[volumeLenses.findIndex(bank => bank.payload.id === id)]?.state() ?? null; },
          selectVolumeLens(id: string, lens: string) {
            const bank = lensBanks[volumeLenses.findIndex(bank => bank.payload.id === id)];
            if (!bank) throw new TypeError('Unknown prepared volume lens bank.');
            bank.selectLens(lens);
          },
          setVolumeStarsVisible(id: string, enabled: boolean) {
            const bank = lensBanks[volumeLenses.findIndex(bank => bank.payload.id === id)];
            if (!bank) throw new TypeError('Unknown prepared volume lens bank.');
            bank.setStarsVisible(enabled);
          },
          subscribeVolumeLens(id: string, listener: () => void) {
            return lensBanks[volumeLenses.findIndex(bank => bank.payload.id === id)]?.subscribe(listener) ?? (() => {});
          },
          captureFrame(world: WorldCameraPose, viewport: WorldCameraViewport) {
            // The worker plans bodies and retained star slots from one captured view.
            const spatialFrame = spatial!.captureFrame(world, viewport), pointFrame = pointField!.captureFrame();
            return { view: { ...spatialFrame.view, points: pointFrame.state },
              current: () => spatialFrame.current() && pointFrame.current() };
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
          setHiddenBodies(ids: readonly string[]) { spatial!.setHiddenBodies(ids); },
          setHiddenLabels(ids: readonly string[]) { spatial!.setHiddenLabels(ids); },
          setSuppressedLabels(ids: readonly string[]) { spatial!.setSuppressedLabels(ids); },
          setRotationActive(active: boolean) { spatial!.setRotationActive(active); pointField!.holdSelection(active); },
          setHiddenIndicators(ids: readonly string[]) { spatial!.setHiddenIndicators(ids); },
          setHighlighted(ids: readonly string[]) { spatial!.setHighlighted(ids); },
          inspect() {
            return Object.freeze({ opacity: spatial!.opacityStats(), publication: spatial!.publicationStats(), stars: pointField!.inspect(), bodies: spatial!.inspect(), environmentLabels: environmentLabels!.inspect(), galaxies: galaxyCatalog?.inspect(),
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
            pointField!.setOccluder(body);
            root.dataset.selectedObject = id;
          },
          publish(world: WorldCameraPose, viewport: WorldCameraViewport, shellVisibility: Readonly<Record<string, boolean>> = {}, frame?: WorldContextPublication) {
            if (destroyed) return;
            opacityClock.batch(() => {
            const distanceM = Math.hypot(...world.pose.positionM.map((value, axis) => value - plan.focus.positionM[axis]));
            prefetchGalaxy(distanceM);
            const fade = logarithmicFade(distanceM, plan.volume.fadeStartDistanceM, plan.volume.fullDistanceM);
            const stellarFade = logarithmicFade(distanceM, plan.stars.fadeStartDistanceM, plan.stars.fullDistanceM);
            volumeOpacity = preparedVolumeOpacity(distanceM, plan.volume.opacityProfile);
            volumeBrightness = preparedVolumeOpacity(distanceM, plan.volume.brightnessProfile);
            const volumeVisible = volumeOpacity > 0;
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
            skyLayer?.publish(world, viewport, volumeOpacity < 1);
            if (volumeOpacity > 0) volumeLayer!.publish({ world, viewport });
            // Like lens banks, a faded image bank leaves layout and compositing.
            for (const bank of imageBanks) {
              bank.root.style.opacity = String(volumeOpacity);
              bank.root.style.display = volumeOpacity > 0 ? '' : 'none';
              if (volumeOpacity > 0) bank.publish({ world, viewport });
            }
            for (const bank of lensBanks) {
              bank.root.style.opacity = String(volumeOpacity);
              bank.root.style.display = volumeOpacity > 0 ? 'block' : 'none';
              if (volumeOpacity > 0) bank.publish({ world, viewport });
            }
            for (const [index, shell] of shellLayers.entries()) {
              shell.publish(world, viewport, shellVisibility[mountedShells[index]!.payload.id] !== false);
            }
            spatial!.publish(world, viewport, frame);
            const foregroundRects = spatial!.backgroundExclusionRects();
            const environmentRects = environmentLabels!.publish({ world, viewport,
              shellStats: shellLayers.map(shell => shell.stats()), blockerRects: foregroundRects });
            const galaxyRects = catalog ? galaxyCatalog!.publish(world, viewport,
              logarithmicFade(distanceM, catalog.fadeStartDistanceM, catalog.fullDistanceM), [...foregroundRects, ...environmentRects],
              catalog.clusters ? logarithmicFade(distanceM, catalog.clusters.fadeStartDistanceM, catalog.clusters.fullDistanceM) : 0) : [];
            const starExclusions = [...foregroundRects, ...environmentRects, ...galaxyRects];
            // A worker-planned view carries its star frame; a direct publication selects locally.
            if (frame?.points) pointField!.publish(world, viewport, 1 - fade, starExclusions, frame.points);
            else pointField!.publish(world, viewport, 1 - fade, starExclusions);
            const emphasizedId = selectionPreview === undefined ? (overview ? null : selected.id) : selectionPreview;
            focusPoint?.publish(world, viewport, { opacity: (1 - fade) * (emphasizedId !== null && emphasizedId !== plan.focus.id ? .75 : 1), selectedDetail: selected.id === plan.focus.id,
              ...(selected.id === plan.focus.id ? {} : { occluder: selected }) });
            const scale = fade > 0 ? 'galactic' : stellarFade > 0 ? 'stellar' : Math.hypot(...world.pose.positionM.map((value, axis) => value - selected.positionM[axis])) > selected.radiusM * 100 ? 'system' : 'object';
            if (scale !== publishedScale) { stage.dataset.contextScale = scale; publishedScale = scale; }
            });
          },
        });
      } catch (error) { destroy(); throw error; }
    },
  });
}
