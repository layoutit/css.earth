import { diffuseAtomEmission, diffuseAtomProjection, gridDiffuse, type DiffuseAtom, type EmissionVector3, type SkyBounds, type MaterialImage as CompilerImage, type ComponentWeights, type PreparedSampledField, type SpatialField, type SampledEmissionFit } from '@cssearth/bake/volume';
export { diffuseAtomEmission, diffuseAtomProjection, gridDiffuse, type DiffuseAtom } from '@cssearth/bake/volume';
/** Offline nonnegative image fit. Spatial atoms and measured XYZ are never optimized. */
import { finiteDetailAtoms } from './emission-detail.ts';

interface Column { indices: Uint32Array; values: Float32Array }
export interface EmissionFitResult {
  diffuse: Float32Array; field: SpatialField;
  receipt: { sourceId: string; ejectaGain: number; coefficients: number[]; atoms: DiffuseAtom[];
    broadAtomCount: number; detailAtomCount: number;
    trainingPixels: number; validationPixels: number; coveredPixels: number;
    beforeRmse: number; afterRmse: number; validationBeforeRmse: number; validationAfterRmse: number;
    missingBefore: number; missingAfter: number; excessAfter: number; iterations: number; interpretation: string };
}
const cross = (a: EmissionVector3, b: EmissionVector3): EmissionVector3 =>
  [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** Finite spherical Gaussian atoms fill a declared 3D envelope, independently of the image. */
export function diffuseAtoms(prepared: Pick<PreparedSampledField, 'bounds'>, recipe: SampledEmissionFit): DiffuseAtom[] {
  const a = recipe.axis, initial: EmissionVector3 = Math.abs(a[2]) < .9 ? [0, 0, 1] : [0, 1, 0];
  const b = cross(a, initial), length = Math.hypot(...b);
  for (let i = 0; i < 3; i++) b[i] /= length;
  const c = cross(a, b), axes = [a, b, c], radii = recipe.radiiArcsec, atoms: DiffuseAtom[] = [];
  const limits = radii.map(r => Math.floor(r / recipe.spacingArcsec));
  if (limits.reduce((product, n) => product * (2 * n + 1), 1) > 100000)
    throw new TypeError('Diffuse envelope exceeds the bounded candidate lattice.');
  for (let z = -limits[2]!; z <= limits[2]!; z++) for (let y = -limits[1]!; y <= limits[1]!; y++) for (let x = -limits[0]!; x <= limits[0]!; x++) {
    const local: EmissionVector3 = [x * recipe.spacingArcsec, y * recipe.spacingArcsec, z * recipe.spacingArcsec];
    if (local.reduce((sum, n, i) => sum + (n / radii[i]!) ** 2, 0) > 1) continue;
    const centerArcsec: EmissionVector3 = [0, 0, 0];
    for (let i = 0; i < 3; i++) centerArcsec[i] = recipe.centerArcsec[i]! + local.reduce((sum, n, j) => sum + n * axes[j]![i]!, 0);
    // Every finite kernel fits in the existing inspected field: never clip a fitted tail at a grid edge.
    if (centerArcsec.some((n, i) => n - 4 * recipe.sigmaArcsec < prepared.bounds.min[i]! || n + 4 * recipe.sigmaArcsec > prepared.bounds.max[i]!)) continue;
    atoms.push({ centerArcsec, sigmaArcsec: recipe.sigmaArcsec });
    if (atoms.length > 2000) throw new TypeError('Diffuse envelope exceeds the bounded fit.');
  }
  if (!atoms.length || atoms.length > 2000) throw new TypeError('Diffuse envelope produces no usable atoms or exceeds the bounded fit.');
  return atoms;
}
function gridProjection(prepared: PreparedSampledField, data: Float32Array, x: number, y: number) {
  const [nx, ny, nz] = prepared.size, u = (x - prepared.bounds.min[0]) / prepared.pitch, v = (y - prepared.bounds.min[1]) / prepared.pitch;
  const ix = Math.floor(u), iy = Math.floor(v);
  if (ix < 0 || iy < 0 || ix >= nx - 1 || iy >= ny - 1) return 0;
  const fx = u - ix, fy = v - iy; let sum = 0;
  for (let z = 0; z < nz; z++) {
    const at = (z * ny + iy) * nx + ix;
    sum += ((1 - fy) * (data[at]! * (1 - fx) + data[at + 1]! * fx) + fy * (data[at + nx]! * (1 - fx) + data[at + nx + 1]! * fx)) * prepared.pitch;
  }
  return sum;
}
/** The image constrains display opacity; chromaticity is applied separately by the existing material baker. */
export function fitSampledEmission(prepared: PreparedSampledField, image: Pick<CompilerImage, 'id' | 'sampleRgb'>,
  weights: ComponentWeights, recipe: SampledEmissionFit, bounds: SkyBounds, signal?: AbortSignal): EmissionFitResult {
  const atoms = diffuseAtoms(prepared, recipe), width = recipe.imageWidth, count = width * width;
  const target = new Float32Array(count), peak = new Float32Array(count), chromaLuma = new Float32Array(count),
    wind = new Float32Array(count), ejecta = new Float32Array(count), covered = new Uint8Array(count), training = new Uint8Array(count);
  const xs = new Float64Array(count), ys = new Float64Array(count), rgb: EmissionVector3 = [0, 0, 0];
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    const at = y * width + x;
    xs[at] = bounds.min[0] + (x + .5) / width * (bounds.max[0] - bounds.min[0]);
    ys[at] = bounds.max[1] - (y + .5) / width * (bounds.max[1] - bounds.min[1]);
    if (!image.sampleRgb(xs[at]!, ys[at]!, rgb)) continue;
    if (rgb.some(n => !Number.isFinite(n) || n < 0 || n > 255)) throw new TypeError('Invalid registered emission-fit pixel.');
    covered[at] = 1; training[at] = (x + 3 * y) % 7 === 0 ? 0 : 1;
    peak[at] = Math.max(...rgb) / 255;
    target[at] = -Math.log(1 - Math.min(.98, peak[at]!));
    chromaLuma[at] = peak[at]! > 0 ? (.2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]) / (255 * peak[at]!) : 1;
    ejecta[at] = weights.ejecta * gridProjection(prepared, prepared.ejecta, xs[at]!, ys[at]!);
    wind[at] = weights.pwn * gridProjection(prepared, prepared.pwn, xs[at]!, ys[at]!);
  }
  if (covered.reduce((a, b) => a + b, 0) < 64) throw new TypeError('Insufficient observed coverage for an emission fit.');
  if (!covered.some((value, i) => value && !training[i]) || !training.some(Boolean))
    throw new TypeError('Emission fit requires observed training and validation pixels.');
  const broadAtomCount = atoms.length;
  atoms.push(...finiteDetailAtoms(prepared, recipe, target, chromaLuma, training, xs, ys, signal));
  if (atoms.length > 5500) throw new TypeError('Combined finite emitter budget exceeded.');
  const sparse = (values: Float32Array): Column => {
    const indices: number[] = [], nonzero: number[] = [];
    values.forEach((value, i) => { if (covered[i] && value > 0) { indices.push(i); nonzero.push(value); } });
    return { indices: Uint32Array.from(indices), values: Float32Array.from(nonzero) };
  };
  const pixelX = (bounds.max[0] - bounds.min[0]) / width, pixelY = (bounds.max[1] - bounds.min[1]) / width;
  const columns: Column[] = [sparse(ejecta), ...atoms.map(atom => {
    const indices: number[] = [], values: number[] = [], radius = 4 * atom.sigmaArcsec;
    const x0 = Math.max(0, Math.floor((atom.centerArcsec[0] - radius - bounds.min[0]) / pixelX));
    const x1 = Math.min(width - 1, Math.ceil((atom.centerArcsec[0] + radius - bounds.min[0]) / pixelX));
    const y0 = Math.max(0, Math.floor((bounds.max[1] - atom.centerArcsec[1] - radius) / pixelY));
    const y1 = Math.min(width - 1, Math.ceil((bounds.max[1] - atom.centerArcsec[1] + radius) / pixelY));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const at = y * width + x; if (!covered[at]) continue;
      const value = diffuseAtomProjection(atom, xs[at]!, ys[at]!); if (!(value > 0)) continue;
      indices.push(at); values.push(value);
    }
    return { indices: Uint32Array.from(indices), values: Float32Array.from(values) };
  })];
  const rowSum = new Float64Array(count), coefficients = new Float64Array(columns.length), prediction = new Float64Array(count);
  coefficients[0] = 1;
  for (const column of columns) column.indices.forEach((at, j) => { rowSum[at] += column.values[j]!; });
  const normalizers = columns.map(column => {
    let bound = 0, norm = 0;
    column.indices.forEach((at, j) => { if (training[at]) { const v = column.values[j]!; bound += v * rowSum[at]!; norm += v * v; } });
    return { step: 1 / Math.max(1e-8, bound + recipe.regularization * norm), penalty: recipe.regularization * norm };
  });
  const project = () => {
    prediction.set(wind);
    columns.forEach((column, i) => { const weight = coefficients[i]!;
      if (weight) column.indices.forEach((at, j) => { prediction[at] += weight * column.values[j]!; }); });
  };
  const before = Float64Array.from(ejecta, (n, i) => n + wind[i]!);
  for (let iteration = 0; iteration < recipe.iterations; iteration++) {
    signal?.throwIfAborted(); project();
    columns.forEach((column, i) => {
      const prior = i === 0 ? 1 : 0; let gradient = normalizers[i]!.penalty * (coefficients[i]! - prior);
      column.indices.forEach((at, j) => { if (training[at]) gradient += column.values[j]! * (prediction[at]! - target[at]!); });
      coefficients[i] = Math.max(i === 0 ? .25 : 0, Math.min(i === 0 ? recipe.maximumEjectaGain : recipe.maximumCoefficient,
        coefficients[i]! - normalizers[i]!.step * gradient));
    });
  }
  project();
  let beforeError = 0, afterError = 0, validationBefore = 0, validationAfter = 0, validationPixels = 0,
    coveredPixels = 0, missingBefore = 0, missingAfter = 0, excessAfter = 0, targetLight = 0;
  for (let i = 0; i < count; i++) if (covered[i]) {
    const targetValue = peak[i]! * chromaLuma[i]!, b = (1 - Math.exp(-before[i]!)) * chromaLuma[i]!, a = (1 - Math.exp(-prediction[i]!)) * chromaLuma[i]!;
    beforeError += (b - targetValue) ** 2; afterError += (a - targetValue) ** 2; coveredPixels++; targetLight += targetValue;
    missingBefore += Math.max(0, targetValue - b); missingAfter += Math.max(0, targetValue - a); excessAfter += Math.max(0, a - targetValue);
    if (!training[i]) { validationPixels++; validationBefore += (b - targetValue) ** 2; validationAfter += (a - targetValue) ** 2; }
  }
  const diffuse = gridDiffuse(prepared, atoms, [...coefficients].slice(1), signal);
  const field = prepared.field({ ejecta: weights.ejecta * coefficients[0]!, pwn: weights.pwn }, 1, diffuse);
  return { diffuse, field, receipt: { sourceId: image.id, ejectaGain: coefficients[0]!, coefficients: [...coefficients].slice(1), atoms,
    broadAtomCount, detailAtomCount: atoms.length - broadAtomCount,
    trainingPixels: coveredPixels - validationPixels, validationPixels, coveredPixels,
    beforeRmse: Math.sqrt(beforeError / coveredPixels), afterRmse: Math.sqrt(afterError / coveredPixels),
    validationBeforeRmse: Math.sqrt(validationBefore / validationPixels), validationAfterRmse: Math.sqrt(validationAfter / validationPixels),
    missingBefore: missingBefore / Math.max(1e-12, targetLight), missingAfter: missingAfter / Math.max(1e-12, targetLight),
    excessAfter: excessAfter / Math.max(1e-12, targetLight), iterations: recipe.iterations,
    interpretation: 'Regularized nonnegative display-opacity fit on fixed measured ejecta and finite 3D Gaussian atoms. Broad atoms have image-independent authored support. Optional fine structures use training-image contrast to select XY and the local spatial-prior mode to assign depth; their finite isotropic widths and branch choice are authored, not measured structures. Every seventh image pixel is excluded from candidate selection and coefficient fitting, not an independent physical observation. Residual light may mix synchrotron, dust, line emission, epoch differences and separation artifacts. No recovered dust/gas density or measured continuum depth.' } };
}
