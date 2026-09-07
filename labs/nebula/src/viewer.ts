import records from './subjects.json';
import sourceCatalog from '../sources/index.json';
import { defaultOverlayPlacement, updateOverlayPlacement, overlayPlacementTransform, type OverlayPlacement } from './overlay-placement';
import * as runtimePolicy from '../../../site/runtime-policy.mjs';
import { createObjectInteractionControls } from '../../../src/renderers/css/navigation/object-interaction-controls';
import { worldCameraFromCenteredPresentation } from '../../../src/renderers/css/navigation/world-camera';
import { worldRotationFromQuaternion } from '../../../src/renderers/css/navigation/world-camera-math';
import { rotationFromMatrix3d } from '../../../src/renderers/css/solar-system/heliocentric-geometry';
import { loadPreparedCssImageLayers } from '../../../src/renderers/css/image-layers/loader';
import type { PreparedCssImageLayers } from '../../../src/renderers/css/image-layers/loader';
import { mountPreparedCssImageLayers } from '../../../src/renderers/css/image-layers/prepared-image-layer-runtime';
import { loadPreparedCssVolume } from '../../../src/renderers/css/volume/loader';
import { mountPreparedCssVolume } from '../../../src/renderers/css/volume/prepared-volume-runtime';
import type { PreparedCssVolume } from '../../../src/renderers/css/volume/types';
import type { CameraDelta, CameraUpdate } from '../../../src/renderers/css/navigation/types';
import '../../../src/renderers/css/styles/volume.css';

declare const __NEBULA_REPO_ROOT__: string;
interface LabSubjectRecord {
  id: string;
  name: string;
  directory: string;
  /** Comparison image relative to directory, or imagePath relative to the repository. */
  image?: string;
  imagePath?: string;
  /** Reuse a photographed subject's reference catalogue for derived experiments. */
  sourceSubjectId?: string;
  comparisonImages?: { id: string; name: string; imagePath: string }[];
  sourcePageUrl?: string;
  credit?: string;
  modelNote?: string;
  framingRadiusUnits?: number;
  hasDetail?: boolean;
  comparisonGroup?: string;
  referenceProjectionScale?: number;
  density?: { directory: string; modelNote: string; sourcePageUrl: string; credit: string; overlays?: string };
}
const subjectRecords: readonly LabSubjectRecord[] = records;
export const localFile = (path: string) => `/@fs${__NEBULA_REPO_ROOT__}/${path}`;
const recipes = import.meta.glob('../../../src/objects/*/source/recipe.json', { eager: true, import: 'default' }) as
  Record<string, { source: { publisherUrl: string; credit: string }; geometry: { supportRadiusKpc: number } }>;
const candidates = import.meta.glob('../../../.local/nebula-lab/*-{cutout,diffuse,residual,mask}.png',
  { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const subjects = subjectRecords.map(record => {
  if (record.referenceProjectionScale !== undefined &&
      (!Number.isFinite(record.referenceProjectionScale) || record.referenceProjectionScale <= 0)) {
    throw new TypeError(`Lab subject ${record.id} has an invalid reference projection scale.`);
  }
  const recipe = recipes[`../../../${record.directory}/source/recipe.json`];
  const imagePath = record.imagePath ?? (record.image ? `${record.directory}/${record.image}` : null);
  if (!imagePath) throw new TypeError(`Lab subject ${record.id} has no comparison image path.`);
  const sourceUrl = localFile(imagePath);
  const sourcePageUrl = record.sourcePageUrl ?? recipe?.source.publisherUrl;
  const credit = record.credit ?? recipe?.source.credit;
  const declared = sourceCatalog.subjects.find(item => item.subjectId === (record.sourceSubjectId ?? record.id))?.sources;
  const sourceImages = declared?.map(source => ({ id: source.id, name: source.name,
    sourceUrl: localFile(`${sourceCatalog.pathBase}/${source.path}`), sourcePageUrl: source.sourcePageUrl, credit: source.credit }))
    ?? [{ id: `${record.id}-source`, name: `${record.name} · source`, sourceUrl, sourcePageUrl, credit }];
  for (const comparison of record.comparisonImages ?? []) {
    sourceImages.push({ id: comparison.id, name: comparison.name, sourceUrl: localFile(comparison.imagePath),
      sourcePageUrl: sourceImages[0]?.sourcePageUrl,
      credit: `Offline extraction used by this volume. ${sourceImages[0]?.credit ?? ''}` });
  }
  for (const kind of ['cutout', 'diffuse', 'residual', 'mask']) {
    const url = candidates[`../../../.local/nebula-lab/${record.id}-${kind}.png`];
    if (url) sourceImages.push({ id: `${record.id}-${kind}`, name: `Extraction candidate · ${kind}`, sourceUrl: url,
      sourcePageUrl, credit: `Local extraction experiment. Not a calibrated measurement. ${credit ?? ''}` });
  }
  return { ...record, sourceUrl, sourcePageUrl, credit, sourceImages, hasDetail: record.hasDetail ?? Boolean(recipe),
    framingRadiusUnits: record.framingRadiusUnits ?? recipe?.geometry.supportRadiusKpc };
});
type Axis = 'auto' | 'x' | 'y' | 'z';
type Component = 'all' | 'diffuse' | 'detail';
export type ViewerMode = 'photo' | 'density';
export type CameraPose = 'front' | 'x-minus-60' | 'x-minus-30' | 'x-plus-30' | 'x-plus-60' |
  'y-minus-60' | 'y-minus-30' | 'y-plus-30' | 'y-plus-60' | 'edge-x' | 'edge-y' | 'manual';
const POSE_OFFSETS: Record<Exclude<CameraPose, 'manual'>, readonly [number, number]> = {
  front: [0, 0], 'x-minus-60': [-60, 0], 'x-minus-30': [-30, 0], 'x-plus-30': [30, 0], 'x-plus-60': [60, 0],
  'y-minus-60': [0, -60], 'y-minus-30': [0, -30], 'y-plus-30': [0, 30], 'y-plus-60': [0, 60],
  'edge-x': [90, 0], 'edge-y': [0, 90],
};

function relativePath(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !/^(?:[a-z]+:|\/)/i.test(value) &&
    !value.split('/').includes('..') && !/[\\\u0000-\u0020?#]/.test(value);
}
function finiteVector(value: unknown, length: number): value is number[] {
  return Array.isArray(value) && value.length === length && value.every(item => typeof item === 'number' && Number.isFinite(item));
}
function parseOverlayCatalogue(value: unknown): DensityOverlayCatalogue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid density overlay catalogue.');
  const data = value as Record<string, unknown>, frame = data.frame as Record<string, unknown>;
  if (data.schema !== 'cssearth-nebula-overlays@1' || !frame || Array.isArray(frame) ||
      typeof frame.referenceFrame !== 'string' || !frame.referenceFrame || typeof frame.epochJdTt !== 'number' || !Number.isFinite(frame.epochJdTt) ||
      !finiteVector(frame.originM, 3) || !finiteVector(frame.localToReferenceXyzw, 4) ||
      Math.abs(Math.hypot(...(frame.localToReferenceXyzw as number[])) - 1) > 1e-9 ||
      typeof frame.metersPerUnit !== 'number' || !Number.isFinite(frame.metersPerUnit) || frame.metersPerUnit <= 0 ||
      !Array.isArray(data.overlays)) throw new TypeError('Invalid prepared density overlay frame.');
  const ids = new Set<string>();
  const overlays = data.overlays.map(input => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Invalid density overlay.');
    const item = input as Record<string, unknown>, style = item.style as Record<string, unknown>;
    const styleKeys = ['width', 'height', 'transform', 'backgroundSize', 'backgroundPosition'];
    if (typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.label !== 'string' || !item.label ||
        !relativePath(item.texturePath) || !Number.isInteger(item.widthPx) || (item.widthPx as number) < 1 ||
        !Number.isInteger(item.heightPx) || (item.heightPx as number) < 1 || !style || Array.isArray(style) ||
        Object.keys(style).some(key => !styleKeys.includes(key)) || styleKeys.some(key => typeof style[key] !== 'string' || !style[key]) ||
        typeof item.sourcePageUrl !== 'string' || !/^https:\/\//.test(item.sourcePageUrl) ||
        typeof item.credit !== 'string' || !item.credit || typeof item.registrationNote !== 'string' || !item.registrationNote ||
        !finiteVector(item.pivotCssPx, 3)) {
      throw new TypeError('Invalid prepared density overlay.');
    }
    ids.add(item.id);
    return { id: item.id, label: item.label, texturePath: item.texturePath, widthPx: item.widthPx, heightPx: item.heightPx,
      pivotCssPx: item.pivotCssPx,
      style: Object.fromEntries(styleKeys.map(key => [key, style[key]])) as DensityOverlay['style'],
      sourcePageUrl: item.sourcePageUrl, credit: item.credit, registrationNote: item.registrationNote };
  });
  const referenceDistanceUnits = data.referenceDistanceUnits ?? data.observerDistanceUnits;
  if (referenceDistanceUnits !== undefined && (typeof referenceDistanceUnits !== 'number' || !Number.isFinite(referenceDistanceUnits) || referenceDistanceUnits <= 0)) {
    throw new TypeError('Overlay reference distance must be positive.');
  }
  return { schema: 'cssearth-nebula-overlays@1', frame: {
    referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt, originM: frame.originM as number[],
    localToReferenceXyzw: frame.localToReferenceXyzw as number[], metersPerUnit: frame.metersPerUnit,
  }, overlays, ...(data.referenceDistanceUnits === undefined && data.observerDistanceUnits === undefined ? {} : {
    referenceDistanceUnits: data.referenceDistanceUnits ?? data.observerDistanceUnits,
  }) } as unknown as DensityOverlayCatalogue;
}
function sameOverlayFrame(a: DensityOverlayCatalogue['frame'], b: PreparedCssVolume['frame']): boolean {
  return a.referenceFrame === b.referenceFrame && a.epochJdTt === b.epochJdTt && a.metersPerUnit === b.metersPerUnit &&
    JSON.stringify(a.originM) === JSON.stringify(b.originM) && JSON.stringify(a.localToReferenceXyzw) === JSON.stringify(b.localToReferenceXyzw);
}
export interface LabState {
  subjectId: string; component: Component; axis: Axis; layer: number | null;
  layerCount: number; status: string; pose: CameraPose; mode: ViewerMode; error?: string; distanceUnits?: number;
}

export interface DensityOverlay {
  id: string; label: string; texturePath: string; widthPx: number; heightPx: number;
  pivotCssPx: [number, number, number];
  style: { width: string; height: string; transform: string; backgroundSize: string; backgroundPosition: string };
  sourcePageUrl: string; credit: string; registrationNote: string;
}
interface DensityOverlayCatalogue { schema: 'cssearth-nebula-overlays@1'; frame: Omit<PreparedCssVolume['frame'], 'boundsUnits'>; overlays: DensityOverlay[]; referenceDistanceUnits?: number; }

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
  let mounted: { publish(publication: Parameters<ReturnType<typeof mountPreparedCssImageLayers>['publish']>[0]): void; destroy(): void } | null = null;
  let banks: { axis: Exclude<Axis, 'auto'>; root: HTMLElement; leaves: { nodes: HTMLElement[]; detail: boolean }[] }[] = [];
  let overlayCatalogue: DensityOverlayCatalogue | null = null, overlayBasePath = '';
  let overlayMeshes: HTMLElement[] = [];
  let overlayCataloguePending: Promise<DensityOverlay[]> | null = null;
  const overlayNodes = new Map<string, HTMLElement[]>(), overlayEnabled = new Map<string, boolean>(), overlayOpacity = new Map<string, number>();
  const overlayPlacements = new Map<string, OverlayPlacement>();
  const overlaySessions = new Map<string, { id: string; enabled: boolean; opacity: number; placement: OverlayPlacement }[]>();
  const overlayLoading = new Map<string, Promise<void>>();
  let axis: Axis = 'auto', component: Component = 'all', layer: number | null = null;
  let pose: CameraPose = 'front';
  let layerCount = 0, status = 'Loading prepared object', error: string | undefined;
  let disposed = false, loadVersion = 0, frameRequest = 0, revision = 0;
  let radius = 1, fitDistance = 6, width = 1, height = 1, focal = 1, cameraScale = 1;
  let rotation = new DOMMatrix().rotateAxisAngle(1, 0, 0, 180);
  const values = { rotX: 0, rotY: 0, zoom: 1, distance: fitDistance };
  const report = () => onState({ subjectId: subject.id, component, axis, layer, layerCount, status, pose, mode: currentMode,
    ...(error ? { error } : {}), distanceUnits: values.distance });
  const schedule = () => {
    if (!disposed && !frameRequest) frameRequest = requestAnimationFrame(() => { frameRequest = 0; publish(); });
  };
  const camera = {
    get state() { return values; },
    update(partial: CameraUpdate) {
      if (partial.rotX !== undefined) values.rotX = partial.rotX;
      if (partial.rotY !== undefined) values.rotY = partial.rotY;
      if (partial.distance !== undefined) values.distance = Math.max(radius * .02, Math.min(fitDistance * 100, partial.distance));
      else if (partial.zoom !== undefined) values.distance = fitDistance / Math.max(.01, Math.min(100, partial.zoom));
      values.zoom = fitDistance / values.distance;
      schedule();
    },
  };
  function rotate(delta: CameraDelta) {
    const changedRotation = Boolean(delta.rotation) || delta.controlPitchDelta !== 0 || delta.controlYawDelta !== 0;
    camera.update({ rotX: values.rotX + delta.controlPitchDelta, rotY: values.rotY + delta.controlYawDelta,
      ...(delta.zoom === undefined ? {} : { zoom: delta.zoom }), ...(delta.distance === undefined ? {} : { distance: delta.distance }) });
    const m = delta.rotation ? worldRotationFromQuaternion(delta.rotation as [number, number, number, number]) : null;
    // CSS parsing reduces precision. Keep numeric matrices until the renderer writes CSS.
    const increment = m
      ? new DOMMatrix([m[0], m[3], m[6], 0, m[1], m[4], m[7], 0, m[2], m[5], m[8], 0, 0, 0, 0, 1])
      : new DOMMatrix().rotateAxisAngle(1, 0, 0, delta.controlPitchDelta).rotateAxisAngle(0, 1, 0, delta.controlYawDelta);
    rotation = increment.multiply(rotation); revision++;
    if (changedRotation) { pose = 'manual'; report(); }
  }
  const controls = createObjectInteractionControls({ inputSurface: host, runtimePolicy, camera,
    trackballMetrics() {
      const rect = host.getBoundingClientRect(), projected = focal * radius / values.distance;
      return { centerX: rect.x + width / 2, centerY: rect.y + height / 2,
        radius: Math.max(width / 5, Math.min(width, projected)), surfaceRadius: projected,
        focalLength: focal, viewportWidth: width, tumbleOnly: true };
    },
    sceneMatrix: () => rotation.toString(), rotate, minimumZoom: .01, maximumZoom: 100,
    dolly: { stepPerDelta: .0015 }, surfaceFlyToHitTest: () => false,
    onStart() { host.style.cursor = 'grabbing'; }, onEnd() { host.style.cursor = 'grab'; },
    onError(failure) { error = String(failure); status = 'Interaction error'; report(); },
  });
  function dominantBank() {
    return banks.reduce((best, bank) => Number(bank.root.style.opacity) > Number(best.root.style.opacity) ? bank : best, banks[0]);
  }
  function inspectLayers() {
    if (!banks.length) return;
    const selected = axis === 'auto' ? dominantBank() : banks.find(bank => bank.axis === axis)!;
    const eligible = selected.leaves.filter(leaf => component === 'all' || (component === 'detail' ? leaf.detail : !leaf.detail));
    const countChanged = layerCount !== eligible.length; layerCount = eligible.length;
    if (layer !== null) layer = Math.max(0, Math.min(layerCount - 1, layer));
    for (const bank of banks) {
      if (axis !== 'auto') {
        bank.root.style.opacity = bank === selected ? '1' : '0';
        bank.root.style.visibility = bank === selected ? 'visible' : 'hidden';
      }
      let index = 0;
      for (const leaf of bank.leaves) {
        const included = component === 'all' || (component === 'detail' ? leaf.detail : !leaf.detail);
        for (const node of leaf.nodes) node.style.visibility = included && (layer === null || index === layer) ? '' : 'hidden';
        if (included) index++;
      }
    }
    if (countChanged) report();
  }
  function publish() {
    if (!mounted || !payload || disposed) return;
    const frame = payload.frame;
    const world = worldCameraFromCenteredPresentation({ rotation: rotationFromMatrix3d(rotation), distanceUnits: values.distance },
      { ...frame, presentationToReference: worldRotationFromQuaternion(frame.localToReferenceXyzw), bodyRadiusM: radius * frame.metersPerUnit },
      { focalPixels: focal, principalOffsetPixels: [0, 0] });
    mounted.publish({ world, viewport: { widthPixels: width, heightPixels: height, focalPixels: focal, principalOffsetPixels: [0, 0] } });
    inspectLayers(); host.dataset.cameraRevision = String(revision); host.dataset.distance = String(values.distance);
  }
  function getOverlayState() {
    return [...new Set([...overlayEnabled.keys(), ...overlayPlacements.keys()])].map(id => ({ id,
      enabled: overlayEnabled.get(id) ?? false, opacity: overlayOpacity.get(id) ?? .55,
      placement: { ...(overlayPlacements.get(id) ?? defaultOverlayPlacement()) },
    }));
  }
  function clearOverlays() {
    overlayMeshes = []; overlayNodes.clear(); overlayCatalogue = null; overlayBasePath = ''; overlayCataloguePending = null; overlayLoading.clear();
    overlayEnabled.clear(); overlayOpacity.clear(); overlayPlacements.clear();
  }
  async function loadOverlayCatalogue() {
    if (currentMode !== 'density' || !payload || !subject.density?.overlays) return [] as DensityOverlay[];
    if (overlayCatalogue) return overlayCatalogue.overlays;
    if (overlayCataloguePending) return overlayCataloguePending;
    const expectedVersion = loadVersion, expectedPayload = payload, expectedSubject = subject.id;
    const pending = (async () => {
      const manifestPath = subject.density!.overlays!, response = await fetch(localFile(manifestPath));
      if (!response.ok) throw new Error(`Density overlay catalogue is unavailable (HTTP ${response.status}).`);
      const parsed = parseOverlayCatalogue(await response.json());
      if (disposed || expectedVersion !== loadVersion || expectedPayload !== payload || expectedSubject !== subject.id || currentMode !== 'density') return [];
      if (!sameOverlayFrame(parsed.frame, payload.frame)) throw new TypeError('Density overlays use a different physical reference frame.');
      overlayCatalogue = parsed; overlayBasePath = manifestPath.slice(0, manifestPath.lastIndexOf('/') + 1);
      return parsed.overlays;
    })();
    overlayCataloguePending = pending;
    try { return await pending; } finally { if (overlayCataloguePending === pending) overlayCataloguePending = null; }
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
    controls.stop();
    applyOverlayPlacement(item);
  }
  async function setOverlay(id: string, enabled: boolean, opacity = overlayOpacity.get(id) ?? .55) {
    if (currentMode !== 'density' || !payload) throw new Error('Image overlays are available in Density view only.');
    if (!(Number.isFinite(opacity) && opacity >= 0 && opacity <= 1)) throw new TypeError('Overlay opacity must be between zero and one.');
    const version = loadVersion;
    const overlays = await loadOverlayCatalogue();
    if (disposed || version !== loadVersion || currentMode !== 'density') return;
    const item = overlays.find(value => value.id === id);
    if (!item) throw new TypeError(`Unknown density overlay: ${id}`);
    overlayOpacity.set(id, opacity); overlayEnabled.set(id, enabled);
    let nodes = overlayNodes.get(id);
    if (!nodes && enabled) {
      let loading = overlayLoading.get(id);
      if (!loading) {
        loading = (async () => {
          const url = localFile(`${overlayBasePath}${item.texturePath}`), image = new Image(); image.src = url; await image.decode();
          if (image.naturalWidth !== item.widthPx || image.naturalHeight !== item.heightPx) throw new TypeError(`Overlay ${id} has an unexpected prepared extent.`);
          if (disposed || version !== loadVersion || currentMode !== 'density' || !overlayEnabled.get(id)) return;
          const current = overlayNodes.get(id);
          if (current) return;
          const created = overlayMeshes.map(mesh => { const node = document.createElement('s'); node.dataset.overlayLeaf = id; Object.assign(node.style, item.style);
            node.style.backgroundImage = `url("${url.replace(/["\\\n\r]/g, character => `\\${character}`)}")`;
            mesh.append(node); return node; }); overlayNodes.set(id, created);
        })();
        overlayLoading.set(id, loading);
        void loading.then(() => { if (overlayLoading.get(id) === loading) overlayLoading.delete(id); }, () => { if (overlayLoading.get(id) === loading) overlayLoading.delete(id); });
      }
      await loading;
      if (disposed || version !== loadVersion || currentMode !== 'density') return;
      nodes = overlayNodes.get(id);
    }
    const latestEnabled = overlayEnabled.get(id) ?? false, latestOpacity = overlayOpacity.get(id) ?? opacity;
    for (const node of nodes ?? []) { node.style.opacity = String(latestOpacity); node.style.visibility = latestEnabled ? 'visible' : 'hidden'; }
    applyOverlayPlacement(item);
    publish();
  }
  function measure() {
    width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight);
    focal = Math.max(width, height) * 1.15 * (subject.referenceProjectionScale ?? 1) * cameraScale;
    schedule();
  }
  const observer = new ResizeObserver(measure); observer.observe(host); measure();
  function reset() {
    controls.stop(); cameraScale = 1; pose = 'front'; rotation = new DOMMatrix().rotateAxisAngle(1, 0, 0, 180); measure();
    fitDistance = Math.max(radius * 2, focal * radius / (Math.min(width, height) * .32));
    values.distance = fitDistance; values.zoom = 1; values.rotX = values.rotY = 0; revision++;
    schedule(); report();
  }
  async function referenceView() {
    if (currentMode !== 'density' || !payload) throw new Error('Reference view is available in Density view only.');
    controls.stop();
    const version = loadVersion, expectedPayload = payload;
    const overlays = await loadOverlayCatalogue();
    if (disposed || version !== loadVersion || expectedPayload !== payload || currentMode !== 'density') return;
    const referenceDistance = overlayCatalogue?.referenceDistanceUnits ?? Math.hypot(...payload.frame.originM) / payload.frame.metersPerUnit;
    const baseFocal = Math.max(width, height) * 1.15 * (subject.referenceProjectionScale ?? 1);
    cameraScale = referenceDistance * Math.min(width, height) * .32 / (radius * baseFocal);
    pose = 'front'; rotation = new DOMMatrix().rotateAxisAngle(1, 0, 0, 180); measure();
    fitDistance = Math.max(radius * 2, focal * radius / (Math.min(width, height) * .32));
    values.distance = referenceDistance; values.zoom = fitDistance / values.distance; values.rotX = values.rotY = 0; revision++;
    status = `${overlays.length} prepared image overlays · reference observer view`; schedule(); report();
  }
  function fitCloud() {
    if (currentMode !== 'density' || !payload) throw new Error('Fit cloud is available in Density view only.');
    const bounds = payload.frame.boundsUnits;
    const cloudRadius = Math.max(radius, Math.hypot(...bounds.max.map((value, index) => Math.max(Math.abs(value), Math.abs(bounds.min[index])))));
    controls.stop(); cameraScale = 1; pose = 'front'; rotation = new DOMMatrix().rotateAxisAngle(1, 0, 0, 180); measure();
    fitDistance = Math.max(cloudRadius * 2, focal * cloudRadius / (Math.min(width, height) * .32));
    values.distance = fitDistance; values.zoom = 1; values.rotX = values.rotY = 0; revision++;
    status = 'Prepared density cloud fitted to its full bounds'; schedule(); report();
  }
  function applyPose(value: Exclude<CameraPose, 'manual'>) {
    const [rotX, rotY] = POSE_OFFSETS[value];
    controls.stop(); pose = value;
    const base = new DOMMatrix().rotateAxisAngle(1, 0, 0, 180);
    rotation = new DOMMatrix().rotateAxisAngle(1, 0, 0, rotX).rotateAxisAngle(0, 1, 0, rotY).multiply(base);
    values.rotX = rotX; values.rotY = rotY; revision++; schedule(); report();
  }
  function retainCamera() {
    return { pose, rotation: new DOMMatrix(Array.from(rotation.toFloat64Array())), rotX: values.rotX, rotY: values.rotY, distance: values.distance, cameraScale };
  }
  function restoreCamera(saved: ReturnType<typeof retainCamera>) {
    controls.stop(); cameraScale = saved.cameraScale; pose = saved.pose; rotation = saved.rotation; measure();
    fitDistance = Math.max(radius * 2, focal * radius / (Math.min(width, height) * .32));
    values.rotX = saved.rotX; values.rotY = saved.rotY; values.distance = saved.distance; values.zoom = fitDistance / values.distance; revision++;
    schedule(); report();
  }
  async function setSubject(id: string, cameraOverride: ReturnType<typeof retainCamera> | null = null) {
    const next = subjects.find(item => item.id === id);
    if (!next) throw new TypeError(`Unknown lab subject: ${id}`);
    const retain = cameraOverride ?? (subject.id !== next.id && subject.comparisonGroup !== undefined && subject.comparisonGroup === next.comparisonGroup ? retainCamera() : null);
    const directory = currentMode === 'density' ? next.density?.directory : next.directory;
    const version = ++loadVersion;
    if (subject.density?.overlays) overlaySessions.set(subject.density.overlays, getOverlayState());
    controls.stop(); subject = next; status = 'Loading prepared object'; error = undefined;
    measure();
    axis = 'auto'; component = 'all'; layer = null;
    mounted?.destroy(); mounted = null; banks = []; payload = null; layerCount = 0; clearOverlays();
    for (const saved of overlaySessions.get(next.density?.overlays ?? '') ?? []) {
      overlayEnabled.set(saved.id, saved.enabled); overlayOpacity.set(saved.id, saved.opacity); overlayPlacements.set(saved.id, { ...saved.placement });
    }
    host.dataset.mode = currentMode; host.dataset.ready = 'false'; report();
    if (!directory) {
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
      const descriptor = JSON.parse(new TextDecoder().decode(await fetchBytes('object.json')));
      const isImage = descriptor.type === 'image-layer-bank';
      const loaded = await (isImage ? loadPreparedCssImageLayers : loadPreparedCssVolume)(descriptor, { read: fetchBytes });
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
      payload = loaded;
      const options = { host, before: end, payload: loaded, resolveResource: resourceUrl };
      const instance = isImage ? mountPreparedCssImageLayers({ ...options, payload: loaded as PreparedCssImageLayers }) : mountPreparedCssVolume(options);
      mounted = instance;
      const roots = 'root' in instance ? [...instance.root.querySelectorAll<HTMLElement>('[data-image-layer-axis]')] : instance.roots;
      banks = loaded.stacks.map((stack, index) => {
        const nodes = [...roots[index].querySelectorAll<HTMLElement>('.css-volume-mesh s')], copies = isImage ? 1 : 3;
        return { axis: stack.axis, root: roots[index], leaves: stack.leaves.map((leaf, leafIndex) => ({
          nodes: nodes.slice(leafIndex * copies, (leafIndex + 1) * copies), detail: leaf.id.endsWith('detail') })) };
      });
      if (currentMode === 'density') overlayMeshes = roots.map(root => {
        const scene = root.querySelector<HTMLElement>('.css-volume-scene');
        if (!scene) throw new TypeError('Prepared density scene is missing its retained scene node.');
        const mesh = document.createElement('div'); mesh.className = 'css-volume-mesh'; mesh.dataset.overlayMesh = 'true'; scene.append(mesh); return mesh;
      });
      if (currentMode === 'density') {
        const enabled = [...overlayEnabled].filter(([, value]) => value);
        await Promise.all(enabled.map(([overlayId]) => setOverlay(overlayId, true, overlayOpacity.get(overlayId))));
        if (disposed || version !== loadVersion) return;
      }
      radius = next.framingRadiusUnits ?? Math.max(...loaded.frame.boundsUnits.max.map((v, index) => (v - loaded.frame.boundsUnits.min[index]) / 2));
      status = `${loaded.resources.length} prepared images · ${(loaded.resources.reduce((sum, item) => sum + item.bytes, 0) / 1e6).toFixed(1)} MB`;
      host.dataset.mode = currentMode; host.dataset.subject = id; host.dataset.ready = 'true';
      if (retain) restoreCamera(retain); else reset();
    } catch (failure) {
      if (disposed || version !== loadVersion) return;
      status = 'Could not load prepared object'; error = failure instanceof Error ? failure.message : String(failure); report();
    }
  }
  await setSubject(subject.id);
  return Object.freeze({ setSubject, reset, loadOverlayCatalogue, setOverlay, setOverlayPlacement, getOverlayState,
    referenceView, fitCloud,
    async setMode(value: ViewerMode) {
      if (value !== 'photo' && value !== 'density') throw new TypeError('Unknown viewer mode.');
      if (value === currentMode) return;
      const saved = retainCamera(); currentMode = value; await setSubject(subject.id, saved);
    },
    setPose(value: CameraPose) {
      if (value === 'manual' || !(value in POSE_OFFSETS)) throw new TypeError('Manual camera pose is controlled by pointer input.');
      applyPose(value);
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
      if (disposed) return; disposed = true; loadVersion++; cancelAnimationFrame(frameRequest);
      observer.disconnect(); controls.destroy(); mounted?.destroy(); end.remove();
    },
  });
}
