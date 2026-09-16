import assert from 'node:assert/strict';
import { test } from 'node:test';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readChannelRows } from './oifits-rows.mts';
import { compareSpotMaps, limbDarkenedVisibility, normalStream, simulateSpotlessDisc, spotMap, SPOT_CONTRAST_RATIO } from './spotless-disc.mts';

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
