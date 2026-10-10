import type { PreparedCssImageLayers, PreparedCssVolume } from '@cssearth/objects';
import { mountOverlayLeaves } from '@cssearth/volume-viewer/scene/image-plane';
import { defaultOverlayPlacement, updateOverlayPlacement, overlayPlacementTransform, type OverlayPlacement } from '@cssearth/bake/volume';
import type { AppliedStarLayers } from '../star-removal/star-removal-types.ts';
import { parseOverlayVariants, variantsForImage, type ImageLayer, type OverlayVariant } from './overlay-variants';
import { readOverlaySessions, writeOverlaySessions, resolveSavedPlacement } from '../alignment/overlay-store';
import type { createToneResourceController } from '../../adapters/viewer/tone-runtime';
import { localFile, type LabSubjectRecord } from './subject-catalogue';
import { parseOverlayCatalogue, sameOverlayFrame, type DensityOverlay, type DensityOverlayCatalogue } from './overlay-catalogue';

/** What the overlays read from the viewer at each call: the mounted subject, its payload and the load it belongs to. */
export interface DensityOverlayContext {
  readonly mode: 'photo' | 'density';
  readonly payload: PreparedCssVolume | PreparedCssImageLayers | null;
  readonly subject: LabSubjectRecord;
  readonly version: number;
  readonly disposed: boolean;
}

/** The Density view's registered image overlays: their catalogue, placement, opacity, image layers and saved sessions.
 * The viewer owns the mounted bank; this owns only the overlay leaves it mounts into the bank's overlay meshes. */
export function createDensityOverlays({ host, toneResources, live, stop, publish }: {
  host: HTMLElement; toneResources: ReturnType<typeof createToneResourceController>;
  live(): DensityOverlayContext; stop(): void; publish(): void;
}) {
  let overlayCatalogue: DensityOverlayCatalogue | null = null, overlayBasePath = '';
  let overlayMeshes: HTMLElement[] = [];
  let overlayCataloguePending: Promise<DensityOverlay[]> | null = null;
  const overlayNodes = new Map<string, HTMLElement[]>(), overlayEnabled = new Map<string, boolean>(), overlayOpacity = new Map<string, number>();
  const overlayPlacements = new Map<string, OverlayPlacement>();
  const overlayDefaults = new Map<string, OverlayPlacement>();
  const overlayBases = new Map<string, string>(), overlaySessions = readOverlaySessions();
  const overlayLoading = new Map<string, Promise<void>>();
  const overlayLayers = new Map<string, ImageLayer>(), overlayLayerRequests = new Map<string, number>();

  function getOverlayState() {
    return [...new Set([...overlayEnabled.keys(), ...overlayPlacements.keys()])].map(id => ({ id,
      enabled: overlayEnabled.get(id) ?? false, opacity: overlayOpacity.get(id) ?? .55,
      placement: { ...(overlayPlacements.get(id) ?? defaultOverlayPlacement()) },
      defaultPlacement: { ...(overlayDefaults.get(id) ?? defaultOverlayPlacement()) },
      basis: overlayBases.get(id) ?? '',
    }));
  }
  function persistOverlays() {
    const { subject } = live();
    if (!subject.density?.overlays) return;
    overlaySessions.set(subject.density.overlays, getOverlayState());
    host.dataset.overlayStorage = writeOverlaySessions(overlaySessions) ? 'saved' : 'session';
  }
  function clear() {
    overlayMeshes = []; overlayNodes.clear(); overlayCatalogue = null; overlayBasePath = ''; overlayCataloguePending = null; overlayLoading.clear();
    overlayEnabled.clear(); overlayOpacity.clear(); overlayPlacements.clear(); overlayBases.clear(); overlayDefaults.clear();
    overlayLayers.clear(); overlayLayerRequests.clear();
  }
  /** Keep the leaving subject's overlay session in memory, before the viewer replaces it. */
  function saveSession() {
    const { subject } = live();
    if (overlayCatalogue && subject.density?.overlays) overlaySessions.set(subject.density.overlays, getOverlayState());
  }
  /** Restore the saved overlay session of the subject being mounted (after `clear`). */
  function restoreSession(path: string) {
    for (const saved of overlaySessions.get(path) ?? []) {
      overlayEnabled.set(saved.id, saved.enabled); overlayOpacity.set(saved.id, saved.opacity); overlayPlacements.set(saved.id, { ...saved.placement });
      overlayBases.set(saved.id, saved.basis);
      if (saved.defaultPlacement) overlayDefaults.set(saved.id, saved.defaultPlacement);
    }
  }
  async function loadOverlayCatalogue() {
    const start = live(), subject = start.subject, payload = start.payload;
    if (start.mode !== 'density' || !payload || !subject.density?.overlays) return [] as DensityOverlay[];
    if (overlayCatalogue) return candidateOverlays(overlayCatalogue.overlays);
    if (overlayCataloguePending) return overlayCataloguePending;
    const expectedVersion = start.version, expectedSubject = subject.id;
    const pending = (async () => {
      const manifestPath = subject.density!.overlays!, response = await fetch(localFile(manifestPath));
      if (!response.ok) throw new Error(`Density overlay catalogue is unavailable (HTTP ${response.status}).`);
      const parsed = parseOverlayCatalogue(await response.json());
      const variantResponse = await fetch('/__nebula/image-variants');
      if (!variantResponse.ok) throw new Error(`Image layer catalogue is unavailable (HTTP ${variantResponse.status}).`);
      const variants = parseOverlayVariants(await variantResponse.json());
      for (const item of parsed.overlays) item.variants = variantsForImage(variants, item);
      const now = live();
      if (now.disposed || expectedVersion !== now.version || payload !== now.payload || expectedSubject !== now.subject.id || now.mode !== 'density') return [];
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
    const { subject } = live(), ids = subject.density?.candidateImageIds;
    if (!ids) return overlays;
    return ids.map(id => {
      const item = overlays.find(overlay => overlay.id === id);
      if (!item) throw new TypeError(`Unknown candidate image ${id} for lab subject ${subject.id}.`);
      return item;
    });
  }
  function applyOverlayPlacement(item: DensityOverlay) {
    const { payload } = live();
    if (!payload) return;
    // Prepared volume geometry uses 50 CSS px per object unit. Position controls use physical kpc.
    const pixelsPerKpc = 50 * 3.085677581491367e19 / payload.frame.metersPerUnit;
    const transform = overlayPlacementTransform(item.style.transform, item.pivotCssPx,
      overlayPlacements.get(item.id) ?? defaultOverlayPlacement(), pixelsPerKpc);
    for (const node of overlayNodes.get(item.id) ?? []) node.style.transform = transform;
  }
  function setOverlayPlacement(id: string, patch: Partial<OverlayPlacement>) {
    const { disposed, mode, payload } = live();
    if (disposed || mode !== 'density' || !payload) throw new Error('Image placement is available in Density view only.');
    const item = overlayCatalogue?.overlays.find(value => value.id === id);
    if (!item) throw new TypeError(`Unknown density overlay: ${id}`);
    overlayPlacements.set(id, updateOverlayPlacement(overlayPlacements.get(id) ?? defaultOverlayPlacement(), patch));
    stop();
    applyOverlayPlacement(item); persistOverlays();
  }
  async function setOverlay(id: string, enabled: boolean, opacity = overlayOpacity.get(id) ?? .55) {
    const start = live();
    if (start.mode !== 'density' || !start.payload) throw new Error('Image overlays are available in Density view only.');
    if (!(Number.isFinite(opacity) && opacity >= 0 && opacity <= 1)) throw new TypeError('Overlay opacity must be between zero and one.');
    const version = start.version;
    const stale = () => { const now = live(); return now.disposed || version !== now.version || now.mode !== 'density'; };
    const overlays = await loadOverlayCatalogue();
    if (stale()) return;
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
          if (stale() || !overlayEnabled.get(id)) return;
          const current = overlayNodes.get(id);
          if (current) return;
          const created = mountOverlayLeaves(overlayMeshes, id, item.style, url); overlayNodes.set(id, created);
          toneResources.bind(path, item.widthPx, item.heightPx, created);
        })();
        overlayLoading.set(id, loading);
        void loading.then(() => { if (overlayLoading.get(id) === loading) overlayLoading.delete(id); }, () => { if (overlayLoading.get(id) === loading) overlayLoading.delete(id); });
      }
      try { await loading; } catch (failure) {
        const now = live();
        if (!now.disposed && version === now.version) { overlayEnabled.set(id, false); persistOverlays(); }
        throw failure;
      }
      if (stale()) return;
      nodes = overlayNodes.get(id);
    }
    const latestEnabled = overlayEnabled.get(id) ?? false, latestOpacity = overlayOpacity.get(id) ?? opacity;
    for (const node of nodes ?? []) { node.style.opacity = String(latestOpacity); node.style.visibility = latestEnabled ? 'visible' : 'hidden'; }
    applyOverlayPlacement(item);
    publish();
  }
  /** The overlay a restored session had switched on, to re-show once the bank has mounted. */
  function firstEnabled(available: readonly DensityOverlay[]) {
    const item = available.find(value => overlayEnabled.get(value.id));
    return item && { id: item.id, opacity: overlayOpacity.get(item.id) };
  }
  async function installRemovalLayers(id: string, applied: AppliedStarLayers, isCurrent = () => true) {
    const item = overlayCatalogue?.overlays.find(value => value.id === id), version = live().version;
    if (!item || !applied.resultId || applied.layers.length !== 2 ||
      new Set(applied.layers.map(layer => layer.id)).size !== 2) throw new TypeError('Removal layers do not match the original aligned image.');
    const variants: OverlayVariant[] = [];
    for (const layer of applied.layers) {
      if (!['diffuse', 'stars'].includes(layer.id) ||
        !/^(?:\.local\/nebula-lab\/|src\/objects\/[a-z0-9-]+\/\.local\/)/.test(layer.texturePath) || layer.texturePath.split('/').includes('..') || /[\\\u0000- ?#]/.test(layer.texturePath) ||
        !Number.isInteger(layer.widthPx) || layer.widthPx < 1 || !Number.isInteger(layer.heightPx) || layer.heightPx < 1 ||
        Math.abs(layer.widthPx / layer.heightPx / (item.widthPx / item.heightPx) - 1) > .001)
        throw new TypeError('Invalid prepared removal image.');
      const image = new Image(); image.src = localFile(layer.texturePath); await image.decode();
      if (image.naturalWidth !== layer.widthPx || image.naturalHeight !== layer.heightPx) throw new TypeError('Removal image decoded at the wrong size.');
      const { url: _serverUrl, ...metadata } = layer;
      variants.push({ ...metadata, label: layer.id === 'diffuse' ? 'Without stars' : 'Residual' });
    }
    const now = live();
    if (now.disposed || version !== now.version || !isCurrent()) return;
    overlayLayerRequests.set(id, (overlayLayerRequests.get(id) ?? 0) + 1);
    item.variants = variants; item.removalResultId = applied.resultId;
    for (const layer of variants) toneResources.bind(layer.texturePath, layer.widthPx, layer.heightPx);
  }
  function getOverlayLayer(id: string): ImageLayer { return overlayLayers.get(id) ?? 'original'; }
  async function setOverlayLayer(id: string, layer: ImageLayer, isCurrent = () => true) {
    const item = overlayCatalogue?.overlays.find(value => value.id === id);
    const variant = item?.variants?.find(value => value.id === layer);
    if (!item || (layer !== 'original' && !variant)) throw new TypeError('Unknown image layer.');
    const request = (overlayLayerRequests.get(id) ?? 0) + 1, version = live().version;
    overlayLayerRequests.set(id, request);
    const current = () => { const now = live(); return !now.disposed && version === now.version && overlayLayerRequests.get(id) === request && isCurrent(); };
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
  /** The texture the tone controls act on for an image: its shown layer, or none when the image is not in the catalogue. */
  function shownTexture(imageId: string | undefined): string[] {
    const overlay = overlayCatalogue?.overlays.find(item => item.id === imageId);
    const variant = overlay?.variants?.find(item => item.id === getOverlayLayer(overlay.id));
    return overlay ? [variant?.texturePath ?? `${overlayBasePath}${overlay.texturePath}`] : [];
  }
  return {
    catalogue: () => overlayCatalogue, setMeshes(meshes: HTMLElement[]) { overlayMeshes = meshes; },
    clear, saveSession, restoreSession, loadOverlayCatalogue, firstEnabled, setOverlay, setOverlayPlacement, getOverlayState,
    installRemovalLayers, getOverlayLayer, setOverlayLayer, shownTexture,
  };
}
