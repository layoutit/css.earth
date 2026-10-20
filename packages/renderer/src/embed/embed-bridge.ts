/**
 * The typed messages between an embedded scene page (`/<object>/?embed&bridge=<host origin>`, site/scene/embed-bridge.mts)
 * and the page that embeds it (the nebula lab). Both sides validate every message they receive with these parsers and
 * drop anything else; the page posts only to the host origin its link names and hears only that origin's parent window.
 *
 * The page publishes its camera exactly as its renderer receives it: the world pose and viewport every retained volume
 * publishes with (`VolumeCameraPublication`), so a host layer drawn with the renderer's own projection
 * (`preparedVolumeCameraTransform`) lands on the page's pixels.
 */
import type { WorldCameraPose } from '@cssearth/engine';
import type { WorldCameraViewport } from '../navigation/camera/world-camera.js';
import { isWorldLayer, WORLD_LAYERS, type WorldLayer } from '../universe/world-layers.js';

export const EMBED_BRIDGE_PROTOCOL = 'cssearth-embed-bridge@1';
/** The link parameters: the host origin the page talks to, and the layers it opens with hidden. */
export const EMBED_BRIDGE_PARAMETER = 'bridge', EMBED_HIDDEN_LAYERS_PARAMETER = 'hide';

export interface EmbedCamera { readonly world: WorldCameraPose; readonly viewport: WorldCameraViewport }
/** The bank a dataset shows, as the page's datasets name it (`ObjectDatasets.volumeOf`). */
export interface EmbedVolume { readonly objectId: string; readonly datasetId: string }

export type EmbedPageMessage =
  | { readonly protocol: typeof EMBED_BRIDGE_PROTOCOL; readonly type: 'state'; readonly objectId: string; readonly ready: boolean;
    readonly dataset: string | null; readonly datasets: readonly string[]; readonly volume: EmbedVolume | null; readonly hidden: readonly WorldLayer[] }
  | { readonly protocol: typeof EMBED_BRIDGE_PROTOCOL; readonly type: 'camera'; readonly camera: EmbedCamera; readonly moving: boolean }
  /** A click on the scene (a press and release that did not drag), in the page's CSS pixels: a host tool may pick there. */
  | { readonly protocol: typeof EMBED_BRIDGE_PROTOCOL; readonly type: 'click'; readonly x: number; readonly y: number; readonly shiftKey: boolean }
  | { readonly protocol: typeof EMBED_BRIDGE_PROTOCOL; readonly type: 'reply'; readonly requestId: number; readonly ok: boolean;
    readonly error?: string; readonly view?: string };

type Command =
  | { readonly type: 'select-dataset'; readonly id: string }
  /** Post the state and camera again (a host that attached after the page started). */
  | { readonly type: 'sync' }
  | { readonly type: 'reset' } | { readonly type: 'earth-view' } | { readonly type: 'fit' }
  | { readonly type: 'turn'; readonly degrees: number }
  | { readonly type: 'capture-view' }
  | { readonly type: 'restore-view'; readonly view: string }
  | { readonly type: 'set-layers'; readonly hidden: readonly WorldLayer[] };
export type EmbedHostCommand = Command & { readonly protocol: typeof EMBED_BRIDGE_PROTOCOL; readonly requestId: number };
export type EmbedCommand = Command;

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const vector = (value: unknown, length: number): value is number[] => Array.isArray(value) && value.length === length && value.every(finite);
/** Object and dataset ids as the site's routes and dataset links accept them (site/model/dataset-url.mts). */
const objectId = (value: unknown): value is string => typeof value === 'string' && value.length <= 128 && /^[a-z0-9][a-z0-9-]*$/u.test(value);
const datasetId = (value: unknown): value is string => typeof value === 'string' && value.length <= 128 && /^[a-z][a-z0-9-]*$/u.test(value);
/** A shared view token (`v=`, renderer/navigation/camera/view-url.ts): base64url, at most 4 KB of bytes. */
const viewToken = (value: unknown): value is string => typeof value === 'string' && value.length >= 3 && value.length <= 5462 && /^[A-Za-z0-9_-]+$/u.test(value);
const layers = (value: unknown): value is WorldLayer[] => Array.isArray(value) && value.length <= WORLD_LAYERS.length && value.every(isWorldLayer) && new Set(value).size === value.length;

function cameraOf(value: unknown): EmbedCamera | null {
  if (!record(value) || !record(value.world) || !record(value.viewport)) return null;
  const { world, viewport } = value;
  if (typeof world.referenceFrame !== 'string' || !world.referenceFrame || !finite(world.epochJdTt) || !record(world.pose)) return null;
  if (world.projectionScale !== undefined && !(finite(world.projectionScale) && world.projectionScale > 0)) return null;
  const pose = world.pose;
  if (!vector(pose.positionM, 3) || !vector(pose.orientationXyzw, 4) || Math.abs(Math.hypot(...pose.orientationXyzw) - 1) > 1e-6) return null;
  if (pose.focusOffset !== undefined && !(record(pose.focusOffset) && vector(pose.focusOffset.originM, 3) && vector(pose.focusOffset.offsetM, 3))) return null;
  if (!(finite(viewport.focalPixels) && viewport.focalPixels > 0) || !vector(viewport.principalOffsetPixels, 2)) return null;
  for (const key of ['widthPixels', 'heightPixels', 'coveredTopPixels', 'projectionScale'] as const)
    if (viewport[key] !== undefined && !(finite(viewport[key]) && (viewport[key] as number) >= 0)) return null;
  const offset = pose.focusOffset;
  return {
    world: { referenceFrame: world.referenceFrame, epochJdTt: world.epochJdTt,
      pose: { positionM: [pose.positionM[0]!, pose.positionM[1]!, pose.positionM[2]!],
        orientationXyzw: [pose.orientationXyzw[0]!, pose.orientationXyzw[1]!, pose.orientationXyzw[2]!, pose.orientationXyzw[3]!],
        ...(record(offset) && vector(offset.originM, 3) && vector(offset.offsetM, 3) ? { focusOffset: {
          originM: [offset.originM[0]!, offset.originM[1]!, offset.originM[2]!] as [number, number, number],
          offsetM: [offset.offsetM[0]!, offset.offsetM[1]!, offset.offsetM[2]!] as [number, number, number] } } : {}) },
      ...(finite(world.projectionScale) ? { projectionScale: world.projectionScale } : {}) },
    viewport: { focalPixels: viewport.focalPixels, principalOffsetPixels: [viewport.principalOffsetPixels[0]!, viewport.principalOffsetPixels[1]!],
      ...(finite(viewport.widthPixels) ? { widthPixels: viewport.widthPixels } : {}),
      ...(finite(viewport.heightPixels) ? { heightPixels: viewport.heightPixels } : {}),
      ...(finite(viewport.coveredTopPixels) ? { coveredTopPixels: viewport.coveredTopPixels } : {}),
      ...(finite(viewport.projectionScale) ? { projectionScale: viewport.projectionScale } : {}) },
  };
}

/** The camera as plain data a message can carry: the pose and the viewport fields a renderer publishes with, nothing else
 * (the optics carry more, and some of it cannot be cloned). */
export function embedCamera(world: WorldCameraPose, viewport: WorldCameraViewport): EmbedCamera {
  const pose = world.pose, offset = pose.focusOffset;
  return {
    world: { referenceFrame: world.referenceFrame, epochJdTt: world.epochJdTt,
      pose: { positionM: [...pose.positionM] as [number, number, number], orientationXyzw: [...pose.orientationXyzw] as [number, number, number, number],
        ...(offset ? { focusOffset: { originM: [...offset.originM] as [number, number, number], offsetM: [...offset.offsetM] as [number, number, number] } } : {}) },
      ...(world.projectionScale === undefined ? {} : { projectionScale: world.projectionScale }) },
    viewport: { focalPixels: viewport.focalPixels, principalOffsetPixels: [viewport.principalOffsetPixels[0], viewport.principalOffsetPixels[1]],
      ...(viewport.projectionScale === undefined ? {} : { projectionScale: viewport.projectionScale }),
      ...(viewport.widthPixels === undefined ? {} : { widthPixels: viewport.widthPixels }),
      ...(viewport.heightPixels === undefined ? {} : { heightPixels: viewport.heightPixels }),
      ...(viewport.coveredTopPixels === undefined ? {} : { coveredTopPixels: viewport.coveredTopPixels }) },
  };
}

/** A page message the host may act on, or null. */
export function parseEmbedPageMessage(value: unknown): EmbedPageMessage | null {
  if (!record(value) || value.protocol !== EMBED_BRIDGE_PROTOCOL) return null;
  switch (value.type) {
    case 'state': {
      const volume = value.volume;
      if (!objectId(value.objectId) || typeof value.ready !== 'boolean' || !(value.dataset === null || datasetId(value.dataset)) ||
          !Array.isArray(value.datasets) || value.datasets.length > 256 || !value.datasets.every(datasetId) || !layers(value.hidden) ||
          !(volume === null || record(volume) && objectId(volume.objectId) && datasetId(volume.datasetId))) return null;
      return { protocol: EMBED_BRIDGE_PROTOCOL, type: 'state', objectId: value.objectId, ready: value.ready,
        dataset: value.dataset, datasets: [...value.datasets], hidden: [...value.hidden],
        volume: record(volume) && objectId(volume.objectId) && datasetId(volume.datasetId) ? { objectId: volume.objectId, datasetId: volume.datasetId } : null };
    }
    case 'camera': {
      const camera = cameraOf(value.camera);
      return camera && typeof value.moving === 'boolean' ? { protocol: EMBED_BRIDGE_PROTOCOL, type: 'camera', camera, moving: value.moving } : null;
    }
    case 'click':
      return finite(value.x) && finite(value.y) && typeof value.shiftKey === 'boolean'
        ? { protocol: EMBED_BRIDGE_PROTOCOL, type: 'click', x: value.x, y: value.y, shiftKey: value.shiftKey } : null;
    case 'reply':
      if (!finite(value.requestId) || !Number.isSafeInteger(value.requestId) || typeof value.ok !== 'boolean' || value.error !== undefined && typeof value.error !== 'string' ||
          value.view !== undefined && !viewToken(value.view)) return null;
      return { protocol: EMBED_BRIDGE_PROTOCOL, type: 'reply', requestId: value.requestId, ok: value.ok,
        ...(typeof value.error === 'string' ? { error: value.error } : {}), ...(typeof value.view === 'string' ? { view: value.view } : {}) };
    default: return null;
  }
}

/** A host command the page may act on, or null. */
export function parseEmbedHostCommand(value: unknown): EmbedHostCommand | null {
  if (!record(value) || value.protocol !== EMBED_BRIDGE_PROTOCOL || !finite(value.requestId) || !Number.isSafeInteger(value.requestId)) return null;
  const base = { protocol: EMBED_BRIDGE_PROTOCOL, requestId: value.requestId } as const;
  switch (value.type) {
    case 'select-dataset': return datasetId(value.id) ? { ...base, type: value.type, id: value.id } : null;
    case 'sync': case 'reset': case 'earth-view': case 'fit': case 'capture-view': return { ...base, type: value.type };
    case 'turn': return finite(value.degrees) && Math.abs(value.degrees) <= 360 ? { ...base, type: value.type, degrees: value.degrees } : null;
    case 'restore-view': return viewToken(value.view) ? { ...base, type: value.type, view: value.view } : null;
    case 'set-layers': return layers(value.hidden) ? { ...base, type: value.type, hidden: [...value.hidden] } : null;
    default: return null;
  }
}

/** The host origin an embedded page's link names (`?embed&bridge=<origin>`), or null: an http(s) origin and nothing else. */
export function embedBridgeOrigin(url: URL): string | null {
  if (!url.searchParams.has('embed')) return null;
  const value = url.searchParams.get(EMBED_BRIDGE_PARAMETER);
  if (!value) return null;
  try {
    const origin = new URL(value);
    return (origin.protocol === 'http:' || origin.protocol === 'https:') && origin.origin === value ? value : null;
  } catch { return null; }
}

/** The layers a link opens with hidden (`hide=labels,stars`); an unknown name is refused, not dropped. */
export function readHiddenWorldLayers(value: string | null): WorldLayer[] {
  if (!value) return [];
  const names = value.split(',').filter(Boolean);
  if (!layers(names)) throw new TypeError(`Invalid hidden world layers: ${JSON.stringify(value)}.`);
  return names;
}
export const formatHiddenWorldLayers = (hidden: readonly WorldLayer[]) => WORLD_LAYERS.filter(layer => hidden.includes(layer)).join(',');
