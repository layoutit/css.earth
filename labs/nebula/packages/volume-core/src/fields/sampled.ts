import type { Cancellation } from '../contracts/cancellation.ts';
/** Offline normalized splatting of qualified points; analytic components never reposition those samples. */
import type { EmissionBounds, EmissionVector3 } from '../contracts/emission.ts';
import type { SampledRecipe, SampleTerm, ComponentWeights } from '../contracts/sampled-recipe.ts';

export interface SpatialField { bounds: EmissionBounds; sampleEmission(x: number, y: number, z: number, out: EmissionVector3): void }
export function mapSample(m: readonly number[], x: number, y: number, z: number): EmissionVector3 {
  return [m[0]! * x + m[1]! * y + m[2]! * z + m[3]!, m[4]! * x + m[5]! * y + m[6]! * z + m[7]!, m[8]! * x + m[9]! * y + m[10]! * z + m[11]!];
}
/** Finite Gaussian tubes, rings and ellipsoids. Weight sets authored integrated display light. */
export function analyticEmission(t: SampleTerm, x: number, y: number, z: number): number {
  let d2: number, scale: number;
  if (t.kind === 'torus') {
    const dx = x - t.centerArcsec[0], dy = y - t.centerArcsec[1], dz = z - t.centerArcsec[2];
    const along = dx * t.axis[0] + dy * t.axis[1] + dz * t.axis[2];
    const radial = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - along * along)) - t.radiusArcsec;
    scale = t.sigmaArcsec; d2 = (radial * radial + along * along) / (scale * scale);
  } else if (t.kind === 'jet') {
    const vx = t.endArcsec[0] - t.startArcsec[0], vy = t.endArcsec[1] - t.startArcsec[1], vz = t.endArcsec[2] - t.startArcsec[2];
    const dx = x - t.startArcsec[0], dy = y - t.startArcsec[1], dz = z - t.startArcsec[2];
    const u = Math.max(0, Math.min(1, (dx * vx + dy * vy + dz * vz) / (vx * vx + vy * vy + vz * vz)));
    scale = t.sigmaArcsec; d2 = ((dx - u * vx) ** 2 + (dy - u * vy) ** 2 + (dz - u * vz) ** 2) / (scale * scale);
  } else {
    scale = t.sigmaArcsec[2]; d2 = ((x - t.centerArcsec[0]) / t.sigmaArcsec[0]) ** 2 +
      ((y - t.centerArcsec[1]) / t.sigmaArcsec[1]) ** 2 + ((z - t.centerArcsec[2]) / t.sigmaArcsec[2]) ** 2;
  }
  return d2 >= 16 ? 0 : t.weight / (Math.sqrt(2 * Math.PI) * scale) * Math.exp(-.5 * d2);
}
function termBounds(t: SampleTerm): EmissionBounds {
  const padding = t.kind === 'ellipsoid' ? t.sigmaArcsec.map(s => s * 4) :
    [0, 1, 2].map(() => 4 * t.sigmaArcsec + (t.kind === 'torus' ? t.radiusArcsec : 0));
  const a = t.kind === 'jet' ? t.startArcsec : t.centerArcsec, b = t.kind === 'jet' ? t.endArcsec : t.centerArcsec;
  return { min: a.map((n, i) => Math.min(n, b[i]!) - padding[i]!) as EmissionVector3,
    max: a.map((n, i) => Math.max(n, b[i]!) + padding[i]!) as EmissionVector3 };
}
export function prepareSampledField(values: Float32Array, recipe: SampledRecipe, signal?: Cancellation) {
  if (values.length !== recipe.source.width * recipe.source.height) throw new TypeError('Qualified FITS sample count differs.');
  const [cx, cy, cz, cw] = recipe.source.columns, stride = recipe.source.width;
  const points: number[] = [], bounds: EmissionBounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  let discarded = 0;
  for (let row = 0; row < recipe.source.height; row++) {
    const weight = values[row * stride + cw]!;
    if (!Number.isFinite(weight)) throw new TypeError('Nonfinite sampled flux.');
    if (weight <= 0) { discarded++; continue; }
    const p = mapSample(recipe.rawToArcsec, values[row * stride + cx]!, values[row * stride + cy]!, values[row * stride + cz]!);
    if (!p.every(Number.isFinite)) throw new TypeError('Nonfinite qualified spatial sample.');
    p.forEach((n, axis) => { bounds.min[axis] = Math.min(bounds.min[axis]!, n); bounds.max[axis] = Math.max(bounds.max[axis]!, n); });
    points.push(...p, Math.pow(weight, recipe.grid.weightExponent));
  }
  if (!points.length) throw new TypeError('No positive sampled emission.');
  const rawBounds: EmissionBounds = { min: [...bounds.min], max: [...bounds.max] };
  const longest = Math.max(...bounds.max.map((n, i) => n - bounds.min[i]!));
  if (!(longest > 0) || longest > 1e6) throw new TypeError('Qualified sampled angular extent is unsupported.');
  const pitch = longest / (recipe.grid.longestAxis - 1), sigma = recipe.grid.blurSigmaCells, padding = pitch * (Math.ceil(4 * sigma) + 1);
  for (let i = 0; i < 3; i++) { bounds.min[i] -= padding; bounds.max[i] += padding; }
  for (const term of recipe.terms) {
    const extent = termBounds(term);
    for (let i = 0; i < 3; i++) { bounds.min[i] = Math.min(bounds.min[i]!, extent.min[i]!); bounds.max[i] = Math.max(bounds.max[i]!, extent.max[i]!); }
  }
  const size = bounds.max.map((n, i) => Math.ceil((n - bounds.min[i]!) / pitch) + 1) as EmissionVector3;
  if (size[0] * size[1] * size[2] > 4e7) throw new TypeError('Analytic components extend beyond the bounded sampled grid.');
  for (let i = 0; i < 3; i++) bounds.max[i] = bounds.min[i]! + pitch * (size[i]! - 1);
  const count = size[0] * size[1] * size[2], ejecta = new Float32Array(count), pwn = new Float32Array(count);
  const [nx, ny, nz] = size, radius = Math.ceil(3 * sigma), kernel: number[] = [], reach = radius * 2 + 1;
  for (let k = -radius; k <= radius; k++) kernel.push(Math.exp(-k * k / (2 * sigma * sigma)));
  const kernelSum = kernel.reduce((a, b) => a + b, 0) ** 3;
  for (let at = 0; at < points.length; at += 4) {
    if ((at & 0x3ffff) === 0) signal?.throwIfAborted();
    const ix = Math.round((points[at]! - bounds.min[0]) / pitch), iy = Math.round((points[at + 1]! - bounds.min[1]) / pitch), iz = Math.round((points[at + 2]! - bounds.min[2]) / pitch);
    const weight = points[at + 3]! / kernelSum;
    for (let kz = 0; kz < reach; kz++) for (let ky = 0; ky < reach; ky++) {
      const z = iz + kz - radius, y = iy + ky - radius, base = (z * ny + y) * nx;
      if (z < 0 || z >= nz || y < 0 || y >= ny) throw new Error('Sampled field padding clipped a kernel.');
      const w = weight * kernel[kz]! * kernel[ky]!;
      for (let kx = 0; kx < reach; kx++) {
        const x = ix + kx - radius; if (x < 0 || x >= nx) throw new Error('Sampled field padding clipped a kernel.');
        ejecta[base + x] += w * kernel[kx]!;
      }
    }
  }
  const columns = new Float32Array(nx * ny);
  for (let z = 0; z < nz; z++) for (let i = 0; i < columns.length; i++) columns[i] += ejecta[z * columns.length + i]! * pitch;
  const positive = Array.from(columns).filter(n => n > 0).sort((a, b) => a - b);
  const normalization = recipe.grid.peakOpticalDepth / positive[Math.floor(positive.length * .995)]!;
  if (!(normalization > 0) || !Number.isFinite(normalization)) throw new Error('Sampled emission normalization failed.');
  for (let i = 0; i < ejecta.length; i++) ejecta[i] *= normalization;
  for (let z = 0; z < nz; z++) {
    signal?.throwIfAborted();
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      let sum = 0;
      for (const term of recipe.terms) sum += analyticEmission(term, bounds.min[0] + x * pitch, bounds.min[1] + y * pitch, bounds.min[2] + z * pitch);
      pwn[(z * ny + y) * nx + x] = sum;
    }
  }
  function sample(data: Float32Array, x: number, y: number, z: number): number {
    const px = (x - bounds.min[0]) / pitch, py = (y - bounds.min[1]) / pitch, pz = (z - bounds.min[2]) / pitch;
    const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz);
    if (ix < 0 || iy < 0 || iz < 0 || ix >= nx - 1 || iy >= ny - 1 || iz >= nz - 1) return 0;
    const u = px - ix, v = py - iy, w = pz - iz, base = (iz * ny + iy) * nx + ix, plane = nx * ny;
    const a = data[base]! * (1 - u) + data[base + 1]! * u, b = data[base + nx]! * (1 - u) + data[base + nx + 1]! * u;
    const c = data[base + plane]! * (1 - u) + data[base + plane + 1]! * u, d = data[base + plane + nx]! * (1 - u) + data[base + plane + nx + 1]! * u;
    return ((1 - v) * a + v * b) * (1 - w) + ((1 - v) * c + v * d) * w;
  }
  const field = (weights: ComponentWeights, depth = 1, diffuse?: Float32Array): SpatialField => ({
    bounds: { min: [bounds.min[0], bounds.min[1], bounds.min[2] * depth], max: [bounds.max[0], bounds.max[1], bounds.max[2] * depth] },
    sampleEmission(x, y, z, out) {
      const value = (weights.ejecta * sample(ejecta, x, y, z / depth) + weights.pwn * sample(pwn, x, y, z / depth) +
        (diffuse ? sample(diffuse, x, y, z / depth) : 0)) / depth;
      out[0] = value; out[1] = value; out[2] = value;
    },
  });
  return { field, ejecta, pwn, bounds, size, pitch,
    evidence: { pointCount: points.length / 4, nonpositiveFluxDiscarded: discarded, rawBounds, qualifiedBounds: bounds, gridSize: size, pitchArcsec: pitch,
      kernelSigmaArcsec: sigma * pitch, fluxExponent: recipe.grid.weightExponent, peakOpticalDepth: recipe.grid.peakOpticalDepth, normalization,
      interpretation: 'Positive line-flux points in the explicitly qualified spatial frame. Finite smoothing and display normalization are authored. PWN terms are separate published geometric fits or authored supports.' } };
}
export type PreparedSampledField = ReturnType<typeof prepareSampledField>;
