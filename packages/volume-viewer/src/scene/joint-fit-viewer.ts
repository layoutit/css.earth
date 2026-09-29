import { readJointVolumeResult, type JointVolumeResult } from '@cssearth/bake/volume';
import type { ViewFraming as ShapeCloudFraming } from '../camera/framing.ts';
import type { VolumeViewerBackend } from './backend.ts';
import { loadImageBank, requiredImageTexture as requiredTexture, releaseImageUrls as release, type ImageBank } from './image-assets.ts';
export interface JointFitViewerBackend<Bank, Publication> extends VolumeViewerBackend<Bank, Publication> {
  assertIdentity(bank: Bank, result: JointVolumeResult): void;
}
const pendingMounts = new WeakMap<HTMLElement, symbol>();
export interface JointFitViewer {
  commit(): void;
  setPose(yawDegrees: number, pitchDegrees: number): void;
  setFraming(framing: ShapeCloudFraming): void;
  destroy(): void;
}
export interface JointFitViewerOptions<Bank, Publication> {
  backend: JointFitViewerBackend<Bank, Publication>;
  host: HTMLElement; result: JointVolumeResult; resolvePath: (path: string) => string;
  fieldOfViewArcsec?: number; deferCommit?: boolean; signal?: AbortSignal;
}

/** One decoded retained volume; Earth view observes +Z from the negative-Z side. */
export async function createJointFitViewer<Bank, Publication>({ backend, host, result: input, resolvePath,
  fieldOfViewArcsec, deferCommit = false, signal }: JointFitViewerOptions<Bank, Publication>): Promise<JointFitViewer> {
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
  let loaded: ImageBank<Bank>;
  try {
    loaded = await loadImageBank(backend, 'Joint-fit', result.volume, resolvePath, urls, signal);
    signal?.throwIfAborted();
    backend.assertIdentity(loaded.payload, result);
    if (pendingMounts.get(host) !== token) throw new DOMException('A newer joint-fit volume replaced this load.', 'AbortError');
  } catch (error) { release(urls); throw error; }
  const end = host.ownerDocument.createElement('span'); end.hidden = true; root.append(end);
  const mounted = backend.mount(root, end, loaded.payload, path => requiredTexture(loaded, path));
  const spans = [0, 1, 2].map(axis => result.frame.boundsUnits.max[axis]! - result.frame.boundsUnits.min[axis]!);
  const presentationSize = fieldOfViewArcsec ?? Math.max(...spans);
  let framing: ShapeCloudFraming = { zoom: 1, panX: 0, panY: 0 }, yaw = 0, pitch = 0;
  let disposed = false, committed = false;
  function publish() {
    if (disposed || !host.clientWidth || !host.clientHeight) return;
    const camera = backend.camera(result.frame, { width: presentationSize, height: presentationSize, unitsPerPixel: 1 },
      { width: host.clientWidth, height: host.clientHeight }, framing, yaw, pitch);
    mounted.publish(camera);
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
