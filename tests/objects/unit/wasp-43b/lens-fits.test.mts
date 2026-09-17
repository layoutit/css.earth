/** The NIRSpec refit and MIRI lenses are fitted at preparation time from the recipes in source/preparation/raster.json. These checks
 * run those recipes as shipped and hold them to what they were measured to give, to the published light-curve fit, and to the
 * published dayside and nightside temperatures; the deposit check records how the published temperature maps were converted. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { planckRadiance } from '../../../../tools/objects/eclipse-map/eigenmap-fit.mts';
import { bandTemperatureTable, hemisphereTemperature } from '../../../../tools/objects/eclipse-map/light-curve-map.mts';
import { loadEclipseMapFit } from '../../../../tools/objects/terrestrial-layers/eclipse-map-fit.mts';
import { readTarMember } from '../../../../tools/objects/terrestrial-layers/tar-member.mts';
import { readNpyObject } from '../../../../tools/objects/terrestrial-layers/npy-pickle.mts';
import { npyArrayAt } from '../../../../tools/objects/terrestrial-layers/npy-dictionary-map.mts';

const source = resolve(import.meta.dirname, '../../../../src/objects/wasp-43b/source');
const recipe = async (id: string) => {
  const raster = JSON.parse(await readFile(resolve(source, 'preparation/raster.json'), 'utf8')) as { surfaces: { id: string; science: unknown }[] };
  const surface = raster.surfaces.find(entry => entry.id === id);
  assert.ok(surface, `raster.json has no ${id} surface`);
  return surface.science;
};
const lens = async (id: string) => {
  const map = await loadEclipseMapFit(source, await recipe(id)), table = bandTemperatureTable(map.band);
  const hemisphere = (centre: number) => hemisphereTemperature(map.fit.basis, map.fit.fit, table, map.radiusRatio, centre).temperature;
  return { map, table, day: hemisphere(0), night: hemisphere(180) };
};
const near = (actual: number, expected: number, tolerance: number, label: string) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual}, expected ${expected} ± ${tolerance}`);

test('the deposited NRS1 and NRS2 temperature maps are single-wavelength conversions with a blackbody star; the white-light map is not', async () => {
  const maps = readNpyObject(readTarMember(await readFile(resolve(source, 'science/challener-2024/wasp-43b.tar')), 'wasp-43b/maps.npy'));
  const cells = (key: string) => {
    const flux = npyArrayAt(maps, [key, 'fmap']).data as Float64Array, temperature = npyArrayAt(maps, [key, 'tmap']).data as Float64Array;
    return Array.from(flux.keys()).filter(i => flux[i]! > 0 && Number.isFinite(temperature[i]!)).map(i => ({ flux: flux[i]!, temperature: temperature[i]! }));
  };
  // At one wavelength, B(lambda, T) / flux is the same in every cell: pi B_star (1 + s_corr) / rp^2. Its spread measures how far a
  // map is from that conversion, and its value gives the star's intensity there.
  const constant = (key: string, wavelength: number) => {
    const logs = cells(key).map(cell => Math.log(planckRadiance(wavelength, cell.temperature) / cell.flux)), mean = logs.reduce((s, v) => s + v, 0) / logs.length;
    return { spread: Math.sqrt(logs.reduce((s, v) => s + (v - mean) ** 2, 0) / logs.length), star: Math.exp(mean) * 0.15883 ** 2 / Math.PI };
  };
  // Measured 2026-09-17 by scanning wavelength: NRS1 3.1551 um (spread 2.7e-7), NRS2 4.466 um (1.4e-6), white light at best 1.2e-2.
  const nrs1 = constant('nrs1', 3.1551), nrs2 = constant('nrs2', 4.466);
  assert.ok(nrs1.spread < 1e-5 && nrs2.spread < 1e-5, `spreads ${nrs1.spread}, ${nrs2.spread}`);
  // Both imply the same multiple of a 4520 K blackbody (Table 1's stellar temperature), 1.036 and 1.035: a blackbody star. The paper
  // describes a PHOENIX spectrum; a model spectrum would not give one multiple (BT-Settl 4500 K sits 8% above that blackbody at
  // 3.16 um and 14% below it at 4.47 um, measured 2026-09-17).
  const ratio1 = nrs1.star / planckRadiance(3.1551, 4520), ratio2 = nrs2.star / planckRadiance(4.466, 4520);
  near(ratio1, 1.036, 0.002, 'NRS1 star over a 4520 K blackbody'); near(ratio2, 1.0345, 0.002, 'NRS2 star over a 4520 K blackbody');
  for (let wavelength = 2.9; wavelength <= 5.2; wavelength += 0.005) assert.ok(constant('whitelight', wavelength).spread > 0.01, `white light at ${wavelength} um`);
});

test('the NIRSpec refit reproduces the in-house fit of the deposited curve and runs about 80 K cooler than the deposit where it converts differently', async () => {
  const { map, table, day, night } = await lens('nirspec-refit');
  // Measured 2026-09-17: degree 3, 6 eigencurves, chi2 8809.56 over 4202 samples, hot spot -2.31, +7.09 (eigenmap-fit.test.mts).
  assert.equal(map.fit.basis.lmax, 3); assert.equal(map.fit.fit.ncurves, 6); assert.equal(map.fit.samples, 4202);
  near(map.fit.fit.chiSquared, 8809.56, 0.05, 'chi2');
  near(map.fit.hotspot.latitude, -2.31, 0.05, 'hot spot latitude'); near(map.fit.hotspot.longitude, 7.09, 0.05, 'hot spot longitude');
  // Measured: dayside 1580 K, nightside 875 K over the G395H band against BT-Settl 4500 K.
  near(day, 1580, 2, 'dayside'); near(night, 875, 2, 'nightside');
  // The deposit's own flux map through this band conversion, against the deposit's temperatures, on the dayside within 60 degrees.
  const maps = readNpyObject(readTarMember(await readFile(resolve(source, 'science/challener-2024/wasp-43b.tar')), 'wasp-43b/maps.npy'));
  const lat = npyArrayAt(maps, ['whitelight', 'lat']).data as Float64Array, lon = npyArrayAt(maps, ['whitelight', 'lon']).data as Float64Array;
  const flux = npyArrayAt(maps, ['whitelight', 'fmap']).data as Float64Array, temperature = npyArrayAt(maps, ['whitelight', 'tmap']).data as Float64Array;
  const differences = Array.from(flux.keys()).filter(i => Math.abs(lat[i]!) < 60 && Math.abs(lon[i]!) < 90 && flux[i]! > 0).map(i => table.temperature(flux[i]!, map.radiusRatio) - temperature[i]!);
  // Measured: -79.8 K mean. BT-Settl is fainter than a blackbody in the CO band near 4.5 um, so the same flux means a cooler planet.
  near(differences.reduce((s, v) => s + v, 0) / differences.length, -79.8, 3, 'deposit flux converted here minus deposit temperature');
});

test('the MIRI white-light lens, from this project\'s own reduction, agrees with the published MIRI dayside and nightside', async () => {
  const { map, day, night } = await lens('miri');
  // Measured 2026-09-17: BIC takes degree 2 with 6 eigencurves (degree 3 with 6 is 0.5 lower, same parameter count), ramp 0.08 d.
  assert.equal(map.fit.basis.lmax, 2); assert.equal(map.fit.fit.ncurves, 6); assert.equal(map.fit.rampTimeConstantDays, 0.08);
  assert.equal(map.fit.samples, 7883); near(map.fit.fit.chiSquared, 11258.4, 0.5, 'chi2');
  near(map.fit.hotspot.longitude, 5.3, 0.2, 'hot spot longitude');
  // Bell et al. (2024): 1524 ± 35 K dayside and 863 ± 23 K nightside over 5-12 um. Measured here over 5-10.5 um: 1527 and 833 K.
  near(day, 1527, 2, 'dayside'); assert.ok(Math.abs(day - 1524) < 35, 'within the published dayside interval');
  near(night, 833, 2, 'nightside'); assert.ok(Math.abs(night - 863) < 2 * 23, 'within twice the published nightside uncertainty');
});

test('the three MIRI slices choose their own models and put the hot spot east of noon in each', async () => {
  // Measured 2026-09-17 (degree, eigencurves, ramp days, dayside K, nightside K, hot spot longitude).
  const expected = { 'miri-band-1': [2, 4, 0.08, 1539, 831, 2.9], 'miri-band-2': [2, 4, 0.16, 1493, 847, 8.4], 'miri-band-3': [2, 4, 0.08, 1565, 914, 8.2] } as const;
  for (const [id, [degree, eigencurves, ramp, dayside, nightside, longitude]] of Object.entries(expected)) {
    const { map, day, night } = await lens(id);
    assert.equal(map.fit.basis.lmax, degree, id); assert.equal(map.fit.fit.ncurves, eigencurves, id); assert.equal(map.fit.rampTimeConstantDays, ramp, id);
    near(day, dayside, 2, `${id} dayside`); near(night, nightside, 2, `${id} nightside`); near(map.fit.hotspot.longitude, longitude, 0.2, `${id} hot spot longitude`);
    assert.ok(map.fit.hotspot.longitude > 0, `${id} hot spot east of noon`);
  }
});
