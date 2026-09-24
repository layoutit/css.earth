/** Offline transport for one fitted neutral field and source-dependent RGB lenses. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, relative } from 'node:path';
import sharp from 'sharp';
import type { DensityVolumeFrame } from '@cssearth/volume-core/contracts/volume-frame';
import type { Vector3 } from '@cssearth/volume-core/contracts/volume-recipe';
import { containedPath, sourceBytes } from '../compact-inputs/density-grid.ts';
import { sha256 } from '@cssearth/core/node';
import type { VolumeSlices } from '@cssearth/volume-core/contracts/volume-slices';
import { recolorCloudSlices } from '../slices/material.ts';
import { bakeMasterVolumeSlices } from '../slices/emission.ts';
import { compilerSlabMaterial } from '@cssearth/volume-core/materials/slab-material';
import { optimizeVolumeLayers, readLayerOptimizationReport } from '@cssearth/volume-core/sampling/layer-optimization';
import { readVolumeLayerPlan } from '@cssearth/volume-core/contracts/volume-slices';
import { createRenderElementBudget, maximumRenderSlabs, readRenderElementBudget, readRenderElementProfile, renderElementCount,
  type RenderElementProfile } from '@cssearth/volume-core/contracts/render-element-budget';
import { readCompilerBakeResult, validCompilerStarSize, validCompilerStarMaterials, type CompilerBakeResult, type CompilerPin, type PreparedCompilerStar, type CompilerStarMaterial, type CompilerStarSprites } from '@cssearth/volume-core/contracts/compiler-bake';
import type { EmissionBounds, EmissionVector3, SkyBounds } from '@cssearth/volume-core/contracts/emission';

import { compilerFrame, compilerPreparedPoint, compilerPreparedSlices, compilerSliceCounts, validCompilerBounds } from '@cssearth/volume-core/coordinates/compiler-frame';
export { compilerFrame, compilerSliceCounts } from '@cssearth/volume-core/coordinates/compiler-frame';

export type { CompilerBakeResult, CompilerLensVolume, CompilerPin, PreparedCompilerStar } from '@cssearth/volume-core/contracts/compiler-bake';
export { readCompilerBakeResult } from '@cssearth/volume-core/contracts/compiler-bake';
export interface CompilerBakeProgress { phase: 'volume' | 'texture' | 'compile'; completed: number; total: number; message: string }
import type {CompilerStarInput} from '@cssearth/volume-core/contracts/compiler-star-input';
export type {CompilerStarInput} from '@cssearth/volume-core/contracts/compiler-star-input';
export interface CompilerLensInput {
  id: string; label: string;
  /** Component-bound 3D chromaticity in 0..255; false means no observed material. No projected-image fallback. */
  sampleMaterial(xWestArcsec: number, yNorthArcsec: number, zAwayArcsec: number, outRgb: Vector3): boolean;
}
/** A host validates its own retained representation; the baker owns only pixels and generic resource pins. */
export interface CompiledVolumeArtifact {
  resources: readonly { path: string; sha256: string; bytes: number }[];
}
export interface CompilerBakeBackend {
  /** Host-owned, tested cost of its retained geometry, points and delivery wrappers. */
  renderBudget?: RenderElementProfile;
  compileVolume(input: { id: string; frame: DensityVolumeFrame; slices: VolumeSlices }): CompiledVolumeArtifact;
  prepareStarSprites(root: string, outputDirectory: string, stars: readonly PreparedCompilerStar[]): Promise<{ starSprites?: CompilerStarSprites }>;
}

export interface BakeCompilerOptions {
  root: string; outputDirectory: string; id: string; fieldIdentity: string;
  boundsArcsec: EmissionBounds; skyBoundsArcsec: SkyBounds;
  sampleEmission(xWestArcsec: number, yNorthArcsec: number, zAwayArcsec: number, outRgb: Vector3): void;
  /** Optional common support envelope for several component mixtures. Used only for offline allocation. */
  samplePlanningEmission?: BakeCompilerOptions['sampleEmission'];
  /** Exact saved sampling for compact replay or a shared component layout. Absence selects the automatic budget. */
  sampling?: CompilerBakeResult['sampling'];
  /** Internal verified compact replay only. Never a research recipe option. New budget receipts still validate. */
  historicalReplay?: boolean;
  /** Component unions may add their pinned stars only after individual material bakes. Never below stars.length. */
  reservedStars?: number;
  /** Historical compact receipts retain their original unreflected coordinate convention. */
  preparedPhysical?: boolean;
  /** Smallest supported kernel scale; reduces slab spacing for thin, tilted structures. */
  minimumFeatureScaleArcsec?: number;
  lenses: CompilerLensInput[]; stars?: CompilerStarInput[]; signal?: AbortSignal;
  progress?(progress: CompilerBakeProgress): void;
}

const IMAGE_WIDTH = 512 as const, DEPTH_SAMPLES = 4 as const;
const json = (value: unknown) => Buffer.from(JSON.stringify(value) + '\n');
function cancel(signal?: AbortSignal) { if (signal?.aborted) throw new DOMException('Nebula compile cancelled.', 'AbortError'); }

/** New authoring plans once; immutable compact replay uses its saved quadrature and partition. */
export function compilerSampling(options: Pick<BakeCompilerOptions, 'boundsArcsec' | 'minimumFeatureScaleArcsec' | 'sampleEmission' | 'samplePlanningEmission' | 'sampling' | 'signal' | 'progress' | 'historicalReplay'> &
  { renderProfile?: RenderElementProfile; starCount?: number }): CompilerBakeResult['sampling'] {
  const starCount = options.starCount ?? 0, profile = options.renderProfile && readRenderElementProfile(options.renderProfile);
  if (!Number.isSafeInteger(starCount) || starCount < 0 ||
      (options.historicalReplay !== undefined && typeof options.historicalReplay !== 'boolean')) throw new TypeError('Invalid compiler star reservation or replay mode.');
  if (options.historicalReplay && !options.sampling) throw new TypeError('Historical replay requires exact saved sampling.');
  if (options.sampling !== undefined) {
    const saved = options.sampling, counts = saved.sliceCounts;
    if (!counts || saved.imageWidth !== IMAGE_WIDTH || saved.samplesPerSlab !== DEPTH_SAMPLES ||
        [counts.x, counts.y, counts.z].some(n => !Number.isInteger(n) || n < 1 || n > 512)) throw new TypeError('Invalid saved compiler sampling.');
    if (saved.layerPlan !== undefined) {
      const plan = readVolumeLayerPlan(saved.layerPlan);
      if (plan.referenceSamplesPerSlab !== DEPTH_SAMPLES || (['x', 'y', 'z'] as const).some(axis => plan.axes[axis].length !== counts[axis]))
        throw new TypeError('Saved compiler sampling differs from its layer plan.');
      if (saved.layerOptimization !== undefined) readLayerOptimizationReport(saved.layerOptimization, plan);
    } else if (saved.layerOptimization !== undefined) throw new TypeError('Saved layer optimization requires a layer plan.');
    const slabCount = counts.x + counts.y + counts.z;
    if (saved.renderBudget !== undefined) {
      if (!profile) throw new TypeError('A budgeted compiler scene requires its host render profile.');
      readRenderElementBudget(saved.renderBudget, starCount, slabCount, profile);
      return structuredClone(saved);
    }
    if (options.historicalReplay) {
      if (profile) {
        const elements = renderElementCount(profile, starCount, slabCount);
        options.progress?.({ phase: 'volume', completed: 0, total: slabCount,
          message: `Replaying pinned historical sampling unchanged: ${elements} reserved renderer elements (${elements > profile.maximumElements ? 'over budget' : 'within budget'}).` });
      }
      return structuredClone(saved);
    }
    if (!profile) throw new TypeError('New compiler sampling requires a host render-element profile.');
    return { ...structuredClone(saved), renderBudget: createRenderElementBudget(profile, starCount, slabCount) };
  }
  if (!profile) throw new TypeError('New compiler sampling requires a host render-element profile.');
  const maximumLayers = Math.min(500, maximumRenderSlabs(profile, starCount));
  const { plan, report } = optimizeVolumeLayers({ bounds: options.boundsArcsec,
    maximumLayers,
    referenceSliceCounts: compilerSliceCounts(options.boundsArcsec, options.minimumFeatureScaleArcsec), referenceSamplesPerSlab: DEPTH_SAMPLES,
    sampleEmission: options.samplePlanningEmission ?? options.sampleEmission, signal: options.signal,
    onProgress: ({ completed, total }) => options.progress?.({ phase: 'volume', completed, total,
      message: `Choosing at most ${maximumLayers} XYZ slabs within ${profile.maximumElements} retained renderer elements` }) });
  return { sliceCounts: { x: plan.axes.x.length, y: plan.axes.y.length, z: plan.axes.z.length }, imageWidth: IMAGE_WIDTH,
    samplesPerSlab: DEPTH_SAMPLES, layerPlan: plan, layerOptimization: report,
    renderBudget: createRenderElementBudget(profile, starCount, plan.axes.x.length + plan.axes.y.length + plan.axes.z.length) };
}
function validSkyBounds(bounds: SkyBounds): boolean {
  return Array.isArray(bounds?.min) && Array.isArray(bounds?.max) && bounds.min.length === 2 && bounds.max.length === 2 &&
    bounds.min.every((n, i) => Number.isFinite(n) && Number.isFinite(bounds.max[i]) && n < bounds.max[i]!);
}
async function pin(root: string, path: string, value: unknown): Promise<CompilerPin> {
  const bytes = json(value); await writeFile(containedPath(root, path), bytes); return { path };
}
export async function compilerAlphaDigest(directory: string, slices: VolumeSlices, signal?: AbortSignal): Promise<string> {
  const digest = createHash('sha256');
  for (const quad of slices.quads) {
    cancel(signal);
    const bytes = await sourceBytes(directory, { path: quad.texturePath });
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

/** Builds all RGB materials from the same decoded alpha and centered west/north/away frame. */
export async function bakeCompiler(options: BakeCompilerOptions, backend: CompilerBakeBackend): Promise<CompilerBakeResult> {
  const { root, outputDirectory, boundsArcsec, skyBoundsArcsec, signal } = options;
  if (!isAbsolute(root) || isAbsolute(outputDirectory) || !outputDirectory || !/^[a-z0-9][a-z0-9-]{0,95}$/.test(options.id) ||
      !/^[a-f0-9]{64}$/.test(options.fieldIdentity) || !validCompilerBounds(boundsArcsec) || !validSkyBounds(skyBoundsArcsec) ||
      typeof options.sampleEmission !== 'function' || !Array.isArray(options.lenses) || options.lenses.length < 1 || options.lenses.length > 8)
    throw new TypeError('Invalid compiler bake input.');
  const lensIds = new Set<string>();
  for (const lens of options.lenses) if (!/^[a-z0-9][a-z0-9-]{0,95}$/.test(lens.id) || lensIds.has(lens.id) || !lens.label.trim() || typeof lens.sampleMaterial !== 'function')
    throw new TypeError('Compiler lenses require unique safe identities and a 3D material sampler.'); else lensIds.add(lens.id);
  const preparedPhysical = options.preparedPhysical ?? true;
  if (typeof preparedPhysical !== 'boolean') throw new TypeError('Invalid compiler frame convention.');
  const { origin, localBounds, frame } = compilerFrame(boundsArcsec, preparedPhysical);
  const starIds = new Set<string>(), stars: PreparedCompilerStar[] = [];
  for (const star of options.stars ?? []) {
    if (!star.id || star.id.length > 128 || starIds.has(star.id) || !Array.isArray(star.positionArcsec) || star.positionArcsec.length !== 3 || !star.positionArcsec.every(Number.isFinite) ||
        !Array.isArray(star.rgb) || star.rgb.length !== 3 || !star.rgb.every(n => Number.isInteger(n) && n >= 0 && n <= 255) ||
        !validCompilerStarSize(star) || !Number.isFinite(star.alpha) || star.alpha < 0 || star.alpha > 1 || !validCompilerStarMaterials(star.materials, lensIds))
      throw new TypeError('Invalid compiler star input.');
    const localPosition = star.positionArcsec.map((n, i) => n - origin[i]!) as EmissionVector3;
    starIds.add(star.id); stars.push({ id: star.id, positionUnits: preparedPhysical ? compilerPreparedPoint(localPosition) : localPosition,
      rgb: [...star.rgb], ...(star.diameterUnits !== undefined ? { diameterUnits: star.diameterUnits } : { widthPx: star.widthPx }), alpha: star.alpha,
      ...(star.materials ? { materials: structuredClone(star.materials) } : {}) });
  }
  if (stars.length > 5000) throw new TypeError('Compiler star count exceeds the retained point budget.');
  const reservedStars = options.reservedStars ?? options.sampling?.renderBudget?.starCount ?? stars.length;
  if (!Number.isSafeInteger(reservedStars) || reservedStars < stars.length) throw new TypeError('Compiler star reservation cannot omit retained stars.');
  const sampling = compilerSampling({ ...options, renderProfile: backend.renderBudget, starCount: reservedStars }), { sliceCounts, layerPlan } = sampling;
  const output = containedPath(root, outputDirectory), masterDirectory = containedPath(output, 'masters');
  const neutralDirectory = containedPath(output, 'neutral');
  await mkdir(output, { recursive: true }); cancel(signal);
  const provenance = { schema: 'cssearth-compiler-volume-provenance@1', fieldIdentity: options.fieldIdentity,
    coordinates: { axes: ['west', 'north', 'away'], units: 'arcsec', localOriginArcsec: origin,
      ...(preparedPhysical ? { mapping: 'sourceArcsec = [preparedWest, preparedNorth, -preparedToward] + localOriginArcsec',
        preparedAxes: ['west', 'north', 'toward'], earthView: 'source-observer-at-negative-z; prepared-observer-at-positive-z' }
        : { mapping: 'absoluteArcsec = localUnits + localOriginArcsec', earthView: 'observer-at-negative-z-looking-away' }) },
    boundsArcsec, skyBoundsArcsec, minimumFeatureScaleArcsec: options.minimumFeatureScaleArcsec,
    interpretation: 'Neutral relative display emission from the supplied fitted field. Source RGB supplies material chromaticity only and cannot change support, opacity, or depth.',
    limitations: ['This prepared preview transports the caller-owned analytic field; it does not define or validate the scientific model.',
      'Angular depth is an inferred display coordinate, not a measured line-of-sight distance.',
      layerPlan ? 'Grouped finite slabs retain four depth samples per reference cell; RGBA8 opacity and plane collapse approximate the continuous field. The coarse optimization estimate is not visual acceptance.'
        : 'Finite slabs, four depth samples per slab, and RGBA8 opacity approximate the continuous field.'],
    ...(sampling.layerOptimization ? { layerOptimization: sampling.layerOptimization } : {}),
    ...(sampling.renderBudget ? { renderBudget: sampling.renderBudget } : {}) };
  const totalSlices = sliceCounts.x + sliceCounts.y + sliceCounts.z;
  options.progress?.({ phase: 'volume', completed: 0, total: totalSlices * 2, message: 'Preparing shared neutral geometry' });
  let calls = 0;
  const baked = await bakeMasterVolumeSlices({ boundsKpc: localBounds, sliceCounts, samplesPerSlab: DEPTH_SAMPLES, ...(layerPlan ? { layerPlan } : {}),
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
    const slabMaterial = compilerSlabMaterial(options.sampleEmission, lens.sampleMaterial);
    options.progress?.({ phase: 'texture', completed: lensIndex * totalSlices, total: options.lenses.length * totalSlices,
      message: `Painting ${lens.label}; preserving shared opacity` });
    const result = await recolorCloudSlices({ slices: neutralSlices, loadResource: path => readFile(containedPath(neutralDirectory, path)),
      outputDirectory: directory, encoding: { format: 'png' }, preserveMaterialIntensity: true, sampleImageRgb(x, y, z, out, slab) {
        return slabMaterial(x + origin[0], y + origin[1], z + origin[2], out, slab);
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
    // Keep the source sampling and pinned PNG bytes untouched. Cross the handedness boundary once,
    // before the physical renderer sees coordinates, by reflecting prepared vertices and points.
    const volume = backend.compileVolume({ id: `compiler-${options.id}`, frame, slices: preparedPhysical ? compilerPreparedSlices(bank.slices) : bank.slices });
    pins.set(bank.id, await pin(root, relative(root, containedPath(bank.directory, 'volume.json')), volume));
  }
  options.progress?.({ phase: 'compile', completed: banks.length, total: banks.length, message: 'Prepared final cloud and materials' });
  const starSprites = await backend.prepareStarSprites(root, outputDirectory, stars);
  return readCompilerBakeResult({ schema: 'cssearth-compiler-bake@1', id: options.id, fieldIdentity: options.fieldIdentity, frame,
    boundsArcsec: structuredClone(boundsArcsec), skyBoundsArcsec: structuredClone(skyBoundsArcsec),
    spanArcsec: Math.max(skyBoundsArcsec.max[0] - skyBoundsArcsec.min[0], skyBoundsArcsec.max[1] - skyBoundsArcsec.min[1]),
    sourceImage: { width: 512, height: 512 }, coordinates: { axes: ['west', 'north', 'away'], localOriginArcsec: origin,
      earthView: 'observer-at-negative-z-looking-away' }, neutral: pins.get('neutral'), alphaSha256: neutralAlpha,
    lenses: painted.map(item => ({ id: item.input.id, label: item.input.label, volume: pins.get(item.input.id), coverage: item.coverage })),
    stars, ...starSprites, sampling });
}
