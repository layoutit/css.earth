import { materialResources, sharesMaterialGeometry } from './material-resources';
import { createMaterialSlots, resyncCloudSupport } from './material-slots';
import { mountOverlayLeaves } from '@cssearth/volume-viewer/scene/image-plane';
import type { AppliedStarLayers } from '../star-removal/star-removal-types.ts';
import { parseOverlayVariants, variantsForImage, type ImageLayer, type OverlayVariant } from './overlay-variants';
import { defaultOverlayPlacement, updateOverlayPlacement, overlayPlacementTransform, type OverlayPlacement, validateCloudDensityFilter, type CloudDensityFilter } from '@cssearth/bake/volume';
import { readOverlaySessions, writeOverlaySessions, resolveSavedPlacement } from '../alignment/overlay-store';
import { createToneResourceController, type ToneResource } from '../../adapters/viewer/tone-runtime';
import { cloudCompositeOpacity, createCloudInspection, nativeCloudBrightness, parseCloudCatalogue, validateCloudBrightness } from '@cssearth/volume-viewer/scene/cloud-inspection';
import type { CloudBrightness, CloudStarOptions, CloudStarContext } from '@cssearth/volume-viewer/scene/cloud-types';
import { mountPreparedLmcStars, parsePreparedLmcStars } from '../../adapters/viewer/catalogue-stars';
import { loadRegisteredOverlay, mountReconstructionOverlay } from '../../adapters/viewer/reconstruction-overlay';
import { createDifferencePlane, lensResultOf, type DifferenceOverlayState } from './difference-plane';
import { loadPreparedCssImageLayers, loadPreparedCssVolume, type PreparedCssImageLayers, type PreparedCssVolume, type VolumeCameraPublication } from '../../adapters/viewer/prepared-loaders';

import { createInspectionCamera, type InspectionPose as CameraPose } from '@cssearth/volume-viewer/camera/inspection-camera';
import { dominantInspectionBank, inspectPreparedLayers, mountInspectionScene, type InspectionAxis as Axis,
  type InspectionComponent as Component, type InspectionBank, type InspectionLeafResources } from '@cssearth/volume-viewer/scene/inspection-banks';
import { localFile, subjects } from './subject-catalogue';
import { relativePath, parseOverlayCatalogue, sameOverlayFrame, type DensityOverlay, type DensityOverlayCatalogue } from './overlay-catalogue';
import { inspectionCameraRenderer } from '../../adapters/viewer/inspection-camera-renderer';
import { inspectionRenderer } from '../../adapters/viewer/inspection-renderer';
export { subjects, localFile, registerReconstructionSubject } from './subject-catalogue';
export type { LabSubjectRecord } from './subject-catalogue';
export type { DensityOverlay } from './overlay-catalogue';
export type { InspectionPose as CameraPose } from '@cssearth/volume-viewer/camera/inspection-camera';
export type ViewerMode = 'photo' | 'density';
export interface LabState {
  subjectId: string; component: Component; axis: Axis; layer: number | null;
  layerCount: number; status: string; pose: CameraPose; mode: ViewerMode; error?: string; distanceUnits?: number;
  material: { available: boolean; mode: 'neutral' | 'textured'; loading: boolean };
  originalOverlay: { available: boolean; enabled: boolean; opacity: number; loading: boolean };
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
  const difference = createDifferencePlane();
  const slots = createMaterialSlots();
  // Tone bindings stay keyed by the mounted bank; a swapped lens maps its own texture paths onto those keys.
  let bankDirectory = '', boundPaths = new Map<string, string>();
  let originalPending: Promise<void> | null = null, originalEnabled = false, originalOpacity = .5;
  let overlayCatalogue: DensityOverlayCatalogue | null = null, overlayBasePath = '';
  let overlayMeshes: HTMLElement[] = [];
  let overlayCataloguePending: Promise<DensityOverlay[]> | null = null;
  const overlayNodes = new Map<string, HTMLElement[]>(), overlayEnabled = new Map<string, boolean>(), overlayOpacity = new Map<string, number>();
  const overlayPlacements = new Map<string, OverlayPlacement>();
  const overlayDefaults = new Map<string, OverlayPlacement>();
  const overlayBases = new Map<string, string>(), overlaySessions = readOverlaySessions();
  const overlayLoading = new Map<string, Promise<void>>();
  const overlayLayers = new Map<string, ImageLayer>(), overlayLayerRequests = new Map<string, number>();
  const toneResources = createToneResourceController();
  let densityOverlayEnabled = false;
  let axis: Axis = 'auto', component: Component = 'all', layer: number | null = null;
  let layerCount = 0, status = 'Loading prepared object', error: string | undefined;
  let disposed = false, loadVersion = 0;
  const densityCameras = new Map<string, ReturnType<typeof retainCamera>>();
  const report = () => onState({ subjectId: subject.id, component, axis, layer, layerCount, status, pose: view.pose, mode: currentMode,
    ...(error ? { error } : {}), distanceUnits: view.values.distance,
    material: { available: currentMode === 'photo' && Boolean(subject.reconstructionNeutral), mode: slots.mode, loading: slots.loading },
    originalOverlay: { available: currentMode === 'photo' && Boolean(subject.reconstructionOverlay),
      enabled: currentMode === 'photo' && originalEnabled && Boolean(subject.reconstructionOverlay), opacity: originalOpacity, loading: Boolean(originalPending) },
    differenceOverlay: { available: currentMode === 'photo' && Boolean(subject.reconstructionOverlay && lensResultOf(subject.id)),
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
    mounted.publish(publication); starLayer?.publish(publication); originalOverlay?.publish(publication);
    difference.publish(publication, currentMode === 'photo' && view.pose === 'front');
    inspectLayers();
    if (currentMode === 'density' && !densityOverlayEnabled)
      for (const bank of banks) for (const leaf of bank.leaves) for (const node of leaf.nodes) node.style.visibility = 'hidden';
    host.dataset.densityOverlay = String(currentMode === 'density' && densityOverlayEnabled);
    const opacity = cloud ? cloudCompositeOpacity(banks.map(bank => ({ axis: bank.axis,
      opacity: Number(bank.root.style.opacity), visible: bank.root.style.visibility !== 'hidden' })), cloudBrightness) : 1;
    cloudSurface?.setOpacity(opacity); host.dataset.cloudOpacity = String(opacity);
  }
  function getOverlayState() {
    return [...new Set([...overlayEnabled.keys(), ...overlayPlacements.keys()])].map(id => ({ id,
      enabled: overlayEnabled.get(id) ?? false, opacity: overlayOpacity.get(id) ?? .55,
      placement: { ...(overlayPlacements.get(id) ?? defaultOverlayPlacement()) },
      defaultPlacement: { ...(overlayDefaults.get(id) ?? defaultOverlayPlacement()) },
      basis: overlayBases.get(id) ?? '',
    }));
  }
  function persistOverlays() {
    if (!subject.density?.overlays) return;
    overlaySessions.set(subject.density.overlays, getOverlayState());
    host.dataset.overlayStorage = writeOverlaySessions(overlaySessions) ? 'saved' : 'session';
  }
  function clearOverlays() {
    overlayMeshes = []; overlayNodes.clear(); overlayCatalogue = null; overlayBasePath = ''; overlayCataloguePending = null; overlayLoading.clear();
    overlayEnabled.clear(); overlayOpacity.clear(); overlayPlacements.clear(); overlayBases.clear(); overlayDefaults.clear();
    overlayLayers.clear(); overlayLayerRequests.clear();
  }
  async function loadOverlayCatalogue() {
    if (currentMode !== 'density' || !payload || !subject.density?.overlays) return [] as DensityOverlay[];
    if (overlayCatalogue) return candidateOverlays(overlayCatalogue.overlays);
    if (overlayCataloguePending) return overlayCataloguePending;
    const expectedVersion = loadVersion, expectedPayload = payload, expectedSubject = subject.id;
    const pending = (async () => {
      const manifestPath = subject.density!.overlays!, response = await fetch(localFile(manifestPath));
      if (!response.ok) throw new Error(`Density overlay catalogue is unavailable (HTTP ${response.status}).`);
      const parsed = parseOverlayCatalogue(await response.json());
      const variantResponse = await fetch('/__nebula/image-variants');
      if (!variantResponse.ok) throw new Error(`Image layer catalogue is unavailable (HTTP ${variantResponse.status}).`);
      const variants = parseOverlayVariants(await variantResponse.json());
      for (const item of parsed.overlays) item.variants = variantsForImage(variants, item);
      if (disposed || expectedVersion !== loadVersion || expectedPayload !== payload || expectedSubject !== subject.id || currentMode !== 'density') return [];
      if (!sameOverlayFrame(parsed.frame, payload.frame)) throw new TypeError('Density overlays use a different physical reference frame.');
      const candidates = candidateOverlays(parsed.overlays);
      overlayCatalogue = parsed; overlayBasePath = manifestPath.slice(0, manifestPath.lastIndexOf('/') + 1);
      const available = new Set(parsed.overlays.map(item => item.id));
      for (const id of overlayBases.keys()) if (!available.has(id)) {
        overlayBases.delete(id); overlayPlacements.delete(id); overlayOpacity.delete(id); overlayEnabled.delete(id); overlayDefaults.delete(id);
      }
      for (const item of parsed.overlays) {
        const savedBasis = overlayBases.get(item.id);
        if (savedBasis !== item.style.transform && !(savedBasis && savedBasis === item.legacyPlacementBasis)) {
          overlayPlacements.set(item.id, item.initialPlacement ?? defaultOverlayPlacement());
          overlayOpacity.set(item.id, item.initialOpacity ?? .55); overlayEnabled.set(item.id, false);
        } else {
          overlayPlacements.set(item.id, resolveSavedPlacement(overlayPlacements.get(item.id) ?? defaultOverlayPlacement(),
            overlayDefaults.get(item.id), item.initialPlacement));
        }
        overlayDefaults.set(item.id, item.initialPlacement ?? defaultOverlayPlacement());
        overlayBases.set(item.id, item.style.transform);
        toneResources.bind(`${overlayBasePath}${item.texturePath}`, item.widthPx, item.heightPx);
        for (const variant of item.variants ?? []) toneResources.bind(variant.texturePath, variant.widthPx, variant.heightPx);
      }
      persistOverlays();
      return candidates;
    })();
    overlayCataloguePending = pending;
    try { return await pending; } finally { if (overlayCataloguePending === pending) overlayCataloguePending = null; }
  }
  function candidateOverlays(overlays: DensityOverlay[]) {
    const ids = subject.density?.candidateImageIds;
    if (!ids) return overlays;
    return ids.map(id => {
      const item = overlays.find(overlay => overlay.id === id);
      if (!item) throw new TypeError(`Unknown candidate image ${id} for lab subject ${subject.id}.`);
      return item;
    });
  }
  function applyOverlayPlacement(item: DensityOverlay) {
    if (!payload) return;
    // Prepared volume geometry uses 50 CSS px per object unit. Position controls use physical kpc.
    const pixelsPerKpc = 50 * 3.085677581491367e19 / payload.frame.metersPerUnit;
    const transform = overlayPlacementTransform(item.style.transform, item.pivotCssPx,
      overlayPlacements.get(item.id) ?? defaultOverlayPlacement(), pixelsPerKpc);
    for (const node of overlayNodes.get(item.id) ?? []) node.style.transform = transform;
  }
  function setOverlayPlacement(id: string, patch: Partial<OverlayPlacement>) {
    if (disposed || currentMode !== 'density' || !payload) throw new Error('Image placement is available in Density view only.');
    const item = overlayCatalogue?.overlays.find(value => value.id === id);
    if (!item) throw new TypeError(`Unknown density overlay: ${id}`);
    overlayPlacements.set(id, updateOverlayPlacement(overlayPlacements.get(id) ?? defaultOverlayPlacement(), patch));
    view.stop();
    applyOverlayPlacement(item); persistOverlays();
  }
  async function setOverlay(id: string, enabled: boolean, opacity = overlayOpacity.get(id) ?? .55) {
    if (currentMode !== 'density' || !payload) throw new Error('Image overlays are available in Density view only.');
    if (!(Number.isFinite(opacity) && opacity >= 0 && opacity <= 1)) throw new TypeError('Overlay opacity must be between zero and one.');
    const version = loadVersion;
    const overlays = await loadOverlayCatalogue();
    if (disposed || version !== loadVersion || currentMode !== 'density') return;
    const item = overlays.find(value => value.id === id);
    if (!item) throw new TypeError(`Unknown density overlay: ${id}`);
    if (enabled) for (const [otherId, active] of overlayEnabled) if (otherId !== id && active && overlays.some(overlay => overlay.id === otherId)) {
      overlayEnabled.set(otherId, false);
      for (const node of overlayNodes.get(otherId) ?? []) node.style.visibility = 'hidden';
    }
    overlayOpacity.set(id, opacity); overlayEnabled.set(id, enabled); persistOverlays();
    let nodes = overlayNodes.get(id);
    if (!nodes && enabled) {
      let loading = overlayLoading.get(id);
      if (!loading) {
        loading = (async () => {
          const path = `${overlayBasePath}${item.texturePath}`, url = toneResources.url(path, localFile(path)), image = new Image(); image.src = url; await image.decode();
          if (image.naturalWidth !== item.widthPx || image.naturalHeight !== item.heightPx) throw new TypeError(`Overlay ${id} has an unexpected prepared extent.`);
          if (disposed || version !== loadVersion || currentMode !== 'density' || !overlayEnabled.get(id)) return;
          const current = overlayNodes.get(id);
          if (current) return;
          const created = mountOverlayLeaves(overlayMeshes, id, item.style, url); overlayNodes.set(id, created);
          toneResources.bind(path, item.widthPx, item.heightPx, created);
        })();
        overlayLoading.set(id, loading);
        void loading.then(() => { if (overlayLoading.get(id) === loading) overlayLoading.delete(id); }, () => { if (overlayLoading.get(id) === loading) overlayLoading.delete(id); });
      }
      try { await loading; } catch (failure) {
        if (!disposed && version === loadVersion) { overlayEnabled.set(id, false); persistOverlays(); }
        throw failure;
      }
      if (disposed || version !== loadVersion || currentMode !== 'density') return;
      nodes = overlayNodes.get(id);
    }
    const latestEnabled = overlayEnabled.get(id) ?? false, latestOpacity = overlayOpacity.get(id) ?? opacity;
    for (const node of nodes ?? []) { node.style.opacity = String(latestOpacity); node.style.visibility = latestEnabled ? 'visible' : 'hidden'; }
    applyOverlayPlacement(item);
    publish();
  }
  async function installRemovalLayers(id: string, originalPreviewSha256: string, applied: AppliedStarLayers, isCurrent = () => true) {
    const item = overlayCatalogue?.overlays.find(value => value.id === id), version = loadVersion;
    if (!item || item.sha256 !== originalPreviewSha256 || !applied.resultId || applied.layers.length !== 2 ||
      new Set(applied.layers.map(layer => layer.id)).size !== 2) throw new TypeError('Removal layers do not match the original aligned image.');
    const variants: OverlayVariant[] = [];
    for (const layer of applied.layers) {
      if (!['diffuse', 'stars'].includes(layer.id) || !/^[a-f0-9]{64}$/.test(layer.sha256) ||
        !layer.texturePath.startsWith('.local/nebula-lab/') || layer.texturePath.split('/').includes('..') || /[\\\u0000-\u0020?#]/.test(layer.texturePath) ||
        !Number.isInteger(layer.widthPx) || layer.widthPx < 1 || !Number.isInteger(layer.heightPx) || layer.heightPx < 1 ||
        Math.abs(layer.widthPx / layer.heightPx / (item.widthPx / item.heightPx) - 1) > .001)
        throw new TypeError('Invalid prepared removal image.');
      const image = new Image(); image.src = localFile(layer.texturePath); await image.decode();
      if (image.naturalWidth !== layer.widthPx || image.naturalHeight !== layer.heightPx) throw new TypeError('Removal image decoded at the wrong size.');
      const { url: _serverUrl, ...metadata } = layer;
      variants.push({ ...metadata, label: layer.id === 'diffuse' ? 'Without stars' : 'Residual' });
    }
    if (disposed || version !== loadVersion || !isCurrent()) return;
    overlayLayerRequests.set(id, (overlayLayerRequests.get(id) ?? 0) + 1);
    item.variants = variants; item.removalResultId = applied.resultId;
    for (const layer of variants) toneResources.bind(layer.texturePath, layer.widthPx, layer.heightPx);
  }
  function getOverlayLayer(id: string): ImageLayer { return overlayLayers.get(id) ?? 'original'; }
  async function setOverlayLayer(id: string, layer: ImageLayer, isCurrent = () => true) {
    const item = overlayCatalogue?.overlays.find(value => value.id === id);
    const variant = item?.variants?.find(value => value.id === layer);
    if (!item || (layer !== 'original' && !variant)) throw new TypeError('Unknown image layer.');
    const request = (overlayLayerRequests.get(id) ?? 0) + 1, version = loadVersion;
    overlayLayerRequests.set(id, request);
    const current = () => !disposed && version === loadVersion && overlayLayerRequests.get(id) === request && isCurrent();
    const path = variant?.texturePath ?? `${overlayBasePath}${item.texturePath}`;
    const width = variant?.widthPx ?? item.widthPx, height = variant?.heightPx ?? item.heightPx;
    const url = toneResources.url(path, localFile(path)), image = new Image(); image.src = url; await image.decode();
    if (image.naturalWidth !== width || image.naturalHeight !== height) throw new TypeError('Image layer decoded at the wrong size.');
    if (!current()) return;
    if (!overlayNodes.has(id)) await setOverlay(id, true);
    if (!current()) return;
    const nodes = overlayNodes.get(id) ?? [];
    toneResources.unbind(nodes);
    for (const node of nodes) { node.style.backgroundImage = `url(${JSON.stringify(url)})`; node.dataset.imageLayer = layer; }
    toneResources.bind(path, width, height, nodes); overlayLayers.set(id, layer);
  }
  function reset() {
    if (subject.referenceDistanceUnits !== undefined) { applyEarthCamera(); return; }
    view.reset(); report();
  }
  async function referenceView() {
    if (!payload) throw new Error('The prepared object is still loading.');
    if (currentMode === 'density') {
      const version = loadVersion, expectedPayload = payload;
      await loadOverlayCatalogue();
      if (disposed || version !== loadVersion || expectedPayload !== payload || currentMode !== 'density') return;
    }
    applyEarthCamera();
  }
  function applyEarthCamera() {
    view.referenceView(subject.density?.referenceFramingRadiusUnits ?? subject.framingRadiusUnits,
      [subject.referenceDistanceUnits, currentMode === 'density' ? overlayCatalogue?.referenceDistanceUnits : undefined]);
    status = 'Earth view · shared observer and framing'; report();
  }
  function fitCloud() {
    if (currentMode !== 'density' || !payload) throw new Error('Fit cloud is available in Density view only.');
    view.fitCloud(); status = 'Prepared density cloud fitted to its full bounds'; report();
  }
  const retainCamera = () => view.retain();
  const restoreCamera = (saved: ReturnType<typeof retainCamera>) => { view.restore(saved); report(); };
  async function setOriginalOverlay(enabled: boolean, opacity = originalOpacity) {
    if (!(Number.isFinite(opacity) && opacity >= 0 && opacity <= 1)) throw new TypeError('Original image opacity must be between zero and one.');
    originalEnabled = enabled; originalOpacity = opacity;
    if (!enabled) { originalOverlay?.setVisible(false, opacity); report(); return; }
    if (currentMode !== 'photo' || !subject.reconstructionOverlay || !payload)
      throw new Error('This saved reconstruction has no prepared original-image overlay.');
    const version = loadVersion, expectedSubject = subject.id;
    const current = () => !disposed && version === loadVersion && expectedSubject === subject.id && currentMode === 'photo';
    if (!originalOverlay && !originalPending) {
      const manifestPath = subject.reconstructionOverlay, expectedFrame = payload.frame, expectedDistance = subject.referenceDistanceUnits;
      const pending = (async () => {
        const { overlay, textureUrl: url } = await loadRegisteredOverlay(manifestPath, localFile, { frame: expectedFrame, distanceUnits: expectedDistance });
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
  /** The render-minus-source map for the displayed image lens, on the original image's registered quad. */
  async function setDifferenceOverlay(enabled: boolean, opacity = difference.opacity) {
    if (enabled && (currentMode !== 'photo' || !payload)) throw new Error('The difference map is shown on the reconstruction’s Earth view.');
    const version = loadVersion, expectedSubject = subject.id;
    const current = () => !disposed && version === loadVersion && expectedSubject === subject.id && currentMode === 'photo';
    const loading = difference.set(enabled, opacity, payload ? { host, before: starLayer?.root ?? end, resultId: lensResultOf(subject.id),
      manifestPath: subject.reconstructionOverlay, frame: payload.frame, distanceUnits: subject.referenceDistanceUnits, url: localFile, current } : undefined);
    report();
    try { await loading; } finally { if (current()) { publish(); report(); } }
  }
  const followDifference = (current: () => boolean) => {
    // The switch survives a subject without a lens (the unpainted density) and remounts on the next lens.
    if (difference.enabled && subject.reconstructionOverlay && lensResultOf(subject.id)) void setDifferenceOverlay(true).catch(failure => { if (current()) { status = 'Difference map could not load'; error = String(failure); report(); } });
  };
  function rememberDensityCamera() {
    if (payload && host.dataset.mode === 'density' && subject.density) {
      densityCameras.set(subject.density.directory, retainCamera());
    }
  }
  async function applyToneResources(target: 'image' | 'density', imageId: string | undefined, resources: ToneResource[], isCurrent = () => true) {
    if (currentMode !== 'density' || !payload || host.dataset.ready !== 'true') throw new Error('Density is still loading; tone can be applied when it is ready.');
    const version = loadVersion;
    const overlay = overlayCatalogue?.overlays.find(item => item.id === imageId);
    const variant = overlay?.variants?.find(item => item.id === getOverlayLayer(overlay.id));
    const expected = target === 'image' ? (overlay ? [variant?.texturePath ?? `${overlayBasePath}${overlay.texturePath}`] : []) :
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
    if (!payload || currentMode !== 'photo' || host.dataset.ready !== 'true' || !subject.reconstructionNeutral || payload.schema !== 'cssearth-css-volume@1') throw new Error('No interchangeable material bank.');
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
    if (!source || source.schema !== 'cssearth-css-volume@1') throw new TypeError('No retained volume geometry to repaint.');
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
    originalOverlay?.destroy(); originalOverlay = null; originalPending = null; difference.clear();
    host.dataset.material = slots.mode;
    if (cloud) {
      host.dataset.cloudSelection = JSON.stringify(cloud.selection()); host.dataset.cloudBrightness = JSON.stringify(cloudBrightness);
      host.dataset.cloudDensityFilter = JSON.stringify(cloudFilter); host.dataset.cloudDensityReady = 'true';
    }
    status = `${replacement.resources.length} prepared images · material changed on retained geometry`;
    host.dataset.subject = next.id; host.dataset.ready = 'true'; publish(); report();
    if (originalEnabled && next.reconstructionOverlay)
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
    const retain = currentMode === 'density' ? densityCameras.get(next.density?.directory ?? '') :
      cameraOverride ?? (subject.id !== next.id && subject.comparisonGroup !== undefined && subject.comparisonGroup === next.comparisonGroup ? retainCamera() : null);
    const directory = currentMode === 'density' ? next.density?.directory : next.directory;
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
      if (overlayCatalogue && subject.density?.overlays) overlaySessions.set(subject.density.overlays, getOverlayState());
      subject = next; densityOverlayEnabled = !next.density?.overlays; view.measure(); axis = 'auto'; component = 'all'; layer = null;
      mounted?.destroy(); mounted = null; banks = []; payload = null; layerCount = 0; clearOverlays(); toneResources.clear();
      cloudSurface = null;
      starLayer?.destroy(); starLayer = null; starInfo = null;
      originalOverlay?.destroy(); originalOverlay = null; originalPending = null; difference.clear();
      cloud = null; cloudBrightness = nativeCloudBrightness(); host.style.opacity = '1';
      cloudFilter = { cutoff: 0, softness: .25, showRemoved: false };
      delete host.dataset.cloudSelection; delete host.dataset.cloudBrightness; delete host.dataset.cloudOpacity;
      delete host.dataset.cloudDensityFilter; delete host.dataset.cloudDensityReady;
      for (const saved of overlaySessions.get(next.density?.overlays ?? '') ?? []) {
        overlayEnabled.set(saved.id, saved.enabled); overlayOpacity.set(saved.id, saved.opacity); overlayPlacements.set(saved.id, { ...saved.placement });
        overlayBases.set(saved.id, saved.basis);
        if (saved.defaultPlacement) overlayDefaults.set(saved.id, saved.defaultPlacement);
      }
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
      const isImage = descriptor.type === 'image-layer-bank';
      const loaded = await (isImage ? loadPreparedCssImageLayers : loadPreparedCssVolume)(descriptor, { read: fetchBytes });
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
      banks = instance.banks; overlayMeshes = instance.overlayMeshes;
      if (currentMode === 'density') {
        const available = await loadOverlayCatalogue();
        if (disposed || version !== loadVersion) return;
        const enabled = available.filter(item => overlayEnabled.get(item.id));
        if (enabled[0]) await setOverlay(enabled[0].id, true, overlayOpacity.get(enabled[0].id));
        if (disposed || version !== loadVersion) return;
      }
      view.setRadius(next.framingRadiusUnits ?? Math.max(...loaded.frame.boundsUnits.max.map((v, index) => (v - loaded.frame.boundsUnits.min[index]) / 2)));
      status = `${loaded.resources.length} prepared images · ${(loaded.resources.reduce((sum, item) => sum + item.bytes, 0) / 1e6).toFixed(1)} MB`;
      if (retain) restoreCamera(retain); else if (currentMode === 'density') await referenceView(); else reset();
      if (disposed || version !== loadVersion) return;
      host.dataset.mode = currentMode; host.dataset.subject = id; host.dataset.ready = 'true';
      schedule(); report();
      if (originalEnabled && next.reconstructionOverlay && currentMode === 'photo')
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
  return Object.freeze({ setSubject, reset: () => currentMode === 'density' ? referenceView() : reset(), loadOverlayCatalogue, setOverlay, setOverlayLayer, getOverlayLayer, installRemovalLayers, setOverlayPlacement, getOverlayState,
    referenceView, fitCloud, setOriginalOverlay, setDifferenceOverlay, setMaterial, applyToneResources, applyCloudDensityResources,
    getDensityOverlay: () => densityOverlayEnabled,
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
      mounted?.destroy(); starLayer?.destroy(); originalOverlay?.destroy(); difference.clear(); end.remove();
    },
  });
}
