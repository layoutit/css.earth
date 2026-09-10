import type { AppliedStarLayers } from '../star-removal/star-removal-types';
import records from '../subjects.json';
import { parseOverlayVariants, variantsForImage, type ImageLayer, type OverlayVariant } from './overlay-variants';
import sourceCatalog from '../../sources/index.json';
import { defaultOverlayPlacement, updateOverlayPlacement, overlayPlacementTransform, type OverlayPlacement } from '../alignment/overlay-placement';
import { readOverlaySessions, writeOverlaySessions, resolveSavedPlacement } from '../alignment/overlay-store';
import { createToneResourceController, type ToneResource } from './tone-runtime';
import { cloudCompositeOpacity, createCloudInspection, nativeCloudBrightness, parseCloudCatalogue, validateCloudBrightness } from './cloud-inspection';
import type { CloudBrightness } from '../components/cloud-controls';
import { createCloudSurface } from '../components/cloud-surface';
import { mountPreparedLmcStars, parsePreparedLmcStars } from '../stars/lmc-stars';
import type { CloudStarOptions, CloudStarContext } from '../components/cloud-star-controls';
import { mountReconstructionOverlay } from './reconstruction-overlay';
import { validateCloudDensityFilter, type CloudDensityFilter } from '../density/cloud-density';
import * as runtimePolicy from '../../../../site/runtime-policy.mjs';
import { createObjectInteractionControls } from '../../../../src/renderers/css/navigation/object-interaction-controls';
import { worldCameraFromCenteredPresentation } from '../../../../src/renderers/css/navigation/world-camera';
import { worldRotationFromQuaternion } from '../../../../src/renderers/css/navigation/world-camera-math';
import { rotationFromMatrix3d } from '../../../../src/renderers/css/solar-system/heliocentric-geometry';
import { loadPreparedCssImageLayers } from '../../../../src/renderers/css/image-layers/loader';
import type { PreparedCssImageLayers } from '../../../../src/renderers/css/image-layers/loader';
import { mountPreparedCssImageLayers } from '../../../../src/renderers/css/image-layers/prepared-image-layer-runtime';
import { loadPreparedCssVolume } from '../../../../src/renderers/css/volume/loader';
import { mountPreparedCssVolume } from '../../../../src/renderers/css/volume/prepared-volume-runtime';
import type { PreparedCssVolume } from '../../../../src/renderers/css/volume/types';
import type { CameraDelta, CameraUpdate } from '../../../../src/renderers/css/navigation/types';
import '../../../../src/renderers/css/styles/volume.css';

declare const __NEBULA_REPO_ROOT__: string;
export interface LabSubjectRecord {
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
  reconstructionImage?: { group: string; label: string; note: string };
  referenceProjectionScale?: number;
  /** Calibrated observer for prepared photographic-volume experiments. */
  referenceDistanceUnits?: number;
  referenceEastLeft?: boolean;
  cloudParts?: { descriptor: string; catalogue: string };
  stars?: string;
  /** Fixed original-image plane prepared from this saved result's exact image registration. */
  reconstructionOverlay?: string;
  density?: { directory: string; modelNote: string; sourcePageUrl: string; credit: string; overlays?: string; candidateImageIds?: string[];
    reconstructionReferenceImageId?: string; starAlignmentReference?: { path: string; sha256: string }; referenceFramingRadiusUnits?: number };
}
const subjectRecords: readonly LabSubjectRecord[] = records;
export const localFile = (path: string) => `/@fs${__NEBULA_REPO_ROOT__.replace(/\/$/, '')}/${path}`;
const recipes = import.meta.glob('../../../../src/objects/*/source/recipe.json', { eager: true, import: 'default' }) as
  Record<string, { source: { publisherUrl: string; credit: string }; geometry: { supportRadiusKpc: number } }>;
function prepareSubjectRecord(record: LabSubjectRecord) {
  const sharedDensity = record.density && subjectRecords.filter(item => item.density?.directory === record.density!.directory);
  const configuredRadii = sharedDensity?.flatMap(item => item.density?.referenceFramingRadiusUnits === undefined ? [] : [item.density.referenceFramingRadiusUnits]) ?? [];
  if (configuredRadii.some(value => !Number.isFinite(value) || value <= 0) || new Set(configuredRadii).size > 1)
    throw new TypeError('Subjects sharing a density field must share one positive Earth-view framing radius.');
  const sharedRadius = configuredRadii[0] ?? Math.max(...(sharedDensity?.map(item => item.framingRadiusUnits ?? 0) ?? [0]));
  const density = record.density ? { ...record.density, ...(sharedRadius > 0 ? { referenceFramingRadiusUnits: sharedRadius } : {}) } : undefined;
  if (record.reconstructionImage !== undefined) {
    const image = record.reconstructionImage;
    if (!image || typeof image !== 'object' || Array.isArray(image) ||
        Object.keys(image).some(key => !['group', 'label', 'note'].includes(key)) ||
        ![image.group, image.label, image.note].every(value => typeof value === 'string' && value.trim().length > 0) ||
        !record.comparisonGroup || subjectRecords.some(other => other.reconstructionImage?.group === image.group && other.comparisonGroup !== record.comparisonGroup)) {
      throw new TypeError(`Lab subject ${record.id} has invalid reconstruction image metadata.`);
    }
  }
  const candidateIds = record.density?.candidateImageIds;
  if (candidateIds !== undefined && (!record.density?.overlays || !Array.isArray(candidateIds) || !candidateIds.length ||
      candidateIds.some(id => typeof id !== 'string' || !id.trim()) || new Set(candidateIds).size !== candidateIds.length)) {
    throw new TypeError(`Lab subject ${record.id} has invalid candidate image ids.`);
  }
  if (record.referenceProjectionScale !== undefined &&
      (!Number.isFinite(record.referenceProjectionScale) || record.referenceProjectionScale <= 0)) {
    throw new TypeError(`Lab subject ${record.id} has an invalid reference projection scale.`);
  }
  if (record.referenceDistanceUnits !== undefined && (!Number.isFinite(record.referenceDistanceUnits) || record.referenceDistanceUnits <= 0))
    throw new TypeError(`Lab subject ${record.id} has an invalid observer distance.`);
  if (record.referenceEastLeft !== undefined && typeof record.referenceEastLeft !== 'boolean')
    throw new TypeError(`Lab subject ${record.id} has an invalid sky handedness.`);
  if (record.reconstructionOverlay !== undefined && !relativePath(record.reconstructionOverlay))
    throw new TypeError(`Lab subject ${record.id} has an invalid original overlay path.`);
  const recipe = recipes[`../../../../${record.directory}/source/recipe.json`];
  const imagePath = record.imagePath ?? (record.image ? `${record.directory}/${record.image}` : null);
  if (!imagePath && !density) throw new TypeError(`Lab subject ${record.id} has no comparison image or density reference.`);
  const sourceUrl = imagePath ? localFile(imagePath) : '';
  const sourcePageUrl = record.sourcePageUrl ?? recipe?.source.publisherUrl;
  const credit = record.credit ?? recipe?.source.credit;
  if (record.reconstructionImage && (!sourcePageUrl || !/^https?:\/\//i.test(sourcePageUrl) || !credit?.trim()))
    throw new TypeError(`Lab subject ${record.id} needs a reconstruction publisher URL and source credit.`);
  const declared = sourceCatalog.subjects.find(item => item.subjectId === (record.sourceSubjectId ?? record.id))?.sources;
  const sourceImages = declared?.map(source => ({ id: source.id, name: source.name,
    sourceUrl: localFile(`${sourceCatalog.pathBase}/${source.path}`), sourcePageUrl: source.sourcePageUrl, credit: source.credit }))
    ?? (imagePath ? [{ id: `${record.id}-source`, name: `${record.name} · source`, sourceUrl, sourcePageUrl, credit }] : []);
  for (const comparison of record.comparisonImages ?? []) {
    sourceImages.push({ id: comparison.id, name: comparison.name, sourceUrl: localFile(comparison.imagePath),
      sourcePageUrl: sourceImages[0]?.sourcePageUrl,
      credit: `Offline extraction used by this volume. ${sourceImages[0]?.credit ?? ''}` });
  }
  return { ...record, density, sourceUrl, sourcePageUrl, credit, sourceImages, hasDetail: record.hasDetail ?? Boolean(recipe),
    framingRadiusUnits: record.framingRadiusUnits ?? recipe?.geometry.supportRadiusKpc };
}
export const subjects = subjectRecords.map(prepareSubjectRecord);

/** Saved banks enter the same prepared-object loader as the checked-in benchmark. */
export function registerReconstructionSubject(record: LabSubjectRecord) {
  const base = subjects.find(item => item.id === record.sourceSubjectId);
  if (!/^reconstruction-[a-f0-9]{64}$/.test(record.id) || !base || !base.density ||
      !relativePath(record.directory) || !record.directory.startsWith('.local/nebula-lab/') ||
      !record.imagePath || !relativePath(record.imagePath) || !record.cloudParts ||
      !relativePath(record.cloudParts.descriptor) || !relativePath(record.cloudParts.catalogue) ||
      record.comparisonGroup !== base.comparisonGroup || record.referenceDistanceUnits !== base.referenceDistanceUnits ||
      record.referenceProjectionScale !== base.referenceProjectionScale || record.referenceEastLeft !== base.referenceEastLeft)
    throw new TypeError('Saved reconstruction does not match its prepared comparison frame.');
  const existing = subjects.find(item => item.id === record.id);
  if (existing) {
    if (existing.directory !== record.directory || existing.imagePath !== record.imagePath)
      throw new TypeError('Saved reconstruction identity changed.');
    return existing.id;
  }
  const prepared = prepareSubjectRecord({ ...record, density: base.density });
  subjects.push(prepared);
  return prepared.id;
}
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
    const initialPlacement = item.initialPlacement === undefined ? undefined : updateOverlayPlacement(defaultOverlayPlacement(), item.initialPlacement as Partial<OverlayPlacement>);
    if (item.legacyPlacementBasis !== undefined && typeof item.legacyPlacementBasis !== 'string') throw new TypeError('Invalid legacy image placement basis.');
    if (item.initialOpacity !== undefined && (typeof item.initialOpacity !== 'number' || !Number.isFinite(item.initialOpacity) || item.initialOpacity < 0 || item.initialOpacity > 1)) throw new TypeError('Invalid initial image opacity.');
    return { id: item.id, label: item.label, sha256: item.sha256, texturePath: item.texturePath, widthPx: item.widthPx, heightPx: item.heightPx,
      pivotCssPx: item.pivotCssPx, initialPlacement, initialOpacity: item.initialOpacity, legacyPlacementBasis: item.legacyPlacementBasis,
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
  originalOverlay: { available: boolean; enabled: boolean; opacity: number; loading: boolean };
}

export interface DensityOverlay {
  id: string; label: string; sha256: string; texturePath: string; widthPx: number; heightPx: number;
  variants?: OverlayVariant[]; removalResultId?: string;
  pivotCssPx: [number, number, number];
  initialPlacement?: OverlayPlacement; initialOpacity?: number;
  legacyPlacementBasis?: string;
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
  let banks: { axis: Exclude<Axis, 'auto'>; root: HTMLElement; leaves: { id: string; nodes: HTMLElement[]; detail: boolean }[] }[] = [];
  let cloud: ReturnType<typeof createCloudInspection> | null = null, cloudBrightness = nativeCloudBrightness();
  let cloudFilter: CloudDensityFilter = { cutoff: 0, softness: .25, showRemoved: false };
  let cloudSurface: ReturnType<typeof createCloudSurface> | null = null;
  let starLayer: ReturnType<typeof mountPreparedLmcStars> | null = null, starInfo: CloudStarContext | null = null;
  let originalOverlay: ReturnType<typeof mountReconstructionOverlay> | null = null;
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
  let axis: Axis = 'auto', component: Component = 'all', layer: number | null = null;
  let pose: CameraPose = 'front';
  let layerCount = 0, status = 'Loading prepared object', error: string | undefined;
  let disposed = false, loadVersion = 0, frameRequest = 0, revision = 0;
  let radius = 1, fitDistance = 6, width = 1, height = 1, focal = 1, cameraScale = 1;
  let rotation = new DOMMatrix().rotateAxisAngle(1, 0, 0, 180);
  const densityCameras = new Map<string, ReturnType<typeof retainCamera>>();
  const values = { rotX: 0, rotY: 0, zoom: 1, distance: fitDistance };
  const report = () => onState({ subjectId: subject.id, component, axis, layer, layerCount, status, pose, mode: currentMode,
    ...(error ? { error } : {}), distanceUnits: values.distance,
    originalOverlay: { available: currentMode === 'photo' && Boolean(subject.reconstructionOverlay),
      enabled: currentMode === 'photo' && originalEnabled && Boolean(subject.reconstructionOverlay), opacity: originalOpacity, loading: Boolean(originalPending) } });
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
    // Density's physical east/north frame needs an east-left screen bridge.
    // Conjugate input rotation by that reflection so dragging follows the pointer.
    if (currentMode === 'density' || subject.referenceEastLeft) delta = { ...delta, controlYawDelta: -delta.controlYawDelta,
      ...(delta.rotation ? { rotation: [delta.rotation[0], -delta.rotation[1], -delta.rotation[2], delta.rotation[3]] as [number, number, number, number] } : {}) };
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
    const includedLeaf = (leaf: typeof selected.leaves[number]) => cloud ? cloud.includes(leaf.id) :
      component === 'all' || (component === 'detail' ? leaf.detail : !leaf.detail);
    const eligible = selected.leaves.filter(includedLeaf);
    const countChanged = layerCount !== eligible.length; layerCount = eligible.length;
    if (layer !== null) layer = Math.max(0, Math.min(layerCount - 1, layer));
    for (const bank of banks) {
      if (axis !== 'auto') {
        bank.root.style.opacity = bank === selected ? '1' : '0';
        bank.root.style.visibility = bank === selected ? 'visible' : 'hidden';
      }
      let index = 0;
      for (const leaf of bank.leaves) {
        const included = includedLeaf(leaf);
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
    const publication = { world, viewport: { widthPixels: width, heightPixels: height, focalPixels: focal, principalOffsetPixels: [0, 0] as [number, number] } };
    mounted.publish(publication); starLayer?.publish(publication); originalOverlay?.publish(publication);
    inspectLayers(); host.dataset.cameraRevision = String(revision); host.dataset.distance = String(values.distance);
    const opacity = cloud ? cloudCompositeOpacity(banks.map(bank => ({ axis: bank.axis,
      opacity: Number(bank.root.style.opacity), visible: bank.root.style.visibility !== 'hidden' })), cloudBrightness) : 1;
    if (cloudSurface) cloudSurface.root.style.opacity = String(opacity);
    host.dataset.cloudOpacity = String(opacity);
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
    controls.stop();
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
          const created = overlayMeshes.map(mesh => { const node = document.createElement('s'); node.dataset.overlayLeaf = id; node.dataset.imageLayer = 'original'; Object.assign(node.style, item.style);
            node.style.backgroundImage = `url("${url.replace(/["\\\n\r]/g, character => `\\${character}`)}")`;
            mesh.append(node); return node; }); overlayNodes.set(id, created);
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
  function measure() {
    width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight);
    focal = Math.max(width, height) * 1.15 * (subject.referenceProjectionScale ?? 1) * cameraScale;
    schedule();
  }
  const observer = new ResizeObserver(measure); observer.observe(host); measure();
  function reset() {
    if (subject.referenceDistanceUnits !== undefined) { applyEarthCamera(); return; }
    controls.stop(); cameraScale = 1; pose = 'front'; rotation = new DOMMatrix().rotateAxisAngle(1, 0, 0, 180); measure();
    fitDistance = Math.max(radius * 2, focal * radius / (Math.min(width, height) * .32));
    values.distance = fitDistance; values.zoom = 1;
    values.rotX = values.rotY = 0; revision++;
    schedule(); report();
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
    if (!payload) throw new Error('The prepared object is still loading.');
    const referenceDistance = Math.hypot(...payload.frame.originM) / payload.frame.metersPerUnit;
    const referenceRadius = subject.density?.referenceFramingRadiusUnits ?? subject.framingRadiusUnits;
    if (!(referenceDistance > 0) || referenceRadius === undefined || !(referenceRadius > 0))
      throw new Error('Earth view requires a physical observer and a shared prepared framing radius.');
    const declaredDistances = [subject.referenceDistanceUnits, currentMode === 'density' ? overlayCatalogue?.referenceDistanceUnits : undefined];
    if (declaredDistances.some(value => value !== undefined && Math.abs(value - referenceDistance) > 1e-12 * referenceDistance))
      throw new TypeError('Earth observer distance differs from the prepared physical frame.');
    controls.stop();
    const baseFocal = Math.max(width, height) * 1.15 * (subject.referenceProjectionScale ?? 1);
    // One lens for the shared density field, independent of tab, route or rendered cloud bounds.
    cameraScale = referenceDistance * Math.min(width, height) * .32 / (referenceRadius * baseFocal);
    pose = 'front'; rotation = new DOMMatrix().rotateAxisAngle(1, 0, 0, 180); measure();
    fitDistance = Math.max(radius * 2, focal * radius / (Math.min(width, height) * .32));
    values.distance = referenceDistance; values.zoom = fitDistance / values.distance; values.rotX = values.rotY = 0; revision++;
    host.dataset.earthFramingRadius = String(referenceRadius);
    status = 'Earth view · shared observer and framing'; schedule(); report();
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
    return { pose, rotation: new DOMMatrix(Array.from(rotation.toFloat64Array())), rotX: values.rotX, rotY: values.rotY, distance: values.distance,
      cameraScale, projectionScale: subject.referenceProjectionScale ?? 1 };
  }
  function restoreCamera(saved: ReturnType<typeof retainCamera>) {
    controls.stop(); cameraScale = saved.cameraScale * saved.projectionScale / (subject.referenceProjectionScale ?? 1);
    pose = saved.pose; rotation = saved.rotation; measure();
    fitDistance = Math.max(radius * 2, focal * radius / (Math.min(width, height) * .32));
    values.rotX = saved.rotX; values.rotY = saved.rotY; values.distance = saved.distance; values.zoom = fitDistance / values.distance; revision++;
    schedule(); report();
  }
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
        const response = await fetch(localFile(manifestPath));
        if (!current()) return;
        if (!response.ok) throw new Error(`Original image registration is unavailable (HTTP ${response.status}).`);
        const catalogue = parseOverlayCatalogue(await response.json());
        if (!sameOverlayFrame(catalogue.frame, expectedFrame) || catalogue.overlays.length !== 1 ||
            typeof catalogue.referenceDistanceUnits !== 'number' || typeof expectedDistance !== 'number' ||
            Math.abs(catalogue.referenceDistanceUnits - expectedDistance) > 1e-12 * expectedDistance)
          throw new TypeError('Original image does not share this reconstruction’s prepared Earth frame.');
        const overlay = catalogue.overlays[0];
        if (overlay.initialPlacement && JSON.stringify(overlay.initialPlacement) !== JSON.stringify(defaultOverlayPlacement()))
          throw new TypeError('Original overlay must include registration in its prepared geometry.');
        const directory = manifestPath.slice(0, manifestPath.lastIndexOf('/') + 1), url = localFile(`${directory}${overlay.texturePath}`);
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
    const version = loadVersion, valid = validateCloudDensityFilter(filter);
    await toneResources.apply(resources, payload.resources.map(item => `${subject.directory}/prepared/${item.path}`),
      () => !disposed && version === loadVersion && isCurrent());
    if (!disposed && version === loadVersion && isCurrent()) {
      cloudFilter = valid; starLayer?.setCloudSupport(cloudFilter, cloud.selection()); publish();
    }
  }
  async function setSubject(id: string, cameraOverride: ReturnType<typeof retainCamera> | null = null) {
    const next = subjects.find(item => item.id === id);
    if (!next) throw new TypeError(`Unknown lab subject: ${id}`);
    rememberDensityCamera();
    const retain = currentMode === 'density' ? densityCameras.get(next.density?.directory ?? '') :
      cameraOverride ?? (subject.id !== next.id && subject.comparisonGroup !== undefined && subject.comparisonGroup === next.comparisonGroup ? retainCamera() : null);
    const directory = currentMode === 'density' ? next.density?.directory : next.directory;
    const version = ++loadVersion;
    controls.stop(); status = 'Loading prepared object'; error = undefined;
    host.dataset.ready = 'false';
    report();
    // Keep the current scene intact until every selected prepared texture has decoded.
    const replaceSubject = () => {
      if (overlayCatalogue && subject.density?.overlays) overlaySessions.set(subject.density.overlays, getOverlayState());
      subject = next; measure(); axis = 'auto'; component = 'all'; layer = null;
      mounted?.destroy(); mounted = null; banks = []; payload = null; layerCount = 0; clearOverlays(); toneResources.clear();
      cloudSurface?.destroy(); cloudSurface = null;
      starLayer?.destroy(); starLayer = null; starInfo = null;
      originalOverlay?.destroy(); originalOverlay = null; originalPending = null;
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
      const stars = starResponse ? parsePreparedLmcStars(await starResponse.json(), loaded.frame) : null;
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
      payload = loaded;
      cloud = loadedCloud;
      if (cloud) { host.dataset.cloudSelection = JSON.stringify(cloud.selection()); host.dataset.cloudBrightness = JSON.stringify(cloudBrightness); }
      if (cloud) { host.dataset.cloudDensityFilter = JSON.stringify({ cutoff: 0, softness: .25, showRemoved: false }); host.dataset.cloudDensityReady = 'true'; }
      if (cloud) cloudSurface = createCloudSurface(host, end);
      const options = { host: cloudSurface?.root ?? host, before: cloudSurface?.end ?? end, payload: loaded, resolveResource: resourceUrl };
      const instance = isImage ? mountPreparedCssImageLayers({ ...options, payload: loaded as PreparedCssImageLayers }) : mountPreparedCssVolume(options);
      mounted = instance;
      if (stars) { starLayer = mountPreparedLmcStars({ host, before: end, payload: stars }); starLayer.setVisible(false);
        starLayer.setCloudSupport(cloudFilter, cloud!.selection());
        starInfo = { id: next.sourceSubjectId ?? next.id, count: stars.stars.length, sourceUrl: stars.sourceUrl }; }
      const roots = 'root' in instance ? [...instance.root.querySelectorAll<HTMLElement>('[data-image-layer-axis]')] : instance.roots;
      banks = loaded.stacks.map((stack, index) => {
        const nodes = [...roots[index].querySelectorAll<HTMLElement>('.css-volume-mesh s')], copies = isImage ? 1 : 3;
        if (currentMode === 'density' || cloud) for (let i = 0; i < stack.leaves.length; i++) {
          const leaf = stack.leaves[i]!;
          toneResources.bind(`${directory}/prepared/${leaf.texturePath}`, leaf.widthPx, leaf.heightPx, nodes.slice(i * copies, (i + 1) * copies));
        }
        return { axis: stack.axis, root: roots[index], leaves: stack.leaves.map((leaf, leafIndex) => {
          const leafNodes = nodes.slice(leafIndex * copies, (leafIndex + 1) * copies);
          if (cloud) for (const node of leafNodes) node.dataset.cloudPart = cloud.partForLeaf(leaf.id);
          return { id: leaf.id, nodes: leafNodes, detail: leaf.id.endsWith('detail') };
        }) };
      });
      if (currentMode === 'density') overlayMeshes = roots.map(root => {
        const scene = root.querySelector<HTMLElement>('.css-volume-scene');
        if (!scene) throw new TypeError('Prepared density scene is missing its retained scene node.');
        const mesh = document.createElement('div'); mesh.className = 'css-volume-mesh'; mesh.dataset.overlayMesh = 'true'; scene.append(mesh); return mesh;
      });
      if (currentMode === 'density') {
        const available = await loadOverlayCatalogue();
        if (disposed || version !== loadVersion) return;
        const enabled = available.filter(item => overlayEnabled.get(item.id));
        if (enabled[0]) await setOverlay(enabled[0].id, true, overlayOpacity.get(enabled[0].id));
        if (disposed || version !== loadVersion) return;
      }
      radius = next.framingRadiusUnits ?? Math.max(...loaded.frame.boundsUnits.max.map((v, index) => (v - loaded.frame.boundsUnits.min[index]) / 2));
      status = `${loaded.resources.length} prepared images · ${(loaded.resources.reduce((sum, item) => sum + item.bytes, 0) / 1e6).toFixed(1)} MB`;
      if (retain) restoreCamera(retain); else if (currentMode === 'density') await referenceView(); else reset();
      if (disposed || version !== loadVersion) return;
      host.dataset.mode = currentMode; host.dataset.subject = id; host.dataset.ready = 'true';
      schedule(); report();
      if (originalEnabled && next.reconstructionOverlay && currentMode === 'photo')
        void setOriginalOverlay(true).catch(failure => { if (!disposed && version === loadVersion) { status = 'Original overlay could not load'; error = String(failure); report(); } });
    } catch (failure) {
      if (disposed || version !== loadVersion) return;
      if (mounted && payload) { currentMode = host.dataset.mode as ViewerMode; host.dataset.ready = 'true'; }
      status = 'Could not load prepared object'; error = failure instanceof Error ? failure.message : String(failure); report();
      throw failure;
    }
  }
  await setSubject(subject.id);
  return Object.freeze({ setSubject, reset: () => currentMode === 'density' ? referenceView() : reset(), loadOverlayCatalogue, setOverlay, setOverlayLayer, getOverlayLayer, installRemovalLayers, setOverlayPlacement, getOverlayState,
    referenceView, fitCloud, setOriginalOverlay, applyToneResources, applyCloudDensityResources,
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
      observer.disconnect(); controls.destroy(); mounted?.destroy(); cloudSurface?.destroy(); starLayer?.destroy(); originalOverlay?.destroy(); end.remove();
    },
  });
}
