import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { spheroidLimb, type NeptuneFrame } from './voyager-frames.mts';
import { cameraPattern } from './voyager-flat.mts';
import { driftBands, driftProfile, measureDrift, windDriftRate, windSpeed } from './voyager-drift.mts';
import { MOSAIC_POLICY, blurMap, columnShifts, equaliseGains, rotationGroups, shearWeights } from './voyager-map.mts';
import { ratioMap, reduceMap, registerBands, wholeRows } from './voyager-color.mts';

const NEPTUNE = { equatorialKm: 24764, polarKm: 24341 };
/** A frame that carries only what the map arithmetic reads: its time, filter and where the spacecraft stood. */
const frame = (id: string, hours: number, underLongitude: number, values?: Float32Array, size = 1): NeptuneFrame => ({ id, filter: 'GREEN', imageTime: '', et: hours * 3600, width: size, height: size,
  values: values ?? new Float32Array(size * size), usable: new Uint8Array(size * size).fill(1), matrix: [], positionKm: [Math.cos(underLongitude * Math.PI / 180) * 7e6, Math.sin(underLongitude * Math.PI / 180) * 7e6, 0],
  sunDirection: [1, 0, 0], rangeKm: 7e6, pixelScaleKm: 50, phaseDegrees: 15, limb: { edgePoints: 0, candidates: 0, rmsPixels: 0, shift: [0, 0], seed: 'prediction', accepted: true } });

test('the limb of a spheroid lies on the spheroid and every sight line to it is tangent', () => {
  const observer = [4.1e6, -2.2e6, -3.3e6], { equatorialKm: a, polarKm: c } = NEPTUNE;
  for (const p of spheroidLimb(observer, NEPTUNE, 90)) {
    assert.ok(Math.abs((p[0]! ** 2 + p[1]! ** 2) / a ** 2 + p[2]! ** 2 / c ** 2 - 1) < 1e-12);
    // Tangent: the sight line is perpendicular to the surface normal there.
    const normal = [p[0]! / a ** 2, p[1]! / a ** 2, p[2]! / c ** 2], sight = [observer[0]! - p[0]!, observer[1]! - p[1]!, observer[2]! - p[2]!];
    assert.ok(Math.abs(normal[0]! * sight[0]! + normal[1]! * sight[1]! + normal[2]! * sight[2]!) < 1e-9);
  }
});

test('the published wind fit is 398 m/s westward at the equator and turns eastward beyond 50 degrees', () => {
  assert.equal(windSpeed(0), -398);
  assert.ok(Math.abs(windSpeed(-20) - -324.72) < 0.01);
  assert.ok(windSpeed(-48) < 0 && windSpeed(-52) > 0);
  // 398 m/s on a circle of 24,764 km is 3.31 degrees an hour.
  assert.ok(Math.abs(windDriftRate(0, NEPTUNE) - -3.315) < 0.001);
});

test('the applied drift is the measured rate at a measured band, the fit far from one, and has no step between', () => {
  const drift = driftProfile([{ latitude: -55, rateDegreesPerHour: 0.25, pairs: 14, spread: 0.05 }, { latitude: -53, rateDegreesPerHour: 0.3, pairs: 16, spread: 0.09 }], NEPTUNE);
  assert.equal(drift(-55), 0.25);
  assert.ok(Math.abs(drift(-54) - 0.275) < 1e-9);
  assert.equal(drift(-20), windDriftRate(-20, NEPTUNE));
  assert.equal(drift(-59), windDriftRate(-59, NEPTUNE), 'four degrees from a measured band the fit applies alone');
  for (let latitude = -60; latitude < -48; latitude += 0.1) assert.ok(Math.abs(drift(latitude + 0.1) - drift(latitude)) < 0.08);
});

test('a band keeps a rate only where enough frame pairs agree on it', () => {
  const sample = (latitude: number, rate: number) => ({ latitude, rateDegreesPerHour: rate, correlation: 0.9, hours: 10, pair: ['a', 'b'] as [string, string] });
  const bands = driftBands([...[-2.8, -2.79, -2.81, -2.8, -2.82, -2.78, 3.4].map(rate => sample(-21, rate)), ...[0.3, 2.1, -1.7, 3.4, 0.9, -0.1].map(rate => sample(-61, rate))]);
  assert.deepEqual(bands.map(band => band.latitude), [-21]);
  assert.ok(Math.abs(bands[0]!.rateDegreesPerHour - -2.8) < 0.001);
  assert.equal(bands[0]!.pairs, 6);
});

test('drift is measured from clouds displaced between two frames, and a pattern that travels with the camera is not taken for clouds', () => {
  const grid = { width: 720, height: 360 }, row0 = 200, rows = 4;
  const clouds = (shiftColumns: number) => { const map = new Float32Array(grid.width * grid.height).fill(NaN); for (let y = row0; y < row0 + rows; y++) for (let x = 0; x < 400; x++) map[y * grid.width + (x + shiftColumns + 720) % 720] = 0.5 + 0.05 * Math.exp(-(((x - 120) / 9) ** 2)) - 0.04 * Math.exp(-(((x - 205) / 16) ** 2)) + 0.03 * Math.exp(-(((x - 290) / 5) ** 2)); return map; };
  // Ten hours apart, the clouds have moved 28 degrees west: 56 columns.
  const samples = measureDrift([frame('a', 0, 100), frame('b', 10, 100 - 223.5)], [clouds(0), clouds(-56)], grid);
  assert.equal(samples.length, 1);
  assert.ok(Math.abs(samples[0]!.rateDegreesPerHour - -2.8) < 0.06);
  // The same displacement when the longitude under the spacecraft changed by just that much is the camera's own pattern.
  assert.equal(measureDrift([frame('a', 0, 100), frame('b', 10, 72)], [clouds(0), clouds(-56)], grid).length, 0);
});

test('carrying a frame to an epoch moves each row by its latitude drift, and frames far in time count less where the drift is sheared', () => {
  const grid = { width: 720, height: 360 }, drift = (latitude: number) => latitude < -60 ? 5 + (-60 - latitude) * 0.5 : -2.8;
  const shifts = columnShifts(frame('a', -6, 0), grid, drift, 0);
  assert.equal(shifts[220], Math.round(-2.8 * 6 / 360 * 720), 'six hours of 2.8 degrees an hour westward');
  const near = shearWeights(frame('a', -1, 0), grid, drift, 0, MOSAIC_POLICY), far = shearWeights(frame('b', -8, 0), grid, drift, 0, MOSAIC_POLICY);
  assert.equal(far[220], 1, 'no shear round 20 degrees south: every frame counts in full');
  assert.ok(near[320]! > 0.5 && far[320]! === Math.fround(0.02), 'in the sheared jet only the frame near the epoch counts');
});

test('gains bring frames to a common level where they overlap', () => {
  const a = new Float32Array(100).fill(NaN), b = new Float32Array(100).fill(NaN);
  for (let i = 0; i < 70; i++) a[i] = 0.5; for (let i = 30; i < 100; i++) b[i] = 0.55;
  const gains = equaliseGains([a, b]);
  assert.ok(Math.abs(gains[0]! * 0.5 - gains[1]! * 0.55) < 1e-4);
  assert.ok(Math.abs(gains[0]! * gains[1]! - 1) < 1e-6, 'the geometric mean of the gains is 1');
});

test('frames are grouped so that no group spans a rotation', () => {
  const groups = rotationGroups([0, 2, 5, 11, 13, 18, 23.5].map((hours, i) => ({ frame: frame(String(i), hours, 0) })), 13);
  assert.deepEqual(groups.map(group => group.map(entry => entry.frame.et / 3600)), [[0, 2, 5, 11], [13, 18, 23.5]]);
});

test('a blur ignores unseen cells, wraps in longitude and leaves a level map unchanged', () => {
  const grid = { width: 64, height: 32 }, map = new Float32Array(64 * 32).fill(0.4);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 64; x++) map[y * 64 + x] = NaN;
  const blurred = blurMap(map, grid, 2);
  assert.ok(Math.abs(blurred[20 * 64 + 0]! - 0.4) < 1e-6 && Math.abs(blurred[9 * 64 + 63]! - 0.4) < 1e-6);
  assert.ok(Number.isNaN(blurred[0]!), 'far from any seen cell stays unseen');
  const spike = new Float32Array(64 * 32).fill(0); spike[16 * 64] = 1;
  const spread = blurMap(spike, grid, 2);
  assert.ok(Math.abs(spread[16 * 64 + 1]! - spread[16 * 64 + 63]!) < 1e-7, 'a cell at longitude 0 spreads equally to both sides of the seam');
});

test('camera blemishes are the part of the frames that stays on the same pixels', () => {
  const size = 96, frames = Array.from({ length: 14 }, (_, n) => {
    const values = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) values[y * size + x] = 0.5 + 0.0005 * x + (Math.hypot(x - (20 + 4 * n), y - (30 + 3 * n)) < 3 ? 0.08 : 0);
    values[48 * size + 48] *= 0.9;
    return frame(String(n), n, 0, values, size);
  });
  const { pattern } = cameraPattern(frames);
  assert.ok(Math.abs(pattern[48 * size + 48]! - 0.9) < 0.01, 'the fixed dark pixel is found');
  assert.ok(Math.abs(pattern[60 * size + 70]! - 1) < 0.002, 'a cloud that moved from frame to frame leaves no mark');
});

test('color ratios follow their band to where the sharp map shows its clouds; an unmatched band keeps only its mean', () => {
  const grid = { width: 720, height: 360 }, cells = grid.width * grid.height, rows = 4, band = 220;
  const sharp = new Float32Array(cells).fill(0.5), green = new Float32Array(cells).fill(0.5), orange = new Float32Array(cells).fill(0.4);
  const cloud = (x: number) => 0.04 * Math.exp(-(((x - 300) / 12) ** 2)) - 0.03 * Math.exp(-(((x - 420) / 20) ** 2));
  for (let y = band; y < band + rows; y++) for (let x = 0; x < grid.width; x++) {
    green[y * grid.width + x] = 0.5 + cloud(x); orange[y * grid.width + x] = (0.5 + cloud(x)) * (0.8 - 2 * cloud(x));
    sharp[y * grid.width + (x + 40) % grid.width] = 0.5 + cloud(x);
  }
  // The drift alone predicts 36 columns; the clouds are found 40 columns on.
  const bands = registerBands(green, sharp, grid, () => -3, -6);
  const matched = bands.find(entry => entry.row === band)!;
  assert.ok(matched.registered && matched.lagColumns === 40);
  assert.ok(bands.filter(entry => entry.row !== band).every(entry => !entry.registered), 'bands without clouds are not matched');
  const ratio = ratioMap(orange, green, bands, grid, { ...COLOR_TEST_POLICY });
  assert.ok(ratio[(band + 1) * grid.width + 340]! < 0.75, 'the cloud whitened by orange light sits 40 columns on');
  assert.ok(Math.abs(ratio[100 * grid.width + 340]! - 0.8) < 1e-4, 'an unmatched band has one ratio all round');
});

test('a map is reduced by whole blocks and its whole rows are the ones seen at every longitude', () => {
  const grid = { width: 8, height: 4 }, map = new Float32Array(32).fill(1); map[0] = NaN; map[31] = NaN;
  assert.deepEqual(wholeRows(map, grid), { first: 1, last: 2 });
  const small = reduceMap(map, grid, 2);
  assert.ok(Number.isNaN(small[0]!) && small[1] === 1 && Number.isNaN(small[7]!));
});

const COLOR_TEST_POLICY = { bandDegrees: 2, highPassDegrees: 30, searchDegrees: 12, minimumCorrelation: 0.35, minimumContrast: 0.003, bridgeLatitudeDegrees: 10, bridgeLagDegrees: 6, smoothDegrees: 0.5 };
