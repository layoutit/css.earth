import { createSceneLifetime } from '@cssearth/engine';
import type { LabelScreenRect } from '../labels/screen-label-layout.js';
import { mountBackgroundPoints } from './background-points.js';
import { opacityClockFor } from '../stars/opacity-clock.js';
import { validatePreparedCssVolume } from '../volume/validation.js';
import { logarithmicFade } from './world-context/context-scale.js';
import { mountPreparedWorldContext, type BodyVisibility } from './prepared-world-context.js';
import { parsePreparedWorldContextPlan } from '../prepared-data/world-context.js';
import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { mountWorldContextPointSource } from './world-context/world-context-point-source.js';
import type { PreparedAssets } from '../rendering/prepared-residency.js';
import type { PreparedCssSurfaceShell } from '../shell/types.js';
import { mountPreparedCssSurfaceShell } from '../shell/prepared-shell-runtime.js';
import { mountEnvironmentLabels } from './environment-labels.js';
import { isPreparedCluster, type PreparedCatalogObject } from '@cssearth/catalog';
import type { PreparedNavigationFocus } from '../navigation/prepared-focus.js';
import { detailedFocusContextOpacity } from './detailed-focus-context.js';
import { DEFAULT_POINT_VISIBILITY } from '../volume/projected-volume-visibility.js';
import type { WorldContextFrame } from './world-context/world-context-frame.js';
import { createWorldContextPlannerClient } from './world-context/world-context-planner-client.js';
import { coveredTopRects, createLabelBudget } from '../labels/universe-label-policy.js';
import { mountSelectedBodyLabel } from './selected-body-label.js';
import type { PreparedUniverseOptions } from './prepared-universe-types.js';
import { createUniverseLensBanks } from './universe-lens-banks.js';
import { createUniverseCatalogBanks } from './universe-catalog-banks.js';
import { createUniverseBackground } from './universe-background.js';

/** Prepared, route-independent surroundings. One application owner holds the decoded bank and DOM. */
// Galaxy files download from this fraction of the volume's fade-start distance:
// about five doubling wheel steps before the first slice is drawn.
const GALAXY_PREFETCH_RATIO = 1 / 32;
/** Hidden, unsubscribed lens banks are retained only within this measured DOM budget. */
export const WARM_VOLUME_LENS_DOM_NODE_BUDGET = 5_000;

export function createPreparedUniverse({ context, volume, pointAppearance, resolvePointResource, resolveResource, sprites, shells = [], imageLayers = [], imageLayerBanks = [], loadImageLayer, volumeLensBanks = [], loadVolumeLens, warmVolumeLensDomNodeBudget = WARM_VOLUME_LENS_DOM_NODE_BUDGET, backgroundPointManifest, backgroundPointCloud, environmentLinks, catalog, catalogBank, loadCatalog, annotationPriorities, annotationLandmarks, annotationOpacities, plannerSource, distantNavigation, plainDots, lensVisibility = DEFAULT_POINT_VISIBILITY, lensBillboards, sky = true }: PreparedUniverseOptions) {
  const plan = parsePreparedWorldContextPlan(context), payload = validatePreparedCssVolume(volume);
  if (volumeLensBanks.length && !lensBillboards) throw new TypeError('Volume lens banks require their prepared billboards.');
  const lensFacts = volumeLensBanks.map(bank => {
    const facts = lensBillboards!.plan.banks.get(bank.id);
    if (!facts) throw new TypeError(`${bank.id}: lens billboards are missing; run pnpm prepare:lens-billboards.`);
    return facts;
  });
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
  const assets: PreparedAssets = {
    entries: [...entries, ...pointEntries, ...shellEntries, ...imageEntries],
    pools: [{ id: pool, retention: 'mount', capacity: entries.length, concurrency: 8, reuse: false, decoding: 'async' },
      { id: pointPool, retention: 'mount', capacity: pointEntries.length, concurrency: 8, reuse: false, decoding: 'async' },
      ...shells.map(({ payload }) => ({ id: `shell:${payload.id}`, retention: 'mount' as const,
        capacity: payload.resources.length, concurrency: 2, reuse: false, decoding: 'async' as const })),
      ...imageLayers.map(({ payload }) => ({ id: `image-layers:${payload.id}`, retention: 'mount' as const,
        capacity: payload.resources.length, concurrency: 4, reuse: false, decoding: 'async' as const }))],
    // Nothing decodes at startup. A sky face loads when it first enters the view (prepared-sky-runtime.ts): the camera
    // sees two or three of the six, and decoding all six fetched every face (about 450 KB) on every page. Galaxy slices,
    // image layers, lens banks and shells appear far away; the browser decodes them for raster when first drawn.
    startup: [],
  };
  // Warm the galaxy backdrop before its handoff. Nebula lenses own their image
  // demand: crossing this distance must not fetch every distant/inactive lens.
  const galaxyUrls = entries.filter(entry => !skyPaths.has(entry.key.slice(pool.length + 1)))
    .map(entry => entry.url);
  const galaxyPrefetchDistanceM = (plan.volume.opacityProfile?.fadeStartDistanceM ?? plan.volume.fadeStartDistanceM) * GALAXY_PREFETCH_RATIO;
  return Object.freeze({ assets,
    createFramePlanner: () => createWorldContextPlannerClient(plan, undefined, annotationPriorities, plannerSource, annotationLandmarks),
    mount(stage: HTMLElement, { onSelectGalaxy, requestPublication, presentationHost = stage }: {
      onSelectGalaxy?: (object: PreparedCatalogObject) => void; requestPublication?: () => boolean;
      /** Stationary world presentation, outside the selected detail's CSS scope. */
      presentationHost?: HTMLElement;
    } = {}) {
      const document = stage.ownerDocument;
      const lifetime = createSceneLifetime();
      const own = <T extends { destroy(): void } | null>(owner: T): T => {
        if (owner) lifetime.onDispose(() => owner.destroy());
        return owner;
      };
      const destroy = () => {
        const errors = lifetime.destroy();
        if (errors.length) throw new AggregateError(errors, 'Prepared universe cleanup failed.');
      };
      try {
        lifetime.onDispose(() => { delete stage.dataset.contextScale; });
        const opacityClock = opacityClockFor(document.defaultView!);
        const root = document.createElement('div');
        lifetime.onDispose(() => root.remove());
        root.className = 'prepared-universe';
        // Keep the background below every depth-sorted body in the isolated stage.
        root.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:${-plan.bodies.length - 2}`;
        presentationHost.insertBefore(root, presentationHost.firstChild);
        // A bank whose every voxel lies between the observer and the body it surrounds composites over the
        // detail scene instead of behind it. Two flattened roots cannot interleave, so the payload declares
        // which side its data is on and the universe mounts it there; nothing is reordered at runtime.
        const frontRoot = document.createElement('div');
        lifetime.onDispose(() => frontRoot.remove());
        frontRoot.className = 'prepared-universe-front';
        frontRoot.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1';
        presentationHost.appendChild(frontRoot);
        const frontEnd = document.createElement('span'); frontEnd.hidden = true; frontRoot.appendChild(frontEnd);
        const selectedLabel = own(mountSelectedBodyLabel(frontRoot, opacityClock));
        const end = document.createElement('span'); end.hidden = true; root.appendChild(end);
        const lenses = createUniverseLensBanks({ root, end, frontRoot, frontEnd, lifetime,
          declarations: volumeLensBanks, facts: lensFacts, frame: plan.frame, visibility: lensVisibility,
          billboards: lensBillboards, load: loadVolumeLens, warmDomNodeBudget: warmVolumeLensDomNodeBudget, requestPublication });
        const background = createUniverseBackground({ root, end, lifetime, plan, payload, pointAppearance, sky, resolveResource,
          prefetchUrls: galaxyUrls, prefetchDistanceM: galaxyPrefetchDistanceM });
        const additionalPoints = own(mountBackgroundPoints(root, end, backgroundPointManifest, backgroundPointCloud));
        const catalogBanks = createUniverseCatalogBanks({ root, end, stage, lifetime,
          declarations: declaredImageLayers, initialImages: initialImageLayers, volumeDeclarations: volumeLensBanks,
          initialCatalog: catalog, catalogBank, loadCatalog, loadImageLayer, onSelect: onSelectGalaxy, requestPublication });
        let labelBudget = createLabelBudget(0, 0);
        let labelBlockers: readonly LabelScreenRect[] = [];
        let overview = false;
        let selectionPreview: string | null | undefined;
        const shellLayers: ReturnType<typeof mountPreparedCssSurfaceShell>[] = [];
        const mountedShells = [...shells];
        let selected = plan.focus;
        // The caption sits below the selected body's longest reach, which an elongated shape model extends past its radius.
        let captionBody: typeof selected = selected;
        let detailedFocus: { objectId: string; focus: PreparedNavigationFocus } | null = null;
        let publishedScale = '';
        background.mount();
        catalogBanks.loadInitialImages();
        for (const shell of shells) shellLayers.push(own(mountPreparedCssSurfaceShell({ host: root, before: end, ...shell })));
        // Picking and navigation stay on the detail stage's input owner. Billboards
        // share its viewport and depth band from outside its changing CSS scope.
        const spatial = own(mountPreparedWorldContext({ host: stage, presentationHost, before: root, plan, sprites, requestPublication, annotationOpacities, distantNavigation, plainDots, opacityClock, orbitRenderer: 'strokes' }));
        // The selected body's own label is the close-up's; overviews label every body.
        const publishSuppressedLabels = () => spatial.setBodyVisibility({ labelSuppressed: overview ? [] : [selected.id] });
        publishSuppressedLabels();
        const bodyAnnotations = spatial.inspect();
        const focusPoint = own(mountWorldContextPointSource({ host: root, before: end, plan, field: pointAppearance, resolveResource: resolvePointResource, pickingHost: stage }));
        const environmentLabels = own(mountEnvironmentLabels({ host: root, before: end, volume: payload, shells: shells.map(shell => shell.payload), links: environmentLinks, pickingHost: stage, opacityClock }));
        catalogBanks.mountInitialCatalog();
        catalogBanks.publishResidency();
        lenses.publishResidency();
        return Object.freeze({ root, roots: Object.freeze([root, spatial.root]), destroy, opacityClock,
          /** Mount an optional prepared shell after startup, the first time it is enabled. */
          addShell(shell: { payload: PreparedCssSurfaceShell; resolveResource(path: string): string }) {
            if (lifetime.disposed) return;
            if (shell.payload.frame.referenceFrame !== plan.frame.referenceFrame || shell.payload.frame.epochJdTt !== plan.frame.epochJdTt) {
              throw new TypeError('Prepared shells must share the universe reference frame and epoch.');
            }
            shellLayers.push(own(mountPreparedCssSurfaceShell({ host: root, before: end, ...shell })));
            mountedShells.push(shell);
            environmentLabels.addShell(shell.payload);
            requestPublication?.();
          },
          selectGalaxy(id: string | null, focus: PreparedNavigationFocus | null = null) {
            if (focus && (focus.id !== id || !Number.isFinite(focus.framingRadiusM) || focus.framingRadiusM <= 0 ||
                focus.positionM.length !== 3 || !focus.positionM.every(Number.isFinite))) {
              throw new TypeError('Prepared context focus must match its selection and have finite authored framing.');
            }
            const record = id ? catalogBanks.catalog?.resolve(id) : null;
            const objectId = record && !isPreparedCluster(record) ? record.detailedObjectId : undefined;
            const next = focus && objectId && [...declaredImageLayers, ...volumeLensBanks].some(bank => bank.id === objectId)
              ? { objectId, focus } : null;
            const changed = next?.objectId !== detailedFocus?.objectId || next?.focus.framingRadiusM !== detailedFocus?.focus.framingRadiusM ||
              next?.focus.positionM.some((value, axis) => value !== detailedFocus?.focus.positionM[axis]);
            detailedFocus = next;
            catalogBanks.catalog?.select(id);
            if (changed) requestPublication?.();
          },
          resolveGalaxy(id: string) { return catalogBanks.catalog?.resolve(id) ?? null; },
          ensureGalaxyCatalog: catalogBanks.ensureCatalog,
          focusBank(id: string) { return lenses.focusBank(id) ?? catalogBanks.focusBank(id); },
          setVolumeLensEnabled: lenses.setEnabled,
          selectVolumeLens: lenses.select,
          setStellarPointsEnabled(enabled: boolean) {
            if (!background.setStellarPointsEnabled(enabled)) return;
            lenses.setStarsVisible(enabled === true);
            background.publishStellarPoints();
          },
          captureFrame(world: WorldCameraPose, viewport: WorldCameraViewport) {
            // The context's labels keep clear of the selected body's caption, placed for the same camera.
            const caption = selectedLabel.rect(world, viewport, captionBody, { overview, focused: detailedFocus !== null, preview: selectionPreview });
            return spatial.captureFrame(world, viewport, caption ? [caption] : []);
          },
          previewSelection(id?: string | null) { selectionPreview = id; spatial.previewSelection(id); },
          setOverview(enabled: boolean, scope?: string) {
            overview = enabled;
            spatial.setOverview(enabled);
            // The background galaxy is an overview destination, not a catalogue focus.
            background.setDetail(enabled && scope === plan.volume.objectId);
            publishSuppressedLabels();
          },
          setNavigationInFlight(active: boolean) { spatial.setNavigationInFlight(active); focusPoint?.setNavigationEnabled(!active); },
          /** Label suppression follows the selection here; callers set the other flags. */
          setBodyVisibility(next: Omit<BodyVisibility, 'labelSuppressed'>) { spatial.setBodyVisibility(next); },
          setRotationActive(active: boolean) { spatial.setRotationActive(active); },
          setLabelBlockers(rects: readonly LabelScreenRect[]) { labelBlockers = rects; spatial.setLabelBlockers(rects); },
          labelBudget() { return labelBudget; },
          inspect() {
            return Object.freeze({ opacity: spatial.opacityStats(), publication: spatial.publicationStats(), bodies: spatial.inspect(), environmentLabels: environmentLabels.inspect(), galaxies: catalogBanks.catalog?.inspect(),
              foregroundLabelExclusions: [...spatial.backgroundExclusionRects(), ...environmentLabels.labelExclusionRects()] });
          },
          /** `framingScale` (below 1 for an elongated shape model) sets the caption below the body's longest reach. */
          selectObject(id: string, frame: PreparedWorldCameraFrame, framingScale = 1) {
            const body = [plan.focus, ...plan.bodies].find(body => body.id === id);
            if (!body || frame.referenceFrame !== plan.frame.referenceFrame || frame.epochJdTt !== plan.frame.epochJdTt ||
                frame.bodyRadiusM !== body.radiusM || !body.positionM.every((value, axis) => Math.abs(value - frame.originM[axis]) < .001)) {
              throw new TypeError('Selected detail does not match its prepared world context.');
            }
            if (!(framingScale > 0 && framingScale <= 1)) throw new TypeError(`Selected ${id} has an invalid framing scale ${framingScale}.`);
            selected = body;
            captionBody = framingScale === 1 ? body : Object.freeze({ ...body, radiusM: body.radiusM / framingScale });
            spatial.selectObject(id);
            publishSuppressedLabels();
            root.dataset.selectedObject = id;
          },
          publish(world: WorldCameraPose, viewport: WorldCameraViewport, frame: WorldContextFrame, shellVisibility: Readonly<Record<string, boolean>> = {}) {
            if (lifetime.disposed) return;
            opacityClock.batch(() => {
              const distanceM = Math.hypot(...world.pose.positionM.map((value, axis) => value - plan.focus.positionM[axis]));
              const detailContextOpacity = detailedFocusContextOpacity(world, detailedFocus?.focus ?? null);
              if (detailContextOpacity > 0) background.prefetch(distanceM);
              additionalPoints.publish({world, viewport}, distanceM);
              const fade = logarithmicFade(distanceM, plan.volume.fadeStartDistanceM, plan.volume.fullDistanceM);
              const volumeOpacity = background.publish(world, viewport, distanceM, selected.positionM, detailContextOpacity);
              catalogBanks.publishImages(world, viewport, volumeOpacity, detailedFocus?.objectId);
              lenses.publish(world, viewport, volumeOpacity, detailContextOpacity, detailedFocus?.objectId);
              for (const [index, shell] of shellLayers.entries()) {
                shell.publish(world, viewport, shellVisibility[mountedShells[index]!.payload.id] !== false);
              }
              spatial.publish(world, viewport, frame);
              const selectedRect = selectedLabel.publish(world, viewport, captionBody, {
                overview, focused: detailedFocus !== null, preview: selectionPreview,
              });
              const foregroundRects = [...spatial.backgroundExclusionRects(), ...labelBlockers, ...(selectedRect ? [selectedRect] : []),
                ...coveredTopRects(viewport)];
              labelBudget = createLabelBudget(viewport.widthPixels!, viewport.heightPixels!,
                bodyAnnotations.flatMap(body => body.labelRect ? [body.labelRect] : []), foregroundRects);
              const localAnnotations = 1 - logarithmicFade(distanceM, 12e6 * 3.085677581491367e16, 40e6 * 3.085677581491367e16);
              const environmentRects = environmentLabels.publish({ world, viewport, volumeLabelOpacity: localAnnotations,
                shellStats: shellLayers.map(shell => shell.stats()), blockerRects: foregroundRects, labelBudget });
              const catalogPresentation = catalogBanks.presentation;
              if (catalogPresentation) {
                const galaxyOpacity = localAnnotations * logarithmicFade(distanceM, catalogPresentation.fadeStartDistanceM, catalogPresentation.fullDistanceM);
                const clusterOpacity = catalogPresentation.clusters ? logarithmicFade(distanceM, catalogPresentation.clusters.fadeStartDistanceM, catalogPresentation.clusters.fullDistanceM) : 0;
                const dotOpacity = (1 - logarithmicFade(distanceM, 30e6 * 3.085677581491367e16, 120e6 * 3.085677581491367e16)) * logarithmicFade(distanceM, catalogPresentation.fadeStartDistanceM, catalogPresentation.fullDistanceM);
                const nebulaOpacity = (1 - fade) * logarithmicFade(distanceM, plan.stars.fadeStartDistanceM, plan.stars.fullDistanceM);
                if (!catalogBanks.catalog && Math.max(galaxyOpacity, clusterOpacity, dotOpacity, nebulaOpacity) > 0) void catalogBanks.ensureCatalog().catch(() => {});
                catalogBanks.catalog?.publish(world, viewport, galaxyOpacity, [...foregroundRects, ...environmentRects], clusterOpacity, dotOpacity, labelBudget, nebulaOpacity);
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
      } catch (error) {
        for (const cleanupError of lifetime.destroy()) document.defaultView?.reportError?.(cleanupError);
        throw error;
      }
    },
  });
}
