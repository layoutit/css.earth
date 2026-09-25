import { observationEnvelope as envelope, type VolumeRecipe, type ImageWcs } from '@cssearth/bake/volume';
import { parseLabModelJson } from '../../resources/model-paths.ts';
/** Offline preparation of frozen cloud-component inspection banks. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { DensityVolumeFrame } from '@cssearth/objects';
import { loadVolumeSource } from '@cssearth/volume-bake/compact-inputs/density-grid';
import { sha256 } from '@cssearth/core/node';
import type { VolumeSlices } from '@cssearth/volume-bake/slices/density';
import { compileCssVolume, type PreparedCssVolume } from '../../adapters/preparation/css-volume.ts';
import { decomposeFilledComponents, type FilledComponentOptions } from '@cssearth/nebula-reconstruction/methods/density-prior/filled-components';
import { createFilledPartsSampler, type FilledVolumePart } from '@cssearth/nebula-reconstruction/methods/density-prior/filled-parts';
import { rectifyObservation } from '@cssearth/nebula-reconstruction/methods/density-prior/filled-products';
import { bakeMasterVolumeSlices, deriveMasterVolumeSlices } from '@cssearth/volume-bake/slices/emission';
import { createObservationMapping, reprojectObservationPrior } from '../../adapters/preparation/observation-prior.ts';

type Vec3 = [number, number, number];
type Bounds3 = { min: Vec3; max: Vec3 };
interface Pin { path: string; sha256: string }
interface Recipe {
  schema: 'cssearth-filled-observation@1'; directory: string;
  photo: Pin & { url: string }; wcs: ImageWcs; frame: Pin; stellarPrior: Pin;
  analysis: { width: number; decomposition: FilledComponentOptions; priorDimensions: Vec3 };
  depth: Parameters<typeof createFilledPartsSampler>[0]['depth']; diffusePriorWeight: number;
  channels: { compact: boolean; diffuse: boolean; extended: boolean };
  exposureGain: number; maxDisplaySignal: number;
  master: { width: number; sliceCounts: { x: number; y: number; z: number }; samplesPerSlab: number };
  delivery: { width: number; quality: number };
  variants: { id: string; directory: string; mode: 'broad' | 'coherent' }[];
}
interface PreparedObject { schema: string; id: string; type: string; format: string; data: PreparedCssVolume }

const json = (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
async function pinned(pin: Pin, url?: string): Promise<Buffer> {
  const bytes = await readFile(pin.path).catch(async (error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT' || !url) throw error;
    const response = await fetch(url); if (!response.ok) throw new Error(`Source download failed: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  });
  if (sha256(bytes) !== pin.sha256) throw new Error(`Pinned input drifted: ${pin.path}`);
  if (url) { await mkdir(dirname(pin.path), { recursive: true }); await writeFile(pin.path, bytes); }
  return bytes;
}
const span = (bounds: Bounds3, axis: number) => bounds.max[axis]! - bounds.min[axis]!;
const safe = (id: string) => id.replace(/[^a-z0-9_-]+/giu, '-').replace(/^-+|-+$/gu, '').toLowerCase();

const [recipePath = 'labs/nebula/models/lmc/clouds.json', requestedVariant, extra] = process.argv.slice(2);
if (extra) throw new Error('Usage: prepare-parts [recipe.json] [coherent-variant-id]');
const recipeBytes = await readFile(recipePath), recipe: Recipe = parseLabModelJson(recipeBytes.toString());
if (recipe.schema !== 'cssearth-filled-observation@1') throw new TypeError('Invalid filled observation recipe.');
const coherent = recipe.variants.filter(item => item.mode === 'coherent');
const variant = requestedVariant ? coherent.find(item => item.id === requestedVariant) : coherent.at(-1);
if (!variant) throw new TypeError('Recipe does not contain the requested coherent reference.');
const targetId = variant.id, targetDirectory = resolve(variant.directory);
if (recipe.channels.compact || recipe.channels.diffuse || !recipe.channels.extended) {
  throw new TypeError('Part preparation requires the exact extended-only reference recipe.');
}
const nativePhoto = await pinned(recipe.photo, recipe.photo.url);
const frameSource = parseLabModelJson((await pinned(recipe.frame)).toString()) as { properties: { volume: DensityVolumeFrame } };
const frame = frameSource.properties.volume, mapping = createObservationMapping(recipe.wcs, frame);
if (Math.abs(frame.metersPerUnit / 3.085677581491367e19 - 1) > 1e-10) {
  throw new TypeError('Cloud-part preparation requires kpc frame units.');
}
const photo = await rectifyObservation(nativePhoto, mapping, recipe.analysis.width);
console.log(`CLOUD_PARTS_PHOTO ${photo.width}x${photo.height}`);
const decomposition = decomposeFilledComponents(photo.intensity, photo.width, photo.height, recipe.analysis.decomposition);
const stellarRecipe = parseLabModelJson((await pinned(recipe.stellarPrior)).toString()) as VolumeRecipe;
const stellar = await loadVolumeSource(dirname(recipe.stellarPrior.path), stellarRecipe);
const prior = reprojectObservationPrior(stellar, mapping, { dimensions: recipe.analysis.priorDimensions });
const sampler = createFilledPartsSampler({ target: photo, decomposition, boundsKpc: prior.boundsKpc, densityPrior: prior,
  mode: 'coherent', channels: recipe.channels, depth: recipe.depth, diffusePriorWeight: recipe.diffusePriorWeight,
  exposureGain: recipe.exposureGain, maxDisplaySignal: recipe.maxDisplaySignal });
const referenceBytes = await readFile(resolve(targetDirectory, 'prepared/volume.json'));
const reference = parseLabModelJson(referenceBytes.toString()) as PreparedObject;
if (reference.id !== targetId || reference.data.id !== targetId) throw new TypeError('Prepared reference object has the wrong id.');
for (const key of ['referenceFrame', 'epochJdTt', 'metersPerUnit', 'originM', 'localToReferenceXyzw'] as const) {
  if (JSON.stringify(reference.data.frame[key]) !== JSON.stringify(frame[key])) {
    throw new TypeError(`Prepared reference frame ${key} differs from the pinned source frame.`);
  }
}
const globalBounds = reference.data.frame.boundsUnits as Bounds3;
const referenceLeafIds = reference.data.stacks.flatMap(stack => stack.leaves.map(leaf => leaf.id));
if (new Set(referenceLeafIds).size !== referenceLeafIds.length) throw new TypeError('Reference leaf ids are not globally unique.');
console.log(`CLOUD_PARTS_MODEL ${sampler.parts.length} parts ${decomposition.components.length} extended`);

async function bakePart(part: FilledVolumePart): Promise<{ part: FilledVolumePart; data: PreparedCssVolume }> {
  if (!(part.integratedIntensity > 0)) throw new TypeError(`Part ${part.id} has no positive source signal.`);
  const physicalBounds = envelope(mapping, part.supportBoundsKpc);
  const ratios = [0, 1, 2].map(axis => span(physicalBounds, axis) / span(globalBounds, axis));
  const counts = { x: Math.min(512, Math.max(16, Math.ceil(recipe.master.sliceCounts.x * ratios[0]!))),
    y: Math.min(512, Math.max(16, Math.ceil(recipe.master.sliceCounts.y * ratios[1]!))),
    z: Math.min(512, Math.max(16, Math.ceil(recipe.master.sliceCounts.z * ratios[2]!))) };
  const width = Math.max(16, Math.ceil(512 * Math.max(ratios[0]!, ratios[1]!)));
  const key = sha256(Buffer.from(JSON.stringify({ recipe: sha256(recipeBytes), part: part.id, physicalBounds,
    counts, width, implementation: sha256(await readFile('labs/nebula/packages/lab/src/server/workflows/density/filled-volume.ts')) }))).slice(0, 16);
  const name = safe(part.id), masterDirectory = resolve('.local/nebula-lab/cloud-parts', key, 'masters');
  const outputDirectory = resolve(targetDirectory, 'prepared/parts', name);
  const deliveryBanks = [{ width: Math.min(512, width), outputDirectory,
    imageEncoding: { format: 'webp' as const, quality: recipe.delivery.quality } }];
  const sample: FilledVolumePart['sample'] = (x, y, z, out) => {
    const [tx, ty] = mapping.tangentAtPoint(x, y, z); part.sample(tx, ty, z, out);
    const metric = mapping.rayPathPerDepth(tx, ty); out[0] /= metric; out[1] /= metric; out[2] /= metric;
  };
  const cached = await readFile(resolve(masterDirectory, 'volume-slices.json'), 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error; return null;
  });
  let slices: VolumeSlices;
  if (cached) slices = (await deriveMasterVolumeSlices({ masters: parseLabModelJson(cached), masterDirectory, deliveryBanks }))[0]!.slices;
  else slices = (await bakeMasterVolumeSlices({ sampleEmission: sample, boundsKpc: physicalBounds, sliceCounts: counts,
    samplesPerSlab: recipe.master.samplesPerSlab, exposureGain: recipe.exposureGain, masterWidth: width, masterDirectory,
    deliveryBanks, unitsPerSourceUnit: 1, provenance: { schema: 'cssearth-cloud-part@1', id: part.id,
      interpretation: part.interpretation, frozenReference: targetId }, onProgress(progress) {
        if (progress.completed === progress.total) console.log(`CLOUD_PARTS_BANK ${part.id} ${progress.total} slices`);
      } })).banks[0]!.slices;
  const outputFrame = { ...frame, boundsUnits: physicalBounds };
  return { part, data: compileCssVolume({ id: `${targetId}-${name}`, frame: outputFrame, slices, recipe: { anchors: [] } }) };
}

const results: { part: FilledVolumePart; data: PreparedCssVolume }[] = [];
let cursor = 0;
async function worker(): Promise<void> {
  while (cursor < sampler.parts.length) {
    const index = cursor++, part = sampler.parts[index]!;
    const result = await bakePart(part); results[index] = result;
    console.log(`CLOUD_PARTS_READY ${index + 1}/${sampler.parts.length} ${part.id} ${result.data.resources.length} images`);
  }
}
await Promise.all(Array.from({ length: Math.min(4, sampler.parts.length) }, () => worker()));

const partLeafIds = new Map<string, string[]>(), partResources: PreparedCssVolume['resources'][number][] = [];
const partLeaves = new Map<string, PreparedCssVolume['stacks'][number]['leaves'][number][]>();
for (const axis of ['x', 'y', 'z']) partLeaves.set(axis, []);
for (const { part, data } of results) {
  const name = safe(part.id), ids: string[] = []; partLeafIds.set(part.id, ids);
  for (const stack of data.stacks) for (const leaf of stack.leaves) {
    const id = `${name}::${leaf.id}`; ids.push(id);
    partLeaves.get(stack.axis)!.push({ ...leaf, id, texturePath: `parts/${name}/${leaf.texturePath}` });
  }
  partResources.push(...data.resources.map(resource => ({ ...resource, path: `parts/${name}/${resource.path}` })));
}
const axisIndex = { x: 0, y: 1, z: 2 } as const;
const stacks = reference.data.stacks.map(stack => {
  const tagged = [...stack.leaves.map((leaf, order) => ({ leaf, order, reference: true })),
    ...partLeaves.get(stack.axis)!.map((leaf, order) => ({ leaf, order, reference: false }))];
  tagged.sort((a, b) => a.leaf.centerUnits[axisIndex[stack.axis]]! - b.leaf.centerUnits[axisIndex[stack.axis]]! ||
    Number(b.reference) - Number(a.reference) || a.order - b.order);
  const leaves = tagged.map(item => item.leaf);
  const retained = leaves.filter(leaf => referenceLeafIds.includes(leaf.id)).map(leaf => leaf.id);
  const original = stack.leaves.map(leaf => leaf.id);
  if (retained.join('\0') !== original.join('\0')) throw new TypeError(`Reference ${stack.axis} leaf order changed.`);
  return { ...stack, leaves };
});
const combinedBounds: Bounds3 = { min: [...globalBounds.min] as Vec3, max: [...globalBounds.max] as Vec3 };
for (const { data } of results) for (let axis = 0; axis < 3; axis++) {
  combinedBounds.min[axis] = Math.min(combinedBounds.min[axis]!, data.frame.boundsUnits.min[axis]!);
  combinedBounds.max[axis] = Math.max(combinedBounds.max[axis]!, data.frame.boundsUnits.max[axis]!);
}
const combined: PreparedObject = { ...reference, data: { ...reference.data,
  frame: { ...reference.data.frame, boundsUnits: combinedBounds }, stacks,
  resources: [...reference.data.resources, ...partResources], provenance: { reference: reference.data.provenance,
    inspection: { schema: 'cssearth-cloud-parts@1', recipe: recipePath, recipeSha256: sha256(recipeBytes),
      composition: 'Exact reference leaves remain the default. Filtered independent RGBA source-over is contribution inspection and is not an exact arbitrary-subset reconstruction.' } } } };
await mkdir(resolve(targetDirectory, 'source'), { recursive: true });
await json(resolve(targetDirectory, 'prepared/inspection.json'), combined);
const sourceTotal = decomposition.diagnostics.inputSum;
const orderedParts = results.map(({ part }) => part).sort((a, b) =>
  Number(b.kind === 'extended') - Number(a.kind === 'extended') || b.integratedIntensity - a.integratedIntensity);
let structure = 0;
await json(resolve(targetDirectory, 'source/cloud-parts.json'), { schema: 'cssearth-cloud-parts@1', id: targetId,
  parts: orderedParts.map(part => ({ id: part.id, label: part.kind === 'extended' ? `Structure ${++structure}` :
    part.kind === 'compact' ? 'Compact candidates' : 'Diffuse remainder', kind: part.kind,
    ...(part.scale === undefined ? {} : { scale: part.scale }), ...(part.radius === undefined ? {} : { radius: part.radius }),
    signalFraction: part.integratedIntensity / sourceTotal, defaultEnabled: part.kind === 'extended', leafIds: partLeafIds.get(part.id)! })), referenceLeafIds,
  composition: 'The unfiltered default uses exact reference leaves. Filtered part leaves are independently encoded source-over contribution inspection; their combined RGBA is order-dependent and approximate.' });
const inspectionBytes = await readFile(resolve(targetDirectory, 'prepared/inspection.json'));
await json(resolve(targetDirectory, 'inspection-object.json'), { schema: 'cssearth-object@1', id: targetId,
  type: 'density-volume', properties: { volume: combined.data.frame,
    preparation: { source: 'source/cloud-parts.json', sha256: sha256(await readFile(resolve(targetDirectory, 'source/cloud-parts.json'))) } },
  prepared: { format: 'cssearth-density-volume@1', url: 'prepared/inspection.json', sha256: sha256(inspectionBytes) } });
console.log(`CLOUD_PARTS_COMPLETE ${results.length} parts ${partResources.length} resources ${partResources.reduce((sum, item) => sum + item.bytes, 0)} bytes`);
