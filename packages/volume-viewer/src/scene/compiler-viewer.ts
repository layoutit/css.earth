import { readCompilerBakeResult, type CompilerBakeResult } from '@cssearth/bake/volume';
import { compilerInspectionCamera, type CompilerInspectionFrame } from '../camera/inspection.ts';
import type { ViewFraming as ShapeCloudFraming } from '../camera/framing.ts';
import type { CompilerViewerBackend } from './backend.ts';
import { loadBank, loadStarAtlas, requiredTexture, release, type LoadedBank } from './assets.ts';
import { mountStars } from './stars.ts';

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
export interface CompilerViewerOptions<Bank, Publication> {
  backend: CompilerViewerBackend<Bank, Publication>;
  host: HTMLElement; result: CompilerBakeResult; resolvePath: (path: string) => string;
  fieldOfViewArcsec?: number; inspectionFrame?: CompilerInspectionFrame; deferCommit?: boolean; signal?: AbortSignal;
}

/** Retains the current material while a requested lens loads and validates. */
export async function createCompilerViewer<Bank, Publication>({ backend, host, result: input, resolvePath,
  fieldOfViewArcsec, inspectionFrame, deferCommit = false, signal }: CompilerViewerOptions<Bank, Publication>): Promise<CompilerViewer> {
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
  let neutral: LoadedBank<Bank> | undefined, starAtlasUrl: string | undefined;
  try {
    neutral = await loadBank(backend, result.neutral, resolvePath, loadingSignal());
    backend.assertIdentity(neutral.payload, result);
    if (result.starSprites) starAtlasUrl = await loadStarAtlas(result, resolvePath, loadingSignal());
    signal?.throwIfAborted();
    if (pendingMounts.get(host) !== token) throw new DOMException('A newer compiler scene replaced this load.', 'AbortError');
  } catch (error) { if (neutral) release(neutral); if (starAtlasUrl) URL.revokeObjectURL(starAtlasUrl); throw error; }
  const end = host.ownerDocument.createElement('span'); end.hidden = true; root.append(end);
  const mounted = backend.mount(root, end, neutral.payload, path => requiredTexture(neutral, path));
  const leaves: MaterialLeaf[] = mounted.materials.map(material => ({ nodes: material.nodes, neutral: requiredTexture(neutral, material.texturePath) }));
  const stars = mountStars(backend, root, result, starAtlasUrl);
  let framing: ShapeCloudFraming = { zoom: 1, panX: 0, panY: 0 }, yaw = 0, pitch = 0;
  let materialRequest = 0, activeLens: { id: string; bank: LoadedBank<Bank> } | null = null;
  const presentationSize = fieldOfViewArcsec ?? result.spanArcsec;
  function publish() {
    if (disposed || !host.clientWidth || !host.clientHeight) return;
    const viewport = { width: host.clientWidth, height: host.clientHeight };
    const inspection = inspectionFrame && compilerInspectionCamera(inspectionFrame, result.coordinates.localOriginArcsec, viewport, framing, yaw, pitch);
    const camera = backend.camera(result.frame, inspection?.image ?? { width: presentationSize, height: presentationSize, unitsPerPixel: 1 },
      viewport, inspection?.framing ?? framing, yaw, pitch);
    mounted.publish(camera);
    stars.publish(camera.publication);
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
        mounted.setTextures(leaves.map(leaf => leaf.neutral));
        root.dataset.material = 'neutral'; root.dataset.lens = ''; stars.setLens(null); publish(); return;
      }
      const lens = result.lenses.find(item => item.id === lensId);
      if (!lens) throw new TypeError('Compiler textured material requires a prepared lens.');
      if (activeLens?.id !== lens.id) {
        root.dataset.materialLoading = lens.id;
        const loaded = await loadBank(backend, lens.volume, resolvePath, loadingSignal());
        if (disposed || request !== materialRequest) { release(loaded); return; }
        try { backend.assertLensGeometry(neutral.payload, loaded.payload, result, lens); }
        catch (error) { release(loaded); throw error; }
        const previous = activeLens; activeLens = { id: lens.id, bank: loaded };
        applyBank(backend, leaves, loaded, mounted.setTextures);
        root.dataset.material = 'textured'; root.dataset.lens = lens.id; delete root.dataset.materialLoading;
        if (previous) release(previous.bank);
      } else {
        applyBank(backend, leaves, activeLens.bank, mounted.setTextures); root.dataset.material = 'textured'; root.dataset.lens = lens.id;
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
      release(neutral); if (activeLens) release(activeLens.bank); if (starAtlasUrl) URL.revokeObjectURL(starAtlasUrl);
      if (pendingMounts.get(host) === token) pendingMounts.delete(host);
    } };
}

function applyBank<Bank, Publication>(backend: CompilerViewerBackend<Bank, Publication>, leaves: MaterialLeaf[], bank: LoadedBank<Bank>, setTextures: (urls: readonly string[]) => void) {
  const textures = backend.texturePaths(bank.payload).map(path => requiredTexture(bank, path));
  if (textures.length !== leaves.length) throw new Error('Compiler material texture count differs from neutral geometry.');
  setTextures(textures);
}

export type { CompilerViewerBackend } from './backend.ts';
