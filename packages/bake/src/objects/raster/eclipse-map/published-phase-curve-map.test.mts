import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { planckRadiance, mapPhaseCurve, mirrorGrid, type EmissionGrid, phaseCurveBrightnessTemperature as brightnessTemperature, depositedChannelWeights, impliedStellarTemperature, loadPublishedPhaseCurveMap, parsePublishedPhaseCurve, parseStarryPhaseCurve, sinusoidMap } from '@cssearth/bake/objects/raster';
import { hostedOrbit, starAstrometry } from '@cssearth/astronomy';
import { starryMapGrid, starrySystemFlux } from '@cssearth/telescope/node';

const test = sourceTest();
const objects = new URL('../../../../../../src/objects/', import.meta.url);
const record = async (path: string) => parsePublishedPhaseCurve(JSON.parse(await readFile(new URL(path, objects), 'utf8')));

test('the Cowan & Agol map, integrated over the visible hemisphere, gives back the light curve it came from', async () => {
  const kelt = await record('kelt-9b/source/science/mansfield-2020/phase-curve.json');
  if (kelt.model.kind !== 'two-term-sinusoid') throw new TypeError('KELT-9b is a two-term sinusoid.');
  const { flux, slice } = sinusoidMap(kelt.model, kelt.eclipseDepth);
  // Cowan & Agol (2008), their equation 4: F(xi) is J(phi) cos(phi + xi) over the hemisphere that faces the observer, integrated
  // here by the midpoint rule, independently of equation 5's coefficients.
  const convolve = (xi: number, steps = 20000) => {
    let sum = 0; const from = -xi - Math.PI / 2, step = Math.PI / steps;
    for (let i = 0; i < steps; i++) { const phi = from + (i + 0.5) * step; sum += slice(phi * 180 / Math.PI) * Math.cos(phi + xi) * step; }
    return sum;
  };
  for (const degrees of [-180, -120, -60, -16.5, 0, 45, 90, 150]) {
    const xi = degrees * Math.PI / 180;
    assert.ok(Math.abs(convolve(xi) - flux(xi)) < 1e-9, `${degrees} degrees: ${convolve(xi)} vs ${flux(xi)}`);
  }
  assert.ok(Math.abs(flux(0) - kelt.eclipseDepth) < 1e-15, 'the planet shows its eclipse depth at mid-eclipse');
});

test('brightness temperature inverts the Planck ratio, and the implied star temperature returns the paper\'s day side', () => {
  for (const [starK, planetK] of [[7942, 4566], [5695, 1259], [10000, 300]] as const) {
    const ratio = planckRadiance(4.5, planetK) / planckRadiance(4.5, starK);
    assert.ok(Math.abs(brightnessTemperature(ratio, starK, 4.5)! - planetK) < 1e-6);
  }
  assert.equal(brightnessTemperature(0, 6000, 4.5), null);
  assert.equal(brightnessTemperature(-1e-4, 6000, 4.5), null);
  const star = impliedStellarTemperature(0.003131, 0.08004, 4566, 4.5);
  assert.ok(Math.abs(0.08004 ** 2 * planckRadiance(4.5, 4566) / planckRadiance(4.5, star) - 0.003131) < 1e-12);
});

test('KELT-9b: Mansfield et al. (2020)\'s sinusoids reproduce their amplitude, night side and hottest hemisphere', async () => {
  const map = await loadPublishedPhaseCurveMap(new URL('kelt-9b/source', objects).pathname, { path: 'science/mansfield-2020/phase-curve.json' });
  const { derived, stellarBandTemperatureK } = map.report as unknown as { derived: Record<string, number>; stellarBandTemperatureK: number };
  // Table 1: amplitude 0.609 +/- 0.020, night side 2556 +101/-97 K, hottest hemisphere 4636 +145/-138 K.
  assert.ok(Math.abs(derived.amplitude! - 0.609) <= 0.020, `amplitude ${derived.amplitude}`);
  assert.ok(Math.abs(derived.nightsideK! - 2556) <= 97, `night side ${derived.nightsideK}`);
  assert.ok(Math.abs(derived.hottestHemisphereK! - 4636) <= 138, `hottest hemisphere ${derived.hottestHemisphereK}`);
  assert.ok(Math.abs(derived.daysideK! - 4566) < 1e-6);
  // The curve peaks 16.5 degrees before eclipse; Table 1 gives 18.7 +2.1/-2.3. The difference is inside the lower bound.
  assert.ok(Math.abs(derived.peakDegreesBeforeEclipse! - 16.48) < 0.01 && 18.7 - derived.peakDegreesBeforeEclipse! <= 2.3);
  // The 8287 K the paper uses in its energy-balance model (section 5) is not the conversion behind its day and night values.
  assert.ok(Math.abs(stellarBandTemperatureK - 7941.9) < 0.1);
  // Every latitude is drawn alike, and the hottest longitude is east of noon.
  assert.equal(map.sample(20, 60), map.sample(20, -60));
  let hottest = -180, peak = -Infinity;
  for (let lon = -180; lon < 180; lon += 0.1) { const t = map.sample(lon, 0)!; if (t > peak) { peak = t; hottest = lon; } }
  assert.ok(hottest > 10 && hottest < 30, `hottest longitude ${hottest}`);
});

test('HD 209458b: Zellem et al. (2014)\'s c1 and c2, counted from transit, give back their Table 2 curve and Table 3 temperatures', async () => {
  const path = 'science/zellem-2014/phase-curve.json', source = new URL('hd-209458b/source/', objects);
  const raw = JSON.parse(await readFile(new URL(path, source), 'utf8')) as { reported: Record<string, { value: number }> };
  const zellem = parsePublishedPhaseCurve(raw);
  if (zellem.model.kind !== 'fourier-from-transit') throw new TypeError('HD 209458b is a Fourier series counted from transit.');
  const { flux, slice } = sinusoidMap(zellem.model, zellem.eclipseDepth);
  // The Cowan & Agol map, integrated over the visible hemisphere, gives the curve back (their equation 4, midpoint rule).
  for (const degrees of [-150, -40.8, 0, 90, 139.2]) {
    const xi = degrees * Math.PI / 180, steps = 20000, from = -xi - Math.PI / 2, step = Math.PI / steps;
    let sum = 0; for (let i = 0; i < steps; i++) { const phi = from + (i + 0.5) * step; sum += slice(phi * 180 / Math.PI) * Math.cos(phi + xi) * step; }
    assert.ok(Math.abs(sum - flux(xi)) < 1e-9, `${degrees} degrees: ${sum} vs ${flux(xi)}`);
  }
  // Table 2: the planet's flux peaks at 1.001527 - 1 and bottoms at 1.000443 - 1 (star = 1), 40.9 +/- 6.0 degrees before eclipse and transit.
  const map = await loadPublishedPhaseCurveMap(source.pathname, { path });
  const { derived, stellarBandTemperatureK } = map.report as unknown as { derived: Record<string, number>; stellarBandTemperatureK: number };
  let max = -Infinity, min = Infinity;
  for (let i = 0; i < 36000; i++) { const f = flux(-Math.PI + 2 * Math.PI * i / 36000); max = Math.max(max, f); min = Math.min(min, f); }
  assert.ok(Math.abs(max - (raw.reported.maximumFlux!.value - 1)) <= 0.000036, `maximum ${max}`);
  assert.ok(Math.abs(min - (raw.reported.minimumFlux!.value - 1)) <= 0.000067, `minimum ${min}`);
  assert.ok(Math.abs(derived.peakDegreesBeforeEclipse! - 40.9) <= 6.0 && Math.abs(derived.peakDegreesBeforeEclipse! - 40.81) < 0.01, `peak ${derived.peakDegreesBeforeEclipse}`);
  assert.ok(Math.abs(derived.troughDegreesBeforeTransit! - 40.81) < 0.01, `trough ${derived.troughDegreesBeforeTransit}`);
  // Table 3: the second eclipse (1443 K) sets the star; the curve's maximum and minimum then give 1499 +/- 15 K and 972 +/- 44 K.
  assert.ok(Math.abs(derived.daysideK! - 1443) < 1e-6);
  assert.ok(Math.abs(derived.hottestHemisphereK! - 1499) <= 15, `hottest hemisphere ${derived.hottestHemisphereK}`);
  assert.ok(Math.abs(derived.coldestHemisphereK! - 972) <= 44, `coldest hemisphere ${derived.coldestHemisphereK}`);
  assert.ok(Math.abs(stellarBandTemperatureK - 5587.6) < 0.1, `star ${stellarBandTemperatureK}`);
  // A first-order map: its hottest longitude is the curve's offset, east of noon, and every latitude is drawn alike.
  let hottest = -180, peak = -Infinity;
  for (let lon = -180; lon < 180; lon += 0.1) { const t = map.sample(lon, 0)!; if (t > peak) { peak = t; hottest = lon; } }
  assert.ok(Math.abs(hottest - 40.8) < 0.11, `hottest longitude ${hottest}`);
  assert.equal(map.sample(-120, 45), map.sample(-120, -45));
});

test('WASP-12b: Bell et al. (2019)\'s two 3.6 µm visits give their table\'s day and night sides and peaks on opposite sides of noon', async () => {
  const source = new URL('wasp-12b/source/', objects);
  // Table A2, fiducial PLD first-order fits: night side 1510 +/- 210 K (2010) and 1760 +/- 97 K (2013); offsets 32.6 +/- 6.2 degrees
  // before eclipse (2010) and 13.6 +/- 3.8 after (2013).
  for (const [year, nightK, nightError, offset, offsetError] of [[2010, 1510, 210, 32.6, 6.2], [2013, 1760, 97, -13.6, 3.8]] as const) {
    const map = await loadPublishedPhaseCurveMap(source.pathname, { path: `science/bell-2019/phase-curve-${year}.json` });
    const { derived, stellarBandTemperatureK } = map.report as unknown as { derived: Record<string, number>; stellarBandTemperatureK: number };
    assert.ok(Math.abs(derived.nightsideK! - nightK) <= nightError, `${year} night side ${derived.nightsideK}`);
    assert.ok(Math.abs(derived.daysideK! - (year === 2010 ? 2744 : 2813)) < 1e-6, `${year} day side`);
    assert.ok(Math.abs(derived.peakDegreesBeforeEclipse! - offset) <= offsetError, `${year} peak ${derived.peakDegreesBeforeEclipse}`);
    // SPCA's first-order offset is -atan2(D1, C1) (Bell et al. 2021, section 4.1); the curve's peak is that same angle.
    const record = parsePublishedPhaseCurve(JSON.parse(await readFile(new URL(`science/bell-2019/phase-curve-${year}.json`, source), 'utf8')));
    if (record.model.kind !== 'eclipse-normalized-fourier') throw new TypeError('WASP-12b is an eclipse-normalized Fourier fit.');
    assert.ok(Math.abs(derived.peakDegreesBeforeEclipse! + Math.atan2(record.model.d1, record.model.c1) * 180 / Math.PI) < 0.01);
    // The table's 3.6 µm day and night sides follow a star near 6,030 K, not the 5,800 K appendix B prints for 3.6 µm (README).
    assert.ok(Math.abs(stellarBandTemperatureK - 6032) < 1.5, `${year} star ${stellarBandTemperatureK}`);
    const east = map.sample(30, 0)!, west = map.sample(-30, 0)!;
    assert.ok(year === 2010 ? east > west : west > east, `${year}: 30 degrees east ${east} K, west ${west} K`);
  }
});

test('WASP-76b: SPIDERMAN evaluates May et al. (2021)\'s dipole to their day side and near their night side', async () => {
  const map = await loadPublishedPhaseCurveMap(new URL('wasp-76b/source', objects).pathname, { path: 'science/may-2021/phase-curve.json' });
  const report = map.report as unknown as { spiderman: string; derived: Record<string, number> };
  assert.equal(report.spiderman, '1.0.3');
  const { derived } = report;
  // Section 3.3: eclipse depth 3729 +/- 52 ppm and day side 2699 +/- 32 K after the dilution correction.
  assert.ok(Math.abs(derived.daysideFlux! - 0.003729) <= 0.000052, `day side flux ${derived.daysideFlux}`);
  assert.ok(Math.abs(derived.daysideK! - 2699) <= 32, `day side ${derived.daysideK}`);
  // Night side 1259 +/- 44 K: the table's two-digit coefficients give 1185 K, 1.7 standard deviations colder (README, Known problems).
  assert.ok(derived.nightsideK! > 1259 - 2 * 44 && derived.nightsideK! < 1259, `night side ${derived.nightsideK}`);
  // A dipole centred on the substellar point: no longitude offset in the curve, the same temperature east and west of noon.
  assert.ok(Math.abs(derived.peakDegreesAfterEclipse!) < 0.01);
  assert.ok(Math.abs(map.sample(40, 0)! - map.sample(-40, 0)!) < 1e-6);
  // Around the antistellar point the fitted dipole is below zero; those cells have no temperature.
  assert.equal(map.sample(180, 0), null);
  assert.ok(derived.nonPositiveAreaFraction! > 0.02 && derived.nonPositiveAreaFraction! < 0.05);
});

const wasp121b = new URL('wasp-121b/source/', objects).pathname, evansSoma = (name: string) => `${wasp121b}science/evans-soma-2025/${name}`;
const depositedRows = async (path: string) => (await readFile(path, 'utf8')).split('\n').filter(line => line.trim() && !line.startsWith('#')).map(line => line.trim().split(/\s+/u).map(Number));
const rms = (model: ArrayLike<number>, data: readonly number[], use: (index: number) => boolean = () => true) => {
  let sum = 0, n = 0; data.forEach((value, i) => { if (use(i)) { sum += (model[i]! - value) ** 2; n++; } }); return Math.sqrt(sum / n);
};

test('WASP-121b: starry turns Evans-Soma et al. (2025)\'s table values into their deposited model light curves, and the package orbit agrees east of noon', async () => {
  for (const detector of ['nrs1', 'nrs2']) {
    // The authors' deposited white light curve models: time (BJD_TDB), systematics, and the starry star-plus-planet flux.
    const deposited = await depositedRows(evansSoma(`whitelc_model_${detector}.txt`)), times = deposited.map(row => row[0]!), physical = deposited.map(row => row[2]!);
    const { model, radiusRatio } = parseStarryPhaseCurve(JSON.parse(await readFile(evansSoma(`phase-curve-${detector}.json`), 'utf8')));
    // Measured 2026-09-23: 1.13 ppm rms (NRS1) and 1.40 ppm (NRS2) with the offset turning the map east; turned west, 129 and 119 ppm.
    const flux = starrySystemFlux(model.map, model.system, times);
    const west = starrySystemFlux(model.map, { ...model.system, orbit: { ...model.system.orbit, theta0Degrees: 180 - model.offsetDegrees } }, times);
    assert.ok(rms(flux, physical) < 2e-6, `${detector}: ${rms(flux, physical)}`);
    assert.ok(rms(west, physical) > 100e-6, `${detector} mirrored: ${rms(west, physical)}`);
    // The map as this package draws it (longitude east of the substellar point) through the package's own orbit and synchronous rotation.
    const latitudes: number[] = [], longitudes: number[] = [];
    for (let lat = -89.5; lat < 90; lat++) latitudes.push(lat);
    for (let lon = -179.5; lon < 180; lon++) longitudes.push(lon);
    const intensity = starryMapGrid(model.map, latitudes, longitudes.map(lon => lon - model.offsetDegrees)).values;
    const cells = latitudes.length * longitudes.length;
    const grid: EmissionGrid = { width: longitudes.length, height: latitudes.length, values: Float64Array.from({ length: cells }, (_, i) => intensity[Math.floor(i / longitudes.length)]![i % longitudes.length]!),
      latitudes: Float64Array.from({ length: cells }, (_, i) => latitudes[Math.floor(i / longitudes.length)]!), longitudes: Float64Array.from({ length: cells }, (_, i) => longitudes[i % longitudes.length]!) };
    const orbit = hostedOrbit('wasp-121b' as never), host = starAstrometry('wasp-121' as never), bmjd = times.map(time => time - 2400000.5);
    // Away from transit, where the deposited model carries the star's own dip, the planet's flux is the model minus the star's 1.
    const outOfTransit = (i: number) => { const phase = (((bmjd[i]! - orbit.transitTimeBmjdTdb) / orbit.periodDays) % 1 + 1) % 1; return phase > 0.06 && phase < 0.94; };
    const planet = physical.map(value => value - 1);
    const east = mapPhaseCurve(grid, orbit, host, radiusRatio, bmjd), mirrored = mapPhaseCurve(mirrorGrid(grid, 'longitude'), orbit, host, radiusRatio, bmjd);
    // Measured 2026-09-23: 0.75 ppm rms (NRS1) and 1.52 ppm (NRS2); mirrored east-west, 135 and 124 ppm.
    assert.ok(rms(east, planet, outOfTransit) < 2e-6, `${detector} east: ${rms(east, planet, outOfTransit)}`);
    assert.ok(rms(mirrored, planet, outOfTransit) > 100e-6, `${detector} mirrored: ${rms(mirrored, planet, outOfTransit)}`);
  }
});

test('WASP-121b: the deposited spectra give each channel one conversion at every phase, and the maps peak just east of noon', async () => {
  for (const [detector, channels, hottestK, offset, grey] of [['nrs1', 146, 3096, 3, 0.142], ['nrs2', 203, 3136, 2, 0.068]] as const) {
    const record = parseStarryPhaseCurve(JSON.parse(await readFile(evansSoma(`phase-curve-${detector}.json`), 'utf8')));
    const weights = await depositedChannelWeights(wasp121b, record.conversion);
    assert.equal(weights.channels.length, channels);
    assert.equal(weights.phaseBins, 36);
    // (Fp/Fs) / B(T_b) is the same at all 36 phase bins to within the authors' whole-kelvin rounding (measured: at most 0.66 %).
    assert.ok(weights.channels.every(channel => channel.spread < 0.01), `${detector} spread`);
    const map = await loadPublishedPhaseCurveMap(wasp121b, { path: `science/evans-soma-2025/phase-curve-${detector}.json` });
    const derived = (map.report as unknown as { derived: { hottest: { kelvin: number; longitude: number; latitude: number }; nonPositiveAreaFraction: number } }).derived;
    assert.ok(Math.abs(derived.hottest.kelvin - hottestK) < 1, `${detector} hottest ${derived.hottest.kelvin}`);
    assert.equal(derived.hottest.longitude, offset, 'the hotspot is the nearest grid longitude east of noon to the fitted offset');
    assert.equal(derived.hottest.latitude, 0);
    // East of noon is warmer than the same distance west; around the antistellar point the dipole is below zero and has no temperature.
    assert.ok(map.sample(90, 0)! > map.sample(-90, 0)!);
    assert.equal(map.sample(180, 0), null);
    assert.ok(Math.abs(derived.nonPositiveAreaFraction - grey) < 0.001, `${detector} grey ${derived.nonPositiveAreaFraction}`);
  }
});

/** A `cssearth-published-phase-curve@1` record held in the test: each number is a table cell. */
const tableCell = (value: number, where: string) => ({ value, cell: String(value), where });

test('HD 189733b: Knutson et al. (2012)\'s second-order terms, counted from transit, give back their eq. 4 curve and Table 1 offsets', () => {
  // Table 1 and section 4.2 at 3.6 and 4.5 µm; the maximum is timed from mid-eclipse and the minimum from mid-transit, in hours.
  // At 3.6 µm the printed c2 puts both extremes after eclipse and transit, against the offsets the paper states three times, so only
  // its eq. 4 identity is held here; which sign to draw is the planet package's decision.
  const periodHours = 2.21857 * 24;
  for (const band of [
    { microns: 3.6, c: [-0.000479, -0.000389, 0.000025, -0.000020], k: 0.15511, depth: 0.001466, dayK: 1328, maxHours: -5.29, maxError: 0.59, minHours: -6.43, minError: 0.82, offsets: false },
    { microns: 4.5, c: [-0.000468, 0.000122, -0.000011, -0.000020], k: 0.15580, depth: 0.001787, dayK: 1192, maxHours: -2.98, maxError: 0.82, minHours: -1.37, minError: 1.00, offsets: true },
  ]) {
    const record = parsePublishedPhaseCurve({ schema: 'cssearth-published-phase-curve@1', source: 'Knutson et al. (2012), Table 1', wavelengthMicrons: band.microns,
      radiusRatio: tableCell(band.k, 'Rp/R*'), eclipseDepth: tableCell(band.depth, 'section 4.2'),
      model: { kind: 'fourier-from-transit', cos1: tableCell(band.c[0]!, 'c1'), sin1: tableCell(band.c[1]!, 'c2'), cos2: tableCell(band.c[2]!, 'c3'), sin2: tableCell(band.c[3]!, 'c4') },
      reported: { daysideK: tableCell(band.dayK, 'section 4.2'), offsetDegrees: tableCell(band.maxHours / periodHours * 360, 'Maximum flux offset') } });
    if (record.model.kind !== 'fourier-from-transit') throw new TypeError('Knutson et al. count from transit.');
    const { flux } = sinusoidMap(record.model, record.eclipseDepth);
    // Their eq. 4, in the angle from transit theta = xi + pi, differs from the model only by the constant the paper does not print.
    const [c1, c2, c3, c4] = band.c as [number, number, number, number];
    const knutson = (theta: number) => c1 * Math.cos(theta) + c2 * Math.sin(theta) + c3 * Math.cos(2 * theta) + c4 * Math.sin(2 * theta);
    for (const degrees of [-150, -90, -35, 0, 40, 120]) {
      const xi = degrees * Math.PI / 180;
      assert.ok(Math.abs(flux(xi) - flux(0) - (knutson(xi + Math.PI) - knutson(Math.PI))) < 1e-15, `${band.microns} µm at ${degrees} degrees`);
    }
    if (!band.offsets) continue;
    let peak = 0, trough = 0;
    for (let i = 0, top = -Infinity, bottom = Infinity; i < 72000; i++) {
      const xi = -Math.PI + 2 * Math.PI * i / 72000, f = flux(xi);
      if (f > top) { top = f; peak = xi; }
      if (f < bottom) { bottom = f; trough = xi; }
    }
    const maxHours = peak / (2 * Math.PI) * periodHours, minHours = (trough < 0 ? trough + Math.PI : trough - Math.PI) / (2 * Math.PI) * periodHours;
    assert.ok(Math.abs(maxHours - band.maxHours) <= band.maxError, `${band.microns} µm maximum at ${maxHours} h`);
    assert.ok(Math.abs(minHours - band.minHours) <= band.minError, `${band.microns} µm minimum at ${minHours} h`);
  }
});

test('GJ 1214b: Kempton et al. (2023)\'s terms, in the star\'s flux from eclipse, give their eq. 7 map, deposited night side and 5-12 µm day side', async () => {
  // Extended Data Table 1, 5.0-12.0 µm, in ppm; Methods eq. 5. Rp/R* 0.1161 and the white-light result are the authors' Zenodo 7703086.
  const [E, C1, D1, C2, D2] = [379e-6, 127e-6, -139e-6, 46e-6, -15e-6];
  const raw = { schema: 'cssearth-published-phase-curve@1', source: 'Kempton et al. (2023), Extended Data Table 1', bandMicrons: [5, 12],
    radiusRatio: tableCell(0.1161, 'Generate plots.ipynb, RpRs'), eclipseDepth: tableCell(E, 'E'),
    model: { kind: 'eclipse-fourier', c1: tableCell(C1, 'C1'), d1: tableCell(D1, 'D1'), c2: tableCell(C2, 'C2'), d2: tableCell(D2, 'D2') },
    reported: { daysideK: tableCell(553, 'MIRI 5-12 µm secondary eclipse'), offsetDegrees: tableCell(-47.68, 'white_light_result.txt, phi_med: the phase of the first-order term') } };
  const record = parsePublishedPhaseCurve(raw);
  if (record.model.kind !== 'eclipse-fourier') throw new TypeError('Kempton et al. write the terms in the star\'s flux.');
  const { map, flux } = sinusoidMap(record.model, record.eclipseDepth);
  // Their eq. 7: A0 = (Fp - C1 - C2)/2, A1 = 2 C1/pi, B1 = -2 D1/pi, A2 = 3 C2/2, B2 = -3 D2/2.
  const printed = { a0: (E - C1 - C2) / 2, a1: 2 * C1 / Math.PI, b1: -2 * D1 / Math.PI, a2: 3 * C2 / 2, b2: -3 * D2 / 2 };
  for (const key of Object.keys(printed) as (keyof typeof printed)[]) assert.ok(Math.abs(map[key] - printed[key]) < 1e-18, key);
  // The deposited white-light night side is 125.4 +16.1/-15.4 ppm.
  assert.ok(Math.abs(flux(Math.PI) - 125.4e-6) <= 15.4e-6, `night side ${flux(Math.PI)}`);
  const directory = await mkdtemp(join(tmpdir(), 'gj-1214b-'));
  try {
    await writeFile(join(directory, 'phase-curve.json'), JSON.stringify(raw));
    const loaded = await loadPublishedPhaseCurveMap(directory, { path: 'phase-curve.json' });
    const { derived, bandMicrons } = loaded.report as unknown as { derived: Record<string, number>; bandMicrons: number[] };
    assert.deepEqual(bandMicrons, [5, 12]);
    assert.ok(Math.abs(derived.daysideK! - 553) < 1e-3, `day side ${derived.daysideK}`);
    // The night side's own spectrum averages 437 +/- 19 K; the white light, converted across the band, agrees.
    assert.ok(Math.abs(derived.nightsideK! - 437) <= 19, `night side ${derived.nightsideK}`);
    // Across 5-12 µm one wavelength will not do: at the band centre the same night side reads 12 K colder, beyond the day side's 9 K error.
    const centre = impliedStellarTemperature(E, 0.1161, 553, 8.5), single = brightnessTemperature(flux(Math.PI) / 0.1161 ** 2, centre, 8.5)!;
    assert.ok(derived.nightsideK! - single > 9, `one wavelength ${single} vs band ${derived.nightsideK}`);
    // Their Figure 2 shows longitudes where the map's emission is negative, in black; the map leaves them without a temperature.
    assert.ok(Array.from({ length: 360 }, (_, i) => loaded.sample(i - 180, 0)).some(value => value === null), 'some longitudes have no emission');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a published phase curve gives one wavelength or one band', () => {
  const base = { schema: 'cssearth-published-phase-curve@1', source: 's', radiusRatio: tableCell(0.1, 'k'), eclipseDepth: tableCell(1e-3, 'E'),
    model: { kind: 'eclipse-fourier', c1: tableCell(1e-4, 'C1'), d1: tableCell(0, 'D1') }, reported: { daysideK: tableCell(1000, 'T'), offsetDegrees: tableCell(0, 'o') } };
  assert.throws(() => parsePublishedPhaseCurve(base), /wavelengthMicrons or bandMicrons/u);
  assert.throws(() => parsePublishedPhaseCurve({ ...base, wavelengthMicrons: 4.5, bandMicrons: [3, 5] }), /wavelengthMicrons or bandMicrons/u);
  assert.throws(() => parsePublishedPhaseCurve({ ...base, bandMicrons: [5, 3] }), /lower and a higher/u);
  const first = parsePublishedPhaseCurve({ ...base, bandMicrons: [3, 5] });
  assert.deepEqual(first.model, { kind: 'eclipse-fourier', c1: 1e-4, d1: 0, c2: 0, d2: 0 }, 'a first-order fit has zero second-order terms');
});
