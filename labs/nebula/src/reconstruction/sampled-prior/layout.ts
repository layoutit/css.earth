/** Offline registration of spectral crops onto the retained union mesh. Never resamples source pixels. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { CompilerBakeResult, CompilerLensVolume, CompilerPin } from '../compiler/bake-types';
import { validatePreparedCssVolume } from '../../../../../src/renderers/css/volume/validation';
import { geometrySha, readGeometryPin } from '../geometry/registered-source';
import { jointRecord } from '../joint-fit/model';
import { compileCssVolume } from '../../../../../src/renderers/css/preparation/volume';
import type { VolumeSlices, VolumeSliceQuad } from '../../../../../src/preparation/volume/slices';

type Vec = [number, number, number];
export interface RegisteredSlice {
  id: string; widthPx: number; heightPx: number; vertices: [Vec, Vec, Vec, Vec];
  texturePath: string; sha256: string; bytes: number;
}
function readSlices(value: unknown): RegisteredSlice[] {
  if (!jointRecord(value) || !Array.isArray(value.quads) || !value.quads.length || value.quads.length > 1536)
    throw new TypeError('Invalid component slice catalogue.');
  const ids = new Set<string>();
  return value.quads.map((q: unknown): RegisteredSlice => {
    if (!jointRecord(q) || typeof q.id !== 'string' || !/^[xyz]-\d+$/.test(q.id) || ids.has(q.id) ||
        ![q.widthPx, q.heightPx, q.bytes].every(n => Number.isSafeInteger(n) && Number(n) > 0) ||
        Number(q.widthPx) > 1024 || Number(q.heightPx) > 2048 ||
        typeof q.texturePath !== 'string' || !/^slices\/[xyz]\/\d+\.png$/.test(q.texturePath) ||
        typeof q.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(q.sha256) || !Array.isArray(q.vertices) || q.vertices.length !== 4 ||
        !q.vertices.every(p => Array.isArray(p) && p.length === 3 && p.every(n => typeof n === 'number' && Number.isFinite(n))))
      throw new TypeError('Invalid registered component quad.');
    ids.add(q.id);
    const vertices = q.vertices.map(p => [Number(p[0]), Number(p[1]), Number(p[2])] as Vec);
    return { id: q.id, widthPx: Number(q.widthPx), heightPx: Number(q.heightPx), bytes: Number(q.bytes),
      texturePath: q.texturePath, sha256: q.sha256, vertices: [vertices[0]!, vertices[1]!, vertices[2]!, vertices[3]!] };
  });
}
const dot = (a: Vec, b: Vec) => a.reduce((sum, n, i) => sum + n * b[i]!, 0);
const minus = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const step = (q: RegisteredSlice, vertex: 1 | 3, pixels: number): Vec => minus(q.vertices[vertex], q.vertices[0]).map(n => n / pixels) as Vec;

/** Quantization can extend a weaker component one pixel beyond the neutral crop. Union actual raster footprints. */
export function mergeSliceLayout(reference: RegisteredSlice, components: RegisteredSlice[]): RegisteredSlice {
  const u = step(reference, 1, reference.widthPx), v = step(reference, 3, reference.heightPx);
  let left = 0, top = 0, right = reference.widthPx, bottom = reference.heightPx;
  for (const q of components) {
    if (q.id !== reference.id) throw new TypeError('Cannot merge different physical slabs.');
    const delta = minus(q.vertices[0], reference.vertices[0]), cu = step(q, 1, q.widthPx), cv = step(q, 3, q.heightPx);
    const x = dot(delta, u) / dot(u, u), y = dot(delta, v) / dot(v, v), ix = Math.round(x), iy = Math.round(y);
    const tolerance = 1e-7 * Math.max(1, ...u.map(Math.abs), ...v.map(Math.abs));
    if (![x, y].every(Number.isFinite) || Math.abs(x - ix) > 1e-5 || Math.abs(y - iy) > 1e-5 ||
        u.some((n, i) => Math.abs(n - cu[i]!) > tolerance) || v.some((n, i) => Math.abs(n - cv[i]!) > tolerance) ||
        delta.some((n, i) => Math.abs(n - ix * u[i]! - iy * v[i]!) > tolerance))
      throw new TypeError('Component footprints do not share one registered pixel grid.');
    left = Math.min(left, ix); top = Math.min(top, iy); right = Math.max(right, ix + q.widthPx); bottom = Math.max(bottom, iy + q.heightPx);
  }
  const point = (x: number, y: number): Vec => reference.vertices[0].map((n, i) => n + x * u[i]! + y * v[i]!) as Vec;
  return { ...reference, widthPx: right - left, heightPx: bottom - top,
    vertices: [point(left, top), point(right, top), point(right, bottom), point(left, bottom)] };
}

/** Integer translation only. The exact RGBA bytes survive; unoccupied union pixels remain zero. */
export function padComponentSlice(reference: RegisteredSlice, component: RegisteredSlice | undefined, rgba?: Uint8Array): Buffer {
  const output = Buffer.alloc(reference.widthPx * reference.heightPx * 4);
  if (!component) return output;
  if (component.id !== reference.id || !rgba || rgba.length !== component.widthPx * component.heightPx * 4)
    throw new TypeError('Component slab identity or raster dimensions differ.');
  if (!rgba.some((value, i) => i % 4 === 3 && value > 0)) return output;
  const u = step(reference, 1, reference.widthPx), v = step(reference, 3, reference.heightPx);
  const cu = step(component, 1, component.widthPx), cv = step(component, 3, component.heightPx);
  const delta = minus(component.vertices[0], reference.vertices[0]);
  const x = dot(delta, u) / dot(u, u), y = dot(delta, v) / dot(v, v), left = Math.round(x), top = Math.round(y);
  const tolerance = 1e-7 * Math.max(1, ...u.map(Math.abs), ...v.map(Math.abs));
  if (![x, y].every(Number.isFinite) || Math.abs(x - left) > 1e-5 || Math.abs(y - top) > 1e-5 ||
      u.some((n, i) => Math.abs(n - cu[i]!) > tolerance) || v.some((n, i) => Math.abs(n - cv[i]!) > tolerance) ||
      delta.some((n, i) => Math.abs(n - left * u[i]! - top * v[i]!) > tolerance) ||
      left < 0 || top < 0 || left + component.widthPx > reference.widthPx || top + component.heightPx > reference.heightPx)
    throw new TypeError(`Component pixels do not register inside the canonical union crop (${reference.id}; offset ${x},${y}; source ${component.widthPx}x${component.heightPx}; union ${reference.widthPx}x${reference.heightPx}).`);
  for (let row = 0; row < component.heightPx; row++) {
    const start = row * component.widthPx * 4;
    output.set(rgba.subarray(start, start + component.widthPx * 4), ((row + top) * reference.widthPx + left) * 4);
  }
  return output;
}

export async function registerComponentBanks(root: string, outputDirectory: string, neutral: CompilerBakeResult,
  lenses: CompilerLensVolume[], signal: AbortSignal,
  readPinned: (pin: CompilerPin) => Promise<Buffer> = pin => readGeometryPin(root, pin)): Promise<CompilerBakeResult> {
  const readVolume = async (pin: CompilerPin) => validatePreparedCssVolume(JSON.parse((await readPinned(pin)).toString()));
  const catalogue = async (pin: CompilerPin) => readSlices(JSON.parse(await readFile(resolve(root, dirname(pin.path), 'volume-slices.json'), 'utf8')));
  const banks = await Promise.all([{ id: 'neutral', volume: neutral.neutral }, ...lenses].map(async item => ({
    ...item, original: await readVolume(item.volume), slices: new Map((await catalogue(item.volume)).map(q => [q.id, q])),
    resources: [] as Array<{ path: string; sha256: string; bytes: number; width: number; height: number }>, alpha: createHash('sha256'),
  })));
  const active = new Set(banks.flatMap(bank => bank.original.stacks.flatMap(stack => stack.leaves.map(leaf => leaf.id))));
  const ids = [...active].sort((a, b) => a[0]!.localeCompare(b[0]!) || Number(a.slice(2)) - Number(b.slice(2)));
  const quads: VolumeSliceQuad[] = [];
  for (const id of ids) {
    signal.throwIfAborted();
    const candidates = banks.flatMap(bank => bank.original.stacks.some(stack => stack.leaves.some(leaf => leaf.id === id)) ? [bank.slices.get(id)!] : []);
    if (candidates.some(q => !q)) throw new TypeError('Prepared component mesh is missing its registered crop.');
    const reference = mergeSliceLayout(candidates[0]!, candidates.slice(1)), unionPixels = Buffer.alloc(reference.widthPx * reference.heightPx * 4);
    await Promise.all(banks.map(async bank => {
      const source = bank.slices.get(id); let pixels: Buffer | undefined;
      if (source) {
        const bytes = await readPinned({ path: `${dirname(bank.volume.path)}/${source.texturePath}`, sha256: source.sha256 });
        const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        if (bytes.length !== source.bytes || decoded.info.width !== source.widthPx || decoded.info.height !== source.heightPx || decoded.info.channels !== 4)
          throw new TypeError('Component raster differs from its registered crop.');
        pixels = decoded.data;
      }
      const padded = padComponentSlice(reference, source, pixels), opacity = Buffer.alloc(reference.widthPx * reference.heightPx);
      for (let i = 0; i < opacity.length; i++) {
        const a = padded[4 * i + 3]!; opacity[i] = a;
        if (a > unionPixels[4 * i + 3]!) { unionPixels[4 * i] = unionPixels[4 * i + 1] = unionPixels[4 * i + 2] = 255; unionPixels[4 * i + 3] = a; }
      }
      bank.alpha.update(opacity);
      const bytes = await sharp(padded, { raw: { width: reference.widthPx, height: reference.heightPx, channels: 4 } }).png().toBuffer();
      const path = resolve(root, outputDirectory, bank.id, reference.texturePath); await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes);
      bank.resources.push({ path: reference.texturePath, sha256: geometrySha(bytes), bytes: bytes.length, width: reference.widthPx, height: reference.heightPx });
    }));
    // This real max-alpha raster defines retained occupancy only; each displayed bank retains its own original RGBA.
    const bytes = await sharp(unionPixels, { raw: { width: reference.widthPx, height: reference.heightPx, channels: 4 } }).png().toBuffer();
    const path = resolve(root, outputDirectory, 'layout-union', reference.texturePath); await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes);
    const center = reference.vertices[0].map((n, i) => (n + reference.vertices[2][i]!) / 2) as Vec;
    const axis = id[0] as 'x' | 'y' | 'z';
    quads.push({ ...reference, axis, sliceIndex: Number(id.slice(2)), center, normal: axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1],
      uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], sha256: geometrySha(bytes), bytes: bytes.length,
      alphaCoverage: unionPixels.reduce((n, a, i) => n + Number(i % 4 === 3 && a > 0), 0) / (reference.widthPx * reference.heightPx) });
  }
  const bounds = neutral.frame.boundsUnits, counts = neutral.sampling.sliceCounts;
  const slices: VolumeSlices = { quads, boundsUnits: { min: [...bounds.min], max: [...bounds.max] }, provenance: { fieldIdentity: neutral.fieldIdentity }, approximation: {
    method: 'Union of registered retained component rasters; no pixel resampling.', radialEmission: 'none', limitations: ['Layout occupancy is the union; display banks retain distinct opacity.'],
    samplesPerSlab: 4, opticalWeight: 1, exposureGain: 1, sliceCounts: counts,
    slabPitchUnits: { x: (bounds.max[0] - bounds.min[0]) / counts.x, y: (bounds.max[1] - bounds.min[1]) / counts.y, z: (bounds.max[2] - bounds.min[2]) / counts.z } } };
  const canonical = compileCssVolume({ id: `compiler-${neutral.id}`, frame: neutral.frame, slices, recipe: { anchors: [] } });
  const pins = new Map<string, { volume: CompilerPin; alphaSha256: string }>();
  for (const bank of banks) {
    const alphaSha256 = bank.alpha.digest('hex');
    const payload = validatePreparedCssVolume({ ...canonical, resources: bank.resources, provenance: {
      ...(jointRecord(bank.original.provenance) ? bank.original.provenance : {}), alphaSha256,
      layout: 'Canonical union mesh; original component RGBA pixels translated without resampling and padded with transparent pixels.', sourceVolume: bank.volume,
    } });
    const bytes = Buffer.from(JSON.stringify(payload)), path = `${outputDirectory}/${bank.id}/volume.json`;
    await writeFile(resolve(root, path), bytes); pins.set(bank.id, { volume: { path, sha256: geometrySha(bytes) }, alphaSha256 });
  }
  return { ...neutral, neutral: pins.get('neutral')!.volume, alphaSha256: pins.get('neutral')!.alphaSha256,
    lenses: lenses.map(lens => ({ ...lens, ...pins.get(lens.id)! })) };
}
