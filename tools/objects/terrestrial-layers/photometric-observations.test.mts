import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { composeCorrectedColor, matchObservedColorLevels, solveBandLevels } from './photometric-observations.mts';
import { linearToSrgb } from '../color-transfer.mts';
import { sampleColorBand } from './scientific-raster.mts';
import type { ColorBand, PhotometryProfile } from './contracts.mts';

const RADIUS_KM = 1000, RADIUS_M = RADIUS_KM * 1000, FILTERS = ['GREEN', 'VIOLET', 'UV'];
const metresPerDegree = RADIUS_M * Math.PI / 180;

/** A flat-valued band over a longitude range at all latitudes, captured from far along `viewLongitude` (view and Sun together). */
function band(filter: string, longitudes: [number, number], value: number, viewLongitude: number, cellDegrees = 1): ColorBand {
  const width = Math.round((longitudes[1] - longitudes[0]) / cellDegrees), height = Math.round(180 / cellDegrees);
  const far = 1e6, direction = [Math.cos(viewLongitude * Math.PI / 180) * far, Math.sin(viewLongitude * Math.PI / 180) * far, 0];
  return { filter, data: new Float32Array(width * height).fill(value), width, height, noData: -9999,
    origin: [longitudes[0] * metresPerDegree, 90 * metresPerDegree], resolution: [cellDegrees * metresPerDegree, -cellDegrees * metresPerDegree],
    capture: { sun: direction, observer: direction } };
}
/** Density order follows the cell size: the finest observation is composed first. */
const observation = (id: string, longitudes: [number, number], values: number[], viewLongitude: number, cellDegrees: number) =>
  [id, FILTERS.map((filter, c) => band(filter, longitudes, values[c]!, viewLongitude, cellDegrees))] as const;

const profile = { filters: FILTERS, referenceRadiusMeters: RADIUS_M, centerLongitude: 0 };
const photometry = (extra: Partial<PhotometryProfile> = {}): PhotometryProfile => ({ radiusKm: RADIUS_KM, maximumIncidenceDegrees: 60, maximumEmissionDegrees: 60,
  referenceIncidenceDegrees: 0, referenceEmissionDegrees: 0, observationWeights: { fine: 1, coarse: 1, far: 1 }, ...extra });
const compose = (groups: Map<string, ColorBand[]>, extra: Partial<PhotometryProfile> = {}, width = 72, height = 36) =>
  composeCorrectedColor({ groups, profile, width, height, sourceIds: [], photometryProfile: photometry(extra), sampleColorBand });

// The fine observation covers 0-180 E but is viewed from 0 E, so beyond 60 E its geometry is too steep; the coarse one views 90 E.
const groups = () => new Map<string, ColorBand[]>([observation('fine', [0, 180], [0.5, 0.5, 0.5], 0, 1), observation('coarse', [0, 180], [0.5, 0.5, 0.5], 90, 2)]);
const ownerAt = (result: ReturnType<typeof compose>, longitude: number, width = 72) => result.owners[18 * width + Math.floor(longitude / 5)];

test('a withheld footprint keeps its texels for the monochrome base by default', () => {
  const result = compose(groups());
  assert.equal(ownerAt(result, 30), 1, 'the fine observation owns where it views the surface within 60 degrees');
  assert.equal(ownerAt(result, 120), 0, 'the fine footprint withholds the steep view and the coarse observation may not fill it');
  assert.equal(result.missing[18 * 72 + 24], 1);
  assert.ok(result.photometry.observations.fine!.withheldPixels > 0);
});

test('one-encounter observations may let the next observation own a withheld texel', () => {
  const result = compose(groups(), { withheld: 'next-observation' });
  assert.equal(ownerAt(result, 30), 1);
  assert.equal(ownerAt(result, 120), 2, 'the coarse observation, viewing 90 E, owns what the fine one withheld');
  assert.equal(result.missing[18 * 72 + 24], 0);
});

test('band levels carry every observation onto the reference calibration through overlapping footprints', () => {
  // Acceptable geometry: fine 0-60 E, coarse 40-160 E, far 140-260 E. far meets only coarse, so it reaches the reference through coarse.
  const g = new Map<string, ColorBand[]>([
    observation('fine', [0, 180], [0.5, 0.4, 0.3], 0, 1),
    observation('coarse', [0, 200], [0.65, 0.48, 0.39], 100, 2),
    observation('far', [120, 330], [1.3, 0.96, 0.78], 200, 3)]);
  const result = compose(g, { withheld: 'next-observation', bandLevels: { reference: 'fine', cellDegrees: 2, minimumOverlapPixels: 50 } });
  const levels = result.photometry.bandLevels!;
  assert.deepEqual(levels.gains.fine, [1, 1, 1]);
  for (const [k, expected] of [[0, 0.5 / 0.65], [1, 0.4 / 0.48], [2, 0.3 / 0.39]] as const) assert.ok(Math.abs(levels.gains.coarse![k]! - expected) < 1e-3, `coarse band ${k}`);
  for (const [k, expected] of [[0, 0.5 / 1.3], [1, 0.4 / 0.96], [2, 0.3 / 0.78]] as const) assert.ok(Math.abs(levels.gains.far![k]! - expected) < 1e-3, `far band ${k}`);
  assert.deepEqual(levels.pairs.map(pair => `${pair.a}/${pair.b}`), ['fine/coarse', 'coarse/far'], 'far never overlaps fine');
  const i = 18 * 72 + Math.floor(250 / 5);
  assert.equal(result.owners[i], 3);
  assert.ok(Math.abs(result.rgb[i * 3]! - 0.5) < 1e-3 && Math.abs(result.rgb[i * 3 + 2]! - 0.3) < 1e-3, 'far texels are written on the reference scale');
});

test('band levels refuse an observation no overlap chain reaches', () => {
  const samplers = [
    { observation: 'a', sample: (x: number) => x < 10 ? new Float32Array([1, 1, 1]) : null },
    { observation: 'b', sample: (x: number) => x >= 20 ? new Float32Array([2, 2, 2]) : null }];
  assert.throws(() => solveBandLevels(samplers, FILTERS, { reference: 'a', cellDegrees: 10, minimumOverlapPixels: 1 }), /no overlapping footprint chain/);
});

test('pooled level matching gives every observation one gain from all boundary samples, and clips only the brightest texels', () => {
  const g = new Map<string, ColorBand[]>([observation('fine', [0, 180], [0.5, 0.4, 0.3], 0, 1), observation('coarse', [0, 200], [0.5, 0.4, 0.3], 100, 2)]);
  // Enough texels that one outlier is far below the 0.1 % the pooled clamp lets clip.
  const width = 720, height = 360, result = compose(g, { withheld: 'next-observation' }, width, height);
  // A base twice as bright as the colour everywhere; one texel of the fine footprint is a bright outlier.
  const base = { rgb: new Uint8Array(width * height * 3).fill(Math.round(255 * linearToSrgb(0.9))), missing: new Uint8Array(width * height) };
  const outlier = 180 * width + 50; result.rgb[outlier * 3] = 5;
  const perObservation = structuredClone(result);
  const separate = matchObservedColorLevels(perObservation, base, { width, height, boundaryPixels: 1, luminance: [0.2126, 0.7152, 0.0722] });
  assert.ok(separate[0]!.gain < 0.21, 'per observation, the outlier clamps the fine footprint to a fifth of the requested gain');
  const pooled = matchObservedColorLevels(result, base, { width, height, boundaryPixels: 1, luminance: [0.2126, 0.7152, 0.0722], pooled: true });
  assert.equal(new Set(pooled.map(level => level.gain)).size, 1, 'one gain for the lens');
  assert.ok(pooled[0]!.gain > 1.9 && pooled[0]!.gain < 2.3, `the pooled gain follows the boundary median, ${pooled[0]!.gain}`);
  assert.ok(pooled.every(level => level.pooled && level.clippedPixels! >= 1 && level.clippedPixels! < 5), 'only the outlier clips');
});

test('a band sample at or below zero is sky or a frame border, so the texel is never coloured', () => {
  const dark = new Map<string, ColorBand[]>([observation('fine', [0, 180], [0.5, 0.5, -0.01], 0, 1), observation('coarse', [0, 180], [0.5, 0.5, 0.5], 90, 2)]);
  const result = compose(dark);
  assert.equal(result.photometry.observations.fine!.correctedPixels, 0, 'the fine observation has no complete positive sample');
  assert.ok(ownerAt(result, 100) === 2, 'the coarse observation owns the texel instead');
});

test('band ratios scale the named bands so the footprint means meet the published whole-disc colour, and report both', () => {
  const result = compose(new Map<string, ColorBand[]>([observation('fine', [0, 180], [0.5, 0.4, 0.45], 0, 1)]),
    { bandRatios: { reference: FILTERS[0]!, ratios: { [FILTERS[1]!]: 1.0, [FILTERS[2]!]: 0.92 }, source: 'published' } });
  const tie = result.photometry.bandRatios!;
  assert.equal(tie.measured[FILTERS[1]!], 0.8); assert.equal(tie.measured[FILTERS[2]!], 0.9);
  assert.deepEqual(tie.gains, [1, 1.25, +(0.92 / 0.9).toFixed(4)]);
  const i = ownerAt(result, 30) ? 18 * 72 + 6 : -1; assert.ok(i >= 0);
  assert.ok(Math.abs(result.rgb[i * 3 + 1]! / result.rgb[i * 3]! - 1.0) < 1e-3 && Math.abs(result.rgb[i * 3 + 2]! / result.rgb[i * 3]! - 0.92) < 1e-3);
});
