import { mountPreparedCssVolume } from '../../../../src/renderers/css/volume/prepared-volume-runtime';
import { validatePreparedCssVolume } from '../../../../src/renderers/css/volume/validation';
import type { PreparedCssVolume } from '../../../../src/renderers/css/volume/types';
import { readJointVolumeResult, type JointVolumePin, type JointVolumeResult } from '../reconstruction/joint-fit/volume-model';
import { shapeCloudOrthographicCamera, type ShapeCloudFraming } from './shape-cloud-camera';
import '../../../../src/renderers/css/styles/volume.css';

export { readJointVolumeResult } from '../reconstruction/joint-fit/volume-model';

declare const __NEBULA_REPO_ROOT__: string;
interface LoadedVolume { payload: PreparedCssVolume; textures: Map<string, string> }
const pendingMounts = new WeakMap<HTMLElement, symbol>();
export interface JointFitViewer {
  commit(): void;
  setPose(yawDegrees: number, pitchDegrees: number): void;
  setFraming(framing: ShapeCloudFraming): void;
  destroy(): void;
}
export interface JointFitViewerOptions {
  host: HTMLElement; result: JointVolumeResult; resolvePath?: (path: string) => string;
  fieldOfViewArcsec?: number; deferCommit?: boolean; signal?: AbortSignal;
}

/** One decoded retained volume; Earth view observes +Z from the negative-Z side. */
export async function createJointFitViewer({ host, result: input, resolvePath = localPath,
  fieldOfViewArcsec, deferCommit = false, signal }: JointFitViewerOptions): Promise<JointFitViewer> {
  signal?.throwIfAborted();
  if (fieldOfViewArcsec !== undefined && (!Number.isFinite(fieldOfViewArcsec) || fieldOfViewArcsec <= 0))
    throw new TypeError('Joint-fit field of view must be positive arcseconds.');
  const result = readJointVolumeResult(input), token = Symbol(result.id);
  pendingMounts.set(host, token);
  const root = host.ownerDocument.createElement('div');
  root.dataset.jointFitRoot = result.id; root.dataset.resultId = result.id;
  root.dataset.ready = 'false'; root.dataset.visible = 'false'; root.dataset.pose = '0,0';
  Object.assign(root.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'visible' });
  const urls: string[] = [];
  let loaded: LoadedVolume;
  try {
    loaded = await loadVolume(result.volume, resolvePath, urls, signal);
    signal?.throwIfAborted();
    if (loaded.payload.id !== `joint-fit-${result.id}` || JSON.stringify(loaded.payload.frame) !== JSON.stringify(result.frame)) {
      throw new TypeError('Prepared joint-fit volume belongs to a different result.');
    }
    if (pendingMounts.get(host) !== token) throw new DOMException('A newer joint-fit volume replaced this load.', 'AbortError');
  } catch (error) { release(urls); throw error; }
  const end = host.ownerDocument.createElement('span'); end.hidden = true; root.append(end);
  const mounted = mountPreparedCssVolume({ host: root, before: end, payload: loaded.payload,
    resolveResource: path => requiredTexture(loaded, path) });
  const cameras = [...root.querySelectorAll<HTMLElement>('.css-volume-camera')];
  const scenes = [...root.querySelectorAll<HTMLElement>('.css-volume-scene')];
  const spans = [0, 1, 2].map(axis => result.frame.boundsUnits.max[axis]! - result.frame.boundsUnits.min[axis]!);
  const presentationSize = fieldOfViewArcsec ?? Math.max(...spans);
  let framing: ShapeCloudFraming = { zoom: 1, panX: 0, panY: 0 }, yaw = 0, pitch = 0;
  let disposed = false, committed = false;
  function publish() {
    if (disposed || !host.clientWidth || !host.clientHeight) return;
    const camera = shapeCloudOrthographicCamera(result.frame, { width: presentationSize, height: presentationSize, unitsPerPixel: 1 },
      { width: host.clientWidth, height: host.clientHeight }, framing, yaw, pitch);
    mounted.publish({ world: camera.publication.world, viewport: { focalPixels: camera.publication.viewport.focalPixels,
      principalOffsetPixels: camera.publication.viewport.principalOffsetPixels } });
    for (const node of cameras) node.style.perspective = 'none';
    for (const node of scenes) node.style.transform = camera.transform;
    root.dataset.pose = `${yaw},${pitch}`; root.dataset.framing = JSON.stringify(framing);
  }
  const observer = new ResizeObserver(publish);
  function commit() {
    if (disposed || committed) return;
    signal?.throwIfAborted();
    if (pendingMounts.get(host) !== token) throw new DOMException('A newer joint-fit volume replaced this load.', 'AbortError');
    host.replaceChildren(root); committed = true; root.dataset.visible = 'true'; observer.observe(host); publish();
  }
  root.dataset.ready = 'true';
  if (!deferCommit) commit();
  return { commit,
    setPose(nextYaw, nextPitch) {
      if (![nextYaw, nextPitch].every(Number.isFinite)) throw new TypeError('Joint-fit angles must be finite.');
      if (!disposed) { yaw = nextYaw; pitch = nextPitch; publish(); }
    },
    setFraming(next) {
      if (!Number.isFinite(next.zoom) || next.zoom <= 0 || ![next.panX, next.panY].every(Number.isFinite))
        throw new TypeError('Joint-fit framing is invalid.');
      if (!disposed) { framing = { ...next }; publish(); }
    },
    destroy() {
      if (disposed) return;
      disposed = true; observer.disconnect(); mounted.destroy(); root.remove(); release(urls);
      if (pendingMounts.get(host) === token) pendingMounts.delete(host);
    } };
}

async function loadVolume(reference: JointVolumePin, resolvePath: (path: string) => string,
  urls: string[], signal?: AbortSignal): Promise<LoadedVolume> {
  const bytes = await readPinned(reference, resolvePath, signal);
  const payload = validatePreparedCssVolume(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  const directory = reference.path.slice(0, reference.path.lastIndexOf('/') + 1);
  const textures = new Map<string, string>(), queue = [...payload.resources];
  const settled = await Promise.allSettled(Array.from({ length: Math.min(6, queue.length) }, async () => {
    while (queue.length) {
      const resource = queue.shift()!;
      const content = await readPinned({ path: `${directory}${resource.path}`, sha256: resource.sha256 }, resolvePath, signal);
      if (content.byteLength !== resource.bytes) throw new Error(`Joint-fit texture byte length differs: ${resource.path}`);
      const url = URL.createObjectURL(new Blob([content])); urls.push(url);
      const image = new Image(); image.src = url; await image.decode();
      if (image.naturalWidth !== resource.width || image.naturalHeight !== resource.height)
        throw new Error(`Joint-fit texture dimensions differ: ${resource.path}`);
      textures.set(resource.path, url);
    }
  }));
  const failure = settled.find(item => item.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
  return { payload, textures };
}
async function readPinned(reference: JointVolumePin, resolvePath: (path: string) => string, signal?: AbortSignal): Promise<ArrayBuffer> {
  if (!pin(reference)) throw new TypeError('Joint-fit resource pin is invalid.');
  const response = await fetch(resolvePath(reference.path), { signal });
  if (!response.ok) throw new Error(`Joint-fit resource failed to load: ${reference.path} (${response.status})`);
  const bytes = await response.arrayBuffer();
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map(value => value.toString(16).padStart(2, '0')).join('');
  if (digest !== reference.sha256) throw new Error(`Joint-fit resource SHA-256 differs: ${reference.path}`);
  return bytes;
}
function release(urls: string[]) { for (const url of urls) URL.revokeObjectURL(url); urls.length = 0; }
function requiredTexture(volume: LoadedVolume, path: string) {
  const texture = volume.textures.get(path); if (!texture) throw new Error(`Joint-fit texture was not decoded: ${path}`); return texture;
}
function pin(value: unknown): value is JointVolumePin {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.path === 'string' && item.path.length > 0 && !item.path.startsWith('/') &&
    !item.path.split('/').includes('..') && !/[\\\u0000-\u0020]/.test(item.path) &&
    typeof item.sha256 === 'string' && /^[a-f0-9]{64}$/.test(item.sha256);
}
function localPath(path: string): string { return `/@fs${__NEBULA_REPO_ROOT__.replace(/\/$/, '')}/${path}`; }
