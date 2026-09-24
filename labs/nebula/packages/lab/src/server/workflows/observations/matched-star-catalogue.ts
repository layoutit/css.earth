/** Replay explicit, visually established stellar identities; the affine holdout is conditional on those identities. */
import { readFile } from 'node:fs/promises';
import { applyAffine, composeAffine, type Affine, type Point } from '@cssearth/nebula-reconstruction/registration/affine';
import type { Pair, SkyFrame } from '@cssearth/nebula-reconstruction/registration/stellar';
import type { ObservationSource } from '../../../features/observations/recipe.js';
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid matched-star catalogue.');
  return value as Record<string, unknown>;
};
const point = (value: unknown, source: ObservationSource): Point => {
  if (!Array.isArray(value) || value.length !== 2 || value.some(v => typeof v !== 'number' || !Number.isFinite(v)) ||
    value[0] < 0 || value[1] < 0 || value[0] > source.width || value[1] > source.height) throw new TypeError('Star position outside native source grid.');
  return [value[0], value[1]];
};
export function readMatchedStarCatalogue(value: unknown, source: ObservationSource, reference: ObservationSource, referenceMatrix: Affine): Pair[] {
  const row = record(value);
  if (row.schema !== 'cssearth-native-matched-stars@1' || row.discovery !== 'model-assisted-visually-inspected' || !Array.isArray(row.stars) || row.stars.length < 45 || row.stars.length > 1000) throw new TypeError('Unsupported explicit star correspondence catalogue.');
  for (const [key, image] of [['source', source], ['reference', reference]] as const) {
    const pin = record(row[key]);
    if (pin.id !== image.id || pin.width !== image.width || pin.height !== image.height) throw new Error(`Matched-star ${key} pin differs.`);
  }
  const sourceSeen = new Set<string>(), referenceSeen = new Set<string>();
  return row.stars.map((value, index): Pair => {
    const star = record(value), a = point(star.source, source), b = point(star.reference, reference);
    if (star.visuallyInspected !== true || sourceSeen.has(JSON.stringify(a)) || referenceSeen.has(JSON.stringify(b))) throw new Error('Each explicit star identity must be unique and visually inspected.');
    sourceSeen.add(JSON.stringify(a)); referenceSeen.add(JSON.stringify(b));
    return { source: a, frame: applyAffine(referenceMatrix, b), sourceIndex: index, referenceIndex: index };
  });
}
export async function loadMatchedStarCatalogue(source: ObservationSource, reference: ObservationSource, referenceMatrix: Affine): Promise<Pair[]> {
  if (!source.matchedStarCatalogue) throw new Error('No explicit matched-star catalogue configured.');
  const bytes = await readFile(source.matchedStarCatalogue.path);
  return readMatchedStarCatalogue(JSON.parse(bytes.toString()), source, reference, referenceMatrix);
}
export async function calibratedInitialTransform(source: ObservationSource, reference: ObservationSource, frame: SkyFrame, publisherMatrix: Affine): Promise<Affine> {
  if (!source.astrometricCalibration) return publisherMatrix;
  const bytes = await readFile(source.astrometricCalibration.path);
  const row = record(JSON.parse(bytes.toString())), s = record(row.source), r = record(row.reference), correction = row.publisherToCalibratedFrame;
  if (row.schema !== 'cssearth-observation-astrometric-calibration@1' || s.id !== source.id || s.width !== source.width || s.height !== source.height ||
    r.id !== reference.id || r.width !== reference.width || r.height !== reference.height ||
    JSON.stringify(row.frame) !== JSON.stringify(frame) ||
    typeof row.interpretation !== 'string' || !row.interpretation.trim() || !Array.isArray(correction) || correction.length !== 6 || correction.some(v => typeof v !== 'number' || !Number.isFinite(v))) throw new Error('Astrometric calibration evidence differs.');
  const matrix: Affine = [correction[0], correction[1], correction[2], correction[3], correction[4], correction[5]];
  if (matrix[0] * matrix[3] - matrix[1] * matrix[2] <= 0) throw new Error('Astrometric calibration cannot reverse parity.');
  return composeAffine(matrix, publisherMatrix);
}
