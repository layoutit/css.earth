/** Offline RGB replacement using a pinned compiler bank's exact retained slabs. */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative } from 'node:path';
import type { Vector3 } from '@cssearth/volume-core/contracts/volume-recipe';
import { containedPath, sha256, sourceBytes } from '../compact-inputs/density-grid.ts';
import { readVolumeLayerPlan, readVolumeSlabInterval, validateVolumeLayerSlices, type VolumeSlices, type VolumeSliceQuad } from '@cssearth/volume-core/contracts/volume-slices';
import { recolorCloudSlices } from '../slices/material.ts';
import { verifyCompilerAlphaIdentity, type BakeCompilerOptions, type CompilerLensInput } from './bake.ts';
import { readCompilerBakeResult, type CompilerBakeResult, type CompilerLensVolume, type CompilerPin } from '@cssearth/volume-core/contracts/compiler-bake';
import { compilerSlabMaterial } from '@cssearth/volume-core/materials/slab-material';
import { COMPILER_PHYSICAL_REFERENCE, compilerPreparedSlices } from '@cssearth/volume-core/coordinates/compiler-frame';

export interface RetainedMaterialBankOptions {
  root: string; outputDirectory: string; scene: CompilerBakeResult; neutralSlicesPin: CompilerPin;
  lens: CompilerLensInput; sampleEmission: BakeCompilerOptions['sampleEmission'];
  onProgress?(progress: { completed: number; total: number }): void;
}
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const positive = (v: unknown): v is number => finite(v) && v > 0;
const integer = (v: unknown): v is number => positive(v) && Number.isSafeInteger(v);
const vector = (v: unknown): v is Vector3 => Array.isArray(v) && v.length === 3 && v.every(finite);
const path = (v: unknown): v is string => typeof v === 'string' && !!v && !isAbsolute(v) && !v.split('/').includes('..') && !/[\\\u0000-\u0020]/u.test(v);
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
function quad(v: unknown): v is VolumeSliceQuad {
  return record(v) && typeof v.id === 'string' && !!v.id && ['x', 'y', 'z'].includes(String(v.axis)) &&
    finite(v.sliceIndex) && Number.isInteger(v.sliceIndex) && v.sliceIndex >= 0 && path(v.texturePath) &&
    integer(v.widthPx) && v.widthPx <= 8192 && integer(v.heightPx) && v.heightPx <= 8192 &&
    Array.isArray(v.vertices) && v.vertices.length === 4 && v.vertices.every(vector) &&
    Array.isArray(v.uvs) && v.uvs.length === 4 && v.uvs.every(uv => Array.isArray(uv) && uv.length === 2 && uv.every(finite)) &&
    vector(v.center) && vector(v.normal) && digest(v.sha256) && integer(v.bytes) &&
    finite(v.alphaCoverage) && v.alphaCoverage >= 0 && v.alphaCoverage <= 1;
}
/** Validate the external slice manifest before exposing it to the material sampler. */
function readSlices(v: unknown, scene: CompilerBakeResult): VolumeSlices {
  if (!record(v) || !Array.isArray(v.quads) || !v.quads.length || v.quads.length > 1536 || !v.quads.every(quad) ||
      new Set(v.quads.map(q => q.id)).size !== v.quads.length || new Set(v.quads.map(q => q.texturePath)).size !== v.quads.length ||
      !record(v.boundsUnits) || !vector(v.boundsUnits.min) || !vector(v.boundsUnits.max) ||
      JSON.stringify(v.boundsUnits) !== JSON.stringify(scene.frame.boundsUnits) || !record(v.approximation))
    throw new TypeError('Invalid retained compiler slices or frame bounds.');
  const a = v.approximation;
  if (typeof a.method !== 'string' || typeof a.radialEmission !== 'string' || !Array.isArray(a.limitations) ||
      !a.limitations.every((s): s is string => typeof s === 'string') || a.samplesPerSlab !== scene.sampling.samplesPerSlab ||
      !positive(a.opticalWeight) || !positive(a.exposureGain) || !record(a.sliceCounts) || !record(a.slabPitchUnits) ||
      a.displayColorMatrix !== undefined || (a.emissionTransfer !== undefined && a.emissionTransfer !== 'shared-opacity'))
    throw new TypeError('Invalid retained compiler slab sampling.');
  const counts = a.sliceCounts, pitches = a.slabPitchUnits;
  const layerPlan = a.layerPlan === undefined ? undefined : readVolumeLayerPlan(a.layerPlan);
  if (JSON.stringify(layerPlan) !== JSON.stringify(scene.sampling.layerPlan))
    throw new TypeError('Retained compiler layer plan differs from the scene sampling.');
  for (const [index, axis] of (['x', 'y', 'z'] as const).entries()) {
    const count = counts[axis], pitch = pitches[axis];
    if (count !== scene.sampling.sliceCounts[axis] || !integer(count) || !positive(pitch) ||
        Math.abs(pitch * count - (v.boundsUnits.max[index]! - v.boundsUnits.min[index]!)) > 1e-8 ||
        v.quads.filter(q => q.axis === axis).length !== count ||
        new Set(v.quads.filter(q => q.axis === axis).map(q => q.sliceIndex)).size !== count ||
        v.quads.some(q => q.axis === axis && q.sliceIndex >= count)) throw new TypeError('Invalid retained compiler axis sampling.');
  }
  // Each runtime-owned property has been checked above; optional noncompiler transport modes are rejected.
  const slices: VolumeSlices = { quads: v.quads.map(q => ({ ...q, ...(q.slab === undefined ? {} : { slab: readVolumeSlabInterval(q.slab) }) })),
    boundsUnits: { min: v.boundsUnits.min, max: v.boundsUnits.max }, provenance: v.provenance,
    approximation: { method: a.method, radialEmission: a.radialEmission, limitations: a.limitations,
      samplesPerSlab: a.samplesPerSlab, opticalWeight: a.opticalWeight, exposureGain: a.exposureGain,
      ...(a.emissionTransfer === 'shared-opacity' ? { emissionTransfer: a.emissionTransfer } : {}),
      ...(layerPlan ? { layerPlan } : {}),
      sliceCounts: { ...scene.sampling.sliceCounts }, slabPitchUnits: {
        x: Number(pitches.x), y: Number(pitches.y), z: Number(pitches.z) } } };
  validateVolumeLayerSlices(slices);
  return slices;
}
const geometry = (s: VolumeSlices) => s.quads.map(({ texturePath: _p, sha256: _h, bytes: _b, ...q }) => q);

export interface RetainedMaterialBackend<Volume> {
 readVolume(value:unknown):Volume;
 compileVolume(input:Parameters<import('./bake.ts').CompilerBakeBackend['compileVolume']>[0]):Volume;
 assertBankIdentity(volume:Volume,scene:CompilerBakeResult):void;
 assertLensGeometry(neutral:Volume,textured:Volume,scene:CompilerBakeResult,lens:Pick<CompilerLensVolume,'alphaSha256'>):void;
}
export async function prepareRetainedMaterialBank<Volume>(options: RetainedMaterialBankOptions, backend:RetainedMaterialBackend<Volume>): Promise<CompilerLensVolume> {
  const { root, outputDirectory, lens, neutralSlicesPin } = options;
  if (!isAbsolute(root) || !path(outputDirectory) || !lens || !/^[a-z0-9][a-z0-9-]{0,95}$/.test(lens.id) ||
      typeof lens.label !== 'string' || !lens.label.trim() || typeof lens.sampleMaterial !== 'function' ||
      typeof options.sampleEmission !== 'function') throw new TypeError('Retained compiler material requires a 3D material sampler and emission sampler.');
  const scene = readCompilerBakeResult(options.scene), sourceDirectory = dirname(containedPath(root, scene.neutral.path));
  if (!neutralSlicesPin || !path(neutralSlicesPin.path) ||
      containedPath(root, neutralSlicesPin.path) !== containedPath(sourceDirectory, 'volume-slices.json'))
    throw new TypeError('Retained compiler slices must sit beside the original neutral bank.');
  const output = containedPath(root, outputDirectory);
  if (output === sourceDirectory || sourceDirectory.startsWith(output + '/') || output.startsWith(sourceDirectory + '/'))
    throw new TypeError('Retained compiler material output must be separate from the neutral bank.');
  const neutral = backend.readVolume(JSON.parse((await sourceBytes(root, scene.neutral)).toString('utf8')));
  backend.assertBankIdentity(neutral, scene);
  const slices = readSlices(JSON.parse((await sourceBytes(root, neutralSlicesPin)).toString('utf8')), scene);
  const compile = (bank: VolumeSlices) => backend.compileVolume({ id: `compiler-${scene.volumeId ?? scene.id}`,
    frame: scene.frame, slices: scene.frame.referenceFrame === COMPILER_PHYSICAL_REFERENCE ? compilerPreparedSlices(bank) : bank });
  backend.assertLensGeometry(neutral, compile(slices), scene, {});
  await verifyCompilerAlphaIdentity(scene.alphaSha256, sourceDirectory, slices);
  const origin = scene.coordinates.localOriginArcsec;
  const material = compilerSlabMaterial((x, y, z, out) => {
    out.fill(NaN); options.sampleEmission(x, y, z, out);
    if (out.some(n => !Number.isFinite(n) || n < 0) || Math.max(...out) - Math.min(...out) > 1e-12)
      throw new TypeError('Retained compiler emission must be finite nonnegative neutral XYZ emission.');
  }, (x, y, z, out) => {
    out.fill(NaN); const observed = lens.sampleMaterial(x, y, z, out);
    if (typeof observed !== 'boolean') throw new TypeError('Retained compiler XYZ material must return a coverage boolean.');
    return observed;
  });
  const painted = await recolorCloudSlices({ slices, loadResource: p => readFile(containedPath(sourceDirectory, p)), outputDirectory: output,
    encoding: { format: 'png' }, preserveMaterialIntensity: true,
    sampleImageRgb(x, y, z, out, slab) { return material(x + origin[0], y + origin[1], z + origin[2], out, slab); },
    onProgress: options.onProgress });
  if (JSON.stringify(geometry(slices)) !== JSON.stringify(geometry(painted.slices))) throw new Error('Retained compiler material changed quad geometry.');
  await verifyCompilerAlphaIdentity(scene.alphaSha256, output, painted.slices);
  painted.slices.provenance = { schema: 'cssearth-compiler-retained-material@1', fieldIdentity: scene.fieldIdentity,
    alphaSha256: scene.alphaSha256, materialLensId: lens.id, neutral: scene.neutral, neutralSlices: neutralSlicesPin,
    reference: slices.provenance, coverage: painted.coverage };
  const volume = compile(painted.slices); backend.assertLensGeometry(neutral, volume, scene, {});
  const bytes = Buffer.from(JSON.stringify(volume) + '\n');
  await writeFile(containedPath(output, 'volume-slices.json'), JSON.stringify(painted.slices) + '\n');
  await writeFile(containedPath(output, 'volume.json'), bytes);
  const { positiveAlphaTexels, recoloredTexels, outsideImageTexels } = painted.coverage;
  return { id: lens.id, label: lens.label, volume: { path: relative(root, containedPath(output, 'volume.json')) },
    coverage: { positiveAlphaTexels, recoloredTexels, outsideImageTexels } };
}
