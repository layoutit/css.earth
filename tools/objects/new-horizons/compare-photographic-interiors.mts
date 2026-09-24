import { cross3 as cross, dotN as dot } from '@cssearth/core';
import type { SourceMesh } from '../terrestrial-layers/contracts.mts';

export interface PhotographicCamera {
  positionKm: readonly number[];
  sunDirection: readonly number[];
  rayMatrix: readonly (readonly number[])[];
}

/** Decoded LORRI frame with its original TAN-SIP binding already applied. */
export interface PhotographicFrame {
  width: number;
  height: number;
  planes: { IMAGE: ArrayLike<number> };
  acceptPixel(index: number): boolean;
  camera: PhotographicCamera;
  rayPixel(x: number, y: number): readonly number[];
  projectPoint(point: readonly number[]): readonly number[];
}

export interface NativeCrop { left: number; top: number; width: number; height: number }
export interface PixelShift { dx: number; dy: number; correlation: number }
export interface InteriorRegion {
  left: number; top: number; right: number; bottom: number;
  partition: 'fit' | 'holdout'; pixels: number; atPrediction: number;
  afterFit: number; best: PixelShift; residualPixels: number;
  detrended: { correlation: number; referenceResidualRms: number; targetResidualRms: number } | null;
}
export interface InteriorBuffers { width: number; height: number; actual: Float32Array; alignedActual: Float64Array; predicted: Float64Array; valid: Uint8Array }
export interface InteriorComparison {
  crop: NativeCrop; validSampleCount: number; buffers: InteriorBuffers;
  fittedShift: PixelShift; fitMean: number; regions: InteriorRegion[];
  searchBoundary: { fitting: boolean; holdouts: boolean[] };
  interpretation: 'Relative image-to-mesh registration only; no absolute cartography or body qualification.';
}

const MAX_SHIFT = 5;
const STEP = .25;
const MINIMUM_REGION_PIXELS = 16;
const cosDegrees = (degrees: number) => Math.cos(degrees * Math.PI / 180);
const subtract = (a: readonly number[], b: readonly number[]) => a.map((value, index) => value - b[index]);

const unit = (value: readonly number[]) => { const length = Math.hypot(...value); if (!(length > 0)) throw new Error('Cannot normalize a zero-length camera ray.'); return value.map(component => component / length); };

function validateCrop(frame: PhotographicFrame, crop: NativeCrop) {
  if (![crop.left, crop.top, crop.width, crop.height].every(Number.isInteger) || crop.left < 0 || crop.top < 0 || crop.width < 8 || crop.height < 8 ||
      crop.left + crop.width > frame.width || crop.top + crop.height > frame.height) throw new Error('Invalid native target crop.');
}

function bilinear(frame: PhotographicFrame, x: number, y: number): number | null {
  const left = Math.floor(x), top = Math.floor(y);
  if (left < 0 || top < 0 || left + 1 >= frame.width || top + 1 >= frame.height) return null;
  const indices = [top * frame.width + left, top * frame.width + left + 1, (top + 1) * frame.width + left, (top + 1) * frame.width + left + 1];
  if (indices.some(index => !frame.acceptPixel(index))) return null;
  const tx = x - left, ty = y - top, weights = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty];
  const value = indices.reduce((sum, index, position) => sum + Number(frame.planes.IMAGE[index]) * weights[position], 0);
  return Number.isFinite(value) ? value : null;
}

function shiftValues() { const values: number[] = []; for (let value = -MAX_SHIFT; value <= MAX_SHIFT + 1e-10; value += STEP) values.push(Number(value.toFixed(2))); return values; }
const SHIFTS = shiftValues();

function ncc(indices: readonly number[], predicted: Float64Array, target: PhotographicFrame, crop: NativeCrop, shift: Pick<PixelShift, 'dx' | 'dy'>): number {
  let a = 0, b = 0, aa = 0, bb = 0, ab = 0;
  for (const index of indices) {
    const x = index % crop.width, y = Math.floor(index / crop.width);
    const measured = bilinear(target, crop.left + x + shift.dx, crop.top + y + shift.dy);
    if (measured === null) return Number.NEGATIVE_INFINITY;
    const model = predicted[index];
    a += model; b += measured; aa += model * model; bb += measured * measured; ab += model * measured;
  }
  const count = indices.length, denominator = Math.sqrt((aa - a * a / count) * (bb - b * b / count));
  return denominator > 0 && Number.isFinite(denominator) ? (ab - a * b / count) / denominator : Number.NEGATIVE_INFINITY;
}

function bestShift(indices: readonly number[], predicted: Float64Array, target: PhotographicFrame, crop: NativeCrop): PixelShift {
  let best: PixelShift = { dx: 0, dy: 0, correlation: ncc(indices, predicted, target, crop, { dx: 0, dy: 0 }) };
  for (const dy of SHIFTS) for (const dx of SHIFTS) {
    const correlation = ncc(indices, predicted, target, crop, { dx, dy });
    if (correlation > best.correlation) best = { dx, dy, correlation };
  }
  return best;
}

function bestFitShift(score: (shift: Pick<PixelShift, 'dx' | 'dy'>) => number): PixelShift {
  let best: PixelShift = { dx: 0, dy: 0, correlation: score({ dx: 0, dy: 0 }) };
  for (const dy of SHIFTS) for (const dx of SHIFTS) {
    const correlation = score({ dx, dy });
    if (correlation > best.correlation) best = { dx, dy, correlation };
  }
  return best;
}

function onBoundary(shift: PixelShift) { return Math.abs(shift.dx) === MAX_SHIFT || Math.abs(shift.dy) === MAX_SHIFT; }

/** Remove a separate least-squares brightness plane from each image window.
 * This diagnostic distinguishes surface variation from broad shading. It is
 * never applied to a delivered photograph or used to refit the camera. */
function detailCorrelation(indices: readonly number[], predicted: Float64Array, target: PhotographicFrame, crop: NativeCrop, shift: PixelShift) {
  const xs = indices.map(index => index % crop.width), ys = indices.map(index => Math.floor(index / crop.width));
  const reference = indices.map(index => predicted[index]);
  const measured: number[] = [];
  for (let index = 0; index < indices.length; index++) {
    const value = bilinear(target, crop.left + xs[index] + shift.dx, crop.top + ys[index] + shift.dy);
    if (value === null) return null;
    measured.push(value);
  }
  const plane = (values: readonly number[]) => {
    const system = Array.from({ length: 3 }, () => [0, 0, 0, 0]);
    for (let i = 0; i < values.length; i++) {
      const row = [1, xs[i], ys[i]];
      for (let r = 0; r < 3; r++) {
        system[r][3] += row[r] * values[i];
        for (let c = 0; c < 3; c++) system[r][c] += row[r] * row[c];
      }
    }
    for (let column = 0; column < 3; column++) {
      let pivot = column;
      for (let row = column + 1; row < 3; row++) if (Math.abs(system[row][column]) > Math.abs(system[pivot][column])) pivot = row;
      if (Math.abs(system[pivot][column]) < 1e-12) return null;
      [system[column], system[pivot]] = [system[pivot], system[column]];
      const divisor = system[column][column];
      for (let c = column; c < 4; c++) system[column][c] /= divisor;
      for (let row = 0; row < 3; row++) if (row !== column) {
        const factor = system[row][column];
        for (let c = column; c < 4; c++) system[row][c] -= factor * system[column][c];
      }
    }
    return system.map(row => row[3]);
  };
  const a = plane(reference), b = plane(measured);
  if (a === null || b === null) return null;
  let aa = 0, bb = 0, ab = 0;
  for (let i = 0; i < indices.length; i++) {
    const ar = reference[i] - a[0] - a[1] * xs[i] - a[2] * ys[i], br = measured[i] - b[0] - b[1] * xs[i] - b[2] * ys[i];
    aa += ar * ar; bb += br * br; ab += ar * br;
  }
  if (!(aa > 0 && bb > 0)) return null;
  const result = { correlation: ab / Math.sqrt(aa * bb), referenceResidualRms: Math.sqrt(aa / indices.length), targetResidualRms: Math.sqrt(bb / indices.length) };
  return Object.values(result).every(Number.isFinite) ? result : null;
}

/**
 * Compares two source photographs through one unchanged native mesh. The only
 * fitted quantity is a target detector translation, learned in two diagonal
 * image quadrants and measured in the other two. No 3D pose, shape, or
 * photometric correction is fitted.
 */
export function comparePhotographicInteriors(reference: PhotographicFrame, target: PhotographicFrame, mesh: SourceMesh, crop: NativeCrop, supersampling: number): InteriorComparison {
  validateCrop(target, crop);
  if (!Number.isInteger(supersampling) || ![1, 2, 3].includes(supersampling)) throw new Error('Interior comparison supports source supersampling of 1, 2 or 3 only.');
  const normals = mesh.indices.map(face => { const [a, b, c] = face.map(index => mesh.positions[index]); return unit(cross(subtract(b, a), subtract(c, a))); });
  const targetEye = target.camera.positionKm.map(value => value * 1000), referenceEye = reference.camera.positionKm.map(value => value * 1000);
  const actual = new Float32Array(crop.width * crop.height), predicted = new Float64Array(crop.width * crop.height).fill(Number.NaN), valid = new Uint8Array(crop.width * crop.height);
  for (let y = 0; y < crop.height; y++) for (let x = 0; x < crop.width; x++) actual[y * crop.width + x] = Number(target.planes.IMAGE[(crop.top + y) * target.width + crop.left + x]);
  const transfer = (x: number, y: number) => {
    const [u, v] = target.rayPixel(x, y), targetRay = unit(target.camera.rayMatrix.map(row => dot(row, [u, v, 1]))), hit = mesh.intersect(targetEye, targetRay);
    if (!hit) return null;
    const point = targetEye.map((value, index) => value + hit.radius * targetRay[index]), normal = normals[hit.faceId], referenceRay = unit(subtract(point, referenceEye));
    if (dot(normal, targetRay) > -cosDegrees(65) || dot(normal, referenceRay) > -cosDegrees(65) || dot(normal, reference.camera.sunDirection) < cosDegrees(70)) return null;
    const referenceHit = mesh.intersect(referenceEye, referenceRay), expectedDistance = Math.hypot(...subtract(point, referenceEye));
    if (!referenceHit || Math.abs(referenceHit.radius - expectedDistance) > 1) return null;
    const [referenceX, referenceY] = reference.projectPoint(point.map(value => value / 1000));
    return bilinear(reference, referenceX, referenceY);
  };
  for (let y = 0; y < crop.height; y++) for (let x = 0; x < crop.width; x++) {
    const index = y * crop.width + x, nativeIndex = (crop.top + y) * target.width + crop.left + x;
    if (!target.acceptPixel(nativeIndex)) continue;
    let sum = 0, count = 0;
    for (let sy = 0; sy < supersampling; sy++) for (let sx = 0; sx < supersampling; sx++) {
      const value = transfer(crop.left + x + (sx + .5) / supersampling - .5, crop.top + y + (sy + .5) / supersampling - .5);
      if (value !== null) { sum += value; count++; }
    }
    if (count === supersampling ** 2) { predicted[index] = sum / count; valid[index] = 1; }
  }
  // Hold exactly the same source-model pixels for every candidate detector
  // shift; a shift cannot improve NCC by removing a difficult boundary pixel.
  for (let index = 0; index < valid.length; index++) if (valid[index]) {
    const x = index % crop.width, y = Math.floor(index / crop.width);
    if (SHIFTS.some(dy => SHIFTS.some(dx => bilinear(target, crop.left + x + dx, crop.top + y + dy) === null))) valid[index] = 0;
  }
  const indices = Array.from(valid.keys()).filter(index => valid[index] === 1);
  if (!indices.length) throw new Error('No common valid interior pixels remain after geometric and quality rejection.');
  const xs = indices.map(index => index % crop.width), ys = indices.map(index => Math.floor(index / crop.width));
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys), middleX = Math.floor((left + right) / 2), middleY = Math.floor((top + bottom) / 2);
  const rectangles: Array<{ left: number; top: number; right: number; bottom: number; partition: 'fit' | 'holdout' }> = [
    { left, top, right: middleX - 1, bottom: middleY - 1, partition: 'fit' },
    { left: middleX + 1, top, right, bottom: middleY - 1, partition: 'holdout' },
    { left, top: middleY + 1, right: middleX - 1, bottom, partition: 'holdout' },
    { left: middleX + 1, top: middleY + 1, right, bottom, partition: 'fit' },
  ];
  const selected = rectangles.map(region => ({ ...region, indices: indices.filter(index => { const x = index % crop.width, y = Math.floor(index / crop.width); return x >= region.left && x <= region.right && y >= region.top && y <= region.bottom; }) }));
  if (selected.some(region => region.indices.length < MINIMUM_REGION_PIXELS)) throw new Error('A disjoint interior quadrant has insufficient common valid pixels.');
  const fitting = selected.filter(region => region.partition === 'fit');
  const score = (shift: Pick<PixelShift, 'dx' | 'dy'>) => fitting.reduce((sum, region) => sum + ncc(region.indices, predicted, target, crop, shift), 0) / fitting.length;
  // Equal quadrant weighting prevents one large diagonal quadrant from
  // determining the translation and is the predeclared fit objective.
  const fittedShift = bestFitShift(score);
  const regions = selected.map(region => {
    const atPrediction = ncc(region.indices, predicted, target, crop, { dx: 0, dy: 0 }), best = bestShift(region.indices, predicted, target, crop), afterFit = ncc(region.indices, predicted, target, crop, fittedShift);
    return { left: region.left + crop.left, top: region.top + crop.top, right: region.right + crop.left, bottom: region.bottom + crop.top, partition: region.partition,
      pixels: region.indices.length, atPrediction, afterFit, best, residualPixels: Math.hypot(best.dx - fittedShift.dx, best.dy - fittedShift.dy),
      detrended: detailCorrelation(region.indices, predicted, target, crop, fittedShift) };
  });
  const held = regions.filter(region => region.partition === 'holdout');
  const finite = [fittedShift.correlation, ...regions.flatMap(region => [region.atPrediction, region.afterFit, region.best.correlation, region.residualPixels])].every(Number.isFinite);
  if (!finite) throw new Error('Interior correlation is undefined for a selected region.');
  const searchBoundary = { fitting: onBoundary(fittedShift), holdouts: held.map(region => onBoundary(region.best)) };
  const alignedActual = Float64Array.from({ length: predicted.length }, (_, index) => bilinear(target,
    crop.left + index % crop.width + fittedShift.dx, crop.top + Math.floor(index / crop.width) + fittedShift.dy) ?? Number.NaN);
  return { crop, validSampleCount: indices.length, buffers: { width: crop.width, height: crop.height, actual, alignedActual, predicted, valid }, fittedShift, fitMean: fittedShift.correlation,
    regions, searchBoundary, interpretation: 'Relative image-to-mesh registration only; no absolute cartography or body qualification.' };
}
