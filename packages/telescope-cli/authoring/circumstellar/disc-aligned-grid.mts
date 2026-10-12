/** Place unencoded observation columns directly in a thin grid aligned with their published disc plane. */
import { encodeDensityKtx2 } from '@cssearth/bake/density';
import { rotateWorldPosition, worldQuaternionFromRotation } from '@cssearth/engine';
import type { WorldRotation } from '@cssearth/core';
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { DiscModel, SkyPlane } from './disc-envelope.mts';

/** Columns in the source west/north/toward frame: nodes, tilted minor axis, normal. */
export function discGridRotation(model: Pick<DiscModel, 'inclinationDeg' | 'positionAngleDeg' | 'nearSidePositionAngleDeg'>): WorldRotation {
  const phi = model.positionAngleDeg * Math.PI / 180, i = model.inclinationDeg * Math.PI / 180;
  const s = Math.sin(phi), c = Math.cos(phi), si = Math.sin(i), ci = Math.cos(i);
  const near = Math.cos((model.nearSidePositionAngleDeg - model.positionAngleDeg - 90) * Math.PI / 180) >= 0 ? 1 : -1;
  return [-s, -c * ci, near * c * si, c, -s * ci, near * s * si, 0, near * si, ci];
}

/** One of the planes a column's light is shared between: the grid holds only this part of the density, out to
 * `planarHalfUnits` in its plane (the whole sky plane when absent). `rotation` is the grid's own, when it is not the
 * model's plane (a sheet of a fan about it); `columns` are the columns already normalised by the whole density. */
export interface DiscGridPart { readonly weight: (x: number, y: number, z: number) => number; readonly planarHalfUnits?: number; readonly rotation?: WorldRotation; readonly columns?: NormalisedColumns }

/** Each measured sky column over the density along its sight line: what a point of the column holds per unit of density.
 * A column the density leaves empty is dropped, and counted. */
export function normaliseColumns(sky: Pick<SkyPlane, 'size' | 'halfUnits' | 'step'>, channels: readonly Float32Array[], density: (x: number, y: number, z: number) => number) {
  const { size, halfUnits: half, step } = sky, count = size * size;
  if (![size, half, step].every(Number.isFinite) || size < 16 || !Number.isInteger(size) || step !== 2 * half / size ||
    channels.length < 1 || channels.length > 4 || channels.some(c => c.length !== count)) throw new TypeError('Invalid observation columns.');
  const integral = channels.map(c => Float64Array.from(c, v => Number.isFinite(v) && v > 0 ? v : 0));
  const normalized = channels.map(() => new Float64Array(count)), offered = channels.map(() => 0), dropped = channels.map(() => 0);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const p = y * size + x;
    if (!integral.some(c => c[p]! > 0)) continue;
    let total = 0;
    for (let z = 0; z < size; z++) total += density(-half + (x + .5) * step, -half + (y + .5) * step, -half + (z + .5) * step) * step;
    for (let c = 0; c < channels.length; c++) {
      offered[c]! += integral[c]![p]!;
      if (total > 0) normalized[c]![p] = integral[c]![p]! / total;
      else { dropped[c]! += integral[c]![p]!; integral[c]![p] = 0; }
    }
  }
  return { integral, normalized, droppedShare: offered.map((value, c) => value > 0 ? dropped[c]! / value : 0) };
}
export type NormalisedColumns = ReturnType<typeof normaliseColumns>;

/** Normalise each measured sky column once, then sample its continuous depth profile. No encoded cubic intermediary.
 * With `part`, a column is still normalised by the whole `density`, and the grid takes the part's share of it. */
export function alignDiscGrid(sky: Pick<SkyPlane, 'size' | 'halfUnits' | 'step'>, channels: readonly Float32Array[],
  density: (x: number, y: number, z: number) => number, model: Pick<DiscModel, 'inclinationDeg' | 'positionAngleDeg' | 'nearSidePositionAngleDeg' | 'centreUnits' | 'centreDepthUnits' | 'gaussianHeightUnits'>, halfHeightUnits: number, part?: DiscGridPart) {
  if (Math.hypot(...model.centreUnits, model.centreDepthUnits ?? 0) > 1e-9)
    throw new TypeError('A disc-aligned grid requires a plane centred on the host.');
  if (!(halfHeightUnits >= 6 * model.gaussianHeightUnits && halfHeightUnits < sky.halfUnits))
    throw new RangeError('The aligned grid must retain at least six vertical scale heights.');
  const { size, halfUnits: half, step } = sky, { integral, normalized, droppedShare } = part?.columns ?? normaliseColumns(sky, channels, density);
  // Half-native planar spacing survives the rotated sampling and the final slab texture's interpolation.
  const planar = part?.planarHalfUnits ?? half, weigh = part?.weight ?? density;
  if (!(planar > 0 && planar <= half)) throw new RangeError('A part of the disc lies inside the sky plane.');
  const width = part?.planarHalfUnits === undefined ? 2 * size : Math.ceil(2 * planar / (step / 2)), depth = Math.ceil(2 * halfHeightUnits / (step / 2));
  const dimensions: [number, number, number] = [width, width, depth], rotation = part?.rotation ?? discGridRotation(model);
  const bounds = { min: [-planar, -planar, -halfHeightUnits] as [number, number, number], max: [planar, planar, halfHeightUnits] as [number, number, number] };
  const raw = new Uint8Array(width * width * depth * 4);
  const column = (values: Float64Array, x: number, y: number) => {
    const fx = (x + half) / step - .5, fy = (y + half) / step - .5;
    if (fx < 0 || fy < 0 || fx > size - 1 || fy > size - 1) return 0;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(x0 + 1, size - 1), y1 = Math.min(y0 + 1, size - 1);
    const ax = fx - x0, ay = fy - y0;
    return (1 - ay) * (values[y0 * size + x0]! * (1 - ax) + values[y0 * size + x1]! * ax) +
      ay * (values[y1 * size + x0]! * (1 - ax) + values[y1 * size + x1]! * ax);
  };
  let peak = 0, filledVoxels = 0;
  const visit = (encode: boolean) => {
    for (let z = 0; z < depth; z++) for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
      const point = rotateWorldPosition(rotation, [-planar + (x + .5) * 2 * planar / width,
        -planar + (y + .5) * 2 * planar / width, -halfHeightUnits + (z + .5) * 2 * halfHeightUnits / depth]);
      const weight = weigh(...point), offset = 4 * ((z * width + y) * width + x);
      let any = false;
      for (let c = 0; c < channels.length; c++) {
        const value = column(normalized[c]!, point[0], point[1]) * weight;
        if (!Number.isFinite(value) || value < 0) throw new RangeError('Invalid disc density.');
        if (!encode) peak = Math.max(peak, value);
        else { const byte = Math.round(255 * Math.sqrt(Math.min(1, value / peak))); raw[offset + c] = byte; any ||= byte > 0; }
      }
      if (encode && any) filledVoxels++;
    }
  };
  visit(false);
  if (!(peak > 0)) throw new RangeError('The aligned disc has no emission.');
  visit(true);
  const frame: DensityVolumeFrame = { referenceFrame: 'lab-sky-west-north-toward', epochJdTt: 2461286.5,
    originM: [0, 0, 0], localToReferenceXyzw: worldQuaternionFromRotation(rotation), metersPerUnit: 1, boundsUnits: bounds };
  return { ktx2: encodeDensityKtx2({ width, height: width, depth, encodedRgba: raw }, 9), dimensions, bounds, frame,
    peak, integral, filledVoxels, droppedShare };
}
