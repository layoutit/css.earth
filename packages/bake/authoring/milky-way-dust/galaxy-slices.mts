/** Compile a locally qualified b30 scalar-alpha slab bank in the fitted Galactic frame. */
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseDensityVolumeFrame, type Axis, type Vector3, type VolumeSlices } from '@cssearth/objects';

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Expected record.');
  return value as Record<string, unknown>;
}
function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Expected finite number.');
  return value;
}
function vector(value: unknown, length: number): number[] {
  if (!Array.isArray(value) || value.length !== length) throw new TypeError('Expected numeric vector.');
  return value.map(number);
}
/** The deferred attenuation is part of the prepared recipe, never an exposure knob. */
export function galaxyCompletedImageOpacity(input: unknown): number {
  const data = record(input), controls = record(data.bakeControls ?? {}), value = data.completedImageOpacity ?? 1;
  const opacity = number(value);
  if (opacity <= 0 || opacity > 1) throw new TypeError('Completed image opacity must be in (0,1].');
  if (controls.deferDisplayGain === true || opacity !== 1) throw new TypeError('Only the accepted completed image opacity is supported.');
  return opacity;
}
const point = (axis: Axis, depth: number, u: number, v: number): Vector3 =>
  axis === 'x' ? [depth, u, v] : axis === 'y' ? [u, depth, v] : [u, v, depth];

export interface GalaxyModelBinding {record:string;texturePrefix:string;}
export function galaxySlices(input: unknown, physicalFrame: unknown, directory: string,model?:GalaxyModelBinding) {
  const data = record(input), field = record(data.field), box = vector(field.box, 6);
  if (box.some((v, i) => i % 2 === 0 && v >= box[i + 1]!)) throw new TypeError('Unordered slab bounds.');
  const controls=record(data.bakeControls??{}),prefix=model?.texturePrefix??'b30-slices';
  if(model){if(!model.record||!/^[a-z0-9-]+$/u.test(prefix)||field.record!==model.record||controls.modelAdapter!=='local-galaxy-model@1'||controls.texturePrefix!==prefix||data.slabLocalTransfer!==true||data.mergedOpticalCopies!==3)throw new TypeError('Invalid opt-in galaxy model binding');}
  else if (field.record !== 'runs/b30-native-scatterFaceSide/fit-crisp.json') throw new TypeError('Expected b30 fitted field.');
  const counts = vector(data.counts, 3);
  if(model&&(counts.some((n,a)=>n>[13,13,7][a]!)||counts.reduce((a,b)=>a+b)>33))throw new TypeError('Opt-in galaxy banks must fit 33 merged layers');
  if (counts.some(n => !Number.isInteger(n) || n <= 0) || 3 * counts.reduce((a, b) => a + b, 0) + 16 > 500) {
    throw new TypeError('Slab bank exceeds 500 pieces including optical copies and reserved wrappers.');
  }
  const lo: Vector3 = [box[0]!, box[2]!, box[4]!], hi: Vector3 = [box[1]!, box[3]!, box[5]!];
  const physical = record(physicalFrame);
  const frame = parseDensityVolumeFrame({ referenceFrame: physical.referenceFrame, epochJdTt: physical.epochJdTt,
    originM: physical.originM, localToReferenceXyzw: physical.localToReferenceXyzw,
    metersPerUnit: number(physical.metersPerUnit) * 1000, boundsUnits: { min: lo, max: hi } });
  if (!Array.isArray(data.leaves)) throw new TypeError('Expected slab leaves.');
  if (data.intervals !== undefined) throw new TypeError('Only uniform slab placement is supported.');
  const centers = ['x','y','z'].map((_,a)=>Array.from({length:counts[a]!},(_,index)=>lo[a]!+(index+.5)*(hi[a]!-lo[a]!)/counts[a]!));
  const seen = new Set<string>();
  const quads: VolumeSlices['quads'] = data.leaves.map(value => {
    const leaf = record(value);
    if (leaf.axis !== 'x' && leaf.axis !== 'y' && leaf.axis !== 'z') throw new TypeError('Invalid slab axis.');
    const axis = leaf.axis, a = 'xyz'.indexOf(axis), index = number(leaf.index), depth = number(leaf.center);
    if (!Number.isInteger(index) || index < 0 || index >= counts[a]!) throw new TypeError('Invalid slab index.');
    const optical=model&&leaf.opticalSlab!==undefined?record(leaf.opticalSlab):undefined;
    const pair=optical?.role==='merged-two',path = `${axis}/${String(index).padStart(3, '0')}${pair?'-pair':''}.png`;
    if (leaf.texturePath !== path || seen.has(path)) throw new TypeError('Invalid or repeated slab texture.');
    seen.add(path);
    if (Math.abs(depth - centers[a]![index]!) > 1e-9) throw new TypeError('Slab centre disagrees with its field.');
    const width = number(leaf.width), height = number(leaf.height);
    if (![width, height].every(n => Number.isInteger(n) && n > 0)) throw new TypeError('Invalid texture dimensions.');
    const h = axis === 'x' ? 1 : 0, v = axis === 'z' ? 1 : 2;
    const image = leaf.imageBounds === undefined ? [lo[h]!, hi[h]!, lo[v]!, hi[v]!] : vector(leaf.imageBounds, 4);
    if (image[0]! > lo[h]! || image[1]! < hi[h]! || image[2]! > lo[v]! || image[3]! < hi[v]!) throw new TypeError('Extended image must contain the canonical footprint.');
    return { id: `${axis}-${index}${pair?'-pair':''}`, axis, sliceIndex: index, texturePath: `${prefix}/${path}`,
      widthPx: width, heightPx: height,
      vertices: [point(axis, depth, image[0]!, image[3]!), point(axis, depth, image[1]!, image[3]!),
        point(axis, depth, image[1]!, image[2]!), point(axis, depth, image[0]!, image[2]!)],
      // Sorting and handover retain the canonical slab anchor; only its image rectangle grows.
      uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], center: point(axis, depth, (lo[h]! + hi[h]!) / 2, (lo[v]! + hi[v]!) / 2),
      normal: axis === 'x' ? [-1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, -1],
      bytes: statSync(resolve(directory, path)).size, alphaCoverage: 1 };
  });
  if (!model && seen.size !== counts.reduce((a, b) => a + b, 0)) throw new TypeError('Incomplete slab bank.');
  if(model){if(seen.size>33)throw new TypeError('Hybrid bank exceeds 33 layers');for(const [a,axis]of ['x','y','z'].entries())for(let i=0;i<counts[a]!;i++)if(!seen.has(`${axis}/${String(i).padStart(3,'0')}.png`))throw new TypeError('Incomplete physical slab bank');}
  const slices: VolumeSlices = { boundsUnits: { min: lo, max: hi }, quads,
    provenance: { record: field.record, status: 'Scalar-alpha far-view candidate; actual-app acceptance recorded by tuner' },
    approximation: { method: data.slabLocalTransfer === true
      ? 'Each slab integrates only its own spectral emission, scatter and dust before fitted camera and fixed display encoding.'
      : 'Historical column-attributed bank; slab-local qualification absent.',
      radialEmission: 'None', limitations: model?['Fixed scalar RGBA local slabs of an independently approved physical model.',
        'Spectral extinction, post-integration display and merged optical copies are approximations; measured residual gates govern installation.',
        'A successful bake is separate from physical reference fidelity, real-site appearance and phone qualification.']:['80/80/40 pc field; GC radius 16 kpc and |z| <= 3.2 kpc.',
        'Scalar alpha cannot reproduce spectral inter-slab transmission or nonlinear post-integration tone.',
        'Reverse and oblique views use the same slab textures; independent spatial qualification remains incomplete.',
        'The inside view uses prepared fixed station clouds and backgrounds instead of these slabs.'],
      samplesPerSlab: Array.isArray(data.rows) ? Math.max(...data.rows.map(row => number(record(row).samplesPerSlab))) : 7, opticalWeight: 1, exposureGain: number(data.gain), sliceCounts: { x: counts[0]!, y: counts[1]!, z: counts[2]! },
      slabPitchUnits: { x: (hi[0] - lo[0]) / counts[0]!, y: (hi[1] - lo[1]) / counts[1]!, z: (hi[2] - lo[2]) / counts[2]! } } };
  return { frame, slices, completedImageOpacity: galaxyCompletedImageOpacity(data) };
}
