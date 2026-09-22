/** The MIRI lens is fitted at preparation time from its recipe in source/preparation/raster.json. This check runs the recipe as
 * shipped and holds it to what it was measured to give and to the published dayside and nightside temperatures; the deposit check
 * records how the published NIRSpec temperature maps were converted. */
import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('wasp-43b');
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { planckRadiance } from '../../../../tools/objects/eclipse-map/eigenmap-fit.mts';
import { bandTemperatureTable, hemisphereTemperature, meridionalOffset } from '../../../../tools/objects/eclipse-map/light-curve-map.mts';
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

test('the MIRI white-light lens, from this project\'s own reduction, agrees with the published MIRI dayside and nightside', async () => {
  const { map, day, night } = await lens('miri');
  // Measured 2026-09-17: the transit comes 19.5 s before the package ephemeris; BIC takes degree 2 with 6 eigencurves (degree 3 with 6 is
  // within 2, same parameter count); the ramp's time constant refines to 0.1048 d from the 0.08 d grid value.
  near(map.transitShiftSeconds, -19.5, 1, 'transit timing');
  assert.equal(map.fit.basis.lmax, 2); assert.equal(map.fit.fit.ncurves, 6); near(map.fit.rampTimeConstantDays!, 0.1048, 0.002, 'ramp time constant');
  assert.equal(map.fit.samples, 7884); near(map.fit.fit.chiSquared, 11250.3, 0.5, 'chi2');
  // Hammond et al. (2024)'s longitudinal offset (meridional, cos-latitude weighted) and the map's own hottest point.
  near(meridionalOffset(map.fit.basis, map.fit.fit), 6.2, 0.1, 'meridional offset'); near(map.fit.hotspot.longitude, 5.84, 0.1, 'hot spot longitude');
  // Bell et al. (2024): 1524 ± 35 K dayside and 863 ± 23 K nightside over 5-12 um. Measured here over 5-10.5 um: 1527 and 840 K.
  near(day, 1527, 2, 'dayside'); assert.ok(Math.abs(day - 1524) < 35, 'within the published dayside interval');
  near(night, 840, 2, 'nightside'); assert.ok(Math.abs(night - 863) < 23 * 1.1, 'about one published nightside uncertainty below');
});
