import type { PreparedShapeScene } from '@cssearth/bake/volume';
import type { ViewFraming as ShapeCloudFraming } from '../camera/framing.ts';
import type { VolumeViewerBackend } from './backend.ts';
import { loadImageBank, requiredImageTexture as requiredTexture, type ImageBank } from './image-assets.ts';
export interface ShapeCloudViewerBackend<Bank, Publication> extends VolumeViewerBackend<Bank, Publication> {
  readResult(value: unknown): PreparedShapeScene;
  assertSharedGeometry(neutral: Bank, textured: Bank, result: PreparedShapeScene): void;
}
type Material = 'neutral' | 'textured';

const pendingMounts = new WeakMap<HTMLElement, symbol>();
export interface ShapeCloudViewer {
  /** Reveal an already decoded scene atomically after its latest camera/material are configured. */
  commit(): void;
  setMaterial(mode: Material): void;
  setPose(yawDegrees: number, pitchDegrees: number): void;
  setFraming(framing: ShapeCloudFraming): void;
  destroy(): void;
}
export interface ShapeCloudViewerOptions<Bank, Publication> {
  backend: ShapeCloudViewerBackend<Bank, Publication>;
  host: HTMLElement;
  result: PreparedShapeScene;
  resolvePath: (path: string) => string;
  deferCommit?: boolean;
  signal?: AbortSignal;
}

/** A retained CSS3D volume: material switches transport pixels, never rebuild geometry. */
export async function createShapeCloudViewer<Bank, Publication>({ backend, host, result: input, resolvePath, deferCommit = false, signal }: ShapeCloudViewerOptions<Bank, Publication>): Promise<ShapeCloudViewer> {
  signal?.throwIfAborted();
  const result = backend.readResult(input);
  const mountToken = Symbol(result.id); pendingMounts.set(host, mountToken);
  const document = host.ownerDocument;
  const root = document.createElement('div');
  root.dataset.shapeCloudRoot = result.id;
  root.dataset.cloudResult = result.id;
  root.dataset.quality = result.quality;
  root.dataset.visible = 'false';
  Object.assign(root.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'visible' });
  let disposed = false, committed = false;
  function commitRoot() {
    if (disposed || committed) return;
    signal?.throwIfAborted();
    if (pendingMounts.get(host) !== mountToken) throw new DOMException('A newer shape cloud replaced this load.', 'AbortError');
    host.replaceChildren(root); committed = true; root.dataset.visible = 'true';
  }
  if (result.empty) {
    root.dataset.empty = 'true'; root.dataset.ready = 'true';
    if (!deferCommit) commitRoot();
    return { commit: commitRoot, setMaterial() {}, setPose() {}, setFraming() {}, destroy() { if (!disposed) {
      disposed = true; root.remove(); if (pendingMounts.get(host) === mountToken) pendingMounts.delete(host);
    } } };
  }
  if (!result.neutral || !result.textured) throw new TypeError('A nonempty shape cloud requires both prepared materials.');
  const urls: string[] = [];
  const release = () => { for (const url of urls) URL.revokeObjectURL(url); urls.length = 0; };
  let banks: { neutral: ImageBank<Bank>; textured: ImageBank<Bank> };
  try {
    const settled = await Promise.allSettled([loadImageBank(backend, 'Shape cloud', result.neutral, resolvePath, urls, signal), loadImageBank(backend, 'Shape cloud', result.textured, resolvePath, urls, signal)]);
    const failure = settled.find(item => item.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
    const neutral = settled[0]!, textured = settled[1]!;
    if (neutral.status !== 'fulfilled' || textured.status !== 'fulfilled') throw new Error('Shape cloud materials did not finish loading.');
    banks = { neutral: neutral.value, textured: textured.value };
    backend.assertSharedGeometry(banks.neutral.payload, banks.textured.payload, result);
    signal?.throwIfAborted();
    if (pendingMounts.get(host) !== mountToken) throw new DOMException('A newer shape cloud replaced this load.', 'AbortError');
  } catch (error) { release(); throw error; }
  const end = document.createElement('span'); end.hidden = true; root.append(end);
  const mounted = backend.mount(root, end, banks.neutral.payload, path => requiredTexture(banks.neutral, path));
  let material: Material = 'neutral', yaw = 0, pitch = 0;
  let framing: ShapeCloudFraming = { zoom: 1, panX: 0, panY: 0 };
  const texturedPaths = backend.texturePaths(banks.textured.payload);
  const leaves = mounted.materials.map((leaf, i) => ({ nodes: leaf.nodes,
    neutral: requiredTexture(banks.neutral, leaf.texturePath), textured: requiredTexture(banks.textured, texturedPaths[i]!) }));
  function publish() {
    if (disposed || !host.clientWidth || !host.clientHeight) return;
    const camera = backend.camera(backend.frame(banks.neutral.payload), result, { width: host.clientWidth, height: host.clientHeight }, framing, yaw, pitch);
    mounted.publish(camera);
    root.dataset.projection = 'orthographic';
    root.dataset.pose = `${yaw},${pitch}`;
    root.dataset.framing = JSON.stringify(framing);
  }
  const observer = new ResizeObserver(publish);
  function commit() {
    if (disposed || committed) return;
    commitRoot(); observer.observe(host); publish();
  }
  root.dataset.material = material; root.dataset.ready = 'true';
  if (!deferCommit) commit();
  return {
    commit,
    setMaterial(next) {
      if (next !== 'neutral' && next !== 'textured') throw new TypeError('Unknown shape cloud material.');
      if (disposed || material === next) return;
      material = next;
      mounted.setTextures(leaves.map(leaf => leaf[next]));
      root.dataset.material = next;
    },
    setPose(yawDegrees, pitchDegrees) {
      if (![yawDegrees, pitchDegrees].every(Number.isFinite)) throw new TypeError('Shape cloud angles must be finite.');
      if (disposed) return;
      yaw = yawDegrees; pitch = pitchDegrees; publish();
    },
    setFraming(next) {
      if (!Number.isFinite(next.zoom) || next.zoom <= 0 || ![next.panX, next.panY].every(Number.isFinite)) throw new TypeError('Shape cloud framing is invalid.');
      if (disposed) return;
      framing = { ...next }; publish();
    },
    destroy() { if (disposed) return; disposed = true; observer.disconnect(); mounted.destroy(); root.remove(); release();
      if (pendingMounts.get(host) === mountToken) pendingMounts.delete(host);
    },
  };
}
