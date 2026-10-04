export const PHOTOMETRIC_MGE_SCHEMA = 'cssearth-photometric-mge@1';
/** Published projected Gaussian light profiles, deprojected under an explicit oblate hypothesis. */
const jointRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const jointPath = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9._/-]+$/.test(v) && !v.startsWith('/') && !v.split('/').includes('..');
import { validateEnvelopeSettings, type SimulationEnvelopeSettings } from '../nebula/simulation-envelope.js';

export interface PhotometricGaussian {
  centralAmplitude: number;
  sigmaArcsec: number;
  projectedAxisRatio: number;
}
export interface PhotometricMgeRecipe {
  schema: typeof PHOTOMETRIC_MGE_SCHEMA; id: string;
  centerIcrsDegrees: [number, number]; distancePc: number;
  positionAngleEastOfNorthDegrees: number; inclinationDegrees: number;
  /** The photometric projection cannot choose which pole tilts away from the observer. */
  lineOfSightTiltSign: 1 | -1;
  cutoffSigma: number;
  gaussians: PhotometricGaussian[];
  evidence: { path: string };
  source: { url: string; locator: string };
  interpretation: string;
  envelope?: SimulationEnvelopeSettings;
  /** Authored finite residual fit budget; omitted retains the historical compiler control. */
  residualMaximumComponents?: number;
}
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const between = (value: unknown, low: number, high: number): value is number => finite(value) && value >= low && value <= high;

export function readPhotometricMgeRecipe(value: unknown): PhotometricMgeRecipe {
  if (!jointRecord(value) || value.schema !== PHOTOMETRIC_MGE_SCHEMA ||
      typeof value.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,95}$/.test(value.id) ||
      !Array.isArray(value.centerIcrsDegrees) || value.centerIcrsDegrees.length !== 2 ||
      !between(value.centerIcrsDegrees[0], 0, 359.999999999) || !between(value.centerIcrsDegrees[1], -90, 90) ||
      !between(value.distancePc, .01, 1e9) || !between(value.positionAngleEastOfNorthDegrees, 0, 180) ||
      !between(value.inclinationDegrees, .01, 90) || ![1, -1].includes(Number(value.lineOfSightTiltSign)) ||
      typeof value.lineOfSightTiltSign !== 'number' || !between(value.cutoffSigma, 4, 8) ||
      !Array.isArray(value.gaussians) || value.gaussians.length < 1 || value.gaussians.length > 128 ||
      !jointRecord(value.evidence) || !jointPath(value.evidence.path) ||
      !jointRecord(value.source) || typeof value.source.url !== 'string' || !value.source.url.startsWith('https://') ||
      typeof value.source.locator !== 'string' || !value.source.locator.trim() ||
      typeof value.interpretation !== 'string' || !value.interpretation.trim())
    throw new TypeError('Invalid photometric MGE recipe.');
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
    cutoffSigma: value.cutoffSigma, gaussians, evidence: { path: value.evidence.path },
    source: { url: value.source.url, locator: value.source.locator }, interpretation: value.interpretation,
    ...(value.envelope === undefined ? {} : { envelope: validateEnvelopeSettings(value.envelope) }),
    ...(value.residualMaximumComponents === undefined ? {} : { residualMaximumComponents: value.residualMaximumComponents }) };
}

/** Publication ownership admission preserves receipts that retain only identity and an evidence pin.
 * Scientific recipe admission remains the full reader's responsibility. */
export function readPublishedPhotometricMgeRecipe(value: unknown, expectedId: string): { evidence: unknown } {
  if (!jointRecord(value) || value.schema !== PHOTOMETRIC_MGE_SCHEMA || value.id !== expectedId)
    throw new Error('Prepared nebula omits its configured photometric model.');
  return { evidence: value.evidence };
}
