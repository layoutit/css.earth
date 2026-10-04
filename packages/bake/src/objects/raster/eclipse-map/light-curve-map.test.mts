import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { BODIES, hostedOrbit, starAstrometry } from '@cssearth/astronomy';
import { mapBasisCurves, realSphericalHarmonics, brightnessTemperature, eigenBasis, equalAngleGrid, planckRadiance, seededRandom, bandTemperatureTable, binAverage, fitLightCurveMap, hemisphereTemperature, meridionalOffset, temperatureGrid } from '@cssearth/bake/objects/raster';

test('a one-sample band with a blackbody star is the single-wavelength brightness temperature', () => {
  const band = { wavelengthMicrons: Float64Array.of(4.5), counts: Float64Array.of(1), stellarIntensity: Float64Array.of(planckRadiance(4.5, 4520)) };
  const table = bandTemperatureTable(band);
  for (const value of [2e-4, 1e-3, 3e-3]) {
    const expected = brightnessTemperature(value, 4.5, 0.15883, 4520, 0.01);
    assert.ok(Math.abs(table.temperature(value, 0.15883, 0.01) - expected) < 0.01, `${value}: ${table.temperature(value, 0.15883, 0.01)} vs ${expected}`);
  }
});

test('a counted band solves its defining equation: count-weighted planet-to-star intensity equals pi value (1 + s_corr) / rp^2', () => {
  const wavelengthMicrons = Float64Array.from({ length: 60 }, (_, i) => 5 + i * 0.1);
  // A star that is not a blackbody and counts that are not flat, so neither shortcut would pass.
  const stellarIntensity = wavelengthMicrons.map(w => planckRadiance(w, 4500) * (1 + 0.2 * Math.sin(w * 3)));
  const counts = wavelengthMicrons.map((w, i) => stellarIntensity[i]! * w * (1 + 0.5 * Math.cos(w)));
  const table = bandTemperatureTable({ wavelengthMicrons, counts, stellarIntensity });
  for (const temperature of [400, 900, 1500, 2100]) {
    const ratio = table.ratio(temperature), value = ratio * 0.15 ** 2 / Math.PI / 1.004;
    assert.ok(Math.abs(table.temperature(value, 0.15, 0.004) - temperature) < 0.01, `${temperature} K`);
  }
  assert.ok(Number.isNaN(table.temperature(-1e-4, 0.15)), 'a negative map value has no temperature');
});

test('bin averages follow each sample\'s extent over a straight line and split a step by the overlap', () => {
  const wavelengthMicrons = Float64Array.from({ length: 1001 }, (_, i) => 1 + i * 0.01);
  const line = binAverage({ wavelengthMicrons, values: wavelengthMicrons.map(w => 3 * w + 1) }, Float64Array.of(2, 3, 4.5));
  // Extents run half-way to the neighbours: 1.5-2.5, 2.5-3.75 and 3.75-5.25, so the middle sample averages the line at 3.125.
  [7, 10.375, 14.5].forEach((expected, i) => assert.ok(Math.abs(line[i]! - expected) < 1e-9));
  // A step at 3.0 microns; samples at 2.8, 3.0 and 3.2 have extents 2.7-2.9, 2.9-3.1 and 3.1-3.3.
  const step = binAverage({ wavelengthMicrons, values: wavelengthMicrons.map(w => w < 3 ? 0 : 1) }, Float64Array.of(2.8, 3.0, 3.2));
  assert.ok(Math.abs(step[0]!) < 1e-9 && Math.abs(step[1]! - 0.5) < 0.06 && Math.abs(step[2]! - 1) < 1e-9, [...step].join());
  assert.throws(() => binAverage({ wavelengthMicrons, values: wavelengthMicrons }, Float64Array.of(0.5, 0.6)), /does not cover/u);
  assert.throws(() => binAverage({ wavelengthMicrons, values: wavelengthMicrons }, Float64Array.of(2)), /at least two/u);
});

test('an injected degree-1 map under a ramp and a drift is recovered with the ramp time constant and the injected degree', () => {
  const orbit = hostedOrbit('wasp-43b'), host = starAstrometry('wasp-43'), rp = BODIES['wasp-43b'].meanRadiusKm / BODIES['wasp-43'].meanRadiusKm;
  const time = Float64Array.from({ length: 400 }, (_, i) => orbit.transitTimeBmjdTdb + 0.2 + i * 6 / 1440);
  const fine = equalAngleGrid(90, 180), [, , y11] = realSphericalHarmonics(1, fine.latitudes, fine.longitudes);
  // A dayside hot planet peaking at the substellar point.
  const truth = Float64Array.from(y11!, v => (1 + 0.9 * v / Math.sqrt(3)) * 2.5e-3 / Math.PI);
  const [model] = mapBasisCurves([truth], fine, orbit, host, rp, time);
  const random = seededRandom(11), sigma = 4e-5, start = time[0]!;
  const flux = Float64Array.from(model!, (v, i) => 1 + v - 8e-4 * Math.exp(-(time[i]! - start) / 0.04) + 5e-4 * (time[i]! - start) + sigma * random.normal());
  const fit = fitLightCurveMap({ time, flux, error: new Float64Array(time.length).fill(sigma), columns: new Map() },
    { degrees: [1, 2], eigencurves: [1, 2, 3, 4], positive: true, transitExclusionPhase: 0.04, gridHeight: 45,
      systematics: [{ kind: 'time' }, { kind: 'exponential-ramp', timeConstantsDays: [0.01, 0.04, 0.16] }] }, orbit, host, rp);
  assert.ok(Math.abs(fit.rampTimeConstantDays! / 0.04 - 1) < 0.1, `ramp time constant ${fit.rampTimeConstantDays}`);
  assert.equal(fit.basis.lmax, 1, 'the injected degree, not a higher one within the BIC tolerance');
  assert.ok(Math.abs(fit.hotspot.longitude) < 5 && Math.abs(fit.hotspot.latitude) < 15, `hotspot ${fit.hotspot.latitude}, ${fit.hotspot.longitude}`);
  assert.ok(fit.candidates.length >= 5 && fit.candidates.every(c => Math.abs(c.rampTimeConstantDays! / 0.04 - 1) < 0.1));
  // The hemisphere a flat blackbody-star band sees at eclipse, back to its temperature, matches the injected dayside.
  const table = bandTemperatureTable({ wavelengthMicrons: Float64Array.of(7.5), counts: Float64Array.of(1), stellarIntensity: Float64Array.of(planckRadiance(7.5, 4500)) });
  const truthFit = { ...fit.fit, coefficients: new Float64Array(fit.fit.ncurves), uniformAmplitude: 2.5e-3, stellarCorrection: 0 };
  const uniform = hemisphereTemperature(fit.basis, truthFit, table, rp, 0);
  assert.ok(Math.abs(uniform.flux - 2.5e-3) < 2e-5, `a uniform planet shows its full flux: ${uniform.flux}`);
  const map = temperatureGrid(fit.basis, fit.fit, table, rp, 45), day = map.temperatures[22 * 90 + 45]!, night = map.temperatures[22 * 90 + 0]!;
  assert.ok(day > night, `substellar ${day} K above antistellar ${night} K`);
  // The injected dipole points at the substellar meridian, so the fitted map's meridional offset is near 0.
  assert.ok(Math.abs(meridionalOffset(fit.basis, fit.fit, 0.25)) < 5, `meridional offset ${meridionalOffset(fit.basis, fit.fit, 0.25)}`);
});

test('the meridional offset finds the longitude of a tilted dipole wherever its latitude sits', () => {
  const orbit = hostedOrbit('wasp-43b'), host = starAstrometry('wasp-43'), rp = BODIES['wasp-43b'].meanRadiusKm / BODIES['wasp-43'].meanRadiusKm;
  const basis = eigenBasis(1, equalAngleGrid(45, 90), orbit, host, rp, Float64Array.from({ length: 50 }, (_, i) => orbit.transitTimeBmjdTdb + i * orbit.periodDays / 50));
  // Express a dipole toward (latitude -30, longitude +12) in the eigenmaps: solve for coefficients on the grid by least squares.
  const lat = -30 * Math.PI / 180, lon = 12 * Math.PI / 180, grid = basis.grid, n = basis.maps.length;
  const target = Float64Array.from(grid.latitudes, (_, c) => { const a = grid.latitudes[c]! * Math.PI / 180, b = grid.longitudes[c]! * Math.PI / 180; return Math.cos(a) * Math.cos(lat) * Math.cos(b - lon) + Math.sin(a) * Math.sin(lat); });
  const normal = new Float64Array(n * n), rhs = new Float64Array(n);
  for (let c = 0; c < target.length; c++) for (let i = 0; i < n; i++) { rhs[i] += basis.maps[i]![c]! * target[c]!; for (let j = 0; j < n; j++) normal[i * n + j] += basis.maps[i]![c]! * basis.maps[j]![c]!; }
  const coefficients = solveSmall(normal, rhs, n);
  const fit = { ncurves: n, coefficients, uniformAmplitude: 0, stellarCorrection: 0 } as unknown as Parameters<typeof meridionalOffset>[1];
  assert.ok(Math.abs(meridionalOffset(basis, fit, 0.05) - 12) < 0.1, `offset ${meridionalOffset(basis, fit, 0.05)}`);
});

function solveSmall(matrix: Float64Array, rhs: Float64Array, n: number) {
  const a = Float64Array.from(matrix), b = Float64Array.from(rhs);
  for (let k = 0; k < n; k++) {
    let pivot = k; for (let i = k + 1; i < n; i++) if (Math.abs(a[i * n + k]!) > Math.abs(a[pivot * n + k]!)) pivot = i;
    for (let j = 0; j < n; j++) [a[k * n + j], a[pivot * n + j]] = [a[pivot * n + j]!, a[k * n + j]!]; [b[k], b[pivot]] = [b[pivot]!, b[k]!];
    for (let i = k + 1; i < n; i++) { const f = a[i * n + k]! / a[k * n + k]!; for (let j = k; j < n; j++) a[i * n + j] -= f * a[k * n + j]!; b[i] -= f * b[k]!; }
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) { let s = b[i]!; for (let j = i + 1; j < n; j++) s -= a[i * n + j]! * x[j]!; x[i] = s / a[i * n + i]!; }
  return x;
}

test('a rock set by a depth summed over a spectrograph reads a throughput table, the record\'s radius ratio and reports the uniform day side', async () => {
  const { mkdtemp, mkdir, rm, writeFile } = await import('node:fs/promises'), { tmpdir } = await import('node:os'), { join } = await import('node:path');
  const { loadBareRockEclipse } = await import('@cssearth/bake/objects/raster');
  const root = await mkdtemp(join(tmpdir(), 'rock-band-'));
  try {
    // A blackbody star at 3,000 K as an SVO model spectrum (surface flux, erg/cm2/s/A, on a 50 A grid), and a throughput that is flat
    // from 5 to 12 microns with rows outside the band a recipe must cut.
    const starK = 3000, ratio = 0.05, rows: string[] = [];
    for (let angstrom = 5000; angstrom <= 300000; angstrom += 50) rows.push(`<TR><TD>${angstrom}</TD><TD>${Math.PI * planckRadiance(angstrom / 1e4, starK) * 1e-7}</TD></TR>`);
    await mkdir(join(root, 'science'), { recursive: true });
    await writeFile(join(root, 'science/star.xml'), `<VOTABLE><FIELD name="WAVELENGTH" unit="ANGSTROM"/><FIELD name="FLUX" unit="ERG/CM2/S/A"/><TABLEDATA>${rows.join('')}</TABLEDATA></VOTABLE>`);
    const band = Array.from({ length: 141 }, (_, i) => 4 + i * 0.1), table = band.map(w => `${w.toFixed(1)}\t${w < 4.95 || w > 12.05 ? 9 : 0.3}`).join('\n');
    await writeFile(join(root, 'science/throughput.dat'), `${table}\n`);
    // The depth a uniform 1,000 K day side shows over that band: rp^2 times the photon-counted band ratio.
    const kept = band.filter(w => w >= 5 && w <= 12), sum = (kelvin: number) => kept.reduce((total, w) => total + planckRadiance(w, kelvin) * w, 0);
    const depthPpm = ratio ** 2 * sum(1000) / sum(starK) * 1e6;
    await writeFile(join(root, 'science/depth.json'), JSON.stringify({ schema: 'cssearth-eclipse-depth@1', planet: 'gj-1132b', eclipseDepthPpm: { low: depthPpm * 0.9, high: depthPpm * 1.1 }, radiusRatio: ratio, source: 'test' }));
    const recipe = { format: 'bare-rock-eclipse', path: 'science/depth.json', sampling: 'bilinear', units: 'K', planet: 'gj-1132b', host: 'gj-1132',
      band: { encoding: 'throughput-columns', path: 'science/throughput.dat', minimumMicrons: 5, maximumMicrons: 12 }, star: { encoding: 'svo-model-spectrum', path: 'science/star.xml' } };
    const rock = await loadBareRockEclipse(root, recipe);
    assert.equal(rock.radiusRatio, ratio, 'the record\'s ratio, not the bodies\' own');
    // The band's end rows count for half a step, so the table's sum differs from the plain one by a few kelvin.
    assert.ok(Math.abs(rock.uniformDaysideK - 1000) < 5, `uniform day side ${rock.uniformDaysideK}`);
    // The same flux from a rock with no heat transport needs a hotter point under the star.
    assert.ok(rock.substellarK > 1080 && rock.substellarK < 1160 && rock.lowerK < rock.substellarK && rock.upperK > rock.substellarK, `substellar ${rock.substellarK}`);
    assert.equal((rock.report as { radiusRatio?: number }).radiusRatio, ratio);
    await assert.rejects(loadBareRockEclipse(root, { ...recipe, band: { ...recipe.band, minimumMicrons: 20, maximumMicrons: 25 } }), /no rows between 20 and 25 microns/u);
    await assert.rejects(loadBareRockEclipse(root, { ...recipe, band: { ...recipe.band, encoding: 'grism' } }), /Unknown band encoding grism/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a measured day side is one temperature over the hemisphere under the star, and nothing on the night side', async () => {
  const { mkdtemp, mkdir, rm, writeFile } = await import('node:fs/promises'), { tmpdir } = await import('node:os'), { join } = await import('node:path');
  const { loadMeasuredDayside } = await import('@cssearth/bake/objects/raster');
  const root = await mkdtemp(join(tmpdir(), 'dayside-'));
  try {
    await mkdir(join(root, 'photometry'), { recursive: true });
    const record = { schema: 'cssearth-dayside-temperature@1', planet: 'wasp-80b', temperatureK: { value: 888, lower: 831, upper: 946 }, wavelengthMicrons: 4.5, source: 'test' };
    await writeFile(join(root, 'photometry/dayside-temperature.json'), JSON.stringify(record));
    const recipe = { format: 'measured-dayside', path: 'photometry/dayside-temperature.json', sampling: 'bilinear', units: 'K', planet: 'wasp-80b' };
    const day = await loadMeasuredDayside(root, recipe);
    assert.deepEqual([day.sample(0, 0), day.sample(89, 0), day.sample(-60, 70), day.sample(91, 0), day.sample(180, 0), day.sample(0, 91)], [888, 888, 888, null, null, null]);
    assert.deepEqual(day.report, { format: 'measured-dayside', units: 'K', daysideK: 888, daysideRangeK: [831, 946], wavelengthMicrons: 4.5 });
    await assert.rejects(loadMeasuredDayside(root, { ...recipe, planet: 'wasp-69b' }), /is not a dayside temperature of wasp-69b/u);
    await writeFile(join(root, 'photometry/dayside-temperature.json'), JSON.stringify({ ...record, temperatureK: { value: 888, lower: 900, upper: 946 } }));
    await assert.rejects(loadMeasuredDayside(root, recipe), /needs 0 < lower <= value <= upper/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});
