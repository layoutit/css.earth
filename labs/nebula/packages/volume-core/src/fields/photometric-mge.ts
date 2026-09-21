/** Published projected Gaussian light profiles, deprojected under an explicit oblate hypothesis. */
const jointRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const jointPath = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9._/-]+$/.test(v) && !v.startsWith('/') && !v.split('/').includes('..');
import type { SimulationDepthPrior } from '../contracts/simulation-prior.ts';
import { validateEnvelopeSettings, type SimulationEnvelopeSettings } from './simulation-envelope.ts';

export interface PhotometricGaussian {
  centralAmplitude: number;
  sigmaArcsec: number;
  projectedAxisRatio: number;
}
export interface PhotometricMgeRecipe {
  schema: 'cssearth-photometric-mge@1'; id: string;
  centerIcrsDegrees: [number, number]; distancePc: number;
  positionAngleEastOfNorthDegrees: number; inclinationDegrees: number;
  /** The photometric projection cannot choose which pole tilts away from the observer. */
  lineOfSightTiltSign: 1 | -1;
  cutoffSigma: number;
  gaussians: PhotometricGaussian[];
  evidence: { path: string; sha256: string };
  source: { url: string; sha256: string; locator: string };
  interpretation: string;
  envelope?: SimulationEnvelopeSettings;
  /** Authored finite residual fit budget; omitted retains the historical compiler control. */
  residualMaximumComponents?: number;
}
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const between = (value: unknown, low: number, high: number): value is number => finite(value) && value >= low && value <= high;

export function readPhotometricMgeRecipe(value: unknown): PhotometricMgeRecipe {
  if (!jointRecord(value) || value.schema !== 'cssearth-photometric-mge@1' ||
      typeof value.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,95}$/.test(value.id) ||
      !Array.isArray(value.centerIcrsDegrees) || value.centerIcrsDegrees.length !== 2 ||
      !between(value.centerIcrsDegrees[0], 0, 359.999999999) || !between(value.centerIcrsDegrees[1], -90, 90) ||
      !between(value.distancePc, .01, 1e9) || !between(value.positionAngleEastOfNorthDegrees, 0, 180) ||
      !between(value.inclinationDegrees, .01, 90) || ![1, -1].includes(Number(value.lineOfSightTiltSign)) ||
      typeof value.lineOfSightTiltSign !== 'number' || !between(value.cutoffSigma, 4, 8) ||
      !Array.isArray(value.gaussians) || value.gaussians.length < 1 || value.gaussians.length > 128 ||
      !jointRecord(value.evidence) || !jointPath(value.evidence.path) ||
      typeof value.evidence.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.evidence.sha256) ||
      !jointRecord(value.source) || typeof value.source.url !== 'string' || !value.source.url.startsWith('https://') ||
      typeof value.source.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.source.sha256) ||
      typeof value.source.locator !== 'string' || !value.source.locator.trim() ||
      typeof value.interpretation !== 'string' || !value.interpretation.trim())
    throw new TypeError('Invalid pinned photometric MGE recipe.');
  if (value.residualMaximumComponents !== undefined && (!between(value.residualMaximumComponents, 16, 8192) || !Number.isInteger(value.residualMaximumComponents)))
    throw new TypeError('Invalid photometric residual component budget.');
  const cosSquared = Math.cos(value.inclinationDegrees * Math.PI / 180) ** 2;
  const gaussians = value.gaussians.map((row: unknown): PhotometricGaussian => {
    if (!jointRecord(row) || !between(row.centralAmplitude, 1e-12, 1e20) ||
        !between(row.sigmaArcsec, .001, 1e6) || !between(row.projectedAxisRatio, .001, 1) ||
        row.projectedAxisRatio ** 2 <= cosSquared)
      throw new TypeError('Photometric Gaussian cannot be deprojected at this inclination.');
    return { centralAmplitude: row.centralAmplitude, sigmaArcsec: row.sigmaArcsec, projectedAxisRatio: row.projectedAxisRatio };
  });
  return { schema: value.schema, id: value.id, centerIcrsDegrees: [value.centerIcrsDegrees[0], value.centerIcrsDegrees[1]],
    distancePc: value.distancePc, positionAngleEastOfNorthDegrees: value.positionAngleEastOfNorthDegrees,
    inclinationDegrees: value.inclinationDegrees, lineOfSightTiltSign: value.lineOfSightTiltSign === 1 ? 1 : -1,
    cutoffSigma: value.cutoffSigma, gaussians, evidence: { path: value.evidence.path, sha256: value.evidence.sha256 },
    source: { url: value.source.url, sha256: value.source.sha256, locator: value.source.locator }, interpretation: value.interpretation,
    ...(value.envelope === undefined ? {} : { envelope: validateEnvelopeSettings(value.envelope) }),
    ...(value.residualMaximumComponents === undefined ? {} : { residualMaximumComponents: value.residualMaximumComponents }) };
}

/** x is west, y north, z away. The density is relative light per angular-depth unit, not calibrated flux. */
export function samplePhotometricMge(recipe: PhotometricMgeRecipe): Omit<SimulationDepthPrior, 'identity'> {
  const parsed = readPhotometricMgeRecipe(recipe);
  const inclination = parsed.inclinationDegrees * Math.PI / 180, pa = parsed.positionAngleEastOfNorthDegrees * Math.PI / 180;
  const sinI = Math.sin(inclination), cosI = Math.cos(inclination), sign = parsed.lineOfSightTiltSign;
  const axis = [sinI * Math.cos(pa), sinI * Math.sin(pa), sign * cosI];
  const totalAmplitude = parsed.gaussians.reduce((sum, row) => sum + row.centralAmplitude, 0);
  const rows = parsed.gaussians.map(row => {
    const qSquared = (row.projectedAxisRatio ** 2 - cosI ** 2) / sinI ** 2;
    return { inverseVariance: 1 / row.sigmaArcsec ** 2, inverseQSquared: 1 / qSquared,
      amplitude: row.centralAmplitude / totalAmplitude * row.projectedAxisRatio /
        (Math.sqrt(2 * Math.PI) * row.sigmaArcsec * Math.sqrt(qSquared)) };
  });
  // An enclosing sphere retains every tilted Gaussian out to the explicitly chosen ellipsoidal cutoff.
  const radius = parsed.cutoffSigma * Math.max(...parsed.gaussians.map(row => row.sigmaArcsec));
  const cutoffSquared = parsed.cutoffSigma ** 2;
  return { bounds: { min: [-radius, -radius, -radius], max: [radius, radius, radius] },
    sampleDensity(x, y, z) {
      if (![x, y, z].every(Number.isFinite)) throw new TypeError('MGE coordinates must be finite.');
      const axial = axis[0]! * x + axis[1]! * y + axis[2]! * z;
      const cylindricalSquared = Math.max(0, x * x + y * y + z * z - axial * axial);
      let density = 0;
      for (const row of rows) {
        const radiusSquared = (cylindricalSquared + axial * axial * row.inverseQSquared) * row.inverseVariance;
        if (radiusSquared < cutoffSquared) density += row.amplitude * Math.exp(-.5 * radiusSquared);
      }
      return density;
    } };
}
