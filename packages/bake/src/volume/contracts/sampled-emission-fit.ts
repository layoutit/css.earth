/** Explicit, bounded image fitting on fixed measured and inferred spatial supports. */
const jointRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
import type { EmissionVector3 } from './emission.ts';

export interface SampledEmissionFit {
  sourceIds: string[]; evidenceIds: string[];
  centerArcsec: EmissionVector3; axis: EmissionVector3; radiiArcsec: EmissionVector3;
  spacingArcsec: number; sigmaArcsec: number; imageWidth: number; iterations: number;
  regularization: number; maximumCoefficient: number; maximumEjectaGain: number;
  /** Optional image structures become finite, locally depth-conditioned emitters, never color columns. */
  detail?: { scalesArcsec: number[]; maximumAtoms: number };
}
function number(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    throw new TypeError('Invalid sampled emission-fit parameter.');
  return value;
}
function vector(value: unknown): EmissionVector3 {
  if (!Array.isArray(value) || value.length !== 3) throw new TypeError('Expected emission-fit vector.');
  return [number(value[0], -1e5, 1e5), number(value[1], -1e5, 1e5), number(value[2], -1e5, 1e5)];
}
function ids(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.length > 30 ||
    value.some(v => typeof v !== 'string' || !/^[a-z0-9][a-z0-9-]{0,95}$/.test(v)) || new Set(value).size !== value.length)
    throw new TypeError('Emission fit requires unique source/evidence identities.');
  return value;
}
export function readSampledEmissionFit(value: unknown): SampledEmissionFit {
  if (!jointRecord(value)) throw new TypeError('Invalid sampled emission fit.');
  const axis = vector(value.axis), radiiArcsec = vector(value.radiiArcsec);
  if (Math.abs(Math.hypot(...axis) - 1) > 1e-6 || radiiArcsec.some(n => n <= 0))
    throw new TypeError('Emission-fit envelope requires a unit axis and positive radii.');
  const imageWidth = number(value.imageWidth, 32, 256), iterations = number(value.iterations, 1, 200);
  if (![imageWidth, iterations].every(Number.isInteger)) throw new TypeError('Emission-fit sampling must be integral.');
  let detail: SampledEmissionFit['detail'];
  if (value.detail !== undefined) {
    if (!jointRecord(value.detail) || !Array.isArray(value.detail.scalesArcsec) || value.detail.scalesArcsec.length < 1 || value.detail.scalesArcsec.length > 4)
      throw new TypeError('Invalid finite detail scales.');
    const scalesArcsec = value.detail.scalesArcsec.map(v => number(v, 1, 1e3)), maximumAtoms = number(value.detail.maximumAtoms, 1, 3500);
    if (!Number.isInteger(maximumAtoms) || new Set(scalesArcsec).size !== scalesArcsec.length) throw new TypeError('Invalid finite detail budget.');
    detail = { scalesArcsec, maximumAtoms };
  }
  return { sourceIds: ids(value.sourceIds), evidenceIds: ids(value.evidenceIds), centerArcsec: vector(value.centerArcsec), axis, radiiArcsec,
    spacingArcsec: number(value.spacingArcsec, 1, 1e4), sigmaArcsec: number(value.sigmaArcsec, 1, 1e4), imageWidth, iterations,
    regularization: number(value.regularization, .0001, 10), maximumCoefficient: number(value.maximumCoefficient, .01, 10),
    maximumEjectaGain: number(value.maximumEjectaGain, 1, 20), ...(detail ? { detail } : {}) };
}
