import { mountPreparedCssVolume } from '../../../../src/renderers/css/volume/prepared-volume-runtime';
import { validatePreparedCssVolume } from '../../../../src/renderers/css/volume/validation';
import type { PreparedCssVolume } from '../../../../src/renderers/css/volume/types';
import type { ShapeCloudPin, ShapeCloudResult } from '../reconstruction/shape-cloud/types';
import { readShapeCloudResult } from '../reconstruction/shape-cloud/result';
import { shapeCloudCamera, type ShapeCloudFraming } from './shape-cloud-camera';
import '../../../../src/renderers/css/styles/volume.css';

declare const __NEBULA_REPO_ROOT__: string;
type Material = 'neutral' | 'textured';
interface LoadedBank { payload: PreparedCssVolume; textures: Map<string, string> }
const pendingMounts = new WeakMap<HTMLElement, symbol>();
export interface ShapeCloudViewer {
  setMaterial(mode: Material): void;
  setPose(yawDegrees: number, pitchDegrees: number): void;
  setFraming(framing: ShapeCloudFraming): void;
  destroy(): void;
}
export interface ShapeCloudViewerOptions {
  host: HTMLElement;
  result: ShapeCloudResult;
  resolvePath?: (path: string) => string;
}

/** A retained CSS3D volume: material switches transport pixels, never rebuild geometry. */
export async function createShapeCloudViewer({ host, result: input, resolvePath = localPath }: ShapeCloudViewerOptions): Promise<ShapeCloudViewer> {
  const result = readShapeCloudResult(input);
  const mountToken = Symbol(result.id); pendingMounts.set(host, mountToken);
  const document = host.ownerDocument;
  const root = document.createElement('div');
  root.dataset.shapeCloudRoot = result.id;
  Object.assign(root.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'visible' });
  let disposed = false;
  if (result.empty) {
    host.replaceChildren(root);
    root.dataset.empty = 'true';
    return { setMaterial() {}, setPose() {}, setFraming() {}, destroy() { if (!disposed) {
      disposed = true; root.remove(); if (pendingMounts.get(host) === mountToken) pendingMounts.delete(host);
    } } };
  }
  if (!result.neutral || !result.textured) throw new TypeError('A nonempty shape cloud requires both prepared materials.');
  const urls: string[] = [];
  const release = () => { for (const url of urls) URL.revokeObjectURL(url); urls.length = 0; };
  let banks: { neutral: LoadedBank; textured: LoadedBank };
  try {
    const settled = await Promise.allSettled([loadBank(result.neutral, resolvePath, urls), loadBank(result.textured, resolvePath, urls)]);
    const failure = settled.find(item => item.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
    const neutral = settled[0]!, textured = settled[1]!;
    if (neutral.status !== 'fulfilled' || textured.status !== 'fulfilled') throw new Error('Shape cloud materials did not finish loading.');
    banks = { neutral: neutral.value, textured: textured.value };
    assertSharedGeometry(banks.neutral.payload, banks.textured.payload, result);
    if (pendingMounts.get(host) !== mountToken) throw new DOMException('A newer shape cloud replaced this load.', 'AbortError');
  } catch (error) { release(); throw error; }
  const end = document.createElement('span'); end.hidden = true; root.append(end);
  const mounted = mountPreparedCssVolume({ host: root, before: end, payload: banks.neutral.payload,
    resolveResource: path => requiredTexture(banks.neutral, path) });
  let material: Material = 'neutral', yaw = 0, pitch = 0;
  let framing: ShapeCloudFraming = { zoom: 1, panX: 0, panY: 0 };
  const leaves = mounted.roots.flatMap((axisRoot, index) => {
    const axis = (['x', 'y', 'z'] as const)[index]!;
    const neutralStack = banks.neutral.payload.stacks.find(stack => stack.axis === axis)!;
    const texturedStack = banks.textured.payload.stacks.find(stack => stack.axis === axis)!;
    const nodes = [...axisRoot.querySelectorAll<HTMLElement>('.css-volume-mesh s')];
    if (nodes.length !== neutralStack.leaves.length * 3) throw new Error('Prepared cloud retained leaves do not match the material layout.');
    return neutralStack.leaves.map((leaf, i) => ({ nodes: nodes.slice(i * 3, i * 3 + 3),
      neutral: requiredTexture(banks.neutral, leaf.texturePath), textured: requiredTexture(banks.textured, texturedStack.leaves[i]!.texturePath) }));
  });
  function publish() {
    if (disposed || !host.clientWidth || !host.clientHeight) return;
    const publication = shapeCloudCamera(banks.neutral.payload.frame, result, { width: host.clientWidth, height: host.clientHeight }, framing, yaw, pitch);
    // This host is the registered photo plane, not the outer comparison viewport.
    // Keep bounded prepared leaves beyond the photo edges; the UI clips its viewport.
    mounted.publish({ world: publication.world, viewport: { focalPixels: publication.viewport.focalPixels,
      principalOffsetPixels: publication.viewport.principalOffsetPixels } });
    root.dataset.pose = `${yaw},${pitch}`;
    root.dataset.framing = JSON.stringify(framing);
  }
  const observer = new ResizeObserver(publish);
  host.replaceChildren(root); observer.observe(host); publish();
  root.dataset.material = material; root.dataset.ready = 'true';
  return {
    setMaterial(next) {
      if (next !== 'neutral' && next !== 'textured') throw new TypeError('Unknown shape cloud material.');
      if (disposed || material === next) return;
      material = next;
      for (const leaf of leaves) for (const node of leaf.nodes) node.style.backgroundImage = `url("${leaf[next]}")`;
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

async function loadBank(pin: ShapeCloudPin, resolvePath: (path: string) => string, urls: string[]): Promise<LoadedBank> {
  const bytes = await readPinned(pin, resolvePath);
  const payload = validatePreparedCssVolume(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  const directory = pin.path.slice(0, pin.path.lastIndexOf('/') + 1);
  const textures = new Map<string, string>(), queue = [...payload.resources];
  const settled = await Promise.allSettled(Array.from({ length: Math.min(6, queue.length) }, async () => {
    while (queue.length) {
      const resource = queue.shift()!;
      const content = await readPinned({ path: `${directory}${resource.path}`, sha256: resource.sha256 }, resolvePath);
      if (content.byteLength !== resource.bytes) throw new Error(`Shape cloud texture byte length differs: ${resource.path}`);
      const url = URL.createObjectURL(new Blob([content])); urls.push(url);
      const image = new Image(); image.src = url; await image.decode();
      if (image.naturalWidth !== resource.width || image.naturalHeight !== resource.height) throw new Error(`Shape cloud texture dimensions differ: ${resource.path}`);
      textures.set(resource.path, url);
    }
  }));
  const failure = settled.find(item => item.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
  return { payload, textures };
}

async function readPinned(pin: ShapeCloudPin, resolvePath: (path: string) => string): Promise<ArrayBuffer> {
  if (!pin || !relativePath(pin.path) || !/^[a-f0-9]{64}$/.test(pin.sha256)) throw new TypeError('Shape cloud resource pin is invalid.');
  const response = await fetch(resolvePath(pin.path));
  if (!response.ok) throw new Error(`Shape cloud resource failed to load: ${pin.path} (${response.status})`);
  const bytes = await response.arrayBuffer();
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
  if (hash !== pin.sha256) throw new Error(`Shape cloud resource SHA-256 differs: ${pin.path}`);
  return bytes;
}

function assertSharedGeometry(neutral: PreparedCssVolume, textured: PreparedCssVolume, result: ShapeCloudResult): void {
  if (neutral.id !== `shape-cloud-${result.id}` || textured.id !== neutral.id) throw new Error('Cloud materials belong to a different preview.');
  if (JSON.stringify(neutral.frame) !== JSON.stringify(textured.frame)) throw new Error('Cloud materials have different physical frames.');
  for (const axis of ['x', 'y', 'z'] as const) {
    const first = neutral.stacks.find(stack => stack.axis === axis)!, second = textured.stacks.find(stack => stack.axis === axis)!;
    if (first.leaves.length !== second.leaves.length) throw new Error('Cloud materials have different slice counts.');
    for (let i = 0; i < first.leaves.length; i++) {
      const a = first.leaves[i]!, b = second.leaves[i]!;
      if (a.id !== b.id || a.widthPx !== b.widthPx || a.heightPx !== b.heightPx || JSON.stringify(a.centerUnits) !== JSON.stringify(b.centerUnits) ||
          JSON.stringify(a.boundsCssPixels) !== JSON.stringify(b.boundsCssPixels) ||
          (Object.keys(a.style) as (keyof typeof a.style)[]).some(key => a.style[key] !== b.style[key])) throw new Error('Cloud materials do not share the same prepared geometry.');
    }
  }
  const first = supportHash(neutral.provenance, result), second = supportHash(textured.provenance, result);
  if (first !== second) throw new Error('Cloud materials have different prepared alpha support.');
}
function supportHash(value: unknown, result: ShapeCloudResult): string {
  if (!record(value) || value.schema !== 'cssearth-shape-cloud-provenance@1' || typeof value.alphaSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.alphaSha256) ||
      value.sourceSha256 !== result.sourceSha256 || value.mapSha256 !== result.mapSha256 || value.geometrySha256 !== result.geometrySha256 ||
      !record(value.projection) || value.projection.width !== result.width || value.projection.height !== result.height || value.projection.unitsPerPixel !== result.unitsPerPixel) {
    throw new TypeError('Prepared cloud provenance or alpha support differs from its result.');
  }
  return value.alphaSha256;
}
function requiredTexture(bank: LoadedBank, path: string): string {
  const texture = bank.textures.get(path);
  if (!texture) throw new Error(`Prepared cloud texture was not decoded: ${path}`);
  return texture;
}
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function relativePath(path: string): boolean { return typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.split('/').includes('..') && !/[\\\u0000-\u0020]/.test(path); }
function localPath(path: string): string { return `/@fs${__NEBULA_REPO_ROOT__.replace(/\/$/, '')}/${path}`; }
