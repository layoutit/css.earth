/** Evaluate and grid accepted finite 3D atoms; no fitting or image inference. */
import type { EmissionVector3 } from '../contracts/emission.ts';
import type { Cancellation } from '../contracts/cancellation.ts';
import type { PreparedSampledField } from './sampled.ts';

export interface DiffuseAtom { centerArcsec: EmissionVector3; sigmaArcsec: number }
const SQRT2PI = Math.sqrt(2 * Math.PI);
function erf(x: number) {
  const t = 1 / (1 + .3275911 * x);
  return 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x);
}
export function diffuseAtomEmission(atom: DiffuseAtom, x: number, y: number, z: number): number {
  const q = ((x - atom.centerArcsec[0]) ** 2 + (y - atom.centerArcsec[1]) ** 2 + (z - atom.centerArcsec[2]) ** 2) / atom.sigmaArcsec ** 2;
  return q >= 16 ? 0 : Math.exp(-q / 2) / (SQRT2PI * atom.sigmaArcsec);
}
export function diffuseAtomProjection(atom: DiffuseAtom, x: number, y: number): number {
  const q = ((x - atom.centerArcsec[0]) ** 2 + (y - atom.centerArcsec[1]) ** 2) / atom.sigmaArcsec ** 2;
  return q >= 16 ? 0 : Math.exp(-q / 2) * erf(Math.sqrt((16 - q) / 2));
}
/** Grid the final finite 3D atoms once; baking never evaluates an image-dependent density column. */
export function gridDiffuse(prepared: PreparedSampledField, atoms: DiffuseAtom[], coefficients: readonly number[], signal?: Cancellation) {
  if (atoms.length !== coefficients.length) throw new TypeError('Diffuse coefficients differ from spatial atoms.');
  const data = new Float32Array(prepared.ejecta.length), [nx, ny, nz] = prepared.size, { bounds, pitch } = prepared;
  atoms.forEach((atom, index) => {
    signal?.throwIfAborted(); const coefficient = coefficients[index]!;
    if (!(coefficient >= 0) || !Number.isFinite(coefficient)) throw new TypeError('Invalid fitted diffuse coefficient.');
    if (coefficient === 0) return;
    const lo = atom.centerArcsec.map((n, i) => Math.max(0, Math.floor((n - 4 * atom.sigmaArcsec - bounds.min[i]!) / pitch)));
    const hi = atom.centerArcsec.map((n, i) => Math.min(prepared.size[i]! - 1, Math.ceil((n + 4 * atom.sigmaArcsec - bounds.min[i]!) / pitch)));
    for (let z = lo[2]!; z <= hi[2]!; z++) for (let y = lo[1]!; y <= hi[1]!; y++) for (let x = lo[0]!; x <= hi[0]!; x++)
      data[(z * ny + y) * nx + x] += coefficient * diffuseAtomEmission(atom, bounds.min[0] + x * pitch, bounds.min[1] + y * pitch, bounds.min[2] + z * pitch);
  });
  if (data.length !== nx * ny * nz) throw new Error('Diffuse grid shape changed.');
  return data;
}
