import { PREPARED_CSS_VOLUME_SCHEMA, validateCloudDensityFilter, parseCloudCatalogue, type CloudDensityFilter, type PreparedCataloguePoints, type PreparedCssImageLayers, type PreparedCssVolume } from '@cssearth/objects';
import { mountPreparedCataloguePoints } from '@cssearth/renderer/stars/prepared-catalogue-points.ts';
import { materialResources, sharesMaterialGeometry } from './material-resources';
import { createMaterialSlots, resyncCloudSupport } from './material-slots';
import { createDensityOverlays } from './density-overlays';
import { createToneResourceController, type ToneResource } from '../../adapters/viewer/tone-runtime';
import { cloudCompositeOpacity, createCloudInspection, nativeCloudBrightness, validateCloudBrightness } from '@cssearth/volume-viewer/scene/cloud-inspection';
import type { CloudBrightness, CloudStarOptions, CloudStarContext } from '@cssearth/volume-viewer/scene/cloud-types';
import { mountPreparedLmcStars, parsePreparedLmcStars } from '../../adapters/viewer/catalogue-stars';
import { loadPlateOverlay, loadRegisteredOverlay, loadVolumeOverlay, mountReconstructionOverlay } from '../../adapters/viewer/reconstruction-overlay';
import { createDifferencePlane, datasetResultOf, differenceSourceOf, type DifferenceOverlayState } from './difference-plane';
import { createCandidateModels, type CandidateModelState } from '../plates/candidate-models';
import { loadPreparedCssVolume, type VolumeCameraPublication } from '../../adapters/viewer/prepared-loaders';
import { loadSelectedBank, selectedBank, settleImageBank } from './bank-selection';

import { createInspectionCamera, type InspectionPose as CameraPose } from '@cssearth/volume-viewer/camera/inspection-camera';
import { dominantInspectionBank, inspectPreparedLayers, mountInspectionScene, type InspectionAxis as Axis,
  type InspectionComponent as Component, type InspectionBank, type InspectionLeafResources } from '@cssearth/volume-viewer/scene/inspection-banks';
import { localFile, subjects } from './subject-catalogue';
import { relativePath, sameOverlayFrame } from './overlay-catalogue';
import { inspectionCameraRenderer } from '../../adapters/viewer/inspection-camera-renderer';
import { inspectionRenderer } from '../../adapters/viewer/inspection-renderer';
export { subjects, localFile, registerReconstructionSubject } from './subject-catalogue';
export type { LabSubjectRecord } from './subject-catalogue';
export type { DensityOverlay } from './overlay-catalogue';
export type { InspectionPose as CameraPose } from '@cssearth/volume-viewer/camera/inspection-camera';
export type ViewerMode = 'photo' | 'density';
/** Which picture the original-image plane shows: the photograph as published, or a plate dataset's star-free copy. */
/** A plate dataset's comparison picture: the published original, its star-free copy, or a lab candidate (`candidate:<id>`). */
export type OriginalPicture = 'original' | 'starless' | `candidate:${string}`;
export interface LabState {
  subjectId: string; component: Component; axis: Axis; layer: number | null;
  layerCount: number; status: string; pose: CameraPose; mode: ViewerMode; error?: string; distanceUnits?: number;
  material: { available: boolean; mode: 'neutral' | 'textured'; loading: boolean };
  originalOverlay: { available: boolean; enabled: boolean; opacity: number; loading: boolean; picture: OriginalPicture };
  differenceOverlay: DifferenceOverlayState;
}

/** One inspected object; production input, transforms and retained leaves, without the application shell. */
export async function createNebulaLabViewer({ host, subjectId, mode: initialMode = 'photo', onState }: {
  host: HTMLElement; subjectId: string; mode?: ViewerMode; onState(state: LabState): void;
}) {
  const document = host.ownerDocument;
  const end = document.createElement('span'); end.hidden = true; host.append(end);
  host.style.touchAction = 'none';
  let subject = subjects.find(item => item.id === subjectId) ?? subjects[0];
  let currentMode: ViewerMode = initialMode;
  if (currentMode !== 'photo' && currentMode !== 'density') throw new TypeError('Unknown viewer mode.');
  let payload: PreparedCssVolume | PreparedCssImageLayers | null = null;
  let mounted: { publish(publication: VolumeCameraPublication): void; destroy(): void } | null = null;
  let banks: InspectionBank[] = [];
  let cloud: ReturnType<typeof createCloudInspection> | null = null, cloudBrightness = nativeCloudBrightness();
  let cloudFilter: CloudDensityFilter = { cutoff: 0, softness: .25, showRemoved: false };
  let cloudSurface: { setOpacity(value: number): void } | null = null;
  let starLayer: ReturnType<typeof mountPreparedLmcStars> | null = null, starInfo: CloudStarContext | null = null;
  let originalOverlay: ReturnType<typeof mountReconstructionOverlay> | null = null;
  // Real stars around the object (`stars <id>`), drawn by the site's own catalogue-point renderer in the bank's frame.
  let fieldStars: ReturnType<typeof mountPreparedCataloguePoints> | null = null;
  const difference = createDifferencePlane();
  // Lab-only published 3D models of a plate object (ignored scratch), drawn beside the bank.
  const candidateModels = createCandidateModels();
  const slots = createMaterialSlots();
  // Tone bindings stay keyed by the mounted bank; a swapped dataset maps its own texture paths onto those keys.
  let bankFramingRadius: number | undefined, bankDirectory = '', boundPaths = new Map<string, string>();
  let originalPending: Promise<void> | null = null, originalEnabled = false, originalOpacity = .5, originalPicture: OriginalPicture = 'original';
  /** A saved reconstruction's prepared original-image plane, a plate dataset's photograph laid where its bake laid it, or a
   * site volume dataset's photograph in the registration its lab workspace made it with. */
  const hasOriginal = (item: typeof subject) => Boolean(item.reconstructionOverlay || item.plates || item.siteVolume);
  const toneResources = createToneResourceController();
  const overlays = createDensityOverlays({ host, toneResources, stop: () => view.stop(), publish: () => publish(),
    live: () => ({ mode: currentMode, payload, subject, version: loadVersion, disposed }) });
  let densityOverlayEnabled = false;
  let axis: Axis = 'auto', component: Component = 'all', layer: number | null = null;
  let layerCount = 0, status = 'Loading prepared object', error: string | undefined;
  let disposed = false, loadVersion = 0;
  const densityCameras = new Map<string, ReturnType<typeof retainCamera>>();
  const report = () => onState({ subjectId: subject.id, component, axis, layer, layerCount, status, pose: view.pose, mode: currentMode,
    ...(error ? { error } : {}), distanceUnits: view.values.distance,
    material: { available: currentMode === 'photo' && Boolean(subject.reconstructionNeutral), mode: slots.mode, loading: slots.loading },
    originalOverlay: { available: currentMode === 'photo' && hasOriginal(subject),
      enabled: currentMode === 'photo' && originalEnabled && hasOriginal(subject), opacity: originalOpacity, loading: Boolean(originalPending), picture: originalPicture },
    differenceOverlay: { available: currentMode === 'photo' && Boolean(subject.reconstructionOverlay && datasetResultOf(subject.id) || subject.plates || subject.siteVolume),
      enabled: difference.enabled, earthFacing: view.pose === 'front', opacity: difference.opacity, loading: difference.loading } });
  const view = createInspectionCamera({ host, backend: inspectionCameraRenderer,
    configuration: () => ({ frame: payload?.frame ?? null, projectionScale: subject.referenceProjectionScale ?? 1,
      eastLeft: currentMode === 'density' || Boolean(subject.referenceEastLeft) }),
    render, changed: report, error(failure) { error = String(failure); status = 'Interaction error'; report(); },
  });
  const schedule = () => view.schedule();
  const publish = () => view.publish();
  const dominantBank = () => dominantInspectionBank(banks);
  function inspectLayers() {
    const inspected = inspectPreparedLayers(banks, { axis, component, layer, layerCount }, cloud ? id => cloud!.includes(id) : undefined);
    layer = inspected.layer; layerCount = inspected.layerCount;
    if (inspected.countChanged) report();
  }
  function render(publication: VolumeCameraPublication) {
    if (!mounted || !payload || disposed) return;
    mounted.publish(publication); starLayer?.publish(publication); fieldStars?.publish(publication); originalOverlay?.publish(publication); candidateModels.publish(publication);
    difference.publish(publication, currentMode === 'photo' && view.pose === 'front');
    inspectLayers();
    if (currentMode === 'density' && !densityOverlayEnabled)
      for (const bank of banks) for (const leaf of bank.leaves) for (const node of leaf.nodes) node.style.visibility = 'hidden';
    host.dataset.densityOverlay = String(currentMode === 'density' && densityOverlayEnabled);
    const opacity = cloud ? cloudCompositeOpacity(banks.map(bank => ({ axis: bank.axis,
      opacity: Number(bank.root.style.opacity), visible: bank.root.style.visibility !== 'hidden' })), cloudBrightness) : 1;
    cloudSurface?.setOpacity(opacity); host.dataset.cloudOpacity = String(opacity);
  }
  function reset() {
    if (subject.referenceDistanceUnits !== undefined) { applyEarthCamera(); return; }
    view.reset(); report();
  }
  async function referenceView() {
    if (!payload) throw new Error('The prepared object is still loading.');
    if (currentMode === 'density') {
      const version = loadVersion, expectedPayload = payload;
      await overlays.loadOverlayCatalogue();
      if (disposed || version !== loadVersion || expectedPayload !== payload || currentMode !== 'density') return;
    }
    applyEarthCamera();
  }
  function applyEarthCamera() {
    // A subject without a declared observer turns to face its object from Earth at the normal framing: rotation only.
    if (subject.referenceDistanceUnits === undefined) { view.earthView(photographUp()); status = 'Earth view · facing the object from Earth'; report(); return; }
    view.referenceView(subject.density?.referenceFramingRadiusUnits ?? subject.framingRadiusUnits ?? bankFramingRadius,
      [subject.referenceDistanceUnits, currentMode === 'density' ? overlays.catalogue()?.referenceDistanceUnits : undefined]);
    status = 'Earth view · shared observer and framing'; report();
  }
  /** The photograph's up in bank units: a face-on leaf's first corner (picture top-left) minus its fourth (bottom-left). */
  function photographUp(): number[] | undefined {
    let best: number[] | undefined;
    const image = payload && 'bankViews' in payload ? payload : null;
    for (const stack of image?.stacks ?? []) if (stack.axis === 'z') for (const leaf of stack.leaves) {
      const corners = leaf.verticesUnits; if (!corners) continue;
      const up = corners[0].map((value, axis) => value - corners[3][axis]!);
      if (!best || Math.hypot(...up) > Math.hypot(...best)) best = up;
    }
    return best;
  }
  function fitCloud() {
    if (currentMode !== 'density' || !payload) throw new Error('Fit cloud is available in Density view only.');
    view.fitCloud(); status = 'Prepared density cloud fitted to its full bounds'; report();
  }
  const retainCamera = () => view.retain();
  const restoreCamera = (saved: ReturnType<typeof retainCamera>) => { view.restore(saved); report(); };
  async function setOriginalOverlay(enabled: boolean, opacity = originalOpacity, picture: OriginalPicture = originalPicture) {
    if (!(Number.isFinite(opacity) && opacity >= 0 && opacity <= 1)) throw new TypeError('Original image opacity must be between zero and one.');
    if (picture !== 'original' && picture !== 'starless' && !/^candidate:[a-z0-9-]+$/.test(picture)) throw new TypeError('Unknown original picture.');
    if (picture !== originalPicture) {
      if (picture !== 'original' && !subject.plates) throw new Error('Only a plate dataset names its star-free or candidate pictures here.');
      if (originalPending) await originalPending;
      originalPicture = picture; originalOverlay?.destroy(); originalOverlay = null;
    }
    originalEnabled = enabled; originalOpacity = opacity;
    if (!enabled) { originalOverlay?.setVisible(false, opacity); report(); return; }
    if (currentMode !== 'photo' || !hasOriginal(subject) || !payload)
      throw new Error('This saved reconstruction has no prepared original-image overlay.');
    const version = loadVersion, expectedSubject = subject.id;
    const current = () => !disposed && version === loadVersion && expectedSubject === subject.id && currentMode === 'photo';
    if (!originalOverlay && !originalPending) {
      const manifestPath = subject.reconstructionOverlay, plates = subject.plates, volume = subject.siteVolume, expectedFrame = payload.frame, expectedDistance = subject.referenceDistanceUnits;
      const dataset = selectedBank(subject).dataset ?? host.dataset.bankDataset ?? '';
      const pending = (async () => {
        const { overlay, textureUrl: url } = plates ? await loadPlateOverlay(plates.object, originalPicture, localFile, expectedFrame)
          : volume ? await loadVolumeOverlay(volume.object, dataset, localFile, expectedFrame)
          : await loadRegisteredOverlay(manifestPath!, localFile, { frame: expectedFrame, distanceUnits: expectedDistance });
        if (!current()) return;
        const image = new Image(); image.src = url; await image.decode();
        if (image.naturalWidth !== overlay.widthPx || image.naturalHeight !== overlay.heightPx)
          throw new TypeError('Original image decoded at the wrong prepared size.');
        if (!current()) return;
        originalOverlay = mountReconstructionOverlay({ host, before: starLayer?.root ?? end, frame: expectedFrame, overlay, url });
      })();
      originalPending = pending; report();
      try { await pending; } catch (failure) { if (current()) { originalEnabled = false; throw failure; } }
      finally { if (originalPending === pending) { originalPending = null; if (current()) report(); } }
    } else if (originalPending) await originalPending;
    if (current()) { originalOverlay?.setVisible(originalEnabled, originalOpacity); publish(); report(); }
  }
  /** A plate object's lab-only published 3D models, in the mounted bank's frame. */
  async function setCandidateModels(state: CandidateModelState) {
    if (currentMode !== 'photo' || !payload || !subject.plates) throw new Error('Published 3D models are shown on a plate dataset.');
    const version = loadVersion, expectedSubject = subject.id;
    const current = () => !disposed && version === loadVersion && expectedSubject === subject.id && currentMode === 'photo';
    await candidateModels.set(state, { host, before: starLayer?.root ?? end, frame: payload.frame, object: subject.plates.object, current });
    if (current()) publish();
  }
  /** Shows the object's fetched Gaia stars (catalogue points in the mounted bank's frame), or hides them with null. */
  function setFieldStars(points: PreparedCataloguePoints | null) {
    fieldStars?.destroy(); fieldStars = null; delete host.dataset.fieldStars;
    if (!points) { publish(); return; }
    if (!payload) throw new Error('The prepared object is still loading.');
    if (points.frame.referenceFrame !== payload.frame.referenceFrame || points.frame.epochJdTt !== payload.frame.epochJdTt)
      throw new TypeError('The stars were placed in another frame than the mounted bank.');
    fieldStars = mountPreparedCataloguePoints({ host, before: end, payload: points });
    host.dataset.fieldStars = String(points.points.length); publish();
  }
  /** The render-minus-source map for the displayed image dataset, on the original image's registered quad. */
  async function setDifferenceOverlay(enabled: boolean, opacity = difference.opacity) {
    if (enabled && (currentMode !== 'photo' || !payload)) throw new Error('The difference map is shown on the reconstruction’s Earth view.');
    const version = loadVersion, expectedSubject = subject.id;
    const current = () => !disposed && version === loadVersion && expectedSubject === subject.id && currentMode === 'photo';
    const loading = difference.set(enabled, opacity, payload ? { host, before: starLayer?.root ?? end, frame: payload.frame, current, source: differenceSourceOf(subject,
      { dataset: selectedBank(subject).dataset ?? host.dataset.bankDataset ?? '', picture: originalPicture, frame: payload.frame, distanceUnits: subject.referenceDistanceUnits, url: localFile }) } : undefined);
    report();
    try { await loading; } finally { if (current()) { publish(); report(); } }
  }
  const followDifference = (current: () => boolean) => {
    // The switch survives a subject without a dataset (the unpainted density) and remounts on the next dataset.
    if (difference.enabled && (subject.reconstructionOverlay && datasetResultOf(subject.id) || subject.plates || subject.siteVolume)) void setDifferenceOverlay(true).catch(failure => { if (current()) { status = 'Difference map could not load'; error = String(failure); report(); } });
  };
  function rememberDensityCamera() {
    if (payload && host.dataset.mode === 'density' && subject.density) {
      densityCameras.set(subject.density.directory, retainCamera());
    }
  }
  async function applyToneResources(target: 'image' | 'density', imageId: string | undefined, resources: ToneResource[], isCurrent = () => true) {
    if (currentMode !== 'density' || !payload || host.dataset.ready !== 'true') throw new Error('Density is still loading; tone can be applied when it is ready.');
    const version = loadVersion;
    const expected = target === 'image' ? overlays.shownTexture(imageId) :
      payload.resources.map(item => `${subject.density!.directory}/prepared/${item.path}`);
    await toneResources.apply(resources, expected, () => !disposed && version === loadVersion && isCurrent());
  }
  async function applyCloudDensityResources(resources: ToneResource[], filter: CloudDensityFilter, isCurrent = () => true) {
    if (currentMode !== 'photo' || !cloud || !payload || host.dataset.ready !== 'true') throw new Error('Reconstruction is still loading.');
    const version = loadVersion, valid = validateCloudDensityFilter(filter), token = slots.begin('cutoff');
    const bound = resources.map(item => {
      const sourcePath = boundPaths.get(item.sourcePath);
      if (!sourcePath) throw new TypeError('Density resources do not belong to the displayed material bank.');
      return { ...item, sourcePath };
    });
    const current = () => !disposed && version === loadVersion && slots.current(token) && isCurrent();
    await toneResources.apply(bound, payload.resources.map(item => `${bankDirectory}/prepared/${item.path}`), current);
    if (!disposed && version === loadVersion && !slots.current(token)) throw new Error('Material changed before the density filter applied; apply it again.');
    if (current() && slots.finish(token)) {
      cloudFilter = valid; starLayer?.setCloudSupport(cloudFilter, cloud.selection()); publish();
    }
  }
  async function setMaterial(mode: 'neutral' | 'textured') {
    if (mode !== 'neutral' && mode !== 'textured') throw new TypeError('Invalid material mode.');
    if (!payload || currentMode !== 'photo' || host.dataset.ready !== 'true' || !subject.reconstructionNeutral || payload.schema !== PREPARED_CSS_VOLUME_SCHEMA) throw new Error('No interchangeable material bank.');
    const token = slots.begin('material'), version = loadVersion, source = payload, directory = subject.directory, mountedDirectory = bankDirectory;
    report();
    try {
      const descriptorPath = mode === 'neutral' ? subject.reconstructionNeutral.descriptor : subject.cloudParts?.descriptor ?? 'object.json';
      if (!relativePath(descriptorPath)) throw new TypeError('Invalid material descriptor.');
      const read = async (path: string) => { const response = await fetch(localFile(`${directory}/${path}`)); if (!response.ok) throw new Error('Prepared material unavailable.'); return response.arrayBuffer(); };
      const descriptor = JSON.parse(new TextDecoder().decode(await read(descriptorPath)));
      const replacement = await loadPreparedCssVolume(descriptor, { read });
      const current = () => !disposed && slots.current(token) && version === loadVersion;
      const resources = materialResources(source, replacement, mountedDirectory, directory, localFile);
      await toneResources.apply(resources, source.resources.map(item => `${mountedDirectory}/prepared/${item.path}`), current);
      if (current() && slots.finish(token, mode)) { // Unfiltered slots now: the applied cutoff and star support reset together.
        host.dataset.material = mode; cloudFilter = resyncCloudSupport(starLayer, cloud);
        if (cloud) host.dataset.cloudDensityFilter = JSON.stringify(cloudFilter);
      }
    } finally { if (slots.finish(token)) report(); }
  }
  /** Replace only the prepared material of a saved result that shares the mounted geometry; camera and leaves stay. */
  async function swapMaterialSubject(next: typeof subject, version: number, token: number) {
    const source = payload;
    if (!source || source.schema !== PREPARED_CSS_VOLUME_SCHEMA) throw new TypeError('No retained volume geometry to repaint.');
    const current = () => !disposed && version === loadVersion && slots.current(token);
    const read = async (path: string) => {
      if (!relativePath(path)) throw new TypeError('Invalid prepared material path.');
      const response = await fetch(localFile(`${next.directory}/${path}`));
      if (!response.ok) throw new Error(`Missing prepared material: ${path} (${response.status})`);
      return response.arrayBuffer();
    };
    const text = async (path: string) => JSON.parse(new TextDecoder().decode(await read(path)));
    const replacement = await loadPreparedCssVolume(await text(next.cloudParts?.descriptor ?? 'object.json'), { read });
    const nextCloud = next.cloudParts ? createCloudInspection(parseCloudCatalogue(await text(next.cloudParts.catalogue), next.id,
      replacement.stacks.flatMap(stack => stack.leaves.map(leaf => leaf.id)))) : null;
    if (Boolean(nextCloud) !== Boolean(cloud)) throw new TypeError('Material bank changes the retained contribution scene.');
    const resources = materialResources(source, replacement, bankDirectory, next.directory, localFile);
    await toneResources.apply(resources, source.resources.map(item => `${bankDirectory}/prepared/${item.path}`), current);
    if (!current() || !slots.finish(token, 'textured')) return;
    subject = next; cloud = nextCloud; cloudBrightness = nativeCloudBrightness(); layer = null;
    cloudFilter = resyncCloudSupport(starLayer, cloud);
    boundPaths = new Map(resources.map(item => [item.replacementPath, item.sourcePath]));
    originalOverlay?.destroy(); originalOverlay = null; originalPending = null; originalPicture = 'original'; difference.clear(); candidateModels.clear();
    host.dataset.material = slots.mode;
    if (cloud) {
      host.dataset.cloudSelection = JSON.stringify(cloud.selection()); host.dataset.cloudBrightness = JSON.stringify(cloudBrightness);
      host.dataset.cloudDensityFilter = JSON.stringify(cloudFilter); host.dataset.cloudDensityReady = 'true';
    }
    status = `${replacement.resources.length} prepared images · material changed on retained geometry`;
    host.dataset.subject = next.id; host.dataset.ready = 'true'; publish(); report();
    if (originalEnabled && hasOriginal(next))
      void setOriginalOverlay(true).catch(failure => { if (current()) { status = 'Original overlay could not load'; error = String(failure); report(); } });
    followDifference(current);
  }
  async function setSubject(id: string, cameraOverride: ReturnType<typeof retainCamera> | null = null, requestedMode?: ViewerMode) {
    const next = subjects.find(item => item.id === id);
    if (!next) throw new TypeError(`Unknown lab subject: ${id}`);
    const materialOnly = cameraOverride === null && (requestedMode ?? currentMode) === 'photo' && currentMode === 'photo' &&
      host.dataset.mode === 'photo' && host.dataset.ready === 'true' && Boolean(mounted) && subject.id !== next.id && sharesMaterialGeometry(subject, next);
    rememberDensityCamera();
    if (requestedMode !== undefined) {
      if (requestedMode !== 'photo' && requestedMode !== 'density') throw new TypeError('Unknown viewer mode.');
      currentMode = requestedMode;
    }
    const bank = selectedBank(next), rebank = subject.id === next.id && Boolean(mounted) && host.dataset.bankDirectory !== undefined, retain = currentMode === 'density' ? densityCameras.get(next.density?.directory ?? '') :
      cameraOverride ?? (rebank || subject.id !== next.id && subject.comparisonGroup !== undefined && subject.comparisonGroup === next.comparisonGroup ? retainCamera() : null);
    const directory = currentMode === 'density' ? next.density?.directory : bank.directory;
    // A swap keeps the shown material state until it commits; a full mount starts from fresh textured slots.
    const version = ++loadVersion, swapToken = materialOnly ? slots.begin('material') : (slots.reset(), 0);
    view.stop(); status = 'Loading prepared object'; error = undefined;
    host.dataset.ready = 'false';
    report();
    if (materialOnly) {
      try { await swapMaterialSubject(next, version, swapToken); return; } catch (failure) {
        if (disposed || version !== loadVersion) return;
        // The retained scene was untouched; the ordinary full mount remains the authoritative path.
        console.warn('Material swap unavailable; remounting the saved result.', failure); slots.reset(); host.dataset.materialSwap = 'remounted';
      }
    }
    // Keep the current scene intact until every selected prepared texture has decoded.
    const replaceSubject = () => {
      overlays.saveSession();
      subject = next; densityOverlayEnabled = !next.density?.overlays; view.measure(); axis = 'auto'; component = 'all'; layer = null;
      mounted?.destroy(); mounted = null; banks = []; payload = null; layerCount = 0; overlays.clear(); toneResources.clear();
      cloudSurface = null;
      starLayer?.destroy(); starLayer = null; starInfo = null;
      fieldStars?.destroy(); fieldStars = null; delete host.dataset.fieldStars;
      originalOverlay?.destroy(); originalOverlay = null; originalPending = null; originalPicture = 'original'; difference.clear(); candidateModels.clear();
      cloud = null; cloudBrightness = nativeCloudBrightness(); host.style.opacity = '1';
      cloudFilter = { cutoff: 0, softness: .25, showRemoved: false };
      delete host.dataset.cloudSelection; delete host.dataset.cloudBrightness; delete host.dataset.cloudOpacity;
      delete host.dataset.cloudDensityFilter; delete host.dataset.cloudDensityReady;
      overlays.restoreSession(next.density?.overlays ?? '');
      host.dataset.mode = currentMode;
      host.style.transform = currentMode === 'density' || subject.referenceEastLeft ? 'scaleX(-1)' : '';
    };
    if (!directory) {
      replaceSubject();
      status = 'No independent density field is available for this subject';
      host.dataset.subject = id; host.dataset.ready = 'true'; report();
      return;
    }
    try {
      const fetchBytes = async (path: string) => {
        const response = await fetch(localFile(`${directory}/${path}`));
        if (!response.ok) throw new Error(`Missing prepared resource: ${path} (${response.status})`);
        return response.arrayBuffer();
      };
      const cloudFiles = currentMode === 'photo' ? next.cloudParts : undefined;
      if (cloudFiles && (!relativePath(cloudFiles.descriptor) || !relativePath(cloudFiles.catalogue))) throw new TypeError('Invalid cloud inspection paths.');
      const descriptor = JSON.parse(new TextDecoder().decode(await fetchBytes(cloudFiles?.descriptor ?? 'object.json')));
      const { isImage, loaded, shownDataset, framingRadius } = await loadSelectedBank(descriptor, fetchBytes, bank);
      if (disposed || version !== loadVersion) return;
      if (payload && subject.id !== next.id && subject.reconstructionImage?.group === next.reconstructionImage?.group &&
          next.reconstructionImage && !sameOverlayFrame(loaded.frame, payload.frame)) {
        throw new TypeError('Reconstruction images use different physical reference frames.');
      }
      const loadedCloud = cloudFiles ? createCloudInspection(parseCloudCatalogue(
        JSON.parse(new TextDecoder().decode(await fetchBytes(cloudFiles.catalogue))), next.id,
        loaded.stacks.flatMap(stack => stack.leaves.map(leaf => leaf.id)))) : null;
      if (next.stars && !relativePath(next.stars)) throw new TypeError('Invalid prepared star path.');
      const starResponse = loadedCloud && next.stars ? await fetch(localFile(next.stars)) : null;
      if (starResponse && !starResponse.ok) throw new Error(`Prepared stars failed to load (${starResponse.status}).`);
      // The dev server answers a missing path with its HTML shell, so absence arrives as 200 text/html.
      // A model without a prepared catalogue layer keeps its material; only the optional overlay is skipped.
      const starJson = starResponse?.headers.get('content-type')?.includes('json') ? await starResponse.json() : null;
      if (starResponse && starJson === null) console.warn(`Prepared stars are unavailable for ${next.id}; continuing without the catalogue layer.`);
      const stars = starJson === null ? null : parsePreparedLmcStars(starJson, loaded.frame);
      if (disposed || version !== loadVersion) return;
      const resourceUrl = (path: string) => localFile(`${directory}/prepared/${path}`);
      // Decode the selected fixed bank before presenting it; no source processing happens in the lab renderer.
      const queue = [...loaded.resources];
      await Promise.all(Array.from({ length: Math.min(8, queue.length) }, async () => {
        while (queue.length && !disposed && version === loadVersion) {
          const resource = queue.shift()!; const image = new Image(); image.src = resourceUrl(resource.path); await image.decode();
        }
      }));
      if (disposed || version !== loadVersion) return;
      replaceSubject();
      payload = loaded; bankDirectory = directory;
      boundPaths = new Map(loaded.resources.map(item => [`${directory}/prepared/${item.path}`, `${directory}/prepared/${item.path}`]));
      cloud = loadedCloud;
      if (cloud) { host.dataset.cloudSelection = JSON.stringify(cloud.selection()); host.dataset.cloudBrightness = JSON.stringify(cloudBrightness); }
      if (cloud) { host.dataset.cloudDensityFilter = JSON.stringify({ cutoff: 0, softness: .25, showRemoved: false }); host.dataset.cloudDensityReady = 'true'; }
      const instance = mountInspectionScene({ backend: inspectionRenderer(isImage), host, before: end, payload: loaded,
        resolveResource: resourceUrl, composite: Boolean(cloud), overlays: currentMode === 'density',
        ...(currentMode === 'density' || cloud ? { bind(leaf: InspectionLeafResources, nodes: HTMLElement[], setTexture?: (url: string) => void) {
          toneResources.bind(`${directory}/prepared/${leaf.texturePath}`, leaf.widthPx, leaf.heightPx, nodes, setTexture);
        } } : {}), ...(cloud ? { partForLeaf: (id: string) => cloud!.partForLeaf(id) } : {}),
      });
      mounted = instance; cloudSurface = instance.root ? instance : null;
      if (stars) { starLayer = mountPreparedLmcStars({ host, before: end, payload: stars }); starLayer.setVisible(false);
        starLayer.setCloudSupport(cloudFilter, cloud!.selection());
        starInfo = { id: next.sourceSubjectId ?? next.id, count: stars.stars.length, sourceUrl: stars.sourceUrl }; }
      banks = instance.banks; overlays.setMeshes(instance.overlayMeshes);
      if (currentMode === 'density') {
        const available = await overlays.loadOverlayCatalogue();
        if (disposed || version !== loadVersion) return;
        const enabled = overlays.firstEnabled(available);
        if (enabled) await overlays.setOverlay(enabled.id, true, enabled.opacity);
        if (disposed || version !== loadVersion) return;
      }
      view.setRadius((bankFramingRadius = framingRadius) ?? next.framingRadiusUnits ?? Math.max(...loaded.frame.boundsUnits.max.map((v, index) => (v - loaded.frame.boundsUnits.min[index]) / 2)));
      status = `${loaded.resources.length} prepared images · ${(loaded.resources.reduce((sum, item) => sum + item.bytes, 0) / 1e6).toFixed(1)} MB`;
      if (retain) restoreCamera(retain); else if (currentMode === 'density') await referenceView(); else reset();
      if (disposed || version !== loadVersion) return;
      host.dataset.mode = currentMode; host.dataset.subject = id; host.dataset.ready = 'true';
      host.dataset.bankDirectory = directory; host.dataset.bankDataset = shownDataset ?? ''; schedule(); report();
      if (isImage) settleImageBank(host, publish, () => !disposed && version === loadVersion);
      if (originalEnabled && hasOriginal(next) && currentMode === 'photo')
        void setOriginalOverlay(true).catch(failure => { if (!disposed && version === loadVersion) { status = 'Original overlay could not load'; error = String(failure); report(); } });
      if (currentMode === 'photo') followDifference(() => !disposed && version === loadVersion);
    } catch (failure) {
      if (disposed || version !== loadVersion) return;
      if (mounted && payload) { currentMode = host.dataset.mode as ViewerMode; host.dataset.ready = 'true'; }
      status = 'Could not load prepared object'; error = failure instanceof Error ? failure.message : String(failure); report();
      throw failure;
    }
  }
  await setSubject(subject.id);
  return Object.freeze({ setSubject, reset: () => currentMode === 'density' ? referenceView() : reset(), loadOverlayCatalogue: overlays.loadOverlayCatalogue, setOverlay: overlays.setOverlay,
    setOverlayLayer: overlays.setOverlayLayer, getOverlayLayer: overlays.getOverlayLayer, installRemovalLayers: overlays.installRemovalLayers,
    setOverlayPlacement: overlays.setOverlayPlacement, getOverlayState: overlays.getOverlayState,
    referenceView, fitCloud, setOriginalOverlay, setDifferenceOverlay, setCandidateModels, setFieldStars, setMaterial, applyToneResources, applyCloudDensityResources,
    getDensityOverlay: () => densityOverlayEnabled, annotationContext: () => payload && { payload, banks, directory: bankDirectory, subjectId: subject.id, camera: retainCamera() },
    setDensityOverlay(enabled: boolean) {
      if (currentMode !== 'density') return;
      densityOverlayEnabled = enabled; publish();
    },
    getStars: () => starInfo,
    setStars(options: CloudStarOptions) {
      if (!starLayer) return;
      starLayer.setVisible(options.enabled); starLayer.root.style.opacity = String(options.brightness);
      starLayer.setSize(options.size); publish();
    },
    getCloudParts: () => cloud?.catalogue ?? null,
    setCloudSelection(ids: readonly string[]) {
      if (!cloud) throw new Error('This reconstruction has no prepared contribution bank.');
      host.dataset.cloudSelection = JSON.stringify(cloud.setSelection(ids));
      starLayer?.setCloudSupport(cloudFilter, cloud.selection()); layer = null; publish(); report();
    },
    setCloudBrightness(value: CloudBrightness) {
      if (!cloud) throw new Error('This reconstruction has no prepared contribution bank.');
      cloudBrightness = validateCloudBrightness(value);
      host.dataset.cloudBrightness = JSON.stringify(cloudBrightness); publish();
    },
    async setMode(value: ViewerMode) {
      if (value !== 'photo' && value !== 'density') throw new TypeError('Unknown viewer mode.');
      if (value === currentMode) return;
      rememberDensityCamera();
      const saved = retainCamera(); currentMode = value; await setSubject(subject.id, saved);
    },
    setPose(value: CameraPose) {
      view.applyPose(value); report();
    },
    setComponent(value: Component) {
      if (!['all', 'diffuse', 'detail'].includes(value)) throw new TypeError('Unknown component.');
      component = value; if (value !== 'all') axis = 'z'; layer = null; publish(); report();
    },
    setAxis(value: Axis) {
      if (!['auto', 'x', 'y', 'z'].includes(value)) throw new TypeError('Unknown axis.');
      axis = value; if (value !== 'z') component = 'all'; layer = null; publish(); report();
    },
    setLayer(value: number | null) {
      if (value !== null && (!Number.isInteger(value) || value < 0)) throw new TypeError('Invalid layer index.');
      if (value !== null && axis === 'auto') axis = dominantBank().axis;
      layer = value; publish(); report();
    },
    destroy() {
      if (disposed) return; disposed = true; loadVersion++; view.destroy();
      mounted?.destroy(); starLayer?.destroy(); originalOverlay?.destroy(); difference.clear(); candidateModels.clear(); end.remove();
    },
  });
}
