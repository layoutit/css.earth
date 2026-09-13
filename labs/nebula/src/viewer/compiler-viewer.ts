import { presentPhysicalPoseInVolume } from '@cssearth/engine';
import { projectPreparedPoint } from '../stars/point-projection';
import { transposeWorldRotation, worldRotationFromQuaternion } from '../../../../src/renderers/css/navigation/world-camera-math';
import { mountPreparedCssVolume } from '../../../../src/renderers/css/volume/prepared-volume-runtime';
import type { PreparedCssVolume } from '../../../../src/renderers/css/volume/types';
import { validatePreparedCssVolume } from '../../../../src/renderers/css/volume/validation';
import { compilerStarAppearance, readCompilerBakeResult, type CompilerBakeResult, type CompilerPin } from '../reconstruction/compiler/bake-types';
import { compilerInspectionCamera, type CompilerInspectionFrame } from './compiler-framing';
import { assertCompilerBankIdentity, assertCompilerLensGeometry } from '../reconstruction/compiler/bank-validation';
import { shapeCloudOrthographicCamera, type ShapeCloudFraming } from './shape-cloud-camera';
import '../../../../src/renderers/css/styles/volume.css';

declare const __NEBULA_REPO_ROOT__: string;
interface LoadedBank { payload: PreparedCssVolume; textures: Map<string, string>; urls: string[] }
interface MaterialLeaf { nodes: HTMLElement[]; neutral: string }
const pendingMounts = new WeakMap<HTMLElement, symbol>();
export type CompilerMaterial = 'neutral' | 'textured';
export interface CompilerViewer {
  commit(): void;
  setMaterial(mode: CompilerMaterial, lensId: string | null): Promise<void>;
  setStars(visible: boolean): void;
  setPose(yawDegrees: number, pitchDegrees: number): void;
  setFraming(framing: ShapeCloudFraming): void;
  destroy(): void;
}
export interface CompilerViewerOptions {
  host: HTMLElement; result: CompilerBakeResult; resolvePath?: (path: string) => string;
  fieldOfViewArcsec?: number; inspectionFrame?: CompilerInspectionFrame; deferCommit?: boolean; signal?: AbortSignal;
}

/** Retains the current material while a requested lens loads and validates. */
export async function createCompilerViewer({ host, result: input, resolvePath = localPath,
  fieldOfViewArcsec, inspectionFrame, deferCommit = false, signal }: CompilerViewerOptions): Promise<CompilerViewer> {
  signal?.throwIfAborted();
  if (fieldOfViewArcsec !== undefined && (!Number.isFinite(fieldOfViewArcsec) || fieldOfViewArcsec <= 0))
    throw new TypeError('Compiler field of view must be positive arcseconds.');
  const result = readCompilerBakeResult(input), token = Symbol(result.id); pendingMounts.set(host, token);
  const lifetime = new AbortController();
  const loadingSignal = () => committed || !signal ? lifetime.signal : AbortSignal.any([signal, lifetime.signal]);
  const root = host.ownerDocument.createElement('div');
  root.dataset.compilerRoot = result.id; root.dataset.resultId = result.id; root.dataset.ready = 'false';
  root.dataset.visible = 'false'; root.dataset.material = 'neutral'; root.dataset.lens = '';
  Object.assign(root.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'visible' });
  let disposed = false, committed = false;
  let neutral: LoadedBank | undefined;
  try {
    neutral = await loadBank(result.neutral, resolvePath, loadingSignal());
    assertCompilerBankIdentity(neutral.payload, result);
    signal?.throwIfAborted();
    if (pendingMounts.get(host) !== token) throw new DOMException('A newer compiler scene replaced this load.', 'AbortError');
  } catch (error) { if (neutral) release(neutral); throw error; }
  const end = host.ownerDocument.createElement('span'); end.hidden = true; root.append(end);
  const mounted = mountPreparedCssVolume({ host: root, before: end, payload: neutral.payload,
    resolveResource: path => requiredTexture(neutral, path) });
  const cameras = [...root.querySelectorAll<HTMLElement>('.css-volume-camera')];
  const scenes = [...root.querySelectorAll<HTMLElement>('.css-volume-scene')];
  const leaves: MaterialLeaf[] = mounted.roots.flatMap((axisRoot, index) => {
    const axis = (['x', 'y', 'z'] as const)[index]!, stack = neutral.payload.stacks.find(item => item.axis === axis)!;
    const nodes = [...axisRoot.querySelectorAll<HTMLElement>('.css-volume-mesh s')];
    if (nodes.length !== stack.leaves.length * 3) throw new Error('Compiler leaves do not match the prepared material layout.');
    return stack.leaves.map((leaf, leafIndex) => ({ nodes: nodes.slice(leafIndex * 3, leafIndex * 3 + 3),
      neutral: requiredTexture(neutral, leaf.texturePath) }));
  });
  const stars = mountStars(root, result);
  let framing: ShapeCloudFraming = { zoom: 1, panX: 0, panY: 0 }, yaw = 0, pitch = 0;
  let materialRequest = 0, activeLens: { id: string; bank: LoadedBank } | null = null;
  const presentationSize = fieldOfViewArcsec ?? result.spanArcsec;
  function publish() {
    if (disposed || !host.clientWidth || !host.clientHeight) return;
    const viewport = { width: host.clientWidth, height: host.clientHeight };
    const inspection = inspectionFrame && compilerInspectionCamera(inspectionFrame, result.coordinates.localOriginArcsec, viewport, framing, yaw, pitch);
    const camera = shapeCloudOrthographicCamera(result.frame, inspection?.image ?? { width: presentationSize, height: presentationSize, unitsPerPixel: 1 },
      viewport, inspection?.framing ?? framing, yaw, pitch);
    mounted.publish({ world: camera.publication.world, viewport: { focalPixels: camera.publication.viewport.focalPixels,
      principalOffsetPixels: camera.publication.viewport.principalOffsetPixels } });
    stars.publish(camera.publication);
    for (const node of cameras) node.style.perspective = 'none';
    for (const node of scenes) node.style.transform = camera.transform;
    root.dataset.pose = `${yaw},${pitch}`; root.dataset.framing = JSON.stringify(framing);
  }
  const observer = new ResizeObserver(publish);
  function commit() {
    if (disposed || committed) return;
    signal?.throwIfAborted();
    if (pendingMounts.get(host) !== token) throw new DOMException('A newer compiler scene replaced this load.', 'AbortError');
    host.replaceChildren(root); committed = true; root.dataset.visible = 'true'; observer.observe(host); publish();
  }
  root.dataset.ready = 'true'; if (!deferCommit) commit();
  return { commit,
    async setMaterial(mode, lensId) {
      if (mode !== 'neutral' && mode !== 'textured') throw new TypeError('Unknown compiler material.');
      const request = ++materialRequest;
      if (disposed) return;
      if (mode === 'neutral') {
        for (const leaf of leaves) for (const node of leaf.nodes) node.style.backgroundImage = `url("${leaf.neutral}")`;
        root.dataset.material = 'neutral'; root.dataset.lens = ''; stars.setLens(null); publish(); return;
      }
      const lens = result.lenses.find(item => item.id === lensId);
      if (!lens) throw new TypeError('Compiler textured material requires a prepared lens.');
      if (activeLens?.id !== lens.id) {
        root.dataset.materialLoading = lens.id;
        const loaded = await loadBank(lens.volume, resolvePath, loadingSignal());
        if (disposed || request !== materialRequest) { release(loaded); return; }
        try { assertCompilerLensGeometry(neutral.payload, loaded.payload, result, lens); }
        catch (error) { release(loaded); throw error; }
        const previous = activeLens; activeLens = { id: lens.id, bank: loaded };
        applyBank(leaves, loaded);
        root.dataset.material = 'textured'; root.dataset.lens = lens.id; delete root.dataset.materialLoading;
        if (previous) release(previous.bank);
      } else {
        applyBank(leaves, activeLens.bank); root.dataset.material = 'textured'; root.dataset.lens = lens.id;
      }
      stars.setLens(lens.id); publish();
    },
    setStars(value) { stars.setVisible(value); root.dataset.stars = String(value); publish(); },
    setPose(nextYaw, nextPitch) {
      if (![nextYaw, nextPitch].every(Number.isFinite)) throw new TypeError('Compiler angles must be finite.');
      if (!disposed) { yaw = nextYaw; pitch = nextPitch; publish(); }
    },
    setFraming(next) {
      if (!Number.isFinite(next.zoom) || next.zoom <= 0 || ![next.panX, next.panY].every(Number.isFinite))
        throw new TypeError('Compiler framing is invalid.');
      if (!disposed) { framing = { ...next }; publish(); }
    },
    destroy() {
      if (disposed) return; disposed = true; materialRequest++; lifetime.abort(); observer.disconnect(); stars.destroy(); mounted.destroy(); root.remove();
      release(neutral); if (activeLens) release(activeLens.bank);
      if (pendingMounts.get(host) === token) pendingMounts.delete(host);
    } };
}

function mountStars(host: HTMLElement, result: CompilerBakeResult) {
  const root = host.ownerDocument.createElement('div'); root.dataset.compilerStars = String(result.stars.length);
  root.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2'; host.append(root);
  const nodes = result.stars.map(star => {
    const node = host.ownerDocument.createElement('s'); node.dataset.starId = star.id;
    const color = `rgb(${star.rgb[0]} ${star.rgb[1]} ${star.rgb[2]})`;
    node.style.cssText = `position:absolute;left:50%;top:50%;display:block;border-radius:50%;background:${color};opacity:${star.alpha};visibility:hidden;text-decoration:none`;
    root.append(node); return node;
  });
  let visible = true, destroyed = false, lensId: string | null = null;
  root.dataset.photometryLens = 'reference';
  return { publish(publication: ReturnType<typeof shapeCloudOrthographicCamera>['publication']) {
    if (destroyed) return;
    const local = presentPhysicalPoseInVolume(publication.world.pose, result.frame);
    const rotation = transposeWorldRotation(worldRotationFromQuaternion(local.orientationXyzw));
    const [ox, oy] = publication.viewport.principalOffsetPixels, focal = publication.viewport.focalPixels;
    const halfWidth = (publication.viewport.widthPixels ?? host.clientWidth) / 2;
    const halfHeight = (publication.viewport.heightPixels ?? host.clientHeight) / 2;
    let count = 0;
    result.stars.forEach((star, index) => {
      const point = projectPreparedPoint(star.positionUnits, local.positionUnits, rotation, focal, ox, oy), node = nodes[index]!;
      const appearance = compilerStarAppearance(star, lensId);
      const diameter = appearance.diameterUnits === undefined ? appearance.widthPx! : appearance.diameterUnits * focal / point.depth;
      const shown = visible && appearance.alpha > 0 && point.depth > 0 && Math.abs(point.x) < halfWidth + diameter && Math.abs(point.y) < halfHeight + diameter;
      node.style.visibility = shown ? '' : 'hidden'; if (shown) {
        count++; node.style.width = node.style.height = `${diameter}px`;
        node.style.transform = `translate(${point.x - diameter / 2}px,${point.y - diameter / 2}px)`;
      }
    });
    root.dataset.visibleStars = String(count);
  }, setLens(value: string | null) {
    lensId = value; root.dataset.photometryLens = value ?? 'reference';
    result.stars.forEach((star, index) => {
      const appearance = compilerStarAppearance(star, lensId), node = nodes[index]!;
      node.style.backgroundColor = `rgb(${appearance.rgb[0]} ${appearance.rgb[1]} ${appearance.rgb[2]})`;
      node.style.opacity = String(appearance.alpha);
    });
  }, setVisible(value: boolean) { visible = value; root.style.display = value ? 'block' : 'none'; root.dataset.visibleStars = value ? root.dataset.visibleStars ?? '0' : '0'; },
  destroy() { destroyed = true; root.remove(); } };
}

function applyBank(leaves: MaterialLeaf[], bank: LoadedBank) {
  const textures = (['x', 'y', 'z'] as const).flatMap(axis => bank.payload.stacks.find(stack => stack.axis === axis)!
    .leaves.map(leaf => requiredTexture(bank, leaf.texturePath)));
  if (textures.length !== leaves.length) throw new Error('Compiler material texture count differs from neutral geometry.');
  leaves.forEach((leaf, index) => { for (const node of leaf.nodes) node.style.backgroundImage = `url("${textures[index]}")`; });
}
async function loadBank(reference: CompilerPin, resolvePath: (path: string) => string, signal?: AbortSignal): Promise<LoadedBank> {
  const bytes = await readPinned(reference, resolvePath, signal);
  const payload = validatePreparedCssVolume(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  const directory = reference.path.slice(0, reference.path.lastIndexOf('/') + 1), textures = new Map<string, string>(), urls: string[] = [];
  const queue = [...payload.resources], settled = await Promise.allSettled(Array.from({ length: Math.min(6, queue.length) }, async () => {
    while (queue.length) {
      const resource = queue.shift()!, content = await readPinned({ path: `${directory}${resource.path}`, sha256: resource.sha256 }, resolvePath, signal);
      if (content.byteLength !== resource.bytes) throw new Error(`Compiler texture byte length differs: ${resource.path}`);
      const blob = new Blob([content]), url = URL.createObjectURL(blob); urls.push(url);
      let image: ImageBitmap;
      try { image = await createImageBitmap(blob); }
      catch (error) { throw new Error(`Compiler texture cannot be decoded: ${resource.path} (${resource.width}×${resource.height}).`, { cause: error }); }
      try {
        if (image.width !== resource.width || image.height !== resource.height) throw new Error(`Compiler texture dimensions differ: ${resource.path}`);
      } finally { image.close(); }
      textures.set(resource.path, url);
    }
  }));
  const failed = settled.find(item => item.status === 'rejected'); if (failed?.status === 'rejected') { release({ urls }); throw failed.reason; }
  return { payload, textures, urls };
}
async function readPinned(reference: CompilerPin, resolvePath: (path: string) => string, signal?: AbortSignal): Promise<ArrayBuffer> {
  if (!reference || !relativePath(reference.path) || !/^[a-f0-9]{64}$/.test(reference.sha256)) throw new TypeError('Compiler resource pin is invalid.');
  const response = await fetch(resolvePath(reference.path), { signal }); if (!response.ok) throw new Error(`Compiler resource failed to load: ${reference.path} (${response.status})`);
  const bytes = await response.arrayBuffer(), digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map(value => value.toString(16).padStart(2, '0')).join('');
  if (digest !== reference.sha256) throw new Error(`Compiler resource SHA-256 differs: ${reference.path}`); return bytes;
}
function requiredTexture(bank: LoadedBank, path: string) { const value = bank.textures.get(path); if (!value) throw new Error(`Compiler texture was not decoded: ${path}`); return value; }
function release(bank: Pick<LoadedBank, 'urls'>) {
  for (const url of bank.urls) URL.revokeObjectURL(url); bank.urls.length = 0;
}
function relativePath(path: string) { return typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.split('/').includes('..') && !/[\\\u0000-\u0020]/.test(path); }
function localPath(path: string): string { return `/@fs${__NEBULA_REPO_ROOT__.replace(/\/$/, '')}/${path}`; }
