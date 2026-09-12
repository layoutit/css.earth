/** Offline transport for one fitted neutral field and source-dependent RGB lenses. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, relative } from 'node:path';
import sharp from 'sharp';
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { Bounds3, Vector3 } from '../../../../../src/preparation/volume/config.js';
import { containedPath, sha256, verifiedBytes } from '../../../../../src/preparation/volume/source.js';
import type { VolumeSlices } from '../../../../../src/preparation/volume/slices.js';
import { compileCssVolume } from '../../../../../src/renderers/css/preparation/volume.js';
import { validatePreparedCssVolume } from '../../../../../src/renderers/css/volume/validation.js';
import { recolorCloudSlices } from '../cloud-material.js';
import { bakeMasterVolumeSlices } from '../master-slices.js';
import { COMPILER_LONGEST_AXIS_SLICES, readCompilerBakeResult, validCompilerStarSize, validCompilerStarMaterials, type CompilerBakeResult, type CompilerPin, type PreparedCompilerStar, type CompilerStarMaterial } from './bake-types.js';
import type { EmissionBounds, EmissionVector3, SkyBounds } from './field-types.js';

export type { CompilerBakeResult, CompilerLensVolume, CompilerPin, PreparedCompilerStar } from './bake-types.js';
export { readCompilerBakeResult } from './bake-types.js';
export interface CompilerBakeProgress { phase: 'volume' | 'texture' | 'compile'; completed: number; total: number; message: string }
export interface CompilerStarInput { id: string; positionArcsec: EmissionVector3; rgb: [number, number, number]; widthPx?: number; diameterUnits?: number; alpha: number; materials?: Record<string, CompilerStarMaterial> }
export interface CompilerLensInput {
  id: string; label: string;
  /** Registered source chromaticity in absolute west/north arcseconds. False means outside observed coverage. */
  sampleRgb(xWestArcsec: number, yNorthArcsec: number, outRgb: Vector3): boolean;
}
export interface BakeCompilerOptions {
  root: string; outputDirectory: string; id: string; fieldIdentity: string;
  boundsArcsec: EmissionBounds; skyBoundsArcsec: SkyBounds;
  sampleEmission(xWestArcsec: number, yNorthArcsec: number, zAwayArcsec: number, outRgb: Vector3): void;
  lenses: CompilerLensInput[]; stars?: CompilerStarInput[]; signal?: AbortSignal;
  progress?(progress: CompilerBakeProgress): void;
}

const IMAGE_WIDTH = 512 as const, DEPTH_SAMPLES = 4 as const;
const json = (value: unknown) => Buffer.from(JSON.stringify(value) + '\n');
function cancel(signal?: AbortSignal) { if (signal?.aborted) throw new DOMException('Nebula compile cancelled.', 'AbortError'); }
function validBounds(bounds: EmissionBounds): boolean {
  return Array.isArray(bounds?.min) && Array.isArray(bounds?.max) && bounds.min.length === 3 && bounds.max.length === 3 &&
    bounds.min.every((n, i) => Number.isFinite(n) && Number.isFinite(bounds.max[i]) && n < bounds.max[i]!);
}
function validSkyBounds(bounds: SkyBounds): boolean {
  return Array.isArray(bounds?.min) && Array.isArray(bounds?.max) && bounds.min.length === 2 && bounds.max.length === 2 &&
    bounds.min.every((n, i) => Number.isFinite(n) && Number.isFinite(bounds.max[i]) && n < bounds.max[i]!);
}
async function pin(root: string, path: string, value: unknown): Promise<CompilerPin> {
  const bytes = json(value); await writeFile(containedPath(root, path), bytes); return { path, sha256: sha256(bytes) };
}
export async function compilerAlphaDigest(directory: string, slices: VolumeSlices, signal?: AbortSignal): Promise<string> {
  const digest = createHash('sha256');
  for (const quad of slices.quads) {
    cancel(signal);
    const bytes = await verifiedBytes(directory, { path: quad.texturePath, sha256: quad.sha256 });
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== quad.widthPx || info.height !== quad.heightPx || info.channels !== 4) throw new Error('Compiler alpha inspection found changed slice dimensions.');
    const alpha = Buffer.alloc(info.width * info.height);
    for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3]!;
    digest.update(alpha);
  }
  return digest.digest('hex');
}

/** Focused handoff check used by the baker and its regression test. */
export async function verifyCompilerAlphaIdentity(expected: string,
  candidateDirectory: string, candidate: VolumeSlices, signal?: AbortSignal): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(expected)) throw new TypeError('Compiler reference alpha digest is invalid.');
  const actual = await compilerAlphaDigest(candidateDirectory, candidate, signal);
  if (actual !== expected) throw new Error('Compiler material changed the shared alpha bytes.');
}

export function compilerFrame(bounds: EmissionBounds): { origin: EmissionVector3; localBounds: Bounds3; frame: DensityVolumeFrame } {
  if (!validBounds(bounds)) throw new TypeError('Compiler frame requires finite increasing west/north/away bounds.');
  const origin = bounds.min.map((n, i) => (n + bounds.max[i]!) / 2) as EmissionVector3;
  const localBounds: Bounds3 = { min: bounds.min.map((n, i) => n - origin[i]!) as Vector3,
    max: bounds.max.map((n, i) => n - origin[i]!) as Vector3 };
  return { origin, localBounds, frame: { referenceFrame: 'lab-sky-angular', epochJdTt: 2451545,
    originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1, boundsUnits: localBounds } };
}

/** Builds all RGB materials from the same decoded alpha and centered west/north/away frame. */
export async function bakeCompiler(options: BakeCompilerOptions): Promise<CompilerBakeResult> {
  const { root, outputDirectory, boundsArcsec, skyBoundsArcsec, signal } = options;
  if (!isAbsolute(root) || isAbsolute(outputDirectory) || !outputDirectory || !/^[a-z0-9][a-z0-9-]{0,95}$/.test(options.id) ||
      !/^[a-f0-9]{64}$/.test(options.fieldIdentity) || !validBounds(boundsArcsec) || !validSkyBounds(skyBoundsArcsec) ||
      typeof options.sampleEmission !== 'function' || !Array.isArray(options.lenses) || options.lenses.length < 1 || options.lenses.length > 8)
    throw new TypeError('Invalid compiler bake input.');
  const lensIds = new Set<string>();
  for (const lens of options.lenses) if (!/^[a-z0-9][a-z0-9-]{0,95}$/.test(lens.id) || lensIds.has(lens.id) || !lens.label.trim() || typeof lens.sampleRgb !== 'function')
    throw new TypeError('Compiler lens identities must be unique and safe.'); else lensIds.add(lens.id);
  const { origin, localBounds, frame } = compilerFrame(boundsArcsec);
  const starIds = new Set<string>(), stars: PreparedCompilerStar[] = [];
  for (const star of options.stars ?? []) {
    if (!star.id || star.id.length > 128 || starIds.has(star.id) || !Array.isArray(star.positionArcsec) || star.positionArcsec.length !== 3 || !star.positionArcsec.every(Number.isFinite) ||
        !Array.isArray(star.rgb) || star.rgb.length !== 3 || !star.rgb.every(n => Number.isInteger(n) && n >= 0 && n <= 255) ||
        !validCompilerStarSize(star) || !Number.isFinite(star.alpha) || star.alpha < 0 || star.alpha > 1 || !validCompilerStarMaterials(star.materials, lensIds))
      throw new TypeError('Invalid compiler star input.');
    starIds.add(star.id); stars.push({ id: star.id, positionUnits: star.positionArcsec.map((n, i) => n - origin[i]!) as EmissionVector3,
      rgb: [...star.rgb], ...(star.diameterUnits !== undefined ? { diameterUnits: star.diameterUnits } : { widthPx: star.widthPx }), alpha: star.alpha,
      ...(star.materials ? { materials: structuredClone(star.materials) } : {}) });
  }
  if (stars.length > 5000) throw new TypeError('Compiler star count exceeds the retained point budget.');
  const spans = boundsArcsec.max.map((n, i) => n - boundsArcsec.min[i]!), pitch = Math.max(...spans) / COMPILER_LONGEST_AXIS_SLICES;
  const count = (span: number) => Math.min(COMPILER_LONGEST_AXIS_SLICES, Math.max(1, Math.ceil(span / pitch)));
  const sliceCounts = { x: count(spans[0]!), y: count(spans[1]!), z: count(spans[2]!) };
  const output = containedPath(root, outputDirectory), masterDirectory = containedPath(output, 'masters');
  const neutralDirectory = containedPath(output, 'neutral');
  await mkdir(output, { recursive: true }); cancel(signal);
  const provenance = { schema: 'cssearth-compiler-volume-provenance@1', fieldIdentity: options.fieldIdentity,
    coordinates: { axes: ['west', 'north', 'away'], units: 'arcsec', localOriginArcsec: origin,
      mapping: 'absoluteArcsec = localUnits + localOriginArcsec', earthView: 'observer-at-negative-z-looking-away' },
    boundsArcsec, skyBoundsArcsec,
    interpretation: 'Neutral relative display emission from the supplied fitted field. Source RGB supplies material chromaticity only and cannot change support, opacity, or depth.',
    limitations: ['This prepared preview transports the caller-owned analytic field; it does not define or validate the scientific model.',
      'Angular depth is an inferred display coordinate, not a measured line-of-sight distance.', 'Finite slabs, four depth samples per slab, and RGBA8 opacity approximate the continuous field.'] };
  const totalSlices = sliceCounts.x + sliceCounts.y + sliceCounts.z;
  options.progress?.({ phase: 'volume', completed: 0, total: totalSlices * 2, message: 'Preparing shared neutral geometry' });
  let calls = 0;
  const baked = await bakeMasterVolumeSlices({ boundsKpc: localBounds, sliceCounts, samplesPerSlab: DEPTH_SAMPLES,
    exposureGain: 1, masterWidth: IMAGE_WIDTH, masterDirectory,
    deliveryBanks: [{ width: IMAGE_WIDTH, outputDirectory: neutralDirectory, imageEncoding: { format: 'png' } }], unitsPerSourceUnit: 1,
    provenance, cropTransparent: true, allowEmpty: false, sampleEmission(x, y, z, out) {
      if ((++calls & 0xffff) === 0) cancel(signal);
      options.sampleEmission(x + origin[0], y + origin[1], z + origin[2], out);
      if (out.some(value => !Number.isFinite(value) || value < 0) || Math.max(...out) - Math.min(...out) > 1e-12)
        throw new TypeError('Compiler geometry sampler must return finite nonnegative neutral emission.');
    }, onProgress(progress) { cancel(signal); options.progress?.({ phase: 'volume',
      completed: (progress.phase === 'delivery' ? totalSlices : 0) + progress.completed, total: totalSlices * 2,
      message: progress.phase === 'master' ? `Preparing ${progress.axis.toUpperCase()} geometry slabs` : `Cropping ${progress.axis.toUpperCase()} retained slabs` }); } });
  const neutralSlices = baked.banks[0]?.slices;
  if (!neutralSlices) throw new Error('Compiler did not derive the cropped neutral bank.');
  await rm(masterDirectory, { recursive: true, force: true });
  neutralSlices.approximation.method = 'Direct XYZ relative-emissivity samples per arcsecond; shared exponential opacity and optical RGB ratios; lossless cropped RGBA8 delivery.';
  const neutralAlpha = await compilerAlphaDigest(neutralDirectory, neutralSlices, signal);
  neutralSlices.provenance = { ...provenance, alphaSha256: neutralAlpha };
  await writeFile(containedPath(neutralDirectory, 'volume-slices.json'), json(neutralSlices));
  const painted: { input: CompilerLensInput; slices: VolumeSlices; coverage: { positiveAlphaTexels: number; recoloredTexels: number; outsideImageTexels: number } }[] = [];
  for (let lensIndex = 0; lensIndex < options.lenses.length; lensIndex++) {
    const lens = options.lenses[lensIndex]!, directory = containedPath(output, `lenses/${lens.id}`);
    options.progress?.({ phase: 'texture', completed: lensIndex * totalSlices, total: options.lenses.length * totalSlices,
      message: `Painting ${lens.label}; preserving shared opacity` });
    const result = await recolorCloudSlices({ slices: neutralSlices, loadResource: path => readFile(containedPath(neutralDirectory, path)),
      outputDirectory: directory, encoding: { format: 'png' }, sampleImageRgb(x, y, _z, out) {
        return lens.sampleRgb(x + origin[0], y + origin[1], out);
      }, onProgress(progress) { cancel(signal); options.progress?.({ phase: 'texture', completed: lensIndex * totalSlices + progress.completed,
        total: options.lenses.length * totalSlices, message: `Painting ${lens.label}; preserving shared opacity` }); } });
    await verifyCompilerAlphaIdentity(neutralAlpha, directory, result.slices, signal);
    result.slices.provenance = { ...provenance, alphaSha256: neutralAlpha, materialLensId: lens.id, coverage: result.coverage };
    await writeFile(containedPath(directory, 'volume-slices.json'), json(result.slices));
    painted.push({ input: lens, slices: result.slices, coverage: { positiveAlphaTexels: result.coverage.positiveAlphaTexels,
      recoloredTexels: result.coverage.recoloredTexels, outsideImageTexels: result.coverage.outsideImageTexels } });
  }
  const banks = [{ id: 'neutral', directory: neutralDirectory, slices: neutralSlices }, ...painted.map(item => ({ id: item.input.id,
    directory: containedPath(output, `lenses/${item.input.id}`), slices: item.slices }))];
  const pins = new Map<string, CompilerPin>();
  for (let index = 0; index < banks.length; index++) {
    cancel(signal); const bank = banks[index]!;
    options.progress?.({ phase: 'compile', completed: index, total: banks.length, message: 'Compiling retained volume materials' });
    const volume = validatePreparedCssVolume(compileCssVolume({ id: `compiler-${options.id}`, frame, slices: bank.slices, recipe: { anchors: [] } }));
    pins.set(bank.id, await pin(root, relative(root, containedPath(bank.directory, 'volume.json')), volume));
  }
  options.progress?.({ phase: 'compile', completed: banks.length, total: banks.length, message: 'Prepared final cloud and materials' });
  return readCompilerBakeResult({ schema: 'cssearth-compiler-bake@1', id: options.id, fieldIdentity: options.fieldIdentity, frame,
    boundsArcsec: structuredClone(boundsArcsec), skyBoundsArcsec: structuredClone(skyBoundsArcsec),
    spanArcsec: Math.max(skyBoundsArcsec.max[0] - skyBoundsArcsec.min[0], skyBoundsArcsec.max[1] - skyBoundsArcsec.min[1]),
    sourceImage: { width: 512, height: 512 }, coordinates: { axes: ['west', 'north', 'away'], localOriginArcsec: origin,
      earthView: 'observer-at-negative-z-looking-away' }, neutral: pins.get('neutral'), alphaSha256: neutralAlpha,
    lenses: painted.map(item => ({ id: item.input.id, label: item.input.label, volume: pins.get(item.input.id), coverage: item.coverage })),
    stars, sampling: { sliceCounts, imageWidth: IMAGE_WIDTH, samplesPerSlab: DEPTH_SAMPLES } });
}
