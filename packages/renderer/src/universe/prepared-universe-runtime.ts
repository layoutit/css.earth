import { parsePreparedWorldContextPlan, validatePreparedCssVolume, DEFAULT_POINT_VISIBILITY, type PreparedWorldContext, type PreparedWorldCameraFrame, type PreparedAssets, type PreparedCssSurfaceShell, type WorldCameraPose, type DensityVolumeFrame } from '@cssearth/objects';

import { createSceneLifetime, eyeDistanceM } from '@cssearth/engine';
import type { LabelScreenRect } from '../labels/screen-label-layout.js';
import { mountBackgroundPoints } from './background-points.js';
import { UNHIGHLIGHTED_OPACITY } from './context-presentation-policy.js';
import { fetchPreparedCatalogueBank, fetchPreparedJson, mountCataloguePoints } from './catalogue-points.js';
import { mountImageMesh } from './image-mesh.js';
import { opacityClockFor } from '../stars/opacity-clock.js';

import { galaxyOutsideFade, logarithmicFade } from './world-context/context-scale.js';
import { mountPreparedWorldContext, type BodyVisibility, type WorldBodyAnnotations } from './prepared-world-context.js';

import type { SpriteWithUrl } from '../solar-system/heliocentric-sprites.js';
import type { WorldCameraViewport } from '../navigation/world-camera.js';

import { mountWorldContextPointSource } from './world-context/world-context-point-source.js';

import { mountPreparedCssSurfaceShell } from '../shell/prepared-shell-runtime.js';
import { mountEnvironmentLabels } from './environment-labels.js';

import type { PreparedLabelEdge } from '../navigation/prepared-label-edge.js';
import { createContextFocusBank } from './prepared-focus-bank.js';
import { detailedFocusContextOpacity, selectedBodyContextOpacity } from './detailed-focus-context.js';
import type { SelectedBank } from './detailed-focus-context.js';

import type { WorldContextFrame } from './world-context/world-context-frame.js';
import { createWorldContextPlannerClient } from './world-context/world-context-planner-client.js';
import { coveredTopRects, createLabelBudget } from '../labels/universe-label-policy.js';
import { mountSelectedBodyLabel } from './selected-body-label.js';
import type { PreparedUniverseOptions } from './prepared-universe-types.js';
import { createUniverseDatasetBanks } from './universe-dataset-banks.js';
import { createUniverseCatalogBanks } from './universe-catalog-banks.js';
import { createUniverseBackground } from './universe-background.js';
import { createVolumeTextureReadiness } from '../volume/volume-texture-readiness.js';

/** Prepared, route-independent surroundings. One application owner holds the decoded bank and DOM. */
// Galaxy files download from this fraction of the volume's fade-start distance:
// about five doubling wheel steps before the first slice is drawn.
const GALAXY_PREFETCH_RATIO = 1 / 32;
/** An image mesh around the Sun (the cosmic microwave background) loads and may show once the camera is this far out,
 * past the quasars' reach, and not at all within half of it; its own fade then shows it only from outside. */
const IMAGE_MESH_LOAD_DISTANCE_M = 7e9 * 3.0856775814913673e16;
/** Hidden, unsubscribed dataset banks are retained only within this measured DOM budget. */
export const WARM_VOLUME_DATASET_DOM_NODE_BUDGET = 5_000;

export function createPreparedUniverse({ context, volume, pointAppearance, resolvePointResource, resolveResource, sprites, shells = [], contextBanks = [], imageLayers = [], imageLayerBanks = [], loadImageLayer, pointBanks = [], volumeDatasetBanks = [], loadVolumeDataset, warmVolumeDatasetDomNodeBudget = WARM_VOLUME_DATASET_DOM_NODE_BUDGET, backgroundCataloguePoints = [], starCataloguePoints = [], imageMeshes = [], environmentLinks, stellarExtents = {}, galaxyCataloguePoints = [], galaxyBacking, catalog, catalogBank, loadCatalog, annotationPriorities: initialPriorities = {}, annotationLandmarks, annotationOpacities: initialOpacities = {}, plannerSource, nonNavigableIds, plainDots, datasetVisibility = DEFAULT_POINT_VISIBILITY, datasetBillboards, sky = true }: PreparedUniverseOptions) {
  let plan = parsePreparedWorldContextPlan(context);
  const payload = validatePreparedCssVolume(volume);
  // What another system's bodies reach once read (addSystem): every planner made and every mounted world layer.
  const planners = new Set<ReturnType<typeof createWorldContextPlannerClient>>();
  const layers = new Set<ReturnType<typeof mountPreparedWorldContext>>();
  const spriteTable: Record<string, SpriteWithUrl> = { ...sprites };
  // Every body's annotation tier and strength, the first plan's and each added system's: a planner or layer made after
  // a system was added starts with that system's too.
  const annotationPriorities: Record<string, number> = { ...initialPriorities };
  const annotationOpacities: Record<string, { line: number; label: number }> = { ...initialOpacities };
  const factsOf = (bank: { id: string }) => {
    if (!datasetBillboards) throw new TypeError(`${bank.id}: volume dataset banks require their prepared billboards.`);
    const facts = datasetBillboards.plan.banks.get(bank.id);
    if (!facts) throw new TypeError(`${bank.id}: dataset billboards are missing; run pnpm prepare:dataset-billboards.`);
    return facts;
  };
  // Declared now and by `addBanks`: each mount starts with the banks declared so far and is told of later ones.
  const declaredVolumes = [...volumeDatasetBanks], declaredPoints = [...pointBanks];
  const datasetFacts = declaredVolumes.map(factsOf);
  const bankMounts = new Set<{ add(volumes: typeof declaredVolumes, points: typeof declaredPoints): void }>();
  if (!Number.isSafeInteger(warmVolumeDatasetDomNodeBudget) || warmVolumeDatasetDomNodeBudget < 0) {
    throw new TypeError('Warm volume dataset DOM node budget must be a non-negative integer.');
  }
  if (payload.id !== plan.volume.objectId || pointAppearance.id !== plan.stars.objectId ||
      [payload, pointAppearance].some(data => data.frame.referenceFrame !== plan.frame.referenceFrame || data.frame.epochJdTt !== plan.frame.epochJdTt)) {
    throw new TypeError('Context, volume and point appearance must share their prepared identities and epoch.');
  }
  const pool = `volume:${payload.id}`, pointPool = `focus-point:${pointAppearance.id}`;
  // The Milky Way cube is the sole sky background until the volume takes over.
  const skyPaths = new Set((payload.sky?.faces ?? []).map(face => face.texturePath));
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
  // A bank's frame is validated against its authored descriptor at load time (loadPreparedVolumeDatasets);
  // this only catches a descriptor wired to the wrong universe before any network request is made.
  const checkFrame = (bank: { id: string; frame: DensityVolumeFrame }) => {
    if (bank.frame.referenceFrame !== plan.frame.referenceFrame || bank.frame.epochJdTt !== plan.frame.epochJdTt) {
      throw new TypeError(`Prepared volume dataset bank ${bank.id} must share the universe reference frame and epoch.`);
    }
  };
  for (const bank of [...declaredImageLayers, ...declaredVolumes]) checkFrame(bank);
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
    // image layers, dataset banks and shells appear far away; the browser decodes them for raster when first drawn.
    startup: [],
  };
  // Warm the galaxy backdrop before its handoff. Nebula datasets own their image
  // demand: crossing this distance must not fetch every distant/inactive dataset.
  const galaxyUrls = entries.filter(entry => !skyPaths.has(entry.key.slice(pool.length + 1)))
    .map(entry => entry.url);
  const galaxyPrefetchDistanceM = (plan.volume.opacityProfile?.fadeStartDistanceM ?? plan.volume.fadeStartDistanceM) * GALAXY_PREFETCH_RATIO;
  return Object.freeze({ assets,
    createFramePlanner: () => {
      const client = createWorldContextPlannerClient(plan, undefined, annotationPriorities, plannerSource, annotationLandmarks);
      planners.add(client);
      return { ...client, destroy() { planners.delete(client); client.destroy(); } };
    },
    /** Draw `next`, an extension of this universe's plan with other systems' bodies (`extendWorldContext`), with their
     * billboards and annotations: mounted layers add the bodies after their own, and planners plan them from the first
     * view that holds them. */
    addSystems(next: PreparedWorldContext, nextSprites: Readonly<Record<string, SpriteWithUrl>>, annotations: WorldBodyAnnotations = {}) {
      const validated = parsePreparedWorldContextPlan(next);
      if (validated === plan) return;
      if (validated.focus.id !== plan.focus.id || plan.bodies.some((body, index) => validated.bodies[index] !== body)) {
        throw new TypeError('A universe only adds bodies after the ones its plan holds.');
      }
      plan = validated; Object.assign(spriteTable, nextSprites);
      Object.assign(annotationPriorities, annotations.annotationPriorities); Object.assign(annotationOpacities, annotations.annotationOpacities);
      for (const layer of layers) layer.addBodies(plan, nextSprites, annotations);
      for (const planner of planners) planner.extend(plan, annotations.annotationPriorities);
    },
    /** Declare banks after the universe is made, as `addSystems` adds bodies: a bank drawn only for the bodies that hold
     * it arrives with them (a volume dataset bank and a package of catalogue dots). Mounted layers add them after their
     * own; a known id is ignored. */
    addBanks({ volumeDatasetBanks: volumes = [], pointBanks: points = [] }: Pick<PreparedUniverseOptions, 'volumeDatasetBanks' | 'pointBanks'>) {
      const known = new Set([...declaredImageLayers, ...declaredVolumes, ...declaredPoints].map(bank => bank.id));
      const freshVolumes = volumes.filter(bank => !known.has(bank.id)), freshPoints = points.filter(bank => !known.has(bank.id));
      for (const bank of freshVolumes) checkFrame(bank);
      const facts = freshVolumes.map(factsOf);
      declaredVolumes.push(...freshVolumes); datasetFacts.push(...facts); declaredPoints.push(...freshPoints);
      if (!freshVolumes.length && !freshPoints.length) return;
      for (const mounted of bankMounts) mounted.add(freshVolumes, freshPoints);
    },
    mount(stage: HTMLElement, { requestPublication, presentationHost = stage }: {
      requestPublication?: () => boolean;
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
        const opacityClock = opacityClockFor(document.defaultView!);
        const root = document.createElement('div');
        lifetime.onDispose(() => root.remove());
        root.className = 'prepared-universe';
        // The stage's depth band starts above zero: the background at 1, every depth-sorted body, the selected detail
        // and the annotations above it. A composited child with a negative z-index made WebKit split
        // the stage into a background and a foreground layer, each backed at the whole stage (15.8 MB at 3x together).
        // Counted over the whole world, so bodies another system adds later stack under the same base.
        const depthBase = (plan.worldBodyCount ?? plan.bodies.length) + 3;
        // Set only the depth owner: an inherited custom property here propagates into the mounted detail tree.
        const previousDepth = stage.style.zIndex;
        stage.style.zIndex = String(depthBase);
        lifetime.onDispose(() => { stage.style.zIndex = previousDepth; });
        // The root fills the stage at the background's depth (volume.css).
        presentationHost.insertBefore(root, presentationHost.firstChild);
        // A bank whose every voxel lies between the observer and the body it surrounds composites over the
        // detail scene instead of behind it. Two flattened roots cannot interleave, so the payload declares
        // which side its data is on and the universe mounts it there; nothing is reordered at runtime.
        const frontRoot = document.createElement('div');
        lifetime.onDispose(() => frontRoot.remove());
        frontRoot.className = 'prepared-universe-front';
        // It fills the stage (volume.css) just above the body band.
        frontRoot.style.zIndex = String(depthBase + 1);
        presentationHost.appendChild(frontRoot);
        const frontEnd = document.createElement('span'); frontEnd.hidden = true; frontRoot.appendChild(frontEnd);
        const selectedLabel = own(mountSelectedBodyLabel(frontRoot, opacityClock, requestPublication));
        const end = document.createElement('span'); end.hidden = true; root.appendChild(end);
        // The galaxy backdrop is opaque black: it mounts first, so the dataset banks' billboards, which mount at once, paint over it.
        const background = createUniverseBackground({ root, end, lifetime, plan, payload, sky, resolveResource,
          prefetchUrls: galaxyUrls, prefetchDistanceM: galaxyPrefetchDistanceM, cataloguePointUrls: galaxyCataloguePoints,
          ...(galaxyBacking ? { backingUrl: galaxyBacking } : {}) });
        // Both billboard layers sample one atlas. Keep one demand-driven decode lease
        // for the universe lifetime, and publish again when its pixels are ready.
        const billboardTextures = own(createVolumeTextureReadiness(() => { requestPublication?.(); }));
        const prepareBillboardAtlas = () => datasetBillboards !== undefined && billboardTextures.ready([datasetBillboards.atlasUrl]);
        const datasets = createUniverseDatasetBanks({ root, end, frontRoot, frontEnd, lifetime,
          declarations: [...declaredVolumes], facts: [...datasetFacts], frame: plan.frame, visibility: datasetVisibility,
          billboards: datasetBillboards, load: loadVolumeDataset, warmDomNodeBudget: warmVolumeDatasetDomNodeBudget, requestPublication, prepareBillboardAtlas });
        // A cut-open mesh draws the inside of its far wall here, behind the points it holds; its outer shell stays over them.
        const meshInterior = document.createElement('span'); meshInterior.hidden = true; root.insertBefore(meshInterior, end);
        // Our galaxy's disc, as its volume frames it: the centre, the frame's z axis and its reach in the plane.
        const [gx, gy, gz, gw] = payload.frame.localToReferenceXyzw;
        const galaxyDisc = { centreM: payload.frame.originM, normal: [2 * (gx * gz + gw * gy), 2 * (gy * gz - gw * gx), 1 - 2 * (gx * gx + gy * gy)],
          radiusM: Math.max(...[payload.frame.boundsUnits.min, payload.frame.boundsUnits.max].flatMap(bound => [Math.abs(bound[0]), Math.abs(bound[1])])) * payload.frame.metersPerUnit };
        const additionalPoints = own(mountBackgroundPoints(root, end, backgroundCataloguePoints, target => fetchPreparedCatalogueBank(target), galaxyDisc));
        // The catalogued stars that are only dots: inside the galaxy or out, with every other star.
        let starPlaces: readonly (readonly number[])[] = [], starPlacesFor: unknown = null, starPlacesSelected: unknown = null;
        const starPoints = starCataloguePoints.map(url => own(mountCataloguePoints({ host: root, before: end, url, loadBank: target => fetchPreparedCatalogueBank(target) })));
        // Over the galaxies: a mesh seen from outside hides what lies inside it.
        const meshes = imageMeshes.map(mesh => ({ cutaway: () => mesh.cutaway?.() ?? true, hidden: () => mesh.hidden?.() ?? false,
          runtime: own(mountImageMesh({ host: root, before: end, interiorBefore: meshInterior, labelHost: frontRoot, url: mesh.url,
            fetchJson: fetchPreparedJson, resolveResource: mesh.resolveResource, cutaway: mesh.cutaway?.() ?? true,
            hidden: mesh.hidden?.() ?? false, hiddenCaption: mesh.hiddenCaption })) }));
        const catalogBanks = createUniverseCatalogBanks({ root, end, stage, lifetime,
          declarations: declaredImageLayers, initialImages: initialImageLayers, volumeDeclarations: [...declaredVolumes],
          pointBanks: [...declaredPoints],
          initialCatalog: catalog, catalogBank, loadCatalog, loadImageLayer, requestPublication, billboards: datasetBillboards, stellarExtents, prepareBillboardAtlas });
        let labelBudget = createLabelBudget(0, 0);
        let labelBlockers: readonly LabelScreenRect[] = [];
        let overview = false;
        let selectionPreview: string | null | undefined;
        const shellLayers: ReturnType<typeof mountPreparedCssSurfaceShell>[] = [];
        const mountedShells = [...shells];
        let selected = plan.focus;
        // The selected body and the centre it orbits: a point bank of either's system draws (universe-catalog-banks.ts).
        let selectedSystem: readonly string[] = [plan.focus.id];
        // The caption sits below the selected body's longest reach, which an elongated shape model extends past its radius.
        let captionBody: typeof selected = selected;
        let previewCaption: typeof selected | null = null;
        let selectedEdge: PreparedLabelEdge | undefined, previewEdge: PreparedLabelEdge | undefined;
        // The first `selectObject` always applies: the mounted default differs from a selection in its caption framing.
        let selectionApplied = false, selectedFramingScale = 1;
        const caption = () => previewCaption ?? captionBody;
        const captionFlags = () => ({ overview: selectionPreview ? false : overview, preview: selectionPreview, edge: previewCaption ? previewEdge : selectedEdge });
        // The bank the mounted scene's dataset shows as its companion: its subject, drawn whole while it is shown.
        let companion: string | null = null;
        // The banks that are a scene's whole subject: a galaxy's image layers, and a volume that is not attached to a body.
        const subjectBanks = new Set([...declaredImageLayers.map(bank => bank.id), ...declaredVolumes.filter((_, index) => !datasetFacts[index]!.attached).map(bank => bank.id)]);
        // Banks declared after this mount (`addBanks`) join its layers, and a free cloud becomes a subject as at mount.
        const bankMount = { add(volumes: typeof declaredVolumes, points: typeof declaredPoints) {
          if (lifetime.disposed) return;
          for (const bank of volumes) {
            const facts = factsOf(bank);
            datasets.declare(bank, facts);
            if (!facts.attached) subjectBanks.add(bank.id);
          }
          catalogBanks.addPointBanks(points);
          requestPublication?.();
        } };
        bankMounts.add(bankMount);
        lifetime.onDispose(() => { bankMounts.delete(bankMount); });
        // A level's context packages are banks too, for the object whose datasets name them (the Milky Way's volume).
        const contextFocusBanks = new Map(contextBanks.map(id => [id, createContextFocusBank(id)]));
        const bankOf = (id: string) => datasets.focusBank(id) ?? catalogBanks.focusBank(id) ?? contextFocusBanks.get(id) ?? null;
        background.mount();
        catalogBanks.loadInitialImages();
        for (const shell of shells) shellLayers.push(own(mountPreparedCssSurfaceShell({ host: root, before: end, ...shell })));
        // Picking and navigation stay on the detail stage's input owner. Billboards
        // share its viewport and depth band from outside its changing CSS scope.
        const spatial = own(mountPreparedWorldContext({ host: stage, presentationHost, before: root, plan, sprites: spriteTable, requestPublication, annotationOpacities, annotationPriorities, nonNavigableIds, plainDots, opacityClock, orbitRenderer: 'strokes', depthBase }));
        layers.add(spatial);
        lifetime.onDispose(() => { layers.delete(spatial); });
        // The selected body's own label is the close-up's; overviews label every body.
        const publishSuppressedLabels = () => spatial.setBodyVisibility({
          labelSuppressed: [...(!overview ? [selected.id] : []), ...(previewCaption ? [previewCaption.id] : [])],
        });
        publishSuppressedLabels();
        const focusPoint = own(mountWorldContextPointSource({ host: root, before: end, plan, field: pointAppearance, resolveResource: resolvePointResource, pickingHost: stage }));
        const environmentLabels = own(mountEnvironmentLabels({ host: root, before: end, volume: payload, shells: shells.map(shell => shell.payload), links: environmentLinks, pickingHost: stage, opacityClock,
          ...(stellarExtents[payload.id] === undefined ? {} : { extentRadiusM: stellarExtents[payload.id] }) }));
        catalogBanks.mountInitialCatalog();
        catalogBanks.publishResidency();
        datasets.publishResidency();
        return Object.freeze({ root, roots: Object.freeze([root, spatial.root]), destroy, opacityClock, depthBase,
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
          ensureGalaxyCatalog: catalogBanks.ensureCatalog,
          focusBank: bankOf,
          setVolumeDatasetEnabled(id: string, enabled: boolean) {
            if (lifetime.disposed) return;
            if (!bankOf(id)) throw new TypeError(`Unknown prepared bank: ${id}.`);
            datasets.setEnabled(id, enabled);
            if (enabled) companion = id; else if (companion === id) companion = null;
            requestPublication?.();
          },
          selectVolumeDataset(id: string, dataset: string) {
            const bank = bankOf(id);
            if (!bank) throw new TypeError(`Unknown prepared bank: ${id}.`);
            bank.selectDataset(dataset);
          },
          captureFrame(world: WorldCameraPose, viewport: WorldCameraViewport) {
            // The context's labels keep clear of the selected body's caption, placed for the same camera.
            const rect = selectedLabel.rect(world, viewport, caption(), captionFlags());
            return spatial.captureFrame(world, viewport, rect ? [rect] : []);
          },
          previewSelection(id?: string | null, framingScale?: number, edge?: PreparedLabelEdge) {
            if (framingScale !== undefined && !(framingScale > 0 && framingScale <= 1)) throw new TypeError('Invalid preview framing scale.');
            const body = id ? [plan.focus, ...plan.bodies].find(body => body.id === id) : undefined;
            previewCaption = body ? framingScale === undefined && id === selected.id ? captionBody
              : { ...body, radiusM: body.radiusM / (framingScale ?? 1) } : null;
            selectionPreview = id;
            previewEdge = edge ?? (id === selected.id ? selectedEdge : undefined);
            selectedLabel.prepare(caption());
            publishSuppressedLabels();
            spatial.previewSelection(id);
          },
          /** `scope`: the rung of the zoom ladder shown (a star's own `system`, or a level). `starsRetired`: the scope is past
           * the level that holds the stars, as the host's ladder says. */
          setOverview(enabled: boolean, scope?: string, preserveSelection = false, starsRetired = false) {
            overview = enabled;
            spatial.setOverview(enabled, preserveSelection);
            // Past the system scope, a planetary system is drawn as its star; past the scope that holds the stars, they retire too.
            spatial.setSystemRetired(enabled && scope !== undefined && scope !== 'system', starsRetired);
            publishSuppressedLabels();
          },
          setNavigationInFlight(active: boolean) { spatial.setNavigationInFlight(active); focusPoint?.setNavigationEnabled(!active); },
          /** A header pill's category: the galaxy, cluster and nebula catalogue emphasises its members; the body markers take
           * theirs through `setBodyVisibility`. */
          /** Label suppression follows the selection here; callers set the other flags. */
          setBodyVisibility(next: Omit<BodyVisibility, 'labelSuppressed'>) { spatial.setBodyVisibility(next); },
          setRotationActive(active: boolean) { spatial.setRotationActive(active); },
          setCoasting(active: boolean) { spatial.setCoasting(active); focusPoint?.setCoasting(active); datasets.setCoasting(active); catalogBanks.setCoasting(active); },
          setLabelBlockers(rects: readonly LabelScreenRect[]) { labelBlockers = rects; spatial.setLabelBlockers(rects); },
          labelBudget() { return labelBudget; },
          inspect() {
            return Object.freeze({ opacity: spatial.opacityStats(), publication: spatial.publicationStats(), bodies: spatial.inspect(), environmentLabels: environmentLabels.inspect(), galaxies: catalogBanks.catalog?.inspect(),
              foregroundLabelExclusions: [...spatial.backgroundExclusionRects(), ...environmentLabels.labelExclusionRects()] });
          },
          /** `framingScale` (below 1 for an elongated shape model) sets the caption below the body's longest reach. */
          selectObject(id: string, frame: PreparedWorldCameraFrame, framingScale = 1, edge?: PreparedLabelEdge) {
            const body = [plan.focus, ...plan.bodies].find(body => body.id === id);
            if (!body || frame.referenceFrame !== plan.frame.referenceFrame || frame.epochJdTt !== plan.frame.epochJdTt ||
                frame.bodyRadiusM !== body.radiusM || !body.positionM.every((value, axis) => Math.abs(value - frame.originM[axis]) < .001)) {
              // Name what disagrees: the bare sentence left a black page with nothing to act on (2026-10-02).
              throw new TypeError(`Selected detail ${id} does not match its prepared world context (focus ${plan.focus.id}): ${!body ? 'the context has no such body'
                : `frame ${frame.referenceFrame} at ${frame.epochJdTt}, radius ${frame.bodyRadiusM} m, origin ${frame.originM.join(', ')}; context ${plan.frame.referenceFrame} at ${plan.frame.epochJdTt}, radius ${body.radiusM} m, position ${body.positionM.join(', ')}`}.`);
            }
            if (!(framingScale > 0 && framingScale <= 1)) throw new TypeError(`Selected ${id} has an invalid framing scale ${framingScale}.`);
            // The same selection again changes no policy: a frame planned for it stays valid (world-frame-queue.ts `warm`).
            if (selectionApplied && selected === body && selectedEdge === edge && selectedFramingScale === framingScale) return;
            selectionApplied = true; selectedFramingScale = framingScale;
            selected = body;
            selectedSystem = 'orbit' in body && body.orbit ? [body.id, body.orbit.centerBodyId] : [body.id];
            selectedEdge = edge;
            captionBody = framingScale === 1 ? body : Object.freeze({ ...body, radiusM: body.radiusM / framingScale });
            selectedLabel.prepare(caption());
            spatial.selectObject(id);
            publishSuppressedLabels();
            root.dataset.selectedObject = id;
          },
          publish(world: WorldCameraPose, viewport: WorldCameraViewport, frame: WorldContextFrame, shellVisibility: Readonly<Record<string, boolean>> = {}) {
            if (lifetime.disposed) return;
            opacityClock.batch(() => {
              const distanceM = eyeDistanceM(world.pose, plan.focus.positionM);
              // A companion that is its scene's whole subject (a galaxy's layers, a nebula's volume) is framed as a body is, by
              // the selected body's place and radius, and the context gives way to it. A volume attached to a body (a star's
              // disc) and a bank of dots (a cluster's members) show beside what is there and dim nothing. Until the scene's
              // own body is selected the companion has nothing to be framed by.
              const detailedFocus: { objectId: string; focus: SelectedBank } | null = companion === null || !subjectBanks.has(companion) || selected === plan.focus ? null
                : { objectId: companion, focus: { positionM: selected.positionM as SelectedBank['positionM'], framingRadiusM: selected.radiusM } };
              const detailContextOpacity = detailedFocusContextOpacity(world, detailedFocus?.focus ?? null);
              if (detailContextOpacity > 0) background.prefetch(distanceM);
              const outsideGalaxy = galaxyOutsideFade(
                eyeDistanceM(world.pose, selected.positionM), plan.volume.discHalfHeightM);
              additionalPoints.publish({world, viewport}, distanceM, outsideGalaxy);
              // Past halfway out the galaxy is seen whole, as the universe background draws it (universe-background.ts).
              spatial.setOutsideGalaxy(outsideGalaxy > .5);
              // Loaded and drawn only far outside the galaxies' own scale.
              // A catalogue focus, selected or previewed, owns the caption; the mesh then names nothing.
              const meshCaptioned = detailedFocus === null && (selectionPreview === undefined || selectionPreview === null);
              // The cutaway and hiding are the mesh's page's dataset: a one-off change when it is chosen, a no-op on every other frame.
              for (const mesh of meshes) mesh.runtime.setCutaway(mesh.cutaway());
              for (const mesh of meshes) mesh.runtime.setHidden(mesh.hidden());
              const meshCover = Math.max(0, ...meshes.map(mesh => mesh.runtime.publish({ world, viewport }, logarithmicFade(distanceM, IMAGE_MESH_LOAD_DISTANCE_M / 2, IMAGE_MESH_LOAD_DISTANCE_M), meshCaptioned)));
              const fade = logarithmicFade(distanceM, plan.volume.fadeStartDistanceM, plan.volume.fullDistanceM);
              // The stars the world draws as bodies (the selected one, and each plain-dot star it holds): no dot bank draws them too.
              const drawnPlaces = spatial.plainStarPlaces();
              if (drawnPlaces !== starPlacesFor || selected.positionM !== starPlacesSelected) {
                starPlacesFor = drawnPlaces; starPlacesSelected = selected.positionM; starPlaces = [selected.positionM, ...drawnPlaces];
              }
              const volumeOpacity = background.publish(world, viewport, distanceM, selected.positionM, detailContextOpacity, starPlaces);
              // The world's own star dots dim like every marker outside a highlighted category and like every body outside
              // the focus star's system (the frame's `otherSystems`).
              for (const bank of starPoints) bank.publish({world, viewport}, (spatial.highlighting() ? UNHIGHLIGHTED_OPACITY : 1) * frame.otherSystems, starPlaces);
              // A body inside a galaxy other than the page's own stands among that galaxy's catalogue dots once the camera has left
              // the body's own system, over the band the stellar neighbourhood takes around the Sun.
              const insideGalaxy = catalogBanks.imageBankContaining(selected.positionM);
              catalogBanks.publishImages(world, viewport, volumeOpacity, detailedFocus?.objectId, insideGalaxy === undefined || insideGalaxy === detailedFocus?.objectId ? undefined
                : { objectId: insideGalaxy, opacity: logarithmicFade(eyeDistanceM(world.pose, selected.positionM), plan.stars.fadeStartDistanceM, plan.stars.fullDistanceM) });
              catalogBanks.publishPoints(world, viewport, companion ?? undefined, selectedSystem);
              datasets.publish(world, viewport, volumeOpacity, detailContextOpacity, detailedFocus?.objectId,
                selectedBodyContextOpacity(world, viewport, captionBody));
              for (const [index, shell] of shellLayers.entries()) {
                shell.publish(world, viewport, shellVisibility[mountedShells[index]!.payload.id] !== false);
              }
              spatial.publish(world, viewport, frame);
              const selectedRect = selectedLabel.publish(world, viewport, caption(), captionFlags());
              const foregroundRects = [...spatial.backgroundExclusionRects(), ...labelBlockers, ...(selectedRect ? [selectedRect] : []),
                ...coveredTopRects(viewport)];
              labelBudget = createLabelBudget(viewport.widthPixels!, viewport.heightPixels!,
                spatial.bodyLabelRects(), foregroundRects);
              const localAnnotations = 1 - logarithmicFade(distanceM, 12e6 * 3.085677581491367e16, 40e6 * 3.085677581491367e16);
              const environmentRects = environmentLabels.publish({ world, viewport, volumeLabelOpacity: localAnnotations,
                shellStats: shellLayers.map(shell => shell.stats()), blockerRects: foregroundRects, labelBudget });
              const catalogPresentation = catalogBanks.presentation;
              if (catalogPresentation) {
                const dotOpacity = (1 - logarithmicFade(distanceM, 30e6 * 3.085677581491367e16, 120e6 * 3.085677581491367e16)) * logarithmicFade(distanceM, catalogPresentation.fadeStartDistanceM, catalogPresentation.fullDistanceM);
                if (!catalogBanks.catalog && dotOpacity > 0) void catalogBanks.ensureCatalog().catch(() => {});
                catalogBanks.catalog?.publish(world, viewport, dotOpacity);
              }
              const emphasizedId = selectionPreview === undefined ? (overview ? null : selected.id) : selectionPreview;
              focusPoint?.publish(world, viewport, { opacity: (1 - fade) * (emphasizedId !== null && emphasizedId !== plan.focus.id ? .75 : 1), selectedDetail: selected.id === plan.focus.id,
                ...(selected.id === plan.focus.id ? {} : { occluder: selected }) });
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
