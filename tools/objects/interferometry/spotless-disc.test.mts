import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readChannelRows } from './oifits-rows.mts';
import { compareSpotMaps, limbDarkenedVisibility, normalStream, reconstructionVerdict, reproducibility, simulateSpotlessDisc, spotMap, SPOT_CONTRAST_RATIO } from './spotless-disc.mts';

const MAS_RAD = Math.PI / 180 / 3.6e6;
/** The baseline at which x = pi B theta / lambda equals the given argument, for a 10 mas disc at 1.6 micrometres. */
const baselineAt = (x: number) => x * 1.6e-6 / (Math.PI * 10 * MAS_RAD);

test('the disc visibility is 1 at zero baseline and has the uniform and fully darkened first nulls', () => {
  assert.equal(limbDarkenedVisibility(0, 1.6e-6, 10, 0.3), 1);
  assert.ok(Math.abs(limbDarkenedVisibility(baselineAt(1e-3), 1.6e-6, 10, 0.3) - 1) < 1e-6, 'continuous at the origin');
  // First zero of J1 (uniform disc) and of J3/2 (u = 1).
  assert.ok(Math.abs(limbDarkenedVisibility(baselineAt(3.831706), 1.6e-6, 10, 0)) < 1e-6);
  assert.ok(Math.abs(limbDarkenedVisibility(baselineAt(4.493409), 1.6e-6, 10, 1)) < 1e-6);
  assert.ok(limbDarkenedVisibility(baselineAt(4.2), 1.6e-6, 10, 0) < 0, 'negative past the null');
});

test('the noise stream is reproducible and standard normal', () => {
  const first = (seed: number) => Array.from({ length: 256 }, normalStream(seed));
  const [two, three] = [first(2), first(3)], r = two.reduce((sum, value, i) => sum + value * three[i]!, 0) / Math.sqrt(two.reduce((sum, v) => sum + v * v, 0) * three.reduce((sum, v) => sum + v * v, 0));
  assert.ok(Math.abs(r) < 0.2, `nearby seeds give independent noise: correlation ${r.toFixed(3)}`);
  const a = normalStream(7), b = normalStream(7), values = Array.from({ length: 20000 }, () => a());
  assert.equal(values[123], Array.from({ length: 124 }, () => b())[123]);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length, variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  assert.ok(Math.abs(mean) < 0.03 && Math.abs(variance - 1) < 0.05, `mean ${mean}, variance ${variance}`);
});

test('spot maps remove the limb profile, and the ratio separates structure from none', () => {
  const size = 64, pixelMas = 0.5, diameterMas = 20;
  const disc = (spot: number) => Float64Array.from({ length: size * size }, (_, i) => {
    const x = i % size - 31.5, y = Math.floor(i / size) - 31.5, r = Math.hypot(x, y) * pixelMas / (diameterMas / 2);
    if (r > 1) return 0;
    const limb = 1 - 0.5 * (1 - Math.sqrt(1 - r * r));
    return limb * (1 + spot * Math.exp(-((x - 6) ** 2 + (y - 4) ** 2) / 8));
  });
  const plain = spotMap({ width: size, height: size, values: disc(0), pixelMas }, diameterMas, 1);
  const spotted = spotMap({ width: size, height: size, values: disc(0.3), pixelMas }, diameterMas, 1);
  const plainRms = Math.sqrt([...plain].filter(Number.isFinite).reduce((sum, value) => sum + value * value, 0) / [...plain].filter(Number.isFinite).length);
  assert.ok(plainRms < 0.02, `a plain limb-darkened disc leaves only pixel-ring residue once its profile is removed: ${plainRms}`);
  const faint = spotMap({ width: size, height: size, values: disc(0.1), pixelMas }, diameterMas, 1);
  assert.ok(compareSpotMaps(spotted, faint).ratio > SPOT_CONTRAST_RATIO, 'a threefold spot passes');
  assert.ok(compareSpotMaps(faint, faint).ratio < SPOT_CONTRAST_RATIO, 'an image no stronger than its artefacts fails');
  assert.equal(compareSpotMaps(faint, faint).correlation, 1);
});

test('simulating a spotless disc keeps the sampling and errors and recovers its diameter', async (context) => {
  const path = resolve(import.meta.dirname, '../../../src/objects/pi1-gruis/source/observations/PI_GRU_forImage.fits');
  if (!await access(path).then(() => true, () => false)) { context.skip('π¹ Gruis PIONIER file not restored'); return; }
  const input = await readFile(path), before = readChannelRows(input);
  const simulated = simulateSpotlessDisc(input, { diameterMas: 18.17, limbDarkening: 0.2, seed: 3 });
  assert.equal(simulated.bytes.length, input.length);
  const after = readChannelRows(simulated.bytes);
  assert.equal(after.vis2.length, before.vis2.length); assert.equal(after.t3.length, before.t3.length);
  assert.deepEqual(after.vis2.map(row => [row.u, row.v, row.error]), before.vis2.map(row => [row.u, row.v, row.error]));
  let best = { diameter: 0, chi2: Infinity };
  for (let diameter = 17.5; diameter <= 19; diameter += 0.01) {
    const chi2 = after.vis2.reduce((sum, row) => sum + ((row.vis2 - limbDarkenedVisibility(Math.hypot(row.u, row.v), row.wavelengthMetres, diameter, 0.2) ** 2) / row.error) ** 2, 0);
    if (chi2 < best.chi2) best = { diameter, chi2 };
  }
  assert.ok(Math.abs(best.diameter - 18.17) < 0.1, `fitted ${best.diameter.toFixed(2)} mas`);
  assert.ok(best.chi2 / after.vis2.length < 1.5, `the noise is each point's own error: reduced chi-squared ${(best.chi2 / after.vis2.length).toFixed(2)}`);
  assert.ok(after.t3.every(row => Math.abs(((row.phaseDegrees % 180) + 270) % 180 - 90) < 90), 'closure phases stay finite');
});

test('a reconstruction is cast only when it fits its data, beats the spotless disc and comes back from both halves', () => {
  // Measured: π¹ Gruis and Betelgeuse SQUEEZE (shipped), Polaris SQUEEZE, Polaris ROTIR sphere (reduced chi-squared V2 and closure
  // phase; spot ratio; correlation of the spots beyond the spotless twins between interleaved halves).
  assert.equal(reconstructionVerdict({ vis2: 2.45, closurePhase: 1.06 }, { ratio: 5.22 }, { correlation: 0.95 }).cast, true);
  assert.equal(reconstructionVerdict({ vis2: 0.35, closurePhase: 1.12 }, { ratio: 2.73 }, { correlation: 0.79 }).cast, true);
  // Betelgeuse through image-star against the spottiest twin within 2 percent: its lens is kept with a label, not by this verdict.
  const betelgeuse = reconstructionVerdict({ vis2: 0.31, closurePhase: 1.2 }, { ratio: 1.24 }, { correlation: 0.57 });
  assert.equal(betelgeuse.cast, false); assert.equal(betelgeuse.reasons.length, 1); assert.match(betelgeuse.reasons[0]!, /spotless/u);
  const flat = reconstructionVerdict({ vis2: 1.76, closurePhase: 2.28 }, { ratio: 1.05 }, { correlation: -0.13 });
  assert.equal(flat.reasons.length, 2); assert.match(flat.reasons.join(), /halves/u);
  const sphere = reconstructionVerdict({ vis2: 1.45, closurePhase: 5.58 }, { ratio: 1.53 }, { correlation: 0.28 });
  assert.equal(sphere.cast, false); assert.equal(sphere.reasons.length, 3); assert.match(sphere.reasons.join(), /does not fit/u);
});

test('reproducibility subtracts each half\'s spotless twin, so shared coverage artefacts cannot agree for it', () => {
  const size = 64, field = (seed: number, scale: number) => { const noise = normalStream(seed); return Float64Array.from({ length: size * size }, () => noise() * scale); };
  const spot = Float64Array.from({ length: size * size }, (_, i) => 0.1 * Math.exp(-((i % size - 20) ** 2 + (Math.floor(i / size) - 40) ** 2) / 50));
  const add = (...maps: Float64Array[]) => maps[0]!.map((_, i) => maps.reduce((sum, map) => sum + map[i]!, 0));
  const artefact = field(1, 0.05), [a1, a2, b1, b2] = [2, 3, 4, 5].map(seed => field(seed, 0.002)) as [Float64Array, Float64Array, Float64Array, Float64Array];
  // The same strong artefacts in both halves and their twins, and a spot only in the data: the halves agree on the spot.
  assert.ok(reproducibility(add(artefact, spot, a1), add(artefact, a2), add(artefact, spot, b1), add(artefact, b2)).correlation > 0.8);
  // Artefacts alone, identical between the halves, leave only independent noise.
  assert.ok(Math.abs(reproducibility(add(artefact, a1), add(artefact, a2), add(artefact, b1), add(artefact, b2)).correlation) < 0.1);
});
